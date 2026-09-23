export default async function handler(req, res) {
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
