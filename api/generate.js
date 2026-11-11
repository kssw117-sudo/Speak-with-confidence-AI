
// ===================================================================
// Защита доступа и лимитов -- на сервере, очисткой кэша не обходится.
// - Код доступа проверяется: общий (ACCESS_CODE) или уникальный из списка
//   ../appsumo/codes.json (выдуманный код не пройдёт).
// - Пробные генерации: 3 на IP-адрес на 30 дней.
// - Лимит: 50 генераций в день на уникальный код; для общего кода --
//   50 в день на каждый IP-адрес (покупатели не делят один лимит).
// - Неудачная генерация не списывается.
// - Лимиты работают, когда к проекту подключена база Upstash Redis
//   (переменные UPSTASH_REDIS_REST_KV_REST_API_URL / _TOKEN). Без неё
//   проверка кода всё равно работает, а лимиты просто не считаются.
// ===================================================================
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);

const GUARD = { product: 'swc', daily: 50, trialMax: 3 };
const TRIAL_TTL = 30 * 24 * 3600;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

async function redis(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error(`redis http ${r.status}`);
  const data = await r.json();
  return data.map(item => { if (item.error) throw new Error(item.error); return item.result; });
}

let codeSet = null;
function knownCodes() {
  if (codeSet) return codeSet;
  try {
    const list = []; // у этого продукта пока только общий код
    const arr = Array.isArray(list) ? list : Object.values(list).flat();
    codeSet = new Set(arr.map(c => String(c && typeof c === 'object' ? c.code : c).trim().toUpperCase()));
  } catch (e) {
    console.error('Could not load codes list:', e.message);
    codeSet = new Set();
  }
  return codeSet;
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '') || 'unknown';
}

// Счётчик с лимитом: +1, если превышен -- откат. Возвращает { ok, used, refund }.
async function takeOne(key, max, ttl) {
  const [n] = await redis([['INCR', key]]);
  if (n === 1) await redis([['EXPIRE', key, ttl]]);
  if (n > max) {
    await redis([['DECR', key]]);
    return { ok: false, used: max };
  }
  return { ok: true, used: n, refund: async () => { try { await redis([['DECR', key]]); } catch (e) {} } };
}

const noRefund = async () => {};

async function guard(req, licenseCode, wantsTrial) {
  const code = typeof licenseCode === 'string' ? licenseCode.trim().toUpperCase() : '';
  const sharedCode = String(process.env.ACCESS_CODE || '').trim().toUpperCase();
  const shared = Boolean(code) && Boolean(sharedCode) && code === sharedCode;
  const unique = !shared && Boolean(code) && knownCodes().has(code);
  const redisOn = Boolean(REDIS_URL && REDIS_TOKEN);
  const ip = clientIp(req);
  const p = GUARD.product;

  if (!shared && !unique) {
    if (code || !wantsTrial) {
      return { ok: false, status: 403, body: { error: 'Invalid access code.', code: 'invalid_code' } };
    }
    if (!redisOn) return { ok: true, refund: noRefund };
    try {
      const t = await takeOne(`${p}:trial:${ip}`, GUARD.trialMax, TRIAL_TTL);
      if (!t.ok) {
        return { ok: false, status: 403, body: { error: 'Your free preview is used. Enter your access code to continue.', code: 'trial_used' } };
      }
      return { ok: true, refund: t.refund };
    } catch (e) {
      console.error('Trial check failed, allowing request:', e.message);
      return { ok: true, refund: noRefund };
    }
  }

  if (!redisOn) return { ok: true, refund: noRefund };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const who = shared ? `shared:${ip}` : code;
    const l = await takeOne(`${p}:limit:${who}:${today}`, GUARD.daily, 93600);
    if (!l.ok) {
      return { ok: false, status: 429, body: { error: `Daily limit of ${GUARD.daily} generations reached. Come back tomorrow.`, code: 'limit_reached' } };
    }
    return { ok: true, refund: l.refund };
  } catch (e) {
    console.error('Limit check failed, allowing request:', e.message);
    return { ok: true, refund: noRefund };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return innerHandler(req, res);
  const body = req.body || {};
  const g = await guard(req, body.licenseCode, !body.licenseCode);
  if (!g.ok) return res.status(g.status).json(g.body);

  // Если генерация не удалась (ответ с ошибкой) -- возвращаем списанное.
  let status = 200;
  const origStatus = res.status.bind(res);
  res.status = (s) => { status = s; return origStatus(s); };
  try {
    const out = await innerHandler(req, res);
    if (status >= 400) await g.refund();
    return out;
  } catch (e) {
    await g.refund();
    throw e;
  }
}
// ============================ конец защиты ============================

