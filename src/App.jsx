import React, { useState, useEffect } from 'react';

const SKY = '#5EA8E0';
const SKY_DEEP = '#3D8AC7';
const SKY_PALE = '#EAF4FC';
const INK = '#1A1A1E';
const INK_SOFT = '#6B6B72';
const LINE = '#E5E7EB';
const BG = '#FFFFFF';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Russian',
  'Ukrainian', 'Polish', 'Dutch', 'Turkish', 'Arabic', 'Hindi', 'Chinese',
  'Japanese', 'Korean', 'Vietnamese', 'Thai', 'Indonesian', 'Swedish',
  'Norwegian', 'Danish', 'Finnish', 'Greek', 'Czech', 'Romanian', 'Hungarian',
  'Hebrew', 'Persian', 'Bengali', 'Urdu', 'Filipino', 'Malay', 'Swahili', 'Serbian',
];

// Простая (не через ИИ) сортировка категорий библиотеки по релевантности
// профессии — по ключевым словам, чтобы не тратить платные запросы
const ROLE_KEYWORDS = {
  'Difficult clients': ['client', 'customer', 'freelance', 'consultant', 'agency', 'service', 'sales', 'account', 'support'],
  'Giving feedback': ['manager', 'lead', 'teacher', 'coach', 'director', 'supervisor', 'mentor', 'teamlead'],
  'Networking & small talk': ['sales', 'founder', 'entrepreneur', 'recruiter', 'marketing', 'business development', 'freelance'],
  'Declining requests': ['freelance', 'manager', 'lead', 'consultant', 'contractor'],
  'Salary & raises': ['employee', 'staff', 'engineer', 'developer', 'analyst', 'specialist'],
  'Apologizing well': ['client', 'customer', 'service', 'support', 'manager'],
};

