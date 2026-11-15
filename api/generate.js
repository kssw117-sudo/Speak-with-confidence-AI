
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
const REDIS_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

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

// Даём ИИ до 60 секунд на ответ (разбор собеседования бывает длинным).
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query && req.query.selftest) return selfTest(req, res);
  if (req.method !== 'POST') return innerHandler(req, res);
  const body = req.body || {};
  // Подписка на бесплатный PDF — без кода доступа
  if (body.mode === 'subscribe') return handleSubscribe(req, res, body);

  // Бесплатная пробная ролевая игра: без кода, до 3 реплик + разбор, по IP раз в 30 дней
  const isTrialRoleplay = !body.licenseCode && body.trial === true && (body.mode === 'roleplay' || body.mode === 'roleplay-feedback');
  let g;
  if (isTrialRoleplay) {
    g = await roleplayTrialGuard(req, body);
  } else {
    // Остальная практика — только с кодом доступа (без пробных попыток).
    g = await guard(req, body.licenseCode, !body.licenseCode && !body.mode);
  }
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

// Пробная ролевая игра: 1 начало + 3 ответа + 1 разбор = 5 запросов к ИИ на IP за 30 дней
const RP_TRIAL_TURNS = 3;
const RP_TRIAL_CALLS = 5;
async function roleplayTrialGuard(req, body) {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const userTurns = msgs.filter(m => m && m.role === 'user').length;
  if (body.mode === 'roleplay' && userTurns > RP_TRIAL_TURNS) {
    return { ok: false, status: 403, body: { error: 'That was the end of your free role-play. Enter your access code to keep going.', code: 'trial_used' } };
  }
  if (!(REDIS_URL && REDIS_TOKEN)) return { ok: true, refund: noRefund };
  try {
    const t = await takeOne(`${GUARD.product}:rptrial:${clientIp(req)}`, RP_TRIAL_CALLS, TRIAL_TTL);
    if (!t.ok) return { ok: false, status: 403, body: { error: 'Your free role-play is used. Enter your access code to keep practicing.', code: 'trial_used' } };
    return { ok: true, refund: t.refund };
  } catch (e) {
    console.error('Role-play trial check failed, allowing request:', e.message);
    return { ok: true, refund: noRefund };
  }
}

// Бесплатный PDF за email: адрес сохраняется в Redis (список swc:subscribers)
async function handleSubscribe(req, res, body) {
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const pdf = '/salary-talk-phrasebook.pdf';
  if (!(REDIS_URL && REDIS_TOKEN)) return res.status(200).json({ ok: true, pdf });
  try {
    const day = new Date().toISOString().slice(0, 10);
    const t = await takeOne(`${GUARD.product}:sub:${clientIp(req)}:${day}`, 5, 93600);
    if (!t.ok) return res.status(429).json({ error: 'Too many requests today. Please try again tomorrow.' });
    const source = String(body.source || 'site').slice(0, 60);
    const [added] = await redis([['SADD', `${GUARD.product}:subscribers`, email]]);
    if (added === 1) await redis([['RPUSH', `${GUARD.product}:subscribers:log`, `${day} | ${email} | ${source}`]]);
  } catch (e) {
    console.error('Subscribe failed:', e.message);
  }
  return res.status(200).json({ ok: true, pdf });
}


// ===================== Ролевая игра и пробное собеседование =====================
const FAST_MODEL = 'claude-haiku-4-5-20251001';
const SMART_MODEL = 'claude-sonnet-4-6';
const DIFFICULTY = {
  friendly: 'Be warm and cooperative, with only mild, polite pushback.',
  realistic: 'Behave like a real person in this role: polite but with genuine objections, questions and some resistance.',
  tough: 'Be demanding and skeptical. Push back firmly, ask hard follow-up questions, and do not give in easily, but stay professional and never insult the user.',
};

function clip(v, n) { return typeof v === 'string' ? v.trim().slice(0, n) : ''; }