async function innerHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { situation, userRole, licenseCode, outputLang, proficiency } = req.body || {};

  if (!situation || !situation.trim()) {
    return res.status(400).json({ error: 'Describe the situation first.' });
  }

  const lang = (outputLang && String(outputLang).trim()) || 'English';
  const role = (userRole && String(userRole).trim().slice(0, 200)) || '';

  const proficiencyInstructions = {
    Simple: 'Use short sentences and simple, common everyday words. Avoid idioms, phrasal verbs, and complex grammar. This is for someone who is not fully comfortable in this language yet, so clarity matters more than sounding sophisticated.',
    Medium: 'Use clear, everyday wording that a confident non-native speaker would use. A few natural idioms are fine, but avoid anything overly formal, literary, or slang-heavy.',
    Fluent: 'Write the way a fluent, native-level speaker would naturally talk in this situation, including natural idioms and rhythm.',
  };
  const proficiencyNote = proficiencyInstructions[proficiency] || proficiencyInstructions.Fluent;

  // Проверка кода доступа — единый код на продукт, как у остальных
  // продуктов Plainwork при прямой продаже через Lava
  const VALID_CODE = process.env.ACCESS_CODE || '';
  const hasValidCode = licenseCode && VALID_CODE && licenseCode.trim().toUpperCase() === VALID_CODE.toUpperCase();

  // Простая защита от злоупотребления — реальный лимит/проверку кода
  // можно донастроить так же, как у остальных пяти продуктов
  if (situation.length > 2000) {
    return res.status(400).json({ error: 'That description is too long.' });
  }

  const systemPrompt = `You help someone prepare for a spoken conversation they're anxious about — a salary negotiation, a difficult client call, a job interview, declining a request, and similar situations. You are not helping them write anything down to send; you are preparing them for something they will say OUT LOUD, in the moment, possibly under pressure.
${role ? `\nThe user's profession or role is: "${role}". Use this to make the talking points sound like something a real person in that line of work would actually say — matching their likely vocabulary, industry context, and the kind of stakes someone in that role would face. Do not mention their job title explicitly in the points unless it's naturally relevant.\n` : ''}
Write your ENTIRE response — every point, the tone note, and the cultural note — in ${lang}. All string values in the JSON must be in ${lang}, not English, unless ${lang} is English.

Wording level for the "points": ${proficiencyNote}

Given the situation the user describes, return a JSON object with this exact shape:
{
  "points": ["string", "string", "string", "string", "string"],
  "toneNote": "one or two sentences on delivery — pacing, where to pause, what to emphasize",
  "culturalNote": "one or two sentences on how direct or formal this should land, kept general rather than naming one specific country unless the user's situation clearly implies one"
}

Rules for "points":
- Exactly 5 short, natural spoken lines — things a real person would actually say out loud, not written prose.
- Cover: an opening line, a way to state the core ask/position, a response to the most likely pushback, a way to hold firm if needed, and a graceful way to close either direction (agreement or not).
- Each point is a single sentence or two, conversational, no bullet formatting inside the string.
- Do not use em dashes or double hyphens; use a single hyphen or a comma instead.
- Never invent specific numbers, names, or company details the user didn't provide.
- Remember: everything must be written in ${lang}.

Respond with ONLY the JSON object, no other text, no markdown code fences.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Situation: ${situation}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Something went wrong generating your talking points. Try again in a moment.' });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse model output:', rawText);
      return res.status(502).json({ error: 'Could not read the response. Please try again.' });
    }

    if (!Array.isArray(parsed.points) || parsed.points.length === 0) {
      return res.status(502).json({ error: 'Could not generate talking points for that. Try rephrasing the situation.' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
}