function sortCategoriesByRole(categories, role) {
  if (!role || !role.trim()) return categories;
  const roleLower = role.toLowerCase();
  const scored = categories.map(cat => {
    const keywords = ROLE_KEYWORDS[cat.name] || [];
    const matches = keywords.filter(k => roleLower.includes(k)).length;
    return { ...cat, _score: matches };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'scenario', label: 'Scenario prep', icon: 'target' },
  { id: 'library', label: 'Phrase library', icon: 'library' },
  { id: 'checklist', label: 'Prep checklist', icon: 'check' },
  { id: 'phrasebook', label: 'My phrasebook', icon: 'notebook' },
];

const FEATURES = [
  { title: 'Scenario prep', body: 'Describe the conversation you\'re dreading, get exact talking points built for it.', icon: 'target' },
  { title: 'Tone coaching', body: 'Not just what to say — where to pause, what to emphasize, how it should sound.', icon: 'wave' },
  { title: 'Cultural context', body: 'How direct is too direct, in the country you\'re actually speaking to.', icon: 'globe' },
  { title: 'Personal phrasebook', body: 'Save the lines that worked. Build your own arsenal over time.', icon: 'bookmark' },
  { title: 'Phrase library', body: 'Hundreds of ready lines by situation — browse instantly, no generation needed.', icon: 'library' },
  { title: 'Prep checklist', body: 'A structured checklist before you walk in — breathing, key points, posture.', icon: 'check' },
  { title: 'Free voice playback', body: 'Hear any phrase read aloud through your browser, at no extra cost.', icon: 'speaker' },
  { title: 'Practice tracker', body: 'See how many scenarios you\'ve rehearsed. Simple streaks, no pressure.', icon: 'trend' },
];

function FeatureIcon({ type, color, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (type) {
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill={color} /></svg>;
    case 'wave':
      return <svg {...common}><path d="M3 12h2l2-7 3 14 3-10 2 6h6" /></svg>;
    case 'globe':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.4 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.4-3.8-8.5S9.5 5.9 12 3.5z" /></svg>;
    case 'bookmark':
      return <svg {...common}><path d="M6 3.5h12v17l-6-4.2-6 4.2v-17z" /></svg>;
    case 'library':
      return <svg {...common}><rect x="4" y="4" width="4" height="16" /><rect x="10" y="4" width="4" height="16" /><path d="M17 4.5l4 .9-3.5 15.6-4-.9z" /></svg>;
    case 'check':
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>;
    case 'speaker':
      return <svg {...common}><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" /><path d="M16 9a4.2 4.2 0 010 6M18.5 6.5a8 8 0 010 11" /></svg>;
    case 'trend':
      return <svg {...common}><path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" /></svg>;
    case 'notebook':
      return <svg {...common}><rect x="4" y="3.5" width="13" height="17" rx="1.5" /><path d="M7 3.5v17M15 6.5l5 1.5-3 12-5-1.5z" /></svg>;
    default:
      return null;
  }
}

const SCENARIOS = [
  { tag: 'Salary talk', line: 'I want to start by saying how much I\'ve valued this year — and I\'d like to talk about compensation.' },
  { tag: 'Difficult client', line: 'I hear that this isn\'t working for you. Let\'s figure out exactly where it broke down.' },
  { tag: 'Job interview', line: 'That\'s a fair question — here\'s a moment where I got it wrong, and what I changed after.' },
  { tag: 'Declining a request', line: 'I can\'t take this on right now without dropping something else — which would you prioritize?' },
  { tag: 'Networking', line: 'What\'s been the most interesting part of your work lately?' },
  { tag: 'Giving feedback', line: 'Can I share something I noticed? It\'s meant to help, not criticize.' },
];

const FAQS = [
  { q: 'Is this the same as SayItRight AI?', a: 'No. SayItRight fixes what you write. This is for what you say out loud, in the moment, when there\'s no time to draft anything.' },
  { q: 'Do I need an account?', a: 'No accounts, no sign-up. Your saved phrases live in your browser.' },
  { q: 'What languages does it support?', a: 'Scenario prep works in 35 languages, pick one from a dropdown, and the AI writes your talking points, tone notes, and cultural context in that language. The static phrase library and prep checklist are in English for now.' },
];

const PHRASE_CATEGORIES = [
  {
    name: 'Salary & raises',
    phrases: [
      "I'd like to talk about my compensation given what I've delivered this year.",
      "Based on my research, the market rate for this role is higher than my current pay.",
      "I'm not looking for a number right now — I want to understand what a path to X would look like.",
      "I want to make sure I'm being paid in line with my impact, not just my tenure.",
      "I've taken on X and Y since my last review, and I'd like that reflected in my pay.",
      "What would need to be true for us to revisit this in three months?",
      "I'm not comparing myself to anyone else on the team, just to what this role is worth.",
    ],
  },
  {
    name: 'Difficult clients',
    phrases: [
      "I hear you, and I want to get this right — walk me through exactly where it broke down.",
      "That's fair feedback. Here's what I can fix, and here's what's outside what we agreed to.",
      "I understand the frustration. Let's separate what's urgent from what's important here.",
      "I don't think leaving solves the actual problem — can we try one more fix first?",
      "I'd rather tell you the truth now than promise something I can't deliver.",
      "Let's agree on what \"fixed\" actually looks like before I start.",
      "I want this relationship to work, so tell me what would need to change.",
    ],
  },
  {
    name: 'Job interviews',
    phrases: [
      "That's a fair question. Here's a time I got it wrong, and what I changed afterward.",
      "I'd frame my biggest strength as consistency under pressure, not raw speed.",
      "Can you tell me more about what success looks like in this role after six months?",
      "I'm looking for a place where I can own outcomes, not just execute tasks.",
      "Honestly, that's still something I'm developing, here's how I'm working on it.",
      "What does the team usually struggle with most, that I'd be walking into?",
      "I turned down a similar offer because the scope didn't match what was promised.",
    ],
  },
  {
    name: 'Declining requests',
    phrases: [
      "I can't take this on right now without dropping something else — which would you prioritize?",
      "That's not something I'm the right person for, but I know who might be.",
      "I want to help, but I can't commit to that timeline honestly.",
      "No is a complete sentence, but let me give you the reason anyway.",
      "I could do this by Friday, or the other thing by Wednesday, not both.",
      "That's outside what I agreed to take on, let's talk about what changed.",
      "I'm going to say no this time, so I can actually say yes to the next one.",
    ],
  },
  {
    name: 'Networking & small talk',
    phrases: [
      "What's been the most interesting part of your work lately?",
      "I'd love to hear more about how you ended up in this field.",
      "That's a great point — I hadn't thought about it from that angle.",
      "Do you have a card, or should we just connect after?",
      "What are you working on that you're actually excited about right now?",
      "I've been meaning to ask someone who'd actually know, how does that side of the industry work?",
      "This has been a great conversation, I'd love to continue it sometime this week.",
    ],
  },
  {
    name: 'Giving feedback',
    phrases: [
      "Can I share something I noticed? It's meant to help, not criticize.",
      "The intent was good, but the impact landed differently than you meant.",
      "I want to be direct with you because I respect you enough not to soften this.",
      "What would you do differently if you had this moment again?",
      "This isn't about one mistake, it's a pattern I want to flag early.",
      "You did a lot right here, and there's one thing I think could be stronger.",
      "I'd rather you hear this from me now than find out some other way later.",
    ],
  },
  {
    name: 'Asking for help',
    phrases: [
      "I've tried a couple of things already, but I'm stuck and could use a second opinion.",
      "Do you have twenty minutes this week to walk through this with me?",
      "I don't want to guess on this one, can you tell me how you'd approach it?",
      "This is outside what I know well, who would you go to for this?",
      "I'm not asking you to do it for me, just to point me in the right direction.",
    ],
  },
  {
    name: 'Apologizing well',
    phrases: [
      "I got this wrong, and I want to tell you exactly what I'm doing differently.",
      "There's no excuse that changes what happened, so I'll skip the explanation and just fix it.",
      "I should have flagged this sooner, that's on me.",
      "I understand if this changes how you see this going forward.",
      "I'm not just sorry it happened, I'm sorry I didn't catch it earlier.",
    ],
  },
];

export default function App() {
  const [page, setPage] = useState(() => localStorage.getItem('swc_last_page') || 'home');
  const [situation, setSituation] = useState(() => localStorage.getItem('swc_draft_situation') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('swc_draft_role') || '');
  const [outputLang, setOutputLang] = useState(() => localStorage.getItem('swc_output_lang') || 'English');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('swc_last_result') || 'null'); } catch (e) { return null; }
  });
  const [generateError, setGenerateError] = useState('');
  const [cardIndex, setCardIndex] = useState(() => parseInt(localStorage.getItem('swc_card_index') || '0', 10));
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    localStorage.setItem('swc_draft_role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('swc_card_index', String(cardIndex));
  }, [cardIndex]);

  useEffect(() => {
    localStorage.setItem('swc_output_lang', outputLang);
  }, [outputLang]);

  useEffect(() => {
    try {
      if (result) localStorage.setItem('swc_last_result', JSON.stringify(result));
    } catch (e) { /* превышена квота localStorage — пропускаем, не критично */ }
  }, [result]);

  useEffect(() => {
    localStorage.setItem('swc_last_page', page);
  }, [page]);

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

  // Голосовая отработка — через встроенный в браузер Web Speech API,
  // работы с сервером или Claude нет, полностью бесплатно
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = React.useRef(null);

  function toggleVoicePractice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice recognition isn\'t supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError('');
    setVoiceTranscript('');
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceTranscript(transcript);
    };
    recognition.onerror = () => setVoiceError('Could not hear you clearly. Try again in a quieter spot.');
    recognition.onend = () => {
      setIsListening(false);
      logPractice();
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function handleGenerate() {
    if (!situation.trim()) return;
    if (!unlocked && freeTrialUsed) return; // форма скрыта в этом случае, но на всякий случай
    setLoading(true);
    setGenerateError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, userRole, outputLang, licenseCode: localStorage.getItem('swc_licenseCode') || '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setResult(data);
      setCardIndex(0);
      if (!unlocked && !freeTrialUsed) {
        localStorage.setItem('swc_free_trial_used', 'true');
        setFreeTrialUsed(true);
      }
    } catch (e) {
      setGenerateError('Could not reach the server. Check your connection and try again.');
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
        .premium-card { box-shadow: 0 1px 3px rgba(20,20,30,0.06), 0 8px 24px rgba(20,20,30,0.05); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .premium-card:hover { transform: translateY(-3px); box-shadow: 0 4px 10px rgba(20,20,30,0.08), 0 16px 36px rgba(20,20,30,0.1); }
        .premium-btn { transition: transform 0.15s ease, box-shadow 0.2s ease; }
        .premium-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(94,168,224,0.4); }
        .premium-btn:active:not(:disabled) { transform: scale(0.98); }
        .shimmer-line { background: linear-gradient(90deg, #F0F3F6 0%, #E3ECF4 50%, #F0F3F6 100%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .desktop-nav { display: flex; }
        .mobile-menu-btn { display: none; }
        .logo-text { display: inline; }
        @media (max-width: 720px) {
          .desktop-nav { display: none; }
          .mobile-menu-btn { display: flex; }
          .logo-text { font-size: 14px !important; }
          header { padding-left: 20px !important; padding-right: 20px !important; }
        }
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
          <span className="logo-text" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>Speak With Confidence</span>
        </div>
        <nav className="desktop-nav" style={{ gap: 4 }}>
          {PAGES.slice(1).map(p => (
            <button key={p.id} onClick={() => setPage(p.id)}
              style={{
                background: page === p.id ? SKY_PALE : 'none', border: 'none', cursor: 'pointer', fontSize: 13.5,
                color: page === p.id ? SKY_DEEP : INK_SOFT,
                fontWeight: page === p.id ? 600 : 400,
                padding: '9px 16px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
              <FeatureIcon type={p.icon} color={page === p.id ? SKY_DEEP : INK_SOFT} size={16} />
              {p.label}
            </button>
          ))}
        </nav>
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
            {mobileMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </header>

      {mobileMenuOpen && (
        <div style={{ position: 'sticky', top: 65, background: '#FFF', borderBottom: `1px solid ${LINE}`, zIndex: 9, padding: '8px 20px 16px' }}>
          {PAGES.slice(1).map(p => (
            <button key={p.id} onClick={() => { setPage(p.id); setMobileMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                background: page === p.id ? SKY_PALE : 'none', border: 'none', cursor: 'pointer', fontSize: 14.5,
                color: page === p.id ? SKY_DEEP : INK_SOFT, fontWeight: page === p.id ? 600 : 400,
                padding: '12px 14px', borderRadius: 10, marginTop: 4,
              }}>
              <FeatureIcon type={p.icon} color={page === p.id ? SKY_DEEP : INK_SOFT} size={18} />
              {p.label}
            </button>
          ))}
        </div>
      )}

      {page === 'home' && (
        <>
          {/* ---------- HERO ---------- */}
          <div style={{ background: `linear-gradient(180deg, ${SKY_PALE} 0%, #FFFFFF 100%)`, padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
            {/* Мягкие размытые пятна на фоне — для глубины, приём премиальных SaaS-сайтов */}
            <div style={{ position: 'absolute', top: -80, left: '8%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(94,168,224,0.35) 0%, rgba(94,168,224,0) 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -40, right: '10%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,138,199,0.3) 0%, rgba(61,138,199,0) 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, left: '45%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(94,168,224,0.25) 0%, rgba(94,168,224,0) 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 48, lineHeight: 1.15, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
                Not what to write. What to say.
              </h1>
              <p style={{ fontSize: 16, color: INK_SOFT, maxWidth: 480, margin: '0 auto 32px' }}>
                Prep for the conversation you're dreading — before you walk in.
              </p>
              <button onClick={() => setPage('scenario')} className="premium-btn"
                style={{ padding: '15px 32px', borderRadius: 999, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${SKY} 0%, ${SKY_DEEP} 100%)`, color: '#FFF', fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(94,168,224,0.35)' }}>
                Start a scenario &rarr;
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 56, flexWrap: 'wrap' }}>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>8</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>tools in one</div></div>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>No</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>sign-up needed</div></div>
                <div><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>1</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>time payment</div></div>
              </div>

              {/* ---------- PRODUCT MOCKUP ---------- */}
              <div style={{ maxWidth: 560, margin: '64px auto 0', textAlign: 'left' }}>
                <div style={{
                  borderRadius: 16, background: '#FFF', overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(20,20,30,0.14), 0 4px 16px rgba(20,20,30,0.08)',
                  border: `1px solid ${LINE}`,
                }}>
                  {/* "Шапка окна браузера" */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderBottom: `1px solid ${LINE}`, background: '#FAFBFC' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF6159' }} />
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFC02E' }} />
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C93F' }} />
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: INK_SOFT, fontFamily: "'IBM Plex Mono', monospace" }}>swc.plainwork.website</div>
                  </div>
                  {/* Содержимое — уменьшенная копия результата */}
                  <div style={{ padding: 24 }}>
                    <div style={{ fontSize: 10.5, color: INK_SOFT, marginBottom: 6 }}>What's the situation?</div>
                    <div style={{ fontSize: 12.5, color: INK, padding: '10px 12px', borderRadius: 8, border: `1px solid ${LINE}`, marginBottom: 16, background: '#FAFBFC' }}>
                      Asking my manager for a raise, but the company just announced a hiring freeze...
                    </div>
                    <div style={{ background: SKY_PALE, borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ fontSize: 10, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>1 / 5</div>
                      <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0, color: INK }}>
                        "I want to start by saying how much I've valued this year, and I'd like to talk about compensation."
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <div style={{ fontSize: 10.5, color: SKY_DEEP, background: '#FFF', border: `1px solid ${SKY_PALE}`, borderRadius: 999, padding: '4px 10px' }}>How it should sound</div>
                      <div style={{ fontSize: 10.5, color: INK_SOFT, background: '#FFF', border: `1px solid ${LINE}`, borderRadius: 999, padding: '4px 10px' }}>Cultural context</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- FEATURES GRID ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 34, textAlign: 'center', marginBottom: 10 }}>
              One tool, every way you prepare
            </h2>
            <p style={{ textAlign: 'center', color: INK_SOFT, fontSize: 14, marginBottom: 44 }}>
              AI-powered and instant, side by side
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className="premium-card" style={{ padding: 22, borderRadius: 14, background: '#FFF' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: SKY_PALE, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FeatureIcon type={f.icon} color={SKY_DEEP} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- EXAMPLE SCENARIOS ---------- */}
          <div style={{ background: '#FAFBFC', padding: '64px 24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 34, textAlign: 'center', marginBottom: 44 }}>
                What it sounds like
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {SCENARIOS.map((s, i) => (
                  <div key={i} className="premium-card" style={{ padding: 24, borderRadius: 14, background: '#FFF' }}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <select value={outputLang} onChange={e => setOutputLang(e.target.value)}
                  style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT, cursor: 'pointer' }}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>What do you do? (optional, but sharpens the advice)</label>
              <input
                value={userRole}
                onChange={e => setUserRole(e.target.value)}
                placeholder="e.g. freelance graphic designer, restaurant manager, software engineer..."
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 16 }}
              />
              <textarea value={situation} onChange={e => setSituation(e.target.value)} rows={4}
                placeholder="Asking my manager for a raise after a strong quarter, but the company just announced a hiring freeze..."
                style={{ width: '100%', padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical', marginBottom: 20 }} />
              <button onClick={handleGenerate} disabled={loading || !situation.trim()} className="premium-btn"
                style={{ padding: '14px 30px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14.5, fontWeight: 600, opacity: (loading || !situation.trim()) ? 0.5 : 1, boxShadow: '0 4px 14px rgba(94,168,224,0.3)' }}>
                {loading ? 'Preparing...' : unlocked ? 'Get talking points' : 'Get talking points (1 free preview)'}
              </button>
              {generateError && <p style={{ color: '#D64545', fontSize: 13, marginTop: 12 }}>{generateError}</p>}
            </>
          )}

          {loading && (
            <div style={{ marginTop: 48 }}>
              <div className="shimmer-line" style={{ height: 100, borderRadius: 16, marginBottom: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="shimmer-line" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                <div className="shimmer-line" style={{ width: 44, height: 44, borderRadius: '50%' }} />
              </div>
            </div>
          )}

          {result && result.points && (
            <div style={{ marginTop: 48 }}>
              <div className="premium-card" style={{ background: '#F7FAFC', borderRadius: 16, padding: 32, minHeight: 140 }}>
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
          {userRole.trim() && (
            <p style={{ fontSize: 12.5, color: SKY_DEEP, marginTop: -14, marginBottom: 24 }}>
              Sorted for: <strong>{userRole}</strong> &middot; <button onClick={() => setPage('scenario')} style={{ background: 'none', border: 'none', color: SKY_DEEP, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>change</button>
            </p>
          )}
          <input
            value={librarySearch}
            onChange={e => setLibrarySearch(e.target.value)}
            placeholder="Search phrases or categories..."
            style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 32 }}
          />
          {sortCategoriesByRole(PHRASE_CATEGORIES, userRole)
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
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: SKY_DEEP, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {cat.name}
                  {cat._score > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: SKY_DEEP, background: SKY_PALE, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Recommended for you
                    </span>
                  )}
                </h3>
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
              ...(/client|customer|freelance|consultant|agency|sales|account/i.test(userRole)
                ? ['Have the account history or last agreement in front of you before you start']
                : []),
              ...(/manager|lead|director|supervisor|teamlead/i.test(userRole)
                ? ['Decide what you want them to walk away doing differently, not just knowing']
                : []),
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => startTimer(15)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>15s</button>
              <button onClick={() => startTimer(30)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>30s</button>
              <button onClick={() => startTimer(60)} style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13 }}>60s</button>
              <button onClick={() => { setTimerRunning(false); logPractice(); }} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: SKY, color: '#FFF', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Done</button>
            </div>
            <p style={{ fontSize: 12, color: INK_SOFT, marginTop: 20 }}>Rehearsed <strong style={{ color: SKY_DEEP }}>{practiceCount}</strong> times so far</p>

            {/* Голосовая отработка — бесплатно, через встроенное в браузер распознавание речи */}
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${LINE}` }}>
              <p style={{ fontSize: 13, color: INK_SOFT, marginBottom: 14 }}>Or say it out loud — see what actually came out.</p>
              <button
                onClick={toggleVoicePractice}
                className="premium-btn"
                style={{
                  padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: isListening ? '#D64545' : SKY, color: '#FFF', fontSize: 13.5, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" /><path d="M19 11a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 006 6.93V20H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A7 7 0 0019 11z" /></svg>
                {isListening ? 'Listening... tap to stop' : 'Start speaking'}
              </button>
              {voiceTranscript && (
                <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: '#FFF', border: `1px solid ${LINE}`, textAlign: 'left' }}>
                  <div style={{ fontSize: 10.5, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>What you said</div>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: INK }}>{voiceTranscript}</p>
                </div>
              )}
              {voiceError && <p style={{ fontSize: 12.5, color: '#D64545', marginTop: 10 }}>{voiceError}</p>}
            </div>
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
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Fraunces', serif", fontStyle: 'normal', fontSize: 15, color: SKY_DEEP, textAlign: 'center', margin: '0 0 24px' }}>
            Confidence isn't luck. It's preparation.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 12, color: INK_SOFT }}>Powered by Claude &middot; Plainwork by Ksenia</span>
            <div style={{ display: 'flex', gap: 18 }}>
              <a href="/terms.html" style={{ fontSize: 12, color: INK_SOFT }}>Terms</a>
              <a href="/privacy.html" style={{ fontSize: 12, color: INK_SOFT }}>Privacy</a>
              <a href="/refund.html" style={{ fontSize: 12, color: INK_SOFT }}>Refunds</a>
              <a href="mailto:kssw117@gmail.com" style={{ fontSize: 12, color: INK_SOFT }}>kssw117@gmail.com</a>
            </div>
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
