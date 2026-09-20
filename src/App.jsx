import React, { useState, useEffect } from 'react';

const SKY = '#5EA8E0';
const SKY_DEEP = '#3D8AC7';
const SKY_PALE = '#EAF4FC';
const INK = '#1A1A1E';
const INK_SOFT = '#6B6B72';
const LINE = '#E5E7EB';
const BG = '#FFFFFF';

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'scenario', label: 'Scenario prep' },
  { id: 'library', label: 'Phrase library' },
  { id: 'checklist', label: 'Prep checklist' },
  { id: 'phrasebook', label: 'My phrasebook' },
];

const FEATURES = [
  { title: 'Scenario prep', body: 'Describe the conversation you\'re dreading, get exact talking points built for it.' },
  { title: 'Tone coaching', body: 'Not just what to say — where to pause, what to emphasize, how it should sound.' },
  { title: 'Cultural context', body: 'How direct is too direct, in the country you\'re actually speaking to.' },
  { title: 'Personal phrasebook', body: 'Save the lines that worked. Build your own arsenal over time.' },
  { title: 'Phrase library', body: 'Hundreds of ready lines by situation — browse instantly, no generation needed.' },
  { title: 'Prep checklist', body: 'A structured checklist before you walk in — breathing, key points, posture.' },
  { title: 'Free voice playback', body: 'Hear any phrase read aloud through your browser, at no extra cost.' },
  { title: 'Practice tracker', body: 'See how many scenarios you\'ve rehearsed. Simple streaks, no pressure.' },
];

const SCENARIOS = [
  { tag: 'Salary talk', line: 'I want to start by saying how much I\'ve valued this year — and I\'d like to talk about compensation.' },
  { tag: 'Difficult client', line: 'I hear that this isn\'t working for you. Let\'s figure out exactly where it broke down.' },
  { tag: 'Job interview', line: 'That\'s a fair question — here\'s a moment where I got it wrong, and what I changed after.' },
];

const FAQS = [
  { q: 'Is this the same as SayItRight AI?', a: 'No. SayItRight fixes what you write. This is for what you say out loud, in the moment, when there\'s no time to draft anything.' },
  { q: 'Do I need an account?', a: 'No accounts, no sign-up. Your saved phrases live in your browser.' },
  { q: 'What languages does it support?', a: 'The coaching itself works in your own language, so the advice actually lands, not just the phrases you\'ll say.' },
];

const PHRASE_CATEGORIES = [
  {
    name: 'Salary & raises',
    phrases: [
      "I'd like to talk about my compensation given what I've delivered this year.",
      "Based on my research, the market rate for this role is higher than my current pay.",
      "I'm not looking for a number right now — I want to understand what a path to X would look like.",
      "I want to make sure I'm being paid in line with my impact, not just my tenure.",
    ],
  },
  {
    name: 'Difficult clients',
    phrases: [
      "I hear you, and I want to get this right — walk me through exactly where it broke down.",
      "That's fair feedback. Here's what I can fix, and here's what's outside what we agreed to.",
      "I understand the frustration. Let's separate what's urgent from what's important here.",
      "I don't think leaving solves the actual problem — can we try one more fix first?",
    ],
  },
  {
    name: 'Job interviews',
    phrases: [
      "That's a fair question. Here's a time I got it wrong, and what I changed afterward.",
      "I'd frame my biggest strength as consistency under pressure, not raw speed.",
      "Can you tell me more about what success looks like in this role after six months?",
      "I'm looking for a place where I can own outcomes, not just execute tasks.",
    ],
  },
  {
    name: 'Declining requests',
    phrases: [
      "I can't take this on right now without dropping something else — which would you prioritize?",
      "That's not something I'm the right person for, but I know who might be.",
      "I want to help, but I can't commit to that timeline honestly.",
      "No is a complete sentence, but let me give you the reason anyway.",
    ],
  },
  {
    name: 'Networking & small talk',
    phrases: [
      "What's been the most interesting part of your work lately?",
      "I'd love to hear more about how you ended up in this field.",
      "That's a great point — I hadn't thought about it from that angle.",
      "Do you have a card, or should we just connect after?",
    ],
  },
  {
    name: 'Giving feedback',
    phrases: [
      "Can I share something I noticed? It's meant to help, not criticize.",
      "The intent was good, but the impact landed differently than you meant.",
      "I want to be direct with you because I respect you enough not to soften this.",
      "What would you do differently if you had this moment again?",
    ],
  },
];