async function askClaude({ model, system, messages, maxTokens }) {
  // Две попытки: если сервис ИИ перегружен или ответ не пришёл вовремя, пробуем ещё раз.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
        signal: ctrl.signal,
      });
      if (r.ok) {
        const data = await r.json();
        return (data.content || []).filter(c => c && c.type !== 'thinking').map(c => c.text || '').join('').trim();
      }
      const errText = await r.text().catch(() => '');
      console.error('Anthropic API error:', r.status, errText.slice(0, 500));
      if (![429, 500, 502, 503, 504, 529].includes(r.status)) return null;
    } catch (e) {
      console.error('Anthropic API request failed:', e.message);
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 0) await new Promise(ok => setTimeout(ok, 1200));
  }
  return null;
}

// Запрос, который должен вернуть JSON: если ответ не разобрался, спрашиваем ещё раз.
async function askJson(opts, isValid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await askClaude(opts);
    if (text === null) return null;
    const data = parseJson(text);
    if (data && isValid(data)) return data;
    console.error('Unexpected AI JSON, retrying:', String(text).slice(0, 300));
  }
  return null;
}

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(String(text).replace(/```json|```/g, '').trim()); } catch (e) {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    return null;
  }
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-30)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));
}

async function handlePractice(req, res, body) {
  const lang = clip(body.outputLang, 40) || 'English';
  const scenario = clip(body.scenario, 1200);
  const partner = clip(body.partner, 300);
  const userRole = clip(body.userRole, 200);
  const difficulty = DIFFICULTY[body.difficulty] || DIFFICULTY.realistic;

  if (body.mode === 'roleplay') {
    if (!scenario) return res.status(400).json({ error: 'Describe the situation first.' });
    const history = cleanHistory(body.messages);
    const system = `You are role-playing so the user can practice a real spoken conversation.
You play: ${partner || 'the other person in this situation'}.
Situation the user wants to practice: ${scenario}
${userRole ? `The user is: ${userRole}.` : ''}
Style: ${difficulty}
Rules:
- Stay fully in character. Never mention that you are an AI, never coach or give advice, never break the role-play.
- Speak like a real person in a live conversation: 1 to 3 short sentences, natural spoken language, no lists, no stage directions, no quotation marks.
- React to what the user actually said. Ask follow-up questions or raise realistic objections.
- Write in ${lang}.`;
    const messages = [{ role: 'user', content: '(The conversation starts now. Say your first line in character.)' }];
    for (const m of history) messages.push(m);
    if (messages[messages.length - 1].role === 'assistant') messages.push({ role: 'user', content: '(The user is silent. Continue naturally.)' });
    // Anthropic требует чередования ролей — склеиваем подряд идущие сообщения одной роли
    const merged = [];
    for (const m of messages) {
      if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n' + m.content;
      else merged.push({ ...m });
    }
    const reply = await askClaude({ model: FAST_MODEL, system, messages: merged, maxTokens: 300 });
    if (!reply || !reply.trim()) return res.status(502).json({ error: 'The other side went quiet. Please try again.' });
    return res.status(200).json({ reply: reply.trim() });
  }

  if (body.mode === 'roleplay-feedback') {
    const history = cleanHistory(body.messages);
    if (history.filter(m => m.role === 'user').length === 0) return res.status(400).json({ error: 'Say at least one line before asking for feedback.' });
    const transcript = history.map(m => `${m.role === 'user' ? 'USER' : 'OTHER PERSON'}: ${m.content}`).join('\n');
    const system = `You are a supportive but honest communication coach. The user just practiced a spoken conversation.
Situation: ${scenario}
Other person: ${partner || 'not specified'}
Evaluate only the USER's lines. Write everything in ${lang}.
Return ONLY a JSON object, no markdown:
{
  "score": number from 0 to 100,
  "summary": "two sentences on how the conversation went",
  "strengths": ["2 or 3 specific things the user did well"],
  "improve": ["2 or 3 specific, practical things to do better"],
  "betterLines": [{"yours": "a line the user actually said", "stronger": "a stronger way to say it"}]
}
Give 2 or 3 betterLines, quoting the user's real lines. Do not use em dashes.`;
    const data = await askJson({ model: SMART_MODEL, system, messages: [{ role: 'user', content: transcript }], maxTokens: 1200 }, d => Number.isFinite(Number(d.score)));
    if (!data) return res.status(502).json({ error: 'Could not prepare feedback. Please try again.' });
    return res.status(200).json({
      score: Math.max(0, Math.min(100, Math.round(Number(data.score)))),
      summary: String(data.summary || ''),
      strengths: Array.isArray(data.strengths) ? data.strengths.map(String).slice(0, 4) : [],
      improve: Array.isArray(data.improve) ? data.improve.map(String).slice(0, 4) : [],
      betterLines: Array.isArray(data.betterLines) ? data.betterLines.filter(b => b && b.yours && b.stronger).slice(0, 4).map(b => ({ yours: String(b.yours), stronger: String(b.stronger) })) : [],
    });
  }

  if (body.mode === 'interview-start') {
    const kind = clip(body.kind, 60) || 'Job interview';
    const target = clip(body.target, 300);
    const background = clip(body.background, 800);
    if (!target) return res.status(400).json({ error: 'Tell us what the interview is for.' });
    const system = `You prepare realistic mock interviews. Write the questions in ${lang}.
Interview type: ${kind}
For: ${target}
${background ? `Candidate background: ${background}` : ''}
Return ONLY a JSON object, no markdown: {"questions": ["q1","q2","q3","q4","q5"]}
Exactly 5 questions a real interviewer for this exact situation would ask, from easier to harder, including at least one follow-up style or tricky question. Each question is one or two spoken sentences. Do not use em dashes.`;
    const data = await askJson({ model: FAST_MODEL, system, messages: [{ role: 'user', content: 'Write the 5 questions.' }], maxTokens: 700 }, d => Array.isArray(d.questions) && d.questions.length >= 3);
    if (!data) return res.status(502).json({ error: 'Could not prepare questions. Please try again.' });
    return res.status(200).json({ questions: data.questions.map(String).slice(0, 5) });
  }

  if (body.mode === 'interview-review') {
    const kind = clip(body.kind, 60) || 'Job interview';
    const target = clip(body.target, 300);
    const qa = Array.isArray(body.qa) ? body.qa.slice(0, 5).map(x => ({ q: clip(x && x.q, 500), a: clip(x && x.a, 2000) })) : [];
    if (!qa.length || qa.every(x => !x.a)) return res.status(400).json({ error: 'Answer at least one question first.' });
    const transcript = qa.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a || '(no answer)'}`).join('\n\n');
    const system = `You are an experienced interviewer and coach reviewing a mock interview. Be honest, specific and encouraging. Write everything in ${lang}.
Interview type: ${kind}
For: ${target}
Return ONLY a JSON object, no markdown:
{
  "overall": number from 0 to 100,
  "summary": "two or three sentences: overall impression and the single most important thing to improve",
  "items": [{"score": number from 1 to 10, "feedback": "one or two sentences on this answer", "better": "a stronger sample answer in 2 to 4 spoken sentences, based on what the candidate said, without inventing facts about them"}]
}
Give exactly one item per question, in order. An empty answer scores 1. Do not use em dashes.`;
    const data = await askJson({ model: SMART_MODEL, system, messages: [{ role: 'user', content: transcript }], maxTokens: 2500 }, d => Number.isFinite(Number(d.overall)) && Array.isArray(d.items));
    if (!data) return res.status(502).json({ error: 'Could not prepare the review. Please try again.' });
    return res.status(200).json({
      overall: Math.max(0, Math.min(100, Math.round(Number(data.overall)))),
      summary: String(data.summary || ''),
      items: data.items.slice(0, qa.length).map(it => ({ score: Math.max(1, Math.min(10, Math.round(Number(it && it.score) || 1))), feedback: String((it && it.feedback) || ''), better: String((it && it.better) || '') })),
    });
  }

  if (body.mode === 'voice-feedback') {
    const topic = clip(body.topic, 400);
    const transcript = clip(body.transcript, 4000);
    const seconds = Math.max(0, Math.min(600, Number(body.seconds) || 0));
    if (!transcript || transcript.split(/\s+/).length < 5) return res.status(400).json({ error: 'Say a little more, at least one full sentence.' });
    const words = transcript.split(/\s+/).filter(Boolean).length;
    const wpm = seconds > 3 ? Math.round(words / (seconds / 60)) : 0;
    const system = `You are a friendly, honest speaking coach. The user spoke out loud and this is the speech-to-text transcript, so ignore missing punctuation and small recognition errors.
Task the user was practicing: ${topic || 'free speaking'}
${userRole ? `The user is: ${userRole}.` : ''}
Speaking time: ${seconds} seconds, about ${wpm} words per minute (130 to 160 is a comfortable pace).
Judge clarity, structure, confidence (hedging, apologizing, filler words), and whether the main point came through. Write everything in ${lang}.
Return ONLY a JSON object, no markdown:
{
  "score": number from 0 to 100,
  "summary": "two sentences on how it sounded",
  "strengths": ["2 or 3 specific things that worked"],
  "improve": ["2 or 3 specific, practical things to change next time"],
  "stronger": "a stronger version of what the user said, same meaning and facts, 3 to 6 spoken sentences, easy to say out loud"
}
Do not use em dashes.`;
    const data = await askJson({ model: SMART_MODEL, system, messages: [{ role: 'user', content: transcript }], maxTokens: 1200 }, d => Number.isFinite(Number(d.score)));
    if (!data) return res.status(502).json({ error: 'Could not prepare feedback. Please try again.' });
    return res.status(200).json({
      score: Math.max(0, Math.min(100, Math.round(Number(data.score)))),
      summary: String(data.summary || ''),
      strengths: Array.isArray(data.strengths) ? data.strengths.map(String).slice(0, 4) : [],
      improve: Array.isArray(data.improve) ? data.improve.map(String).slice(0, 4) : [],
      stronger: String(data.stronger || ''),
      wpm,
    });
  }

  return res.status(400).json({ error: 'Unknown mode.' });
}

// Проверка, что ИИ отвечает во всех режимах: откройте /api/generate?selftest=1
// Не больше 3 проверок в сутки на весь сайт, чтобы не тратить деньги.
async function selfTest(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ ok: false, error: 'ANTHROPIC_API_KEY is not set in Vercel.' });
  if (!(REDIS_URL && REDIS_TOKEN)) return res.status(200).json({ ok: false, error: 'Redis is not connected, self-test is disabled.' });
  try {
    const t = await takeOne(`swc:selftest:${new Date().toISOString().slice(0, 10)}`, 3, 93600);
    if (!t.ok) return res.status(429).json({ ok: false, error: 'Self-test already ran 3 times today.' });
  } catch (e) { return res.status(200).json({ ok: false, error: 'Redis error: ' + e.message }); }
  const run = async (body) => {
    const started = Date.now();
    let status = 200, out = null;
    const fake = { status(s) { status = s; return this; }, json(d) { out = d; return this; } };
    try { await handlePractice(req, fake, { outputLang: 'English', ...body }); } catch (e) { status = 500; out = { error: e.message }; }
    return { ok: status === 200, status, ms: Date.now() - started, sample: JSON.stringify(out).slice(0, 160) };
  };
  const scenario = 'Asking my manager for a raise after a strong year.';
  const [roleplay, interviewStart] = await Promise.all([
    run({ mode: 'roleplay', scenario, partner: 'My manager', difficulty: 'realistic', messages: [{ role: 'assistant', content: 'Hi, you wanted to talk?' }, { role: 'user', content: 'Yes, I would like to discuss my salary.' }] }),
    run({ mode: 'interview-start', kind: 'Job interview', target: 'Junior project manager' }),
  ]);
  const [feedback, review, voice] = await Promise.all([
    run({ mode: 'roleplay-feedback', scenario, partner: 'My manager', messages: [{ role: 'assistant', content: 'Hi, you wanted to talk?' }, { role: 'user', content: 'Yes, I think I deserve more money because I worked a lot.' }] }),
    run({ mode: 'interview-review', kind: 'Job interview', target: 'Junior project manager', qa: [{ q: 'Tell me about yourself.', a: 'I studied economics and I organised two events at my last job.' }] }),
    run({ mode: 'voice-feedback', topic: 'Introduce yourself in 60 seconds', seconds: 20, transcript: 'Hi, um, my name is Anna and I am, like, a designer. I make websites for small businesses and I really like my work.' }),
  ]);
  const results = { roleplay, interviewStart, feedback, review, voice };
  return res.status(200).json({ ok: Object.values(results).every(r => r.ok), results });
}
// =================================================================================

async function innerHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.body && req.body.mode) return handlePractice(req, res, req.body);

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