export default function App() {
  const [page, setPage] = useState('home');
  const [situation, setSituation] = useState(() => localStorage.getItem('swc_draft_situation') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [savedPhrases, setSavedPhrases] = useState(() => {
    try { return JSON.parse(localStorage.getItem('swc_saved_phrases') || '[]'); } catch (e) { return []; }
  });

  function toggleSave(phrase) {
    setSavedPhrases(prev => {
      const next = prev.includes(phrase) ? prev.filter(p => p !== phrase) : [...prev, phrase];
      localStorage.setItem('swc_saved_phrases', JSON.stringify(next));
      return next;
    });
  }

  const [checkedItems, setCheckedItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('swc_checked_items') || '[]'); } catch (e) { return []; }
  });
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [timerRunning, setTimerRunning] = useState(false);
  const [practiceCount, setPracticeCount] = useState(() => parseInt(localStorage.getItem('swc_practice_count') || '0', 10));
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('swc_unlocked') === 'true');
  const [freeTrialUsed, setFreeTrialUsed] = useState(() => localStorage.getItem('swc_free_trial_used') === 'true');
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [showHelpBubble, setShowHelpBubble] = useState(false);

  // Лёгкий "поп"-звук для открытия/закрытия окошка подсказки — тот же
  // паттерн, что используется во всех пяти остальных продуктах
  function playPopSound(opening) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(opening ? 520 : 380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(opening ? 780 : 260, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* звук не критичен для работы приложения */ }
  }

  function handleUnlock() {
    if (!licenseCode.trim()) { setLicenseError('Please enter a code.'); return; }
    localStorage.setItem('swc_licenseCode', licenseCode.trim());
    localStorage.setItem('swc_unlocked', 'true');
    setUnlocked(true);
    setLicenseError('');
  }

  function toggleCheck(item) {
    setCheckedItems(prev => {
      const next = prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item];
      localStorage.setItem('swc_checked_items', JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    localStorage.setItem('swc_draft_situation', situation);
  }, [situation]);

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const id = setTimeout(() => setTimerSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerSeconds]);

  function startTimer(seconds) {
    setTimerSeconds(seconds);
    setTimerRunning(true);
  }

  function logPractice() {
    const next = practiceCount + 1;
    setPracticeCount(next);
    localStorage.setItem('swc_practice_count', String(next));
  }


  async function handleGenerate() {
    if (!situation.trim()) return;
    if (!unlocked && freeTrialUsed) return; // форма скрыта в этом случае, но на всякий случай
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, licenseCode: localStorage.getItem('swc_licenseCode') || '' }),
      });
      const data = await res.json();
      setResult(data);
      setCardIndex(0);
      if (!unlocked && !freeTrialUsed) {
        localStorage.setItem('swc_free_trial_used', 'true');
        setFreeTrialUsed(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px', borderBottom: `1px solid ${LINE}`, position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setPage('home')}>
          <svg width="28" height="28" viewBox="0 0 200 190">
            <rect x="15" y="15" width="170" height="115" rx="40" fill={SKY} />
            <polygon points="55,130 40,165 80,132" fill={SKY} />
            <polyline points="65,72 92,100 140,50" stroke="#FFF" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>Speak With Confidence</span>
        </div>
        <nav style={{ display: 'flex', gap: 28 }}>
          {PAGES.slice(1).map(p => (
            <button key={p.id} onClick={() => setPage(p.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5,
                color: page === p.id ? SKY_DEEP : INK_SOFT,
                fontWeight: page === p.id ? 600 : 400,
                borderBottom: page === p.id ? `2px solid ${SKY_DEEP}` : '2px solid transparent',
                paddingBottom: 4,
              }}>
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {page === 'home' && (
        <>
          {/* ---------- HERO ---------- */}
          <div style={{ background: SKY_PALE, padding: '70px 24px 60px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 40, lineHeight: 1.2, margin: '0 0 16px' }}>
                Not what to write. What to say.
              </h1>
              <p style={{ fontSize: 16, color: INK_SOFT, maxWidth: 480, margin: '0 auto 28px' }}>
                Prep for the conversation you're dreading — before you walk in.
              </p>
              <button onClick={() => setPage('scenario')}
                style={{ padding: '15px 32px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 15, fontWeight: 600 }}>
                Start a scenario &rarr;
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 44, flexWrap: 'wrap' }}>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24 }}>8</div><div style={{ fontSize: 12, color: INK_SOFT }}>tools in one</div></div>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24 }}>No</div><div style={{ fontSize: 12, color: INK_SOFT }}>sign-up needed</div></div>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24 }}>1</div><div style={{ fontSize: 12, color: INK_SOFT }}>time payment</div></div>
              </div>
            </div>
          </div>

          {/* ---------- FEATURES GRID ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, textAlign: 'center', marginBottom: 8 }}>
              One tool, every way you prepare
            </h2>
            <p style={{ textAlign: 'center', color: INK_SOFT, fontSize: 14, marginBottom: 40 }}>
              AI-powered and instant, side by side
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ padding: 22, borderRadius: 14, border: `1px solid ${LINE}`, background: '#FFF' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: SKY_PALE, marginBottom: 12 }} />
                  <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- EXAMPLE SCENARIOS ---------- */}
          <div style={{ background: '#FAFBFC', padding: '64px 24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, textAlign: 'center', marginBottom: 40 }}>
                What it sounds like
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {SCENARIOS.map((s, i) => (
                  <div key={i} style={{ padding: 24, borderRadius: 14, background: '#FFF', border: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 11, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>{s.tag}</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>&ldquo;{s.line}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- FAQ ---------- */}
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 90px' }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, textAlign: 'center', marginBottom: 32 }}>
              Questions
            </h2>
            {FAQS.map((f, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500 }}>
                  {f.q}
                  <span>{openFaq === i ? '\u2212' : '+'}</span>
                </button>
                {openFaq === i && <p style={{ fontSize: 13.5, color: INK_SOFT, paddingBottom: 18, margin: 0, lineHeight: 1.6 }}>{f.a}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {page === 'scenario' && (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>What's the situation?</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>Describe it in your own words — as messy as it actually is.</p>

          {!unlocked && freeTrialUsed ? (
            <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE, marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Free preview used</p>
              <p style={{ fontSize: 13, color: INK_SOFT, margin: '0 0 16px' }}>Enter your access code to keep preparing scenarios.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={licenseCode}
                  onChange={e => setLicenseCode(e.target.value)}
                  placeholder="Enter your access code"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14 }}
                />
                <button onClick={handleUnlock}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Unlock
                </button>
              </div>
              {licenseError && <p style={{ color: '#D64545', fontSize: 12.5, marginTop: 8 }}>{licenseError}</p>}
              <a href="/buy.html" style={{ display: 'block', marginTop: 10, fontSize: 12.5, color: SKY_DEEP }}>No code? Get access</a>
            </div>
          ) : (
            <>
              <textarea value={situation} onChange={e => setSituation(e.target.value)} rows={4}
                placeholder="Asking my manager for a raise after a strong quarter, but the company just announced a hiring freeze..."
                style={{ width: '100%', padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical', marginBottom: 20 }} />
              <button onClick={handleGenerate} disabled={loading}
                style={{ padding: '14px 30px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14.5, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Preparing...' : unlocked ? 'Get talking points' : 'Get talking points (1 free preview)'}
              </button>
            </>
          )}
          {result && result.points && (
            <div style={{ marginTop: 48 }}>
              <div style={{ background: '#F7FAFC', borderRadius: 16, padding: 32, border: `1px solid ${LINE}`, minHeight: 140 }}>
                <div style={{ fontSize: 12, color: SKY_DEEP, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cardIndex + 1} / {result.points.length}</div>
                <p style={{ fontSize: 17, lineHeight: 1.6, margin: 0 }}>{result.points[cardIndex]}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button onClick={() => setCardIndex(i => Math.max(0, i - 1))} disabled={cardIndex === 0}
                  style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 18, opacity: cardIndex === 0 ? 0.3 : 1 }}>&larr;</button>
                <button onClick={() => setCardIndex(i => Math.min(result.points.length - 1, i + 1))} disabled={cardIndex === result.points.length - 1}
                  style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 18, opacity: cardIndex === result.points.length - 1 ? 0.3 : 1 }}>&rarr;</button>
              </div>

              {result.toneNote && (
                <div style={{ marginTop: 24, padding: '16px 18px', borderRadius: 12, background: SKY_PALE }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>How it should sound</div>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{result.toneNote}</p>
                </div>
              )}
              {result.culturalNote && (
                <div style={{ marginTop: 12, padding: '16px 18px', borderRadius: 12, border: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Cultural context</div>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: INK_SOFT }}>{result.culturalNote}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {page === 'library' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Phrase library</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>Ready lines by situation — no waiting, no generation.</p>
          <input
            value={librarySearch}
            onChange={e => setLibrarySearch(e.target.value)}
            placeholder="Search phrases or categories..."
            style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 32 }}
          />
          {PHRASE_CATEGORIES
            .map(cat => ({
              ...cat,
              phrases: cat.phrases.filter(p =>
                !librarySearch.trim() ||
                p.toLowerCase().includes(librarySearch.toLowerCase()) ||
                cat.name.toLowerCase().includes(librarySearch.toLowerCase())
              ),
            }))
            .filter(cat => cat.phrases.length > 0)
            .map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 36 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: SKY_DEEP }}>{cat.name}</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {cat.phrases.map((p, pi) => (
                    <div key={pi} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14,
                      padding: '14px 16px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#FAFBFC',
                    }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{p}</p>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => { const u = new SpeechSynthesisUtterance(p); window.speechSynthesis.speak(u); }}
                          aria-label="Listen"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}
                        >
                          &#128266;
                        </button>
                        <button
                          onClick={() => toggleSave(p)}
                          aria-label="Save"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: savedPhrases.includes(p) ? SKY_DEEP : INK_SOFT }}
                        >
                          {savedPhrases.includes(p) ? '\u2605' : '\u2606'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          ))}
        </div>
      )}
      {page === 'checklist' && (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Prep checklist</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 28 }}>Go through this right before you walk in.</p>

          <div style={{ display: 'grid', gap: 10, marginBottom: 40 }}>
            {[
              'Say your opening line out loud once, not just in your head',
              'Name the outcome you actually want from this conversation',
              'Think of the one objection you\'re most afraid of, and your answer to it',
              'Take three slow breaths before you start',
              'Stand or sit up straight — posture changes your voice',
              'Decide your walk-away point in advance',
            ].map((item, i) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 10, border: `1px solid ${LINE}`, cursor: 'pointer',
                background: checkedItems.includes(item) ? SKY_PALE : '#FFF',
              }}>
                <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => toggleCheck(item)} style={{ width: 18, height: 18, accentColor: SKY_DEEP }} />
                <span style={{ fontSize: 14, textDecoration: checkedItems.includes(item) ? 'line-through' : 'none', color: checkedItems.includes(item) ? INK_SOFT : INK }}>{item}</span>
              </label>
            ))}
          </div>

          <div style={{ padding: 28, borderRadius: 16, background: '#FAFBFC', border: `1px solid ${LINE}`, textAlign: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Rehearsal timer</h3>
            <p style={{ fontSize: 13, color: INK_SOFT, marginBottom: 20 }}>Practice saying your opening line within the time limit.</p>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 600, color: timerSeconds === 0 ? SKY_DEEP : INK, marginBottom: 16 }}>
              {timerSeconds}s
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => startTimer(15)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>15s</button>
              <button onClick={() => startTimer(30)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>30s</button>
              <button onClick={() => startTimer(60)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>60s</button>
              <button onClick={() => { setTimerRunning(false); logPractice(); }} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: SKY, color: '#FFF', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Done</button>
            </div>
            <p style={{ fontSize: 12, color: INK_SOFT, marginTop: 20 }}>Rehearsed <strong style={{ color: SKY_DEEP }}>{practiceCount}</strong> times so far</p>
          </div>
        </div>
      )}

      {page === 'phrasebook' && (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>My phrasebook</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 28 }}>Lines you've saved, ready to reuse.</p>

          {savedPhrases.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: INK_SOFT, border: `1px dashed ${LINE}`, borderRadius: 14, fontSize: 14 }}>
              Nothing saved yet. Star a phrase in the library to keep it here.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {savedPhrases.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#FAFBFC',
                }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{p}</p>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { const u = new SpeechSynthesisUtterance(p); window.speechSynthesis.speak(u); }} aria-label="Listen"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>&#128266;</button>
                    <button onClick={() => toggleSave(p)} aria-label="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>&#10005;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- FOOTER ---------- */}
      <footer style={{ borderTop: `1px solid ${LINE}`, padding: '32px 24px', marginTop: 60 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 12, color: INK_SOFT }}>Powered by Claude &middot; Plainwork by Ksenia</span>
          <div style={{ display: 'flex', gap: 18 }}>
            <a href="/terms.html" style={{ fontSize: 12, color: INK_SOFT }}>Terms</a>
            <a href="/privacy.html" style={{ fontSize: 12, color: INK_SOFT }}>Privacy</a>
            <a href="/refund.html" style={{ fontSize: 12, color: INK_SOFT }}>Refunds</a>
            <a href="mailto:kssw117@gmail.com" style={{ fontSize: 12, color: INK_SOFT }}>kssw117@gmail.com</a>
          </div>
        </div>
      </footer>

      {/* Плавающая кнопка "нужна помощь" — как на всех остальных продуктах */}
      <button
        onClick={() => {
          playPopSound(!showHelpBubble);
          setShowHelpBubble(v => !v);
        }}
        aria-label="Need help?"
        style={{
          position: 'fixed', bottom: 20, right: 20, width: 48, height: 48, borderRadius: '50%',
          background: SKY, color: '#FFF', border: 'none',
          cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(94,168,224,0.4)', zIndex: 50,
        }}
      >
        {showHelpBubble ? '\u2715' : '?'}
      </button>

      {showHelpBubble && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, width: 290, maxWidth: 'calc(100vw - 40px)',
          background: '#FFF', borderRadius: 14, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          border: `1px solid ${LINE}`, zIndex: 50,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: INK }}>How Speak With Confidence AI works</p>
          <p style={{ margin: 0, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.55 }}>
            Describe a conversation you're dreading in Scenario prep, and get talking points, tone coaching, and cultural context. Or skip the wait entirely with the ready-made Phrase library, Prep checklist, and rehearsal timer — no AI needed for those.
          </p>
        </div>
      )}
    </div>
  );
}
