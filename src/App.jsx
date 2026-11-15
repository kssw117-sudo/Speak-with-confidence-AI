import React, { useState, useEffect } from 'react';
import { PHRASE_CATEGORIES, PHRASE_GROUPS } from './phrases.js';

// Ответ сервера о пробной попытке или дневном лимите (считаются на сервере).
function guardError(data) {
  if (data && (data.code === 'trial_used' || data.code === 'limit_reached')) {
    const e = new Error(data.error || data.code);
    e.guardMessage = data.error;
    e.guardCode = data.code;
    return e;
  }
  return null;
}


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
// Короткий тест на уровень английского — без ИИ, просто вопросы с
// нарастающей сложностью, по результату выставляется уровень
const QUIZ_QUESTIONS = [
  { q: 'She ___ to the store yesterday.', options: ['go', 'goes', 'went', 'going'], correct: 2 },
  { q: "I have been working here ___ five years.", options: ['since', 'for', 'from', 'at'], correct: 1 },
  { q: 'If I ___ more time, I would learn another language.', options: ['have', 'had', 'will have', 'having'], correct: 1 },
  { q: 'By the time we arrived, the meeting ___.', options: ['already started', 'had already started', 'already starts', 'has already start'], correct: 1 },
  { q: 'Which sentence sounds most natural to a native speaker?', options: ['I am agree with you', 'I agree with you', 'I am agreeing with you', 'I do agree with you always'], correct: 1 },
];

function scoreToProficiency(correctCount) {
  if (correctCount <= 2) return 'Simple';
  if (correctCount <= 4) return 'Medium';
  return 'Fluent';
}

// Озвучка фраз из библиотеки/фразника — они всегда на английском,
// поэтому явно задаём язык и по возможности берём качественный
// англоязычный голос, иначе браузер может читать неправильно
function buildUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const enVoice = voices.find(v => v.lang === 'en-US' && /Google|Natural|Neural/i.test(v.name))
    || voices.find(v => v.lang === 'en-US')
    || voices.find(v => v.lang && v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;
  return utterance;
}

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
  { id: 'roleplay', label: 'Role-play', icon: 'chat' },
  { id: 'interview', label: 'Mock interview', icon: 'mic' },
  { id: 'voice', label: 'Voice practice', icon: 'wave' },
  { id: 'library', label: 'Phrase library', icon: 'library' },
  { id: 'checklist', label: 'Prep checklist', icon: 'check' },
  { id: 'phrasebook', label: 'My phrasebook', icon: 'notebook' },
];

const FEATURES = [
  { title: 'AI role-play', body: 'Practice the real conversation. The AI plays your manager, client or interviewer and pushes back.', icon: 'chat', page: 'roleplay',
    fullBody: 'Pick who you need to talk to and what is at stake. The AI stays in character, reacts to what you actually say, raises real objections and asks follow-up questions. Type or speak your answers. When you finish, you get a score, what you did well, what to fix, and stronger versions of your own lines.' },
  { title: 'Mock interview', body: 'Five realistic questions for your exact job, promotion or client call, then a scored review.', icon: 'mic', page: 'interview',
    fullBody: 'Tell it what the interview is for, a job, a promotion, a client or freelance project call, and you get five questions a real interviewer would ask, from easy to tricky. Answer each one by typing or speaking. Then you get an overall score, feedback on every answer and a stronger sample answer built from what you said.' },
  { title: 'Voice practice', body: 'Say it out loud. Repeat phrases after a native voice, or speak freely and get AI feedback.', icon: 'wave', page: 'voice',
    fullBody: 'Two ways to train your voice. Repeat after me: listen to a phrase, say it, and see which words came through clearly. Speak freely: pick a task like introducing yourself or explaining a delay, talk for up to two minutes, and see your pace and filler words. With your access code, the AI then scores how it sounded and gives you a stronger version to practice.' },
  { title: 'Scenario prep', body: 'Describe the conversation you\'re dreading, get exact talking points built for it.', icon: 'target', page: 'scenario',
    fullBody: 'You type the situation in plain, messy language — no need to explain it neatly. The AI reads it and builds five talking points specifically for that conversation: an opening line, how to state your position, a response to the pushback you\'re most likely to get, a way to hold firm, and a way to close well either direction. It\'s not generic advice — it\'s built around what you actually described.' },
  { title: 'Tone coaching', body: 'Not just what to say — where to pause, what to emphasize, how it should sound.', icon: 'wave', page: 'scenario',
    fullBody: 'Every Scenario prep result comes with a short note on delivery: where to slow down, what word to lean on, whether this moment calls for warmth or firmness. Words on a page and words said out loud land differently — this is the part that\'s easy to get right on paper and wrong in the room.' },
  { title: 'Cultural context', body: 'How direct is too direct, in the country you\'re actually speaking to.', icon: 'globe', page: 'scenario',
    fullBody: 'What sounds confident in one culture can sound blunt or even rude in another. Alongside your talking points, you get a short read on how direct or formal the moment calls for — so you don\'t accidentally undersell yourself, or come across sharper than you meant to.' },
  { title: 'Personal phrasebook', body: 'Save the lines that worked. Build your own arsenal over time.', icon: 'bookmark', page: 'phrasebook',
    fullBody: 'Star any phrase from the library, and it lands here. Over time this becomes your own personal collection of lines that actually worked for you — not generic advice, but your own track record of what landed.' },
  { title: 'Phrase library', body: '1,000+ ready lines for work and everyday life. Browse instantly, no generation needed.', icon: 'library', page: 'library',
    fullBody: 'More than 1,000 ready-made phrases across 26 situations: salary talks, interviews, difficult clients, meetings, deadlines, remote calls, freelance projects, a new job, presentations, sales, setting boundaries, complaints and more. Search them, hear any line read aloud, and star the ones you want to keep.' },
  { title: 'Prep checklist', body: 'A structured checklist before you walk in — breathing, key points, posture.', icon: 'check', page: 'checklist',
    fullBody: 'A short, practical checklist to run through right before the conversation starts: say your opening line out loud once, name the outcome you actually want, think through the objection you\'re most afraid of, breathe, sit up straight, know your walk-away point. Plus a rehearsal timer and voice practice to actually say it out loud.' },
  { title: 'Free voice playback', body: 'Hear any phrase read aloud through your browser, at no extra cost.', icon: 'speaker', page: 'library',
    fullBody: 'Every phrase in the library and your phrasebook can be read aloud through your browser\'s own voice, completely free — no API calls, no cost. Hearing a line out loud, not just reading it, is often the difference between a phrase that sounds natural and one that doesn\'t.' },
  { title: 'Practice tracker', body: 'See how many scenarios you\'ve rehearsed. Simple streaks, no pressure.', icon: 'trend', page: 'checklist',
    fullBody: 'A quiet counter of how many times you\'ve rehearsed with the timer or voice practice. No streak pressure, no guilt trips — just a simple, honest number so you can see the habit building.' },
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
    case 'chat':
      return <svg {...common}><path d="M4 5.5h11a2 2 0 012 2v6a2 2 0 01-2 2H9l-4 3.5V15.5H4a2 2 0 01-2-2v-6a2 2 0 012-2z" /><path d="M17 9.5h3a2 2 0 012 2v5a2 2 0 01-2 2h-1v3l-3.5-3H12" /></svg>;
    case 'mic':
      return <svg {...common}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7" /></svg>;
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

// Библиотека фраз (1000+) вынесена в src/phrases.js

// Дневной лимит генераций для тех, кто уже разблокировал доступ кодом —
// защита от злоупотребления одним купленным кодом, тот же паттерн, что
// используется в остальных продуктах Plainwork
const DAILY_LIMIT = 50;
const DAILY_KEY = 'swc_daily_gen';

function getDailyCount() {
  try {
    const record = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    const today = new Date().toDateString();
    if (!record || record.date !== today) return 0;
    return record.count;
  } catch (e) { return 0; }
}

function incrementDailyCount() {
  const today = new Date().toDateString();
  let record;
  try {
    record = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
  } catch (e) { record = null; }
  if (!record || record.date !== today) {
    record = { date: today, count: 0 };
  }
  record.count += 1;
  localStorage.setItem(DAILY_KEY, JSON.stringify(record));
  return record.count;
}

// Живое демо ролевой игры на главной: реплики появляются по очереди, когда блок виден
const DEMO_CHAT = [
  { role: 'ai', text: "Budgets are tight this year. Why should we raise your salary now?" },
  { role: 'me', text: "Because I led the client migration that kept our two largest accounts." },
  { role: 'ai', text: "Everyone worked hard this year. What makes your case different?" },
  { role: 'me', text: "The numbers. That project protected around 400,000 dollars in yearly revenue." },
  { role: 'ai', text: "Fair point. What number do you have in mind?" },
  { role: 'me', text: "Based on my results and market data, I'm asking for a 12 percent increase." },
];

function LiveDemo({ onTry }) {
  const [shown, setShown] = React.useState(0);
  const [typing, setTyping] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!visible) return;
    if (shown >= DEMO_CHAT.length) {
      const t = setTimeout(() => setShown(0), 5000);
      return () => clearTimeout(t);
    }
    const next = DEMO_CHAT[shown];
    setTyping(next.role === 'ai');
    const t = setTimeout(() => { setTyping(false); setShown(n => n + 1); }, shown === 0 ? 700 : next.role === 'ai' ? 1700 : 1300);
    return () => clearTimeout(t);
  }, [visible, shown]);
  return (
    <div ref={ref} style={{ background: '#FAFBFC', borderRadius: 20, border: `1px solid ${LINE}`, padding: '22px 20px', minHeight: 430, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `1px solid ${LINE}`, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: SKY_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{'\u{1F454}'}</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Your manager</div>
          <div style={{ fontSize: 11.5, color: INK_SOFT }}>AI role-play &middot; Tough mode</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, alignContent: 'start', flex: 1 }}>
        {DEMO_CHAT.slice(0, shown).map((m, i) => (
          <div key={i} className="result-card-anim" style={{
            justifySelf: m.role === 'me' ? 'end' : 'start', maxWidth: '85%',
            background: m.role === 'me' ? SKY : '#FFF', color: m.role === 'me' ? '#FFF' : INK,
            border: m.role === 'me' ? 'none' : `1px solid ${LINE}`,
            padding: '10px 14px', borderRadius: m.role === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 13.5, lineHeight: 1.5,
          }}>{m.text}</div>
        ))}
        {typing && (
          <div className="demo-typing" style={{ justifySelf: 'start', background: '#FFF', border: `1px solid ${LINE}`, borderRadius: '14px 14px 14px 4px', padding: '12px 16px', display: 'flex', gap: 5 }}>
            <span /><span /><span />
          </div>
        )}
      </div>
      {shown >= DEMO_CHAT.length && (
        <div className="result-card-anim" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: SKY_PALE, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span><strong style={{ color: SKY_DEEP }}>Score 86/100.</strong> Clear ask, backed by numbers.</span>
          <button onClick={onTry} style={{ background: 'none', border: 'none', color: SKY_DEEP, fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>Try it &rarr;</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState(() => {
    // Ссылки вида swc.plainwork.website/#roleplay открывают нужный раздел
    const h = (window.location.hash || '').replace('#', '');
    if (h && (PAGES.some(p => p.id === h) || h === 'progress')) return h;
    return localStorage.getItem('swc_last_page') || 'home';
  });
  const isPopStateRef = React.useRef(false);
  const [situation, setSituation] = useState(() => localStorage.getItem('swc_draft_situation') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('swc_draft_role') || '');
  const [outputLang, setOutputLang] = useState(() => localStorage.getItem('swc_output_lang') || 'English');
  const [proficiency, setProficiency] = useState(() => localStorage.getItem('swc_proficiency') || 'Fluent');
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);

  function answerQuiz(optionIndex) {
    const nextAnswers = [...quizAnswers, optionIndex];
    setQuizAnswers(nextAnswers);
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      const correctCount = nextAnswers.filter((a, i) => a === QUIZ_QUESTIONS[i].correct).length;
      const level = scoreToProficiency(correctCount);
      setQuizResult({ correctCount, level });
      setProficiency(level);
    }
  }

  function resetQuiz() {
    setQuizOpen(false);
    setQuizStep(0);
    setQuizAnswers([]);
    setQuizResult(null);
  }

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
  const [freeTrialCount, setFreeTrialCount] = useState(() => parseInt(localStorage.getItem('swc_free_trial_count') || '0', 10));
  const FREE_TRIAL_LIMIT = 3;
  const [dailyCount, setDailyCount] = useState(() => getDailyCount());
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [showHelpBubble, setShowHelpBubble] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [speakingText, setSpeakingText] = useState(null);
  const [speakingPaused, setSpeakingPaused] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState(null);

  function toggleSpeak(text) {
    if (!window.speechSynthesis) return;
    // Пауза/resume в Web Speech API нестабильна в некоторых браузерах —
    // "залипает" и ломает все последующие попытки озвучить что-то новое.
    // Поэтому вместо настоящей паузы делаем надёжный стоп/старт.
    window.speechSynthesis.cancel();
    if (speakingText === text) {
      // Повторный клик по той же фразе — просто останавливаем
      setSpeakingText(null);
      setSpeakingPaused(false);
      return;
    }
    const utterance = buildUtterance(text);
    utterance.onend = () => { setSpeakingText(null); setSpeakingPaused(false); };
    utterance.onerror = () => { setSpeakingText(null); setSpeakingPaused(false); };
    setSpeakingText(text);
    setSpeakingPaused(false);
    window.speechSynthesis.speak(utterance);
  }


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
    localStorage.setItem('swc_proficiency', proficiency);
  }, [proficiency]);

  useEffect(() => {
    try {
      if (result) localStorage.setItem('swc_last_result', JSON.stringify(result));
    } catch (e) { /* превышена квота localStorage — пропускаем, не критично */ }
  }, [result]);

  useEffect(() => {
    localStorage.setItem('swc_last_page', page);
  }, [page]);

  // Синхронизация со стрелками "назад"/"вперёд" в браузере и свайпами на
  // телефоне — без этого они не знают о переключениях между страницами,
  // потому что те происходят через state, а не настоящие URL
  useEffect(() => {
    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }
    window.history.pushState({ page }, '', '#' + page);
  }, [page]);

  useEffect(() => {
    function handlePopState(e) {
      isPopStateRef.current = true;
      setPage(e.state?.page || 'home');
    }
    window.history.replaceState({ page }, '', '#' + page);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const id = setTimeout(() => setTimerSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerSeconds]);

  function startTimer(seconds) {
    setTimerSeconds(seconds);
    setTimerRunning(true);
  }

  const [activeDays, setActiveDays] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem('swc_active_days') || '[]'); return Array.isArray(d) ? d : []; } catch (e) { return []; }
  });
  function markActiveDay() {
    const today = new Date().toISOString().slice(0, 10);
    setActiveDays(prev => {
      if (prev.includes(today)) return prev;
      const next = [...prev, today].slice(-400);
      try { localStorage.setItem('swc_active_days', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }
  function logPractice() {
    const next = practiceCount + 1;
    setPracticeCount(next);
    localStorage.setItem('swc_practice_count', String(next));
    markActiveDay();
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
    if (!unlocked && freeTrialCount >= FREE_TRIAL_LIMIT) return; // форма скрыта в этом случае, но на всякий случай
    if (unlocked && dailyCount >= DAILY_LIMIT) return; // форма скрыта в этом случае, но на всякий случай
    setLoading(true);
    setGenerateError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, userRole, outputLang, proficiency, licenseCode: localStorage.getItem('swc_licenseCode') || '' }),
      });
      const data = await res.json();
      { const ge = guardError(data); if (ge && ge.guardCode === 'trial_used') { localStorage.setItem('swc_free_trial_count', String(FREE_TRIAL_LIMIT)); setFreeTrialCount(FREE_TRIAL_LIMIT); } }
      if (!res.ok) {
        setGenerateError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setResult(data);
      setCardIndex(0);
      if (!unlocked) {
        const next = freeTrialCount + 1;
        localStorage.setItem('swc_free_trial_count', String(next));
        setFreeTrialCount(next);
      } else {
        setDailyCount(incrementDailyCount());
      }
    } catch (e) {
      setGenerateError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // ===================== Ролевая игра и пробное собеседование =====================
  // Доступны с кодом доступа. Каждый запрос к AI считается в дневном лимите.
  const ROLEPLAY_PRESETS = [
    { tag: 'Salary talk', partner: 'My manager, busy and careful with budget', scenario: 'I want to ask for a raise after a strong year, but budgets are tight.' },
    { tag: 'Job interview', partner: 'A hiring manager at the company', scenario: 'A job interview for a role I really want.' },
    { tag: 'Difficult client', partner: 'An unhappy client who thinks the work is late and not good enough', scenario: 'The client is upset and threatens to cancel the contract.' },
    { tag: 'Missed deadline', partner: 'My manager, who expected the work today', scenario: 'I need to tell my manager the project will be three days late and propose a plan.' },
    { tag: 'Freelance client', partner: 'A new client who wants more work for the same price', scenario: 'The client keeps adding tasks that are outside the agreed scope.' },
    { tag: 'Saying no', partner: 'A colleague who keeps asking me to do their tasks', scenario: 'I want to decline another request without damaging the relationship.' },
    { tag: 'Giving feedback', partner: 'A team member who keeps missing deadlines', scenario: 'I need to give honest feedback about missed deadlines.' },
    { tag: 'Price negotiation', partner: 'A potential client who says my price is too high', scenario: 'Negotiating the price of a project without dropping my rate too much.' },
  ];
  const INTERVIEW_KINDS = ['Job interview', 'Promotion interview', 'Client call', 'Freelance project call'];
  const LANG_CODES = { English: 'en-US', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE', Portuguese: 'pt-BR', Italian: 'it-IT', Russian: 'ru-RU', Ukrainian: 'uk-UA', Polish: 'pl-PL', Dutch: 'nl-NL', Turkish: 'tr-TR', Arabic: 'ar-SA', Hindi: 'hi-IN', Chinese: 'zh-CN', Japanese: 'ja-JP', Korean: 'ko-KR', Vietnamese: 'vi-VN', Thai: 'th-TH', Indonesian: 'id-ID', Swedish: 'sv-SE', Norwegian: 'nb-NO', Danish: 'da-DK', Finnish: 'fi-FI', Greek: 'el-GR', Czech: 'cs-CZ', Romanian: 'ro-RO', Hungarian: 'hu-HU', Hebrew: 'he-IL', Persian: 'fa-IR', Bengali: 'bn-IN', Urdu: 'ur-PK', Filipino: 'fil-PH', Malay: 'ms-MY', Swahili: 'sw-KE', Serbian: 'sr-RS' };
  const langCode = LANG_CODES[outputLang] || 'en-US';

  const [rpPartner, setRpPartner] = useState(() => localStorage.getItem('swc_rp_partner') || '');
  const [rpScenario, setRpScenario] = useState(() => localStorage.getItem('swc_rp_scenario') || '');
  const [rpDifficulty, setRpDifficulty] = useState(() => localStorage.getItem('swc_rp_difficulty') || 'realistic');
  const [rpMessages, setRpMessages] = useState([]);
  const [rpInput, setRpInput] = useState('');
  const [rpLoading, setRpLoading] = useState(false);
  const [rpError, setRpError] = useState('');
  const [rpFeedback, setRpFeedback] = useState(null);
  const RP_MAX_TURNS_FULL = 12;
  const RP_TRIAL_TURNS = 3;
  const [rpTrialUsed, setRpTrialUsed] = useState(() => localStorage.getItem('swc_rp_trial_used') === 'true');
  function markRpTrialUsed() { setRpTrialUsed(true); try { localStorage.setItem('swc_rp_trial_used', 'true'); } catch (e) {} }
  const [rpAutoSpeak, setRpAutoSpeak] = useState(() => localStorage.getItem('swc_rp_autospeak') === 'true');
  useEffect(() => { try { localStorage.setItem('swc_rp_autospeak', String(rpAutoSpeak)); } catch (e) {} }, [rpAutoSpeak]);

  const [ivKind, setIvKind] = useState(() => localStorage.getItem('swc_iv_kind') || 'Job interview');
  const [ivTarget, setIvTarget] = useState(() => localStorage.getItem('swc_iv_target') || '');
  const [ivBackground, setIvBackground] = useState(() => localStorage.getItem('swc_iv_background') || '');
  const [ivQuestions, setIvQuestions] = useState([]);
  const [ivAnswers, setIvAnswers] = useState([]);
  const [ivStep, setIvStep] = useState(0);
  const [ivLoading, setIvLoading] = useState(false);
  const [ivError, setIvError] = useState('');
  const [ivReview, setIvReview] = useState(null);

  const [practiceHistory, setPracticeHistory] = useState(() => {
    try { const h = JSON.parse(localStorage.getItem('swc_practice_history') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; }
  });

  useEffect(() => { try { localStorage.setItem('swc_rp_partner', rpPartner); localStorage.setItem('swc_rp_scenario', rpScenario); localStorage.setItem('swc_rp_difficulty', rpDifficulty); } catch (e) {} }, [rpPartner, rpScenario, rpDifficulty]);
  useEffect(() => { try { localStorage.setItem('swc_iv_kind', ivKind); localStorage.setItem('swc_iv_target', ivTarget); localStorage.setItem('swc_iv_background', ivBackground); } catch (e) {} }, [ivKind, ivTarget, ivBackground]);

  // Карточка результата: картинка 1200x630, которой можно поделиться или скачать
  const [shareNote, setShareNote] = useState('');
  async function shareResult({ score, what }) {
    try {
      const W = 1200, H = 630;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#EAF4FC'); g.addColorStop(1, '#FFFFFF');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(94,168,224,0.18)';
      x.beginPath(); x.arc(1080, 90, 220, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(120, 600, 160, 0, Math.PI * 2); x.fill();
      const serif = "600 {S}px Fraunces, Georgia, 'Times New Roman', serif";
      const sans = "{W} {S}px Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
      x.fillStyle = SKY_DEEP; x.font = sans.replace('{W}', '600').replace('{S}', '26');
      x.fillText('SPEAK WITH CONFIDENCE', 80, 96);
      x.fillStyle = INK; x.font = serif.replace('{S}', '54');
      x.fillText('I practiced before the real thing', 80, 196);
      x.fillStyle = SKY_DEEP; x.font = serif.replace('{S}', '200');
      const sc = String(Math.round(Number(score) || 0));
      x.fillText(sc, 72, 420);
      const sw = x.measureText(sc).width;
      x.fillStyle = INK_SOFT; x.font = serif.replace('{S}', '64');
      x.fillText('/100', 92 + sw, 420);
      x.fillStyle = INK; x.font = sans.replace('{W}', '400').replace('{S}', '32');
      let line = String(what || '').trim();
      if (line.length > 58) line = line.slice(0, 56) + '…';
      x.fillText(line.charAt(0).toUpperCase() + line.slice(1), 80, 486);
      x.fillStyle = INK_SOFT; x.font = sans.replace('{W}', '400').replace('{S}', '26');
      x.fillText('Rehearse your next hard conversation at swc.plainwork.website', 80, 566);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'my-practice-score.png', { type: 'image/png' });
      const text = `I scored ${sc}/100 practicing a ${String(what || 'hard conversation')} with Speak With Confidence. https://swc.plainwork.website`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'my-practice-score.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      try { await navigator.clipboard.writeText(text); setShareNote('Image saved, and a ready caption is copied. Paste it into LinkedIn or your stories.'); }
      catch (e) { setShareNote('Image saved. Post it on LinkedIn or in your stories.'); }
      setTimeout(() => setShareNote(''), 6000);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      setShareNote('Could not create the image in this browser.');
      setTimeout(() => setShareNote(''), 5000);
    }
  }

  function addHistory(entry) {
    setPracticeHistory(prev => {
      const next = [{ ...entry, date: new Date().toISOString().slice(0, 10) }, ...prev].slice(0, 200);
      try { localStorage.setItem('swc_practice_history', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }

  // Один запрос к серверу для ролевой игры и собеседования
  async function callPractice(payload) {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, outputLang, userRole, licenseCode: unlocked ? (localStorage.getItem('swc_licenseCode') || '') : '', trial: !unlocked && String(payload.mode || '').startsWith('roleplay') }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.code === 'trial_used') {
      markRpTrialUsed();
      throw new Error(data.error || 'Your free role-play is used. Enter your access code to keep practicing.');
    }
    if (res.status === 403 && data.code === 'invalid_code') {
      setUnlocked(false);
      localStorage.removeItem('swc_unlocked');
      throw new Error('Your access code was not accepted. Please enter it again.');
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    if (unlocked) setDailyCount(incrementDailyCount());
    return data;
  }

  // Голосовой ввод ответа (бесплатно, через браузер)
  const [dictating, setDictating] = useState(null);
  const dictationRef = React.useRef(null);
  function toggleDictation(target, setter, currentText) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alertVoice(); return; }
    if (dictating) { dictationRef.current?.stop(); return; }
    const base = currentText ? currentText.trim() + ' ' : '';
    const recognition = new SpeechRecognition();
    recognition.lang = langCode;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let t = '';
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript;
      setter(base + t);
    };
    recognition.onend = () => setDictating(null);
    recognition.onerror = () => setDictating(null);
    dictationRef.current = recognition;
    recognition.start();
    setDictating(target);
  }
  function alertVoice() {
    setRpError('Voice input works in Chrome and Edge. You can still type your answer.');
    setIvError('Voice input works in Chrome and Edge. You can still type your answer.');
  }

  function speakIn(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode;
    u.rate = 0.97;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(langCode.slice(0, 2)));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  async function startRoleplay() {
    if (!rpScenario.trim()) return;
    setRpError(''); setRpFeedback(null); setRpMessages([]); setRpLoading(true);
    try {
      const data = await callPractice({ mode: 'roleplay', scenario: rpScenario, partner: rpPartner, difficulty: rpDifficulty, messages: [] });
      setRpMessages([{ role: 'assistant', content: data.reply }]);
      if (rpAutoSpeak) speakIn(data.reply);
    } catch (e) { setRpError(e.message); } finally { setRpLoading(false); }
  }

  async function sendRoleplay() {
    const text = rpInput.trim();
    if (!text || rpLoading) return;
    if (dictating) dictationRef.current?.stop();
    const next = [...rpMessages, { role: 'user', content: text }];
    setRpMessages(next); setRpInput(''); setRpError(''); setRpLoading(true);
    try {
      const data = await callPractice({ mode: 'roleplay', scenario: rpScenario, partner: rpPartner, difficulty: rpDifficulty, messages: next });
      setRpMessages([...next, { role: 'assistant', content: data.reply }]);
      if (rpAutoSpeak) speakIn(data.reply);
    } catch (e) { setRpError(e.message); } finally { setRpLoading(false); }
  }

  async function finishRoleplay() {
    if (rpLoading) return;
    setRpError(''); setRpLoading(true);
    try {
      const data = await callPractice({ mode: 'roleplay-feedback', scenario: rpScenario, partner: rpPartner, messages: rpMessages });
      setRpFeedback(data);
      if (!unlocked) markRpTrialUsed();
      logPractice();
      addHistory({ type: 'Role-play', title: rpPartner || rpScenario.slice(0, 60), score: data.score });
    } catch (e) { setRpError(e.message); } finally { setRpLoading(false); }
  }

  function resetRoleplay() { setRpMessages([]); setRpFeedback(null); setRpInput(''); setRpError(''); }

  async function startInterview() {
    if (!ivTarget.trim()) return;
    setIvError(''); setIvReview(null); setIvQuestions([]); setIvAnswers([]); setIvStep(0); setIvLoading(true);
    try {
      const data = await callPractice({ mode: 'interview-start', kind: ivKind, target: ivTarget, background: ivBackground });
      setIvQuestions(data.questions);
      setIvAnswers(data.questions.map(() => ''));
    } catch (e) { setIvError(e.message); } finally { setIvLoading(false); }
  }

  async function finishInterview() {
    if (ivLoading) return;
    if (dictating) dictationRef.current?.stop();
    setIvError(''); setIvLoading(true);
    try {
      const data = await callPractice({ mode: 'interview-review', kind: ivKind, target: ivTarget, qa: ivQuestions.map((q, i) => ({ q, a: ivAnswers[i] || '' })) });
      setIvReview(data);
      logPractice();
      addHistory({ type: ivKind, title: ivTarget.slice(0, 60), score: data.overall });
    } catch (e) { setIvError(e.message); } finally { setIvLoading(false); }
  }

  function resetInterview() { setIvQuestions([]); setIvAnswers([]); setIvStep(0); setIvReview(null); setIvError(''); }

  const rpUserTurns = rpMessages.filter(m => m.role === 'user').length;
  const practiceLimitReached = unlocked && dailyCount >= DAILY_LIMIT;
  const rpTrial = !unlocked;
  const RP_MAX_TURNS = rpTrial ? RP_TRIAL_TURNS : RP_MAX_TURNS_FULL;
  const rpTrialActive = rpTrial && (rpMessages.length > 0 || Boolean(rpFeedback));

  // ===================== Голосовая практика =====================
  // «Повтори за мной» — бесплатно, без ИИ, распознавание речи в браузере.
  // «Говори свободно» — запись речи, темп и слова-паразиты считаются в браузере,
  // разбор от ИИ — с кодом доступа.
  const VOICE_TOPICS = [
    'Introduce yourself in 60 seconds',
    'Explain a project delay to a client',
    'Ask your manager for a raise',
    'Say no to an extra task politely',
    'Pitch your service in one minute',
    'Give feedback to a colleague',
    'Describe your biggest achievement at work',
    'Open a meeting and set the agenda',
  ];
  const FILLERS = ['um', 'uh', 'er', 'erm', 'hmm', 'like', 'you know', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'i mean'];
  const HEDGES = ['just', 'maybe', 'i think', 'i guess', 'sorry', 'a little bit', 'probably', 'i hope', 'i feel like'];

  const [vpTab, setVpTab] = useState(() => localStorage.getItem('swc_vp_tab') || 'repeat');
  useEffect(() => { try { localStorage.setItem('swc_vp_tab', vpTab); } catch (e) {} }, [vpTab]);

  // --- Повтори за мной
  const [vpCategory, setVpCategory] = useState(() => localStorage.getItem('swc_vp_category') || PHRASE_CATEGORIES[0].name);
  useEffect(() => { try { localStorage.setItem('swc_vp_category', vpCategory); } catch (e) {} }, [vpCategory]);
  const vpPool = vpCategory === '__saved' ? savedPhrases : ((PHRASE_CATEGORIES.find(c => c.name === vpCategory) || PHRASE_CATEGORIES[0]).phrases);
  const [vpIndex, setVpIndex] = useState(0);
  const vpPhrase = vpPool.length ? vpPool[vpIndex % vpPool.length] : '';
  const [vpHeard, setVpHeard] = useState('');
  const [vpListening, setVpListening] = useState(false);
  const [vpResult, setVpResult] = useState(null);
  const [vpError, setVpError] = useState('');
  const [vpDone, setVpDone] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem('swc_vp_done') || 'null'); return r && r.date === new Date().toISOString().slice(0, 10) ? r.count : 0; } catch (e) { return 0; }
  });
  const vpRecRef = React.useRef(null);

  function normWords(t) {
    return String(t).toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  }
  // Какие слова фразы прозвучали (наибольшая общая подпоследовательность)
  function compareSpeech(target, spoken) {
    const a = normWords(target), b = normWords(spoken);
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hit = new Array(a.length).fill(false);
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { hit[i] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    const shown = String(target).split(/\s+/).filter(Boolean);
    const words = shown.map((w, k) => ({ w, ok: hit[k] !== false }));
    const score = a.length ? Math.round(hit.filter(Boolean).length / a.length * 100) : 0;
    return { score, words };
  }

  function speakEnglish(text, rate) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = buildUtterance(text);
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }

  function vpRecord() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVpError('Voice practice works in Chrome and Edge on a computer or Android phone.'); return; }
    if (vpListening) { vpRecRef.current?.stop(); return; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setVpError(''); setVpHeard(''); setVpResult(null);
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      finalText = t;
      setVpHeard(t);
    };
    rec.onerror = (e) => {
      setVpError(e && e.error === 'not-allowed' ? 'Please allow microphone access in your browser and try again.' : e && e.error === 'network' ? 'Your browser could not reach its speech service. Voice practice works best in Google Chrome or Microsoft Edge.' : 'I could not hear you clearly. Try again a little closer to the microphone.');
    };
    rec.onend = () => {
      setVpListening(false);
      if (finalText.trim()) {
        setVpResult(compareSpeech(vpPhrase, finalText));
        try { localStorage.setItem('swc_vp_total', String((parseInt(localStorage.getItem('swc_vp_total') || '0', 10) || 0) + 1)); } catch (e) {}
        setVpDone(prev => {
          const n = prev + 1;
          try { localStorage.setItem('swc_vp_done', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: n })); } catch (e) {}
          return n;
        });
        logPractice();
      }
    };
    vpRecRef.current = rec;
    rec.start();
    setVpListening(true);
  }

  function vpNext() {
    if (vpListening) vpRecRef.current?.stop();
    setVpHeard(''); setVpResult(null); setVpError('');
    if (vpPool.length > 1) {
      let n = vpIndex;
      while (n % vpPool.length === vpIndex % vpPool.length) n = Math.floor(Math.random() * vpPool.length);
      setVpIndex(n);
    }
  }

  // --- Говори свободно
  const [fsTopic, setFsTopic] = useState(() => localStorage.getItem('swc_fs_topic') || VOICE_TOPICS[0]);
  useEffect(() => { try { localStorage.setItem('swc_fs_topic', fsTopic); } catch (e) {} }, [fsTopic]);
  const [fsRecording, setFsRecording] = useState(false);
  const [fsTranscript, setFsTranscript] = useState('');
  const [fsSeconds, setFsSeconds] = useState(0);
  const [fsStats, setFsStats] = useState(null);
  const [fsFeedback, setFsFeedback] = useState(null);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsError, setFsError] = useState('');
  const fsRef = React.useRef({ rec: null, on: false, finals: '', interim: '', start: 0, timer: null });
  const FS_MAX_SECONDS = 120;

  function countPhrases(text, list) {
    const t = ' ' + normWords(text).join(' ') + ' ';
    const found = [];
    let total = 0;
    for (const f of list) {
      const n = t.split(' ' + f + ' ').length - 1;
      if (n > 0) { found.push(n > 1 ? `${f} ×${n}` : f); total += n; }
    }
    return { total, found };
  }

  function fsStop() {
    const st = fsRef.current;
    if (!st.on) return;
    st.on = false;
    clearInterval(st.timer);
    try { st.rec && st.rec.stop(); } catch (e) {}
    setFsRecording(false);
    const text = (st.finals + ' ' + st.interim).replace(/\s+/g, ' ').trim();
    const secs = Math.max(1, Math.round((Date.now() - st.start) / 1000));
    setFsTranscript(text);
    setFsSeconds(secs);
    if (!text) { setFsError('I did not catch any speech. Check your microphone and try again.'); return; }
    const words = normWords(text).length;
    setFsStats({ words, seconds: secs, wpm: Math.round(words / (secs / 60)), fillers: countPhrases(text, FILLERS), hedges: countPhrases(text, HEDGES) });
    logPractice();
  }

  function fsStart() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setFsError('Voice practice works in Chrome and Edge on a computer or Android phone.'); return; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setFsError(''); setFsTranscript(''); setFsStats(null); setFsFeedback(null); setFsSeconds(0);
    const st = fsRef.current;
    st.on = true; st.finals = ''; st.interim = ''; st.start = Date.now();
    const begin = () => {
      const rec = new SR();
      rec.lang = langCode;
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) st.finals += ' ' + e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        st.interim = interim;
        setFsTranscript((st.finals + ' ' + interim).trim());
      };
      rec.onerror = (e) => {
        if (e && (e.error === 'not-allowed' || e.error === 'network')) {
          st.on = false; clearInterval(st.timer); setFsRecording(false);
          setFsError(e.error === 'network' ? 'Your browser could not reach its speech service. Voice practice works best in Google Chrome or Microsoft Edge.' : 'Please allow microphone access in your browser and try again.');
        }
      };
      // Браузер сам останавливает запись после паузы — продолжаем, пока человек не нажал «Стоп»
      rec.onend = () => { if (st.on) { st.finals += ' ' + st.interim; st.interim = ''; try { begin(); } catch (e) { fsStop(); } } };
      st.rec = rec;
      rec.start();
    };
    begin();
    st.timer = setInterval(() => {
      const secs = Math.round((Date.now() - st.start) / 1000);
      setFsSeconds(secs);
      if (secs >= FS_MAX_SECONDS) fsStop();
    }, 500);
    setFsRecording(true);
  }

  async function fsGetFeedback() {
    if (fsLoading || !fsTranscript) return;
    setFsError(''); setFsLoading(true);
    try {
      const data = await callPractice({ mode: 'voice-feedback', topic: fsTopic, transcript: fsTranscript, seconds: fsSeconds });
      setFsFeedback(data);
      addHistory({ type: 'Voice practice', title: fsTopic.slice(0, 60), score: data.score });
    } catch (e) { setFsError(e.message); } finally { setFsLoading(false); }
  }

  useEffect(() => () => { const st = fsRef.current; st.on = false; clearInterval(st.timer); try { st.rec && st.rec.stop(); } catch (e) {} }, []);
  useEffect(() => { if (page !== 'voice') { if (fsRef.current.on) fsStop(); if (vpListening) vpRecRef.current?.stop(); } }, [page]);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ===================== Бесплатный PDF за email =====================
  const [leadEmail, setLeadEmail] = useState('');
  const [leadState, setLeadState] = useState(() => localStorage.getItem('swc_lead_done') === 'true' ? 'done' : 'idle');
  const [leadError, setLeadError] = useState('');
  async function submitLead(e) {
    if (e) e.preventDefault();
    if (leadState === 'sending') return;
    setLeadError(''); setLeadState('sending');
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'subscribe', email: leadEmail, source: 'home' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setLeadState('done');
      try { localStorage.setItem('swc_lead_done', 'true'); } catch (err) {}
      window.open(data.pdf || '/salary-talk-phrasebook.pdf', '_blank');
    } catch (err) { setLeadError(err.message); setLeadState('idle'); }
  }

  // ===================== Прогресс =====================
  const progressStats = (() => {
    const days = new Set(activeDays);
    const dayKey = (d) => d.toISOString().slice(0, 10);
    let streak = 0;
    const cur = new Date();
    if (!days.has(dayKey(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
    while (days.has(dayKey(cur))) { streak++; cur.setUTCDate(cur.getUTCDate() - 1); }
    const scored = practiceHistory.filter(h => Number.isFinite(Number(h.score)));
    const scores = scored.map(h => Number(h.score));
    const recent = scores.slice(0, 10);
    const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;
    const best = scores.length ? Math.max(...scores) : null;
    const byType = {};
    scored.forEach(h => { const k = h.type || 'Practice'; (byType[k] = byType[k] || []).push(Number(h.score)); });
    const types = Object.entries(byType).map(([k, v]) => ({ type: k, count: v.length, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.count - a.count);
    const last28 = [];
    for (let i = 27; i >= 0; i--) { const d = new Date(); d.setUTCDate(d.getUTCDate() - i); const k = dayKey(d); last28.push({ k, on: days.has(k), today: i === 0 }); }
    let vpTotal = 0;
    try { vpTotal = parseInt(localStorage.getItem('swc_vp_total') || '0', 10) || 0; } catch (e) {}
    const chart = scored.slice(0, 20).reverse();
    const firstHalf = chart.slice(0, Math.floor(chart.length / 2)).map(h => Number(h.score));
    const secondHalf = chart.slice(Math.floor(chart.length / 2)).map(h => Number(h.score));
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const trend = chart.length >= 4 ? Math.round(mean(secondHalf) - mean(firstHalf)) : null;
    return { streak, avg, best, types, last28, vpTotal, chart, trend, activeTotal: days.size };
  })();

  // Библиотека: вкладки по группам и категориям
  const [libraryGroup, setLibraryGroup] = useState('Work');
  const [libraryCategory, setLibraryCategory] = useState(null);

  // Достижения — считаются на лету из уже отслеживаемых данных,
  // никакого нового хранилища не требуется
  const totalGenerations = freeTrialCount + dailyCount;
  const ACHIEVEMENTS = [
    { label: 'First scenario prepped', done: totalGenerations >= 1 },
    { label: 'Phrase collector (5+ saved)', done: savedPhrases.length >= 5 },
    { label: 'Checklist regular (all items checked)', done: checkedItems.length >= 6 },
    { label: 'Dedicated practicer (10+ rehearsals)', done: practiceCount >= 10 },
    { label: 'Fluent tested', done: !!quizResult },
    { label: 'First role-play or mock interview', done: practiceHistory.length >= 1 },
    { label: 'Said 10 phrases out loud today', done: vpDone >= 10 },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.done).length;

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
        @keyframes pageFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .page-fade { animation: pageFadeIn 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .result-card-anim { animation: cardFadeIn 0.3s ease both; }
        textarea, input, select { font-family: inherit; }
        .ready-img { transition: transform 0.6s ease; }
        .ready-banner:hover .ready-img { transform: scale(1.04); }
        .demo-typing span { width: 7px; height: 7px; border-radius: 50%; background: #9AA8B5; animation: demoDot 1.2s infinite ease-in-out; }
        .demo-typing span:nth-child(2) { animation-delay: 0.15s; }
        .demo-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes demoDot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @keyframes statPop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .stat-pop { animation: statPop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes marqueeScroll { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
        .marquee-track { display: flex; width: max-content; animation: marqueeScroll 42s linear infinite; will-change: transform; backface-visibility: hidden; transform: translateZ(0); }
        @keyframes helpBubbleBounce { 0%, 100% { transform: translateY(0); } 15% { transform: translateY(-10px); } 30% { transform: translateY(0); } 40% { transform: translateY(-5px); } 50% { transform: translateY(0); } }
        .help-bubble-btn:hover { animation: helpBubbleBounce 0.9s ease-in-out infinite; }
        @keyframes logoBubbleBounce { 0%, 100% { transform: translateY(0); } 20% { transform: translateY(-5px); } 40% { transform: translateY(0); } }
        .logo-bubble { animation: logoBubbleBounce 2.4s ease-in-out infinite; transform-origin: bottom center; }
        .logo-bubble:hover { animation-play-state: paused; }
        .marquee-track img { image-rendering: -webkit-optimize-contrast; backface-visibility: hidden; transform: translateZ(0); }
        .marquee-wrap:hover .marquee-track { animation-play-state: paused; }
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
        padding: '16px 40px 0', borderBottom: `1px solid ${LINE}`, position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setPage('home')}>
            <svg className="logo-bubble" width="28" height="28" viewBox="0 0 200 190">
              <rect x="15" y="15" width="170" height="115" rx="40" fill={SKY} />
              <polygon points="55,130 40,165 80,132" fill={SKY} />
              <polyline points="65,72 92,100 140,50" stroke="#FFF" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="logo-text" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>Speak With Confidence</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setAccountOpen(v => !v)} aria-label="Your account" style={{
              background: accountOpen ? SKY_PALE : 'none', border: `1.5px solid ${accountOpen ? SKY : LINE}`, borderRadius: 999,
              cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accountOpen ? SKY_DEEP : INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
              </svg>
              {unlockedCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: SKY, color: '#FFF', fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unlockedCount}
                </span>
              )}
            </button>
            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
              </svg>
            </button>
          </div>
        </div>
        <nav className="desktop-nav" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '14px 16px' }}>
          {PAGES.slice(1).map(p => (
            <button key={p.id} onClick={() => setPage(p.id)} className="premium-btn"
              style={{
                background: page === p.id ? SKY : '#FFF',
                border: `1.5px solid ${page === p.id ? SKY : LINE}`,
                cursor: 'pointer', fontSize: 13.5,
                color: page === p.id ? '#FFF' : INK,
                fontWeight: 600,
                padding: '9px 15px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: page === p.id ? '0 3px 10px rgba(94,168,224,0.35)' : '0 1px 3px rgba(20,20,30,0.06)',
              }}>
              <FeatureIcon type={p.icon} color={page === p.id ? '#FFF' : SKY_DEEP} size={17} />
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {accountOpen && (
        <div style={{
          position: 'fixed', top: 70, right: 20, width: 300, maxWidth: 'calc(100vw - 40px)',
          background: '#FFF', borderRadius: 14, padding: 20, boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          border: `1px solid ${LINE}`, zIndex: 50,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Your progress</p>
          <p style={{ fontSize: 11.5, color: INK_SOFT, margin: '0 0 16px' }}>
            {unlocked ? 'Access unlocked' : `${freeTrialCount} of ${FREE_TRIAL_LIMIT} free previews used`}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div style={{ background: SKY_PALE, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: SKY_DEEP }}>{totalGenerations}</div>
              <div style={{ fontSize: 10.5, color: INK_SOFT }}>scenarios prepped</div>
            </div>
            <div style={{ background: SKY_PALE, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: SKY_DEEP }}>{practiceCount}</div>
              <div style={{ fontSize: 10.5, color: INK_SOFT }}>times rehearsed</div>
            </div>
            <div style={{ background: SKY_PALE, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: SKY_DEEP }}>{savedPhrases.length}</div>
              <div style={{ fontSize: 10.5, color: INK_SOFT }}>phrases saved</div>
            </div>
            <div style={{ background: SKY_PALE, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: SKY_DEEP }}>{checkedItems.length}</div>
              <div style={{ fontSize: 10.5, color: INK_SOFT }}>checklist items done</div>
            </div>
          </div>

          <button onClick={() => { setPage('progress'); setAccountOpen(false); }}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 18 }}>
            See my full progress &rarr;
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            Achievements ({unlockedCount}/{ACHIEVEMENTS.length})
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {ACHIEVEMENTS.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: a.done ? 1 : 0.4 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: a.done ? SKY : '#FFF', border: `1.5px solid ${a.done ? SKY : LINE}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </span>
                <span style={{ fontSize: 12, color: INK }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div style={{ position: 'sticky', top: 65, background: '#FFF', borderBottom: `1px solid ${LINE}`, zIndex: 9, padding: '8px 20px 16px' }}>
          {PAGES.slice(1).map(p => (
            <button key={p.id} onClick={() => { setPage(p.id); setMobileMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                background: page === p.id ? SKY : '#FFF',
                border: `1.5px solid ${page === p.id ? SKY : LINE}`, cursor: 'pointer', fontSize: 14.5,
                color: page === p.id ? '#FFF' : INK, fontWeight: 600,
                padding: '12px 14px', borderRadius: 10, marginTop: 6,
              }}>
              <FeatureIcon type={p.icon} color={page === p.id ? '#FFF' : SKY_DEEP} size={18} />
              {p.label}
            </button>
          ))}
        </div>
      )}

      {page === 'home' && (
        <div key="home" className="page-fade">
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
                <div className="stat-pop" style={{ animationDelay: '0.05s' }}><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>11</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>tools in one</div></div>
                <div className="stat-pop" style={{ animationDelay: '0.12s' }}><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>35</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>languages</div></div>
                <div className="stat-pop" style={{ animationDelay: '0.19s' }}><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>No</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>sign-up needed</div></div>
                <div className="stat-pop" style={{ animationDelay: '0.26s' }}><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>1,000+</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>ready phrases</div></div>
                <div className="stat-pop" style={{ animationDelay: '0.33s' }}><div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 38, color: SKY_DEEP }}>1</div><div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>time payment</div></div>
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

          {/* ---------- PHOTO MARQUEE (с подписями) ---------- */}
          <div className="marquee-wrap" style={{ overflow: 'hidden', padding: '48px 0', background: '#FAFBFC', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            <div className="marquee-track" style={{ gap: 28 }}>
              {[...Array(2)].flatMap((_, dup) =>
                [
                  { n: 5, caption: 'Steady on both sides of the table' },
                  { n: 1, caption: 'Calm before the door opens' },
                  { n: 2, caption: 'Your voice, already prepared' },
                  { n: 3, caption: 'Where the words actually happen' },
                  { n: 4, caption: 'First words, already right' },
                ].map(({ n, caption }) => (
                  <div key={`${dup}-${n}`} style={{ width: 420, flexShrink: 0 }}>
                    <img
                      src={`/images/hero${n}.jpg`}
                      alt={caption}
                      style={{ width: '100%', height: 236, objectFit: 'cover', display: 'block' }}
                    />
                    <p style={{ fontSize: 13, color: INK, fontWeight: 600, textAlign: 'center', marginTop: 10 }}>{caption}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---------- HOW IT WORKS ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px 8px' }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 34, textAlign: 'center', marginBottom: 10 }}>How it works</h2>
            <p style={{ textAlign: 'center', color: INK_SOFT, fontSize: 14, marginBottom: 44 }}>From nervous to ready in one evening</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                { n: '1', title: 'Describe the situation', body: 'A raise, a tough client, an interview. Say who you will talk to and what you want to get.', page: 'scenario', cta: 'Prepare talking points' },
                { n: '2', title: 'Practice out loud', body: 'The AI plays the other person and pushes back. Or repeat strong phrases after a native voice.', page: 'roleplay', cta: 'Try a role-play' },
                { n: '3', title: 'Walk in ready', body: 'Get a score, see what to fix and keep the best lines in your phrasebook for the real moment.', page: 'phrasebook', cta: 'Open my phrasebook' },
              ].map(st => (
                <div key={st.n} className="premium-card" onClick={() => setPage(st.page)}
                  style={{ padding: 26, borderRadius: 16, background: '#FFF', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 44, color: SKY_PALE, lineHeight: 1, marginBottom: 6, WebkitTextStroke: `1.5px ${SKY}` }}>{st.n}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{st.title}</div>
                  <div style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.55, marginBottom: 14 }}>{st.body}</div>
                  <div style={{ fontSize: 13, color: SKY_DEEP, fontWeight: 600 }}>{st.cta} &rarr;</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- COVER BANNER (та же картинка, что в превью ссылки) ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 24px 8px' }}>
            <div className="premium-card ready-banner" onClick={() => setPage('roleplay')} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setPage('roleplay'); }}
              style={{ borderRadius: 20, overflow: 'hidden', cursor: 'pointer', background: '#FFF' }}>
              <img src="/images/og-cover.jpg" alt="Rehearse the hard conversation before it happens" className="ready-img"
                style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button onClick={() => setPage('roleplay')} className="premium-btn"
                style={{ padding: '13px 26px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14, fontWeight: 600 }}>
                Try a free role-play &rarr;
              </button>
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
                <div key={i} className="premium-card" onClick={() => setExpandedFeature(i)}
                  style={{ padding: 22, borderRadius: 14, background: '#FFF', cursor: 'pointer' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: SKY_PALE, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FeatureIcon type={f.icon} color={SKY_DEEP} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- LIVE DEMO ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 24px 64px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>See it in action</div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 32, lineHeight: 1.2, margin: '0 0 14px' }}>Rehearse with someone who pushes back</h2>
                <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.6, margin: '0 0 22px' }}>
                  The AI stays in character as your manager, client or interviewer. It asks the awkward follow-up questions, so the real conversation holds no surprises.
                </p>
                <ul style={{ margin: '0 0 26px', paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
                  <li>Type or speak your answers</li>
                  <li>Friendly, realistic or tough mode</li>
                  <li>A score and stronger versions of your lines at the end</li>
                </ul>
                <button onClick={() => setPage('roleplay')} className="premium-btn"
                  style={{ padding: '13px 26px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14, fontWeight: 600 }}>
                  Start your own role-play &rarr;
                </button>
              </div>
              <LiveDemo onTry={() => setPage('roleplay')} />
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
                  <div key={i} className="premium-card" onClick={() => toggleSpeak(s.line)}
                    style={{ padding: 24, borderRadius: 14, background: '#FFF', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.tag}</div>
                      <span style={{ fontSize: 15, color: SKY_DEEP }}>
                        {speakingText === s.line ? '\u23F9' : '\u{1F50A}'}
                      </span>
                    </div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>&ldquo;{s.line}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- READY BANNER ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '72px 24px 8px' }}>
            <div className="premium-card ready-banner" onClick={() => setPage('interview')} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setPage('interview'); }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderRadius: 20, overflow: 'hidden', background: '#FFF', cursor: 'pointer' }}>
              <div style={{ minHeight: 300, overflow: 'hidden' }}>
                <img src="/images/ready.jpg" alt="Calm and ready before the interview" className="ready-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '40% 30%', display: 'block' }} />
              </div>
              <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Interview tomorrow?</div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 32, lineHeight: 1.2, margin: '0 0 14px' }}>
                  Walk in like you've already done it once
                </h2>
                <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.6, margin: '0 0 26px' }}>
                  Answer five real questions out loud tonight. Get a score, honest feedback and a stronger version of every answer, so tomorrow feels like a second take.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={e => { e.stopPropagation(); setPage('interview'); }} className="premium-btn"
                    style={{ padding: '13px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14, fontWeight: 600 }}>
                    Start a mock interview &rarr;
                  </button>
                  <button onClick={e => { e.stopPropagation(); setPage('voice'); }}
                    style={{ padding: '13px 20px', borderRadius: 999, border: `1px solid ${LINE}`, cursor: 'pointer', background: '#FFF', color: INK, fontSize: 14, fontWeight: 600 }}>
                    Practice out loud
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- FREE PDF ---------- */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px 8px' }}>
            <div style={{ borderRadius: 20, padding: '36px 32px', background: `linear-gradient(135deg, ${SKY_PALE}, #FFFFFF)`, border: '1px solid #CFE5F6', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Free PDF</div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 28, lineHeight: 1.2, margin: '0 0 10px' }}>The Salary Talk Phrasebook</h2>
                <p style={{ fontSize: 14, color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>40 calm lines for asking for a raise, handling a "not yet" and leaving with a plan, plus five things that change the outcome.</p>
              </div>
              {leadState === 'done' ? (
                <div style={{ padding: 20, borderRadius: 14, background: '#FFF', border: `1px solid ${LINE}` }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, margin: '0 0 6px' }}>It's yours</p>
                  <p style={{ fontSize: 13.5, color: INK_SOFT, margin: '0 0 14px' }}>If it didn't open, use the button below.</p>
                  <a href="/salary-talk-phrasebook.pdf" target="_blank" rel="noopener" className="premium-btn"
                    style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 999, background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Open the PDF</a>
                </div>
              ) : (
                <form onSubmit={submitLead}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="email" required value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="Your email"
                      style={{ flex: '1 1 200px', padding: '13px 16px', borderRadius: 999, border: `1px solid ${LINE}`, fontSize: 14, background: '#FFF' }} />
                    <button type="submit" disabled={leadState === 'sending'} className="premium-btn"
                      style={{ padding: '13px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14, opacity: leadState === 'sending' ? 0.6 : 1 }}>
                      {leadState === 'sending' ? 'Sending...' : 'Get the PDF'}
                    </button>
                  </div>
                  {leadError && <p style={{ color: '#D64545', fontSize: 12.5, margin: '8px 0 0' }}>{leadError}</p>}
                  <p style={{ fontSize: 11.5, color: INK_SOFT, margin: '10px 0 0' }}>We may email you new phrase packs and tips, rarely. Unsubscribe anytime by replying "stop". See our <a href="/privacy.html" style={{ color: SKY_DEEP }}>privacy policy</a>.</p>
                </form>
              )}
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
        </div>
      )}

      {page === 'scenario' && (
        <div key="scenario" className="page-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>What's the situation?</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 8 }}>Describe it in your own words — as messy as it actually is.</p>
          {!unlocked && freeTrialCount < FREE_TRIAL_LIMIT && (
            <p style={{ fontSize: 12.5, color: SKY_DEEP, marginBottom: 24 }}>
              {FREE_TRIAL_LIMIT} free previews, no code needed
            </p>
          )}
          {unlocked && (
            <p style={{ fontSize: 12.5, color: SKY_DEEP, marginBottom: 24 }}>
              {dailyCount} of {DAILY_LIMIT} today
            </p>
          )}

          {!unlocked && freeTrialCount >= FREE_TRIAL_LIMIT ? (
            <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE, marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Free previews used</p>
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
          ) : unlocked && dailyCount >= DAILY_LIMIT ? (
            <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE, marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Today's 50 generations are used up</p>
              <p style={{ fontSize: 13, color: INK_SOFT, margin: 0 }}>Come back tomorrow for 50 more — this resets daily, doesn't affect anything else in the app.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setQuizOpen(true)} style={{ background: 'none', border: 'none', color: SKY_DEEP, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                  Not sure? Take a 30-second test
                </button>
                <select value={proficiency} onChange={e => setProficiency(e.target.value)}
                  style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT, cursor: 'pointer' }}>
                  <option value="Simple">Simple wording</option>
                  <option value="Medium">Everyday wording</option>
                  <option value="Fluent">Fluent, natural wording</option>
                </select>
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
                {loading ? 'Preparing...' : unlocked ? `Get talking points (${DAILY_LIMIT - dailyCount} left today)` : `Get talking points (${FREE_TRIAL_LIMIT - freeTrialCount} free left)`}
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
              <div key={cardIndex} className="premium-card result-card-anim" style={{ background: '#F7FAFC', borderRadius: 16, padding: 32, minHeight: 140 }}>
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

      {((page === 'interview' && !unlocked) || (page === 'roleplay' && !unlocked && rpTrialUsed && !rpTrialActive)) && (
        <div key={'locked-' + page} className="page-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>{page === 'roleplay' ? 'AI role-play' : 'Mock interview'}</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>
            {page === 'roleplay'
              ? 'The AI plays your manager, client or interviewer, reacts to what you say and pushes back. At the end you get a score and stronger versions of your own lines.'
              : 'Five realistic questions for your job interview, promotion talk or client call. Answer by typing or speaking, then get a score and a better sample answer for each question.'}
          </p>
          <div className="premium-card" style={{ borderRadius: 16, border: `1px solid ${LINE}`, padding: 20, marginBottom: 24, background: '#FAFBFC' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Example</div>
            {page === 'roleplay' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ justifySelf: 'start', maxWidth: '85%', background: SKY_PALE, padding: '10px 14px', borderRadius: '14px 14px 14px 4px', fontSize: 13.5 }}>Budgets are frozen this year. Why should I make an exception for you?</div>
                <div style={{ justifySelf: 'end', maxWidth: '85%', background: SKY, color: '#FFF', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 13.5 }}>Because I delivered two projects early, and I'd like to talk about what that's worth.</div>
                <div style={{ justifySelf: 'start', maxWidth: '85%', background: SKY_PALE, padding: '10px 14px', borderRadius: '14px 14px 14px 4px', fontSize: 13.5 }}>That's fair. What number do you have in mind?</div>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px' }}><strong>Q2 of 5.</strong> Tell me about a time a project went wrong. What did you do?</p>
                <p style={{ margin: 0, color: INK_SOFT }}>Score 7/10. Clear story, but add the result in numbers, for example how many days you saved.</p>
              </div>
            )}
          </div>
          <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Included with your access code</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" value={licenseCode} onChange={e => setLicenseCode(e.target.value)} placeholder="Enter your access code"
                style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14 }} />
              <button onClick={handleUnlock} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Unlock</button>
            </div>
            {licenseError && <p style={{ color: '#D64545', fontSize: 12.5, marginTop: 8 }}>{licenseError}</p>}
            <a href="/buy.html" style={{ display: 'block', marginTop: 10, fontSize: 12.5, color: SKY_DEEP }}>No code? Get access</a>
          </div>
        </div>
      )}

      {page === 'roleplay' && (unlocked || !rpTrialUsed || rpTrialActive) && (
        <div key="roleplay" className="page-fade" style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>AI role-play</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 8 }}>Practice the conversation before it happens. The AI stays in character and pushes back like a real person.</p>
          {rpTrial ? (
            <div style={{ display: 'inline-block', fontSize: 12.5, color: SKY_DEEP, background: SKY_PALE, borderRadius: 999, padding: '6px 14px', marginBottom: 24, fontWeight: 600 }}>
              Free try: {RP_TRIAL_TURNS} replies and your feedback, no code needed
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: SKY_DEEP, marginBottom: 24 }}>{dailyCount} of {DAILY_LIMIT} AI replies today</p>
          )}

          {rpMessages.length === 0 && !rpFeedback && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {ROLEPLAY_PRESETS.map(p => (
                  <button key={p.tag} onClick={() => { setRpPartner(p.partner); setRpScenario(p.scenario); }}
                    style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${rpScenario === p.scenario ? SKY : LINE}`, background: rpScenario === p.scenario ? SKY_PALE : '#FFF', color: rpScenario === p.scenario ? SKY_DEEP : INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {p.tag}
                  </button>
                ))}
              </div>
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>Who will you talk to?</label>
              <input value={rpPartner} onChange={e => setRpPartner(e.target.value)} placeholder="e.g. my manager, an unhappy client, a hiring manager"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 16 }} />
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>What's the situation, and what do you want to get out of it?</label>
              <textarea value={rpScenario} onChange={e => setRpScenario(e.target.value)} rows={3}
                placeholder="I want to ask for a raise after a strong year, but budgets are tight..."
                style={{ width: '100%', padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 12.5, color: INK_SOFT }}>How tough?</span>
                {[['friendly', 'Friendly'], ['realistic', 'Realistic'], ['tough', 'Tough']].map(([v, l]) => (
                  <button key={v} onClick={() => setRpDifficulty(v)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${rpDifficulty === v ? SKY : LINE}`, background: rpDifficulty === v ? SKY : '#FFF', color: rpDifficulty === v ? '#FFF' : INK, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
                ))}
                <label style={{ fontSize: 12.5, color: SKY_DEEP, cursor: 'pointer', marginLeft: 6 }}>
                  <input type="checkbox" checked={rpAutoSpeak} onChange={e => setRpAutoSpeak(e.target.checked)} style={{ marginRight: 6, verticalAlign: 'middle' }} />Voice mode
                </label>
                <select value={outputLang} onChange={e => setOutputLang(e.target.value)}
                  style={{ marginLeft: 'auto', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT }}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {practiceLimitReached ? (
                <p style={{ fontSize: 13.5, color: INK_SOFT }}>Today's {DAILY_LIMIT} AI replies are used up. Come back tomorrow.</p>
              ) : (
                <button onClick={startRoleplay} disabled={rpLoading || !rpScenario.trim()} className="premium-btn"
                  style={{ padding: '14px 30px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14.5, fontWeight: 600, opacity: (rpLoading || !rpScenario.trim()) ? 0.5 : 1 }}>
                  {rpLoading ? 'Starting...' : 'Start the conversation'}
                </button>
              )}
            </>
          )}

          {rpMessages.length > 0 && !rpFeedback && (
            <div>
              <div style={{ fontSize: 12.5, color: INK_SOFT, marginBottom: 14 }}>
                Talking to: <strong style={{ color: INK }}>{rpPartner || 'the other person'}</strong> &middot; {rpUserTurns} of {RP_MAX_TURNS} replies
                <label style={{ float: 'right', cursor: 'pointer', color: SKY_DEEP }}>
                  <input type="checkbox" checked={rpAutoSpeak} onChange={e => setRpAutoSpeak(e.target.checked)} style={{ marginRight: 6, verticalAlign: 'middle' }} />Read replies aloud
                </label>
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
                {rpMessages.map((m, i) => (
                  <div key={i} className="result-card-anim" style={{
                    justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '85%',
                    background: m.role === 'user' ? SKY : SKY_PALE, color: m.role === 'user' ? '#FFF' : INK,
                    padding: '11px 15px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 14.5, lineHeight: 1.5,
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                    {m.role === 'assistant' && (
                      <button onClick={() => speakIn(m.content)} aria-label="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: SKY_DEEP, padding: 0, flexShrink: 0 }}>{'\u{1F50A}'}</button>
                    )}
                  </div>
                ))}
                {rpLoading && <div className="shimmer-line" style={{ justifySelf: 'start', width: 180, height: 40, borderRadius: 14 }} />}
              </div>
              {rpUserTurns < RP_MAX_TURNS && !practiceLimitReached ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                  <textarea value={rpInput} onChange={e => setRpInput(e.target.value)} rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRoleplay(); } }}
                    placeholder="Type what you would say, or press the mic and speak"
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical' }} />
                  <button onClick={() => toggleDictation('rp', setRpInput, rpInput)} aria-label="Speak"
                    style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer', background: dictating === 'rp' ? '#D64545' : SKY_PALE, color: dictating === 'rp' ? '#FFF' : SKY_DEEP, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FeatureIcon type="mic" color={dictating === 'rp' ? '#FFF' : SKY_DEEP} size={20} />
                  </button>
                  <button onClick={sendRoleplay} disabled={rpLoading || !rpInput.trim()}
                    style={{ height: 46, padding: '0 18px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14, opacity: (rpLoading || !rpInput.trim()) ? 0.5 : 1 }}>Send</button>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: INK_SOFT, marginBottom: 12 }}>{practiceLimitReached ? `Today's ${DAILY_LIMIT} AI replies are used up.` : 'That is the end of this round.'} Get your feedback below.</p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={finishRoleplay} disabled={rpLoading || rpUserTurns === 0} className="premium-btn"
                  style={{ padding: '11px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY_DEEP, color: '#FFF', fontWeight: 600, fontSize: 13.5, opacity: (rpLoading || rpUserTurns === 0) ? 0.5 : 1 }}>
                  Finish and get feedback
                </button>
                <button onClick={resetRoleplay} style={{ padding: '11px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5 }}>Start over</button>
              </div>
            </div>
          )}

          {rpFeedback && (
            <div className="result-card-anim">
              <div className="premium-card" style={{ background: '#F7FAFC', borderRadius: 16, padding: 28, marginBottom: 16, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 52, color: SKY_DEEP, lineHeight: 1 }}>{rpFeedback.score}</div>
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Your score out of 100</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{rpFeedback.summary}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 18, borderRadius: 12, background: SKY_PALE }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>What worked</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>{rpFeedback.strengths.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div style={{ padding: 18, borderRadius: 12, border: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>What to work on</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>{rpFeedback.improve.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              </div>
              {rpFeedback.betterLines.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Say it stronger</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {rpFeedback.betterLines.map((b, i) => (
                      <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#FAFBFC' }}>
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: INK_SOFT }}>You said: {b.yours}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{b.stronger}</p>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button onClick={() => speakIn(b.stronger)} aria-label="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>{'\u{1F50A}'}</button>
                            <button onClick={() => toggleSave(b.stronger)} aria-label="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: savedPhrases.includes(b.stronger) ? SKY_DEEP : INK_SOFT }}>{savedPhrases.includes(b.stronger) ? '★' : '☆'}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => shareResult({ score: rpFeedback.score, what: 'role-play: ' + (rpPartner || 'a hard conversation') })}
                  style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Share my score</button>
                {!rpTrial && (
                  <>
                    <button onClick={startRoleplay} disabled={rpLoading || practiceLimitReached} className="premium-btn"
                      style={{ padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14, opacity: (rpLoading || practiceLimitReached) ? 0.5 : 1 }}>Try again</button>
                    <button onClick={resetRoleplay} style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 14 }}>New situation</button>
                  </>
                )}
              </div>
              {rpTrial && (
                <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>That was your free role-play</p>
                  <p style={{ fontSize: 13.5, color: INK_SOFT, margin: '0 0 16px', lineHeight: 1.55 }}>With an access code you get full conversations of up to {RP_MAX_TURNS_FULL} replies, mock interviews, AI voice feedback and up to {DAILY_LIMIT} AI replies a day.</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="text" value={licenseCode} onChange={e => setLicenseCode(e.target.value)} placeholder="Enter your access code"
                      style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14 }} />
                    <button onClick={handleUnlock} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Unlock</button>
                  </div>
                  {licenseError && <p style={{ color: '#D64545', fontSize: 12.5, marginTop: 8 }}>{licenseError}</p>}
                  <a href="/buy.html" className="premium-btn" style={{ display: 'inline-block', marginTop: 14, padding: '11px 22px', borderRadius: 999, background: SKY_DEEP, color: '#FFF', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>Get access</a>
                </div>
              )}
            </div>
          )}
          {rpError && <p style={{ color: '#D64545', fontSize: 13, marginTop: 12 }}>{rpError}</p>}
          {shareNote && page === 'roleplay' && <p style={{ color: SKY_DEEP, fontSize: 13, marginTop: 12 }}>{shareNote}</p>}
        </div>
      )}

      {page === 'interview' && unlocked && (
        <div key="interview" className="page-fade" style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Mock interview</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 8 }}>Five questions a real interviewer would ask, then an honest review of every answer.</p>
          <p style={{ fontSize: 12.5, color: SKY_DEEP, marginBottom: 24 }}>{dailyCount} of {DAILY_LIMIT} AI replies today</p>

          {ivQuestions.length === 0 && !ivReview && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {INTERVIEW_KINDS.map(k => (
                  <button key={k} onClick={() => setIvKind(k)}
                    style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ivKind === k ? SKY : LINE}`, background: ivKind === k ? SKY_PALE : '#FFF', color: ivKind === k ? SKY_DEEP : INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{k}</button>
                ))}
              </div>
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>What is the interview for?</label>
              <input value={ivTarget} onChange={e => setIvTarget(e.target.value)}
                placeholder={ivKind === 'Job interview' ? 'e.g. junior data analyst at a bank' : ivKind === 'Promotion interview' ? 'e.g. moving from designer to team lead' : ivKind === 'Client call' ? 'e.g. first call with a hotel that wants a new website' : 'e.g. a 3-month marketing project for a US startup'}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 16 }} />
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 6 }}>A few words about you (optional, makes the questions sharper)</label>
              <textarea value={ivBackground} onChange={e => setIvBackground(e.target.value)} rows={3}
                placeholder="e.g. 4 years in customer support, led a team of 3, learning data analysis..."
                style={{ width: '100%', padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical', marginBottom: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <select value={outputLang} onChange={e => setOutputLang(e.target.value)}
                  style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT }}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {practiceLimitReached ? (
                <p style={{ fontSize: 13.5, color: INK_SOFT }}>Today's {DAILY_LIMIT} AI replies are used up. Come back tomorrow.</p>
              ) : (
                <button onClick={startInterview} disabled={ivLoading || !ivTarget.trim()} className="premium-btn"
                  style={{ padding: '14px 30px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontSize: 14.5, fontWeight: 600, opacity: (ivLoading || !ivTarget.trim()) ? 0.5 : 1 }}>
                  {ivLoading ? 'Preparing questions...' : 'Start the interview'}
                </button>
              )}
            </>
          )}

          {ivQuestions.length > 0 && !ivReview && (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                {ivQuestions.map((_, i) => (
                  <button key={i} onClick={() => setIvStep(i)} aria-label={'Question ' + (i + 1)}
                    style={{ flex: 1, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', background: i === ivStep ? SKY : (ivAnswers[i] || '').trim() ? '#A9CFEE' : LINE }} />
                ))}
              </div>
              <div key={ivStep} className="premium-card result-card-anim" style={{ background: '#F7FAFC', borderRadius: 16, padding: 26, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Question {ivStep + 1} of {ivQuestions.length}</div>
                  <button onClick={() => speakIn(ivQuestions[ivStep])} aria-label="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>{'\u{1F50A}'}</button>
                </div>
                <p style={{ fontSize: 17, lineHeight: 1.55, margin: 0 }}>{ivQuestions[ivStep]}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
                <textarea value={ivAnswers[ivStep] || ''} rows={5}
                  onChange={e => { const v = e.target.value; setIvAnswers(prev => prev.map((a, i) => i === ivStep ? v : a)); }}
                  placeholder="Type your answer, or press the mic and answer out loud"
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 14.5, resize: 'vertical' }} />
                <button onClick={() => toggleDictation('iv', v => setIvAnswers(prev => prev.map((a, i) => i === ivStep ? v : a)), ivAnswers[ivStep] || '')} aria-label="Speak"
                  style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer', background: dictating === 'iv' ? '#D64545' : SKY_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FeatureIcon type="mic" color={dictating === 'iv' ? '#FFF' : SKY_DEEP} size={20} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ivStep > 0 && <button onClick={() => setIvStep(ivStep - 1)} style={{ padding: '11px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5 }}>Back</button>}
                {ivStep < ivQuestions.length - 1 ? (
                  <button onClick={() => { if (dictating) dictationRef.current?.stop(); setIvStep(ivStep + 1); }} className="premium-btn"
                    style={{ padding: '11px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 13.5 }}>Next question</button>
                ) : (
                  <button onClick={finishInterview} disabled={ivLoading || ivAnswers.every(a => !a.trim())} className="premium-btn"
                    style={{ padding: '11px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY_DEEP, color: '#FFF', fontWeight: 600, fontSize: 13.5, opacity: (ivLoading || ivAnswers.every(a => !a.trim())) ? 0.5 : 1 }}>
                    {ivLoading ? 'Reviewing your answers...' : 'Finish and get my review'}
                  </button>
                )}
                <button onClick={resetInterview} style={{ padding: '11px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5 }}>Start over</button>
              </div>
            </div>
          )}

          {ivReview && (
            <div className="result-card-anim">
              <div className="premium-card" style={{ background: '#F7FAFC', borderRadius: 16, padding: 28, marginBottom: 18, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 52, color: SKY_DEEP, lineHeight: 1 }}>{ivReview.overall}</div>
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Overall, out of 100</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{ivReview.summary}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                {ivReview.items.map((it, i) => (
                  <div key={i} style={{ padding: 18, borderRadius: 12, border: `1px solid ${LINE}`, background: '#FAFBFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{i + 1}. {ivQuestions[i]}</p>
                      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: it.score >= 7 ? '#2E8B57' : it.score >= 4 ? SKY_DEEP : '#D64545', background: '#FFF', border: `1px solid ${LINE}`, borderRadius: 999, padding: '3px 10px', height: 'fit-content' }}>{it.score}/10</span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 13.5, color: INK_SOFT, lineHeight: 1.55 }}>{it.feedback}</p>
                    {it.better && (
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: SKY_PALE, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}><strong>Stronger answer:</strong> {it.better}</p>
                        <button onClick={() => speakIn(it.better)} aria-label="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: SKY_DEEP, flexShrink: 0 }}>{'\u{1F50A}'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => shareResult({ score: ivReview.overall, what: ivKind.toLowerCase() + ': ' + ivTarget })}
                  style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Share my score</button>
                <button onClick={startInterview} disabled={ivLoading || practiceLimitReached} className="premium-btn"
                  style={{ padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14, opacity: (ivLoading || practiceLimitReached) ? 0.5 : 1 }}>New questions, same interview</button>
                <button onClick={resetInterview} style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 14 }}>Different interview</button>
              </div>
            </div>
          )}
          {ivError && <p style={{ color: '#D64545', fontSize: 13, marginTop: 12 }}>{ivError}</p>}
          {shareNote && page === 'interview' && <p style={{ color: SKY_DEEP, fontSize: 13, marginTop: 12 }}>{shareNote}</p>}

          {practiceHistory.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Your recent practice</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {practiceHistory.slice(0, 6).map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}` }}>
                    <span style={{ color: INK_SOFT }}>{h.date} &middot; {h.type} &middot; <span style={{ color: INK }}>{h.title}</span></span>
                    <strong style={{ color: SKY_DEEP }}>{h.score}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {page === 'voice' && (
        <div key="voice" className="page-fade" style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Voice practice</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>Confidence lives in your voice, not on paper. Say it out loud until it feels natural.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
            {[['repeat', 'Repeat after me'], ['free', 'Speak freely']].map(([id, label]) => (
              <button key={id} onClick={() => setVpTab(id)}
                style={{ padding: '9px 18px', borderRadius: 999, border: `1.5px solid ${vpTab === id ? SKY : LINE}`, background: vpTab === id ? SKY : '#FFF', color: vpTab === id ? '#FFF' : INK, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>

          {vpTab === 'repeat' && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                <select value={vpCategory} onChange={e => { setVpCategory(e.target.value); setVpIndex(0); setVpHeard(''); setVpResult(null); }}
                  style={{ flex: '1 1 240px', fontSize: 13.5, padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#FFF', color: INK }}>
                  {savedPhrases.length > 0 && <option value="__saved">My phrasebook ({savedPhrases.length})</option>}
                  {PHRASE_GROUPS.map(g => (
                    <optgroup key={g} label={g}>
                      {PHRASE_CATEGORIES.filter(c => c.group === g).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <span style={{ fontSize: 12.5, color: SKY_DEEP }}>{vpDone} said out loud today</span>
              </div>
              {vpPhrase ? (
                <div key={vpPhrase} className="premium-card result-card-anim" style={{ background: '#F7FAFC', borderRadius: 16, padding: 28, marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Listen, then say it</div>
                  <p style={{ fontSize: 20, lineHeight: 1.5, margin: '0 0 20px', fontFamily: "'Fraunces', serif" }}>
                    {vpResult ? vpResult.words.map((x, i) => (
                      <span key={i} style={{ color: x.ok ? '#2E8B57' : '#D64545', textDecoration: x.ok ? 'none' : 'underline' }}>{x.w} </span>
                    )) : vpPhrase}
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => speakEnglish(vpPhrase, 0.95)} style={{ padding: '10px 16px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5 }}>{'\u{1F50A}'} Listen</button>
                    <button onClick={() => speakEnglish(vpPhrase, 0.7)} style={{ padding: '10px 16px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5 }}>{'\u{1F422}'} Slowly</button>
                    <button onClick={vpRecord} className="premium-btn"
                      style={{ padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer', background: vpListening ? '#D64545' : SKY, color: '#FFF', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FeatureIcon type="mic" color="#FFF" size={17} /> {vpListening ? 'Listening... tap to stop' : vpResult ? 'Say it again' : 'Say it'}
                    </button>
                  </div>
                  {vpHeard && !vpResult && <p style={{ fontSize: 13.5, color: INK_SOFT, margin: '14px 0 0' }}>{vpHeard}</p>}
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: INK_SOFT }}>No phrases here yet.</p>
              )}
              {vpResult && (
                <div className="result-card-anim" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '16px 20px', borderRadius: 12, background: SKY_PALE, marginBottom: 18, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 34, color: SKY_DEEP }}>{vpResult.score}%</div>
                  <div style={{ flex: '1 1 220px', fontSize: 13.5, lineHeight: 1.5 }}>
                    {vpResult.score >= 90 ? 'Clear and natural. Every word came through.' : vpResult.score >= 70 ? 'Good. The underlined words were not clear. Listen once more and repeat them slowly.' : 'Some words got lost. Try the slow version first, then say it at your own pace.'}
                    <div style={{ color: INK_SOFT, fontSize: 12.5, marginTop: 4 }}>Heard: {vpHeard}</div>
                  </div>
                </div>
              )}
              {vpError && <p style={{ color: '#D64545', fontSize: 13, marginBottom: 12 }}>{vpError}</p>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={vpNext} style={{ padding: '11px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>Next phrase</button>
                {vpPhrase && (
                  <button onClick={() => toggleSave(vpPhrase)} style={{ padding: '11px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5, color: savedPhrases.includes(vpPhrase) ? SKY_DEEP : INK }}>
                    {savedPhrases.includes(vpPhrase) ? '★ Saved' : '☆ Save to phrasebook'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: INK_SOFT, marginTop: 20 }}>Free and private: your voice is recognized by your browser and never stored.</p>
            </div>
          )}

          {vpTab === 'free' && (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, color: INK_SOFT, marginBottom: 8 }}>What will you talk about?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {VOICE_TOPICS.map(t => (
                  <button key={t} onClick={() => setFsTopic(t)} disabled={fsRecording}
                    style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${fsTopic === t ? SKY : LINE}`, background: fsTopic === t ? SKY_PALE : '#FFF', color: fsTopic === t ? SKY_DEEP : INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{t}</button>
                ))}
              </div>
              <input value={fsTopic} onChange={e => setFsTopic(e.target.value)} disabled={fsRecording} placeholder="Or write your own task"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: INK_SOFT }}>Speak in the language you chose. Up to {FS_MAX_SECONDS / 60} minutes.</span>
                <select value={outputLang} onChange={e => setOutputLang(e.target.value)} disabled={fsRecording}
                  style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT }}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="premium-card" style={{ background: '#F7FAFC', borderRadius: 16, padding: 28, marginBottom: 18, textAlign: 'center' }}>
                <button onClick={fsRecording ? fsStop : fsStart} aria-label={fsRecording ? 'Stop' : 'Start speaking'}
                  style={{ width: 84, height: 84, borderRadius: '50%', border: 'none', cursor: 'pointer', background: fsRecording ? '#D64545' : SKY, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: fsRecording ? '0 0 0 10px rgba(214,69,69,0.15)' : '0 8px 24px rgba(74,144,217,0.35)', transition: 'all 0.2s ease' }}>
                  {fsRecording ? <span style={{ width: 24, height: 24, borderRadius: 4, background: '#FFF' }} /> : <FeatureIcon type="mic" color="#FFF" size={34} />}
                </button>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: fsRecording ? '#D64545' : INK, marginTop: 14 }}>{fmtTime(fsSeconds)}</div>
                <div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 4 }}>{fsRecording ? 'Recording. Tap the button when you finish.' : fsStats ? 'Done. See how it went below.' : 'Tap and start talking'}</div>
                {fsTranscript && (
                  <p style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.6, margin: '20px 0 0', padding: 14, borderRadius: 10, background: '#FFF', border: `1px solid ${LINE}`, color: INK }}>{fsTranscript}</p>
                )}
              </div>

              {fsStats && !fsRecording && (
                <div className="result-card-anim">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      ['Time', fmtTime(fsStats.seconds)],
                      ['Pace', fsStats.seconds >= 10 ? `${fsStats.wpm} wpm` : '—'],
                      ['Filler words', String(fsStats.fillers.total)],
                      ['Hedging words', String(fsStats.hedges.total)],
                    ].map(([l, v]) => (
                      <div key={l} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#FFF' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, color: SKY_DEEP, marginTop: 4 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <ul style={{ margin: '0 0 18px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: INK }}>
                    {fsStats.seconds >= 10 && <li>{fsStats.wpm < 110 ? 'A bit slow. Try to keep moving between sentences.' : fsStats.wpm > 170 ? 'Quite fast. Slow down and pause after your key point.' : 'Comfortable pace. Easy to follow.'}</li>}
                    {fsStats.fillers.total > 0 && <li>Fillers: {fsStats.fillers.found.join(', ')}. Replace them with a short pause.</li>}
                    {fsStats.hedges.total > 0 && <li>Softeners: {fsStats.hedges.found.join(', ')}. Drop them where you want to sound sure.</li>}
                  </ul>

                  {!fsFeedback && (unlocked ? (
                    <button onClick={fsGetFeedback} disabled={fsLoading || practiceLimitReached} className="premium-btn"
                      style={{ padding: '13px 26px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY_DEEP, color: '#FFF', fontWeight: 600, fontSize: 14, opacity: (fsLoading || practiceLimitReached) ? 0.5 : 1 }}>
                      {fsLoading ? 'Listening to your answer...' : practiceLimitReached ? `Today's ${DAILY_LIMIT} AI replies are used up` : 'Get AI feedback'}
                    </button>
                  ) : (
                    <div style={{ padding: 22, borderRadius: 14, background: SKY_PALE }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>Want a score and a stronger version from the AI?</p>
                      <p style={{ fontSize: 13, color: INK_SOFT, margin: '0 0 14px' }}>Included with your access code.</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input type="text" value={licenseCode} onChange={e => setLicenseCode(e.target.value)} placeholder="Enter your access code"
                          style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14 }} />
                        <button onClick={handleUnlock} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Unlock</button>
                      </div>
                      {licenseError && <p style={{ color: '#D64545', fontSize: 12.5, marginTop: 8 }}>{licenseError}</p>}
                      <a href="/buy.html" style={{ display: 'block', marginTop: 10, fontSize: 12.5, color: SKY_DEEP }}>No code? Get access</a>
                    </div>
                  ))}

                  {fsFeedback && (
                    <div className="result-card-anim">
                      <div className="premium-card" style={{ background: '#F7FAFC', borderRadius: 16, padding: 26, marginBottom: 14, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 52, color: SKY_DEEP, lineHeight: 1 }}>{fsFeedback.score}</div>
                        <div style={{ flex: '1 1 260px' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>How it sounded, out of 100</div>
                          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{fsFeedback.summary}</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
                        <div style={{ padding: 18, borderRadius: 12, background: SKY_PALE }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: SKY_DEEP, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>What worked</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>{fsFeedback.strengths.map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                        <div style={{ padding: 18, borderRadius: 12, border: `1px solid ${LINE}` }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Next time</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>{fsFeedback.improve.map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                      </div>
                      {fsFeedback.stronger && (
                        <div style={{ padding: '16px 18px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#FAFBFC', marginBottom: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Say it like this</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => speakIn(fsFeedback.stronger)} aria-label="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>{'\u{1F50A}'}</button>
                              <button onClick={() => toggleSave(fsFeedback.stronger)} aria-label="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: savedPhrases.includes(fsFeedback.stronger) ? SKY_DEEP : INK_SOFT }}>{savedPhrases.includes(fsFeedback.stronger) ? '★' : '☆'}</button>
                            </div>
                          </div>
                          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{fsFeedback.stronger}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                    <button onClick={fsStart} className="premium-btn"
                      style={{ padding: '12px 24px', borderRadius: 999, border: `1px solid ${LINE}`, cursor: 'pointer', background: '#FFF', color: INK, fontWeight: 600, fontSize: 13.5 }}>Record again</button>
                    {fsFeedback && (
                      <button onClick={() => shareResult({ score: fsFeedback.score, what: 'speaking task: ' + fsTopic })}
                        style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>Share my score</button>
                    )}
                  </div>
                  {shareNote && <p style={{ color: SKY_DEEP, fontSize: 13, marginTop: 12 }}>{shareNote}</p>}
                </div>
              )}
              {fsError && <p style={{ color: '#D64545', fontSize: 13, marginTop: 12 }}>{fsError}</p>}
            </div>
          )}
        </div>
      )}

      {page === 'progress' && (
        <div key="progress" className="page-fade" style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Your progress</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 28 }}>Every rehearsal makes the real conversation easier. Here is how far you have come.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[
              [String(progressStats.streak), progressStats.streak === 1 ? 'day in a row' : 'days in a row'],
              [progressStats.avg === null ? '—' : String(progressStats.avg), 'average score, last 10'],
              [progressStats.best === null ? '—' : String(progressStats.best), 'best score'],
              [String(practiceCount), 'practice sessions'],
              [String(progressStats.vpTotal), 'phrases said out loud'],
              [String(savedPhrases.length), 'phrases saved'],
            ].map(([v, l]) => (
              <div key={l} className="premium-card" style={{ padding: '16px 18px', borderRadius: 14, background: '#FFF' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 30, color: SKY_DEEP, lineHeight: 1.1 }}>{v}</div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          <div className="premium-card" style={{ padding: 22, borderRadius: 16, background: '#FFF', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your scores over time</div>
              {progressStats.trend !== null && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: progressStats.trend >= 0 ? '#2E8B57' : '#B3261E' }}>
                  {progressStats.trend >= 0 ? `+${progressStats.trend}` : progressStats.trend} points vs your earlier sessions
                </div>
              )}
            </div>
            {progressStats.chart.length >= 2 ? (() => {
              const W = 680, H = 200, P = 28;
              const pts = progressStats.chart.map((h, i) => [P + i * (W - 2 * P) / (progressStats.chart.length - 1), H - P - (Number(h.score) / 100) * (H - 2 * P)]);
              const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
              const area = path + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - P} L ${pts[0][0].toFixed(1)} ${H - P} Z`;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Scores over time">
                  {[0, 50, 100].map(v => {
                    const y = H - P - (v / 100) * (H - 2 * P);
                    return <g key={v}><line x1={P} x2={W - P} y1={y} y2={y} stroke={LINE} strokeDasharray={v === 0 ? '' : '3 4'} /><text x={4} y={y + 4} fontSize="11" fill={INK_SOFT}>{v}</text></g>;
                  })}
                  <path d={area} fill={SKY_PALE} />
                  <path d={path} fill="none" stroke={SKY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p[0]} cy={p[1]} r="4.5" fill="#FFF" stroke={SKY_DEEP} strokeWidth="2" />
                      <title>{`${progressStats.chart[i].date} · ${progressStats.chart[i].type}: ${progressStats.chart[i].score}`}</title>
                    </g>
                  ))}
                </svg>
              );
            })() : (
              <p style={{ fontSize: 13.5, color: INK_SOFT, margin: 0 }}>Finish two scored sessions (role-play, mock interview or voice feedback) to see your curve.</p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
            <div className="premium-card" style={{ padding: 22, borderRadius: 16, background: '#FFF' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Last 4 weeks</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {progressStats.last28.map(d => (
                  <div key={d.k} title={d.k} style={{ aspectRatio: '1', borderRadius: 6, background: d.on ? SKY : '#F1F3F5', outline: d.today ? `2px solid ${SKY_DEEP}` : 'none', outlineOffset: 1 }} />
                ))}
              </div>
              <p style={{ fontSize: 12, color: INK_SOFT, margin: '12px 0 0' }}>{progressStats.activeTotal} {progressStats.activeTotal === 1 ? 'day' : 'days'} of practice in total</p>
            </div>
            <div className="premium-card" style={{ padding: 22, borderRadius: 16, background: '#FFF' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>By type of practice</div>
              {progressStats.types.length ? progressStats.types.map(t => (
                <div key={t.type} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span>{t.type} <span style={{ color: INK_SOFT }}>&middot; {t.count}</span></span>
                    <strong style={{ color: SKY_DEEP }}>{t.avg}</strong>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#F1F3F5' }}>
                    <div style={{ width: `${t.avg}%`, height: '100%', borderRadius: 3, background: SKY }} />
                  </div>
                </div>
              )) : <p style={{ fontSize: 13.5, color: INK_SOFT, margin: 0 }}>No scored sessions yet.</p>}
            </div>
          </div>

          {practiceHistory.length > 0 ? (
            <div className="premium-card" style={{ padding: 22, borderRadius: 16, background: '#FFF' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>All sessions</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {practiceHistory.slice(0, 30).map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}` }}>
                    <span style={{ color: INK_SOFT }}>{h.date} &middot; {h.type} &middot; <span style={{ color: INK }}>{h.title}</span></span>
                    <strong style={{ color: SKY_DEEP }}>{h.score}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, borderRadius: 14, background: SKY_PALE, textAlign: 'center' }}>
              <p style={{ fontSize: 14.5, fontWeight: 600, margin: '0 0 12px' }}>Your first session takes five minutes</p>
              <button onClick={() => setPage('roleplay')} className="premium-btn"
                style={{ padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', background: SKY, color: '#FFF', fontWeight: 600, fontSize: 14 }}>Start a role-play &rarr;</button>
            </div>
          )}
          <p style={{ fontSize: 12, color: INK_SOFT, marginTop: 20 }}>Your progress is stored only in this browser.</p>
        </div>
      )}

      {page === 'library' && (
        <div key="library" className="page-fade" style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginBottom: 8 }}>Phrase library</h2>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>1,000+ ready lines for work and everyday life. Tap to listen, star to save.</p>
          {userRole.trim() && (
            <p style={{ fontSize: 12.5, color: SKY_DEEP, marginTop: -14, marginBottom: 24 }}>
              Sorted for: <strong>{userRole}</strong> &middot; <button onClick={() => setPage('scenario')} style={{ background: 'none', border: 'none', color: SKY_DEEP, textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>change</button>
            </p>
          )}
          <input
            value={librarySearch}
            onChange={e => setLibrarySearch(e.target.value)}
            placeholder="Search 1,000+ phrases, e.g. deadline, invoice, refund..."
            style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 20 }}
          />
          {(() => {
            const q = librarySearch.trim().toLowerCase();
            const renderPhrase = (p, key) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14,
                padding: '14px 16px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#FAFBFC',
              }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{p}</p>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleSpeak(p)} aria-label={speakingText === p ? 'Stop' : 'Listen'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>
                    {speakingText === p ? '\u23F9' : '\u{1F50A}'}
                  </button>
                  <button onClick={() => toggleSave(p)} aria-label="Save"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: savedPhrases.includes(p) ? SKY_DEEP : INK_SOFT }}>
                    {savedPhrases.includes(p) ? '\u2605' : '\u2606'}
                  </button>
                </div>
              </div>
            );
            if (q) {
              const hits = [];
              PHRASE_CATEGORIES.forEach(cat => cat.phrases.forEach(p => {
                if (p.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)) hits.push({ p, cat: cat.name });
              }));
              return (
                <div>
                  <p style={{ fontSize: 12.5, color: INK_SOFT, margin: '0 0 14px' }}>{hits.length} {hits.length === 1 ? 'phrase' : 'phrases'} found{hits.length > 80 ? ', showing the first 80' : ''}</p>
                  <div style={{ display: 'grid', gap: 10 }}>{hits.slice(0, 80).map((h, i) => renderPhrase(h.p, i))}</div>
                </div>
              );
            }
            const groupCats = sortCategoriesByRole(PHRASE_CATEGORIES.filter(c => c.group === libraryGroup), userRole);
            const active = groupCats.find(c => c.name === libraryCategory) || groupCats[0];
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {PHRASE_GROUPS.map(g => (
                    <button key={g} onClick={() => { setLibraryGroup(g); setLibraryCategory(null); }}
                      style={{ padding: '8px 16px', borderRadius: 999, border: `1.5px solid ${libraryGroup === g ? SKY : LINE}`, background: libraryGroup === g ? SKY : '#FFF', color: libraryGroup === g ? '#FFF' : INK, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                      {g}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                  {groupCats.map(c => (
                    <button key={c.name} onClick={() => setLibraryCategory(c.name)}
                      style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${active && active.name === c.name ? SKY : LINE}`, background: active && active.name === c.name ? SKY_PALE : '#FFF', color: active && active.name === c.name ? SKY_DEEP : INK_SOFT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      {c.name} <span style={{ opacity: 0.6, fontWeight: 500 }}>{c.phrases.length}</span>
                    </button>
                  ))}
                </div>
                {active && (
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: SKY_DEEP, display: 'flex', alignItems: 'center', gap: 10 }}>
                      {active.name}
                      {active._score > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: SKY_DEEP, background: SKY_PALE, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Recommended for you</span>
                      )}
                    </h3>
                    <div style={{ display: 'grid', gap: 10 }}>{active.phrases.map((p, i) => renderPhrase(p, i))}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      {page === 'checklist' && (
        <div key="checklist" className="page-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
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
        <div key="phrasebook" className="page-fade" style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
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
                    <button onClick={() => toggleSpeak(p)} aria-label={speakingText === p ? 'Stop' : 'Listen'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: SKY_DEEP }}>
                      {speakingText === p ? '\u23F9' : '\u{1F50A}'}
                    </button>
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
            Confidence isn't luck. It's preparation
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: INK_SOFT }}>Powered by Claude &middot; Plainwork by Ksenia</span>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="/terms.html" style={{ fontSize: 12, color: INK_SOFT }}>Terms</a>
              <a href="/privacy.html" style={{ fontSize: 12, color: INK_SOFT }}>Privacy</a>
              <a href="/refund.html" style={{ fontSize: 12, color: INK_SOFT }}>Refunds</a>
              <a href="mailto:kssw117@gmail.com" style={{ fontSize: 12, color: INK_SOFT }}>kssw117@gmail.com</a>
            </div>
          </div>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: INK, textAlign: 'center', marginTop: 20 }}>
            Thanks to Skyeng for the idea behind voice practice &#128153;
          </p>
          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 14 }}>
<a href="/phrases/" style={{ color: SKY_DEEP, fontWeight: 600, marginRight: 18 }}>Free phrase guides</a>
            <a href="https://plainwork.website/" target="_blank" rel="noopener noreferrer" style={{ color: SKY_DEEP, fontWeight: 600 }}>
              More useful tools at Plainwork &rarr;
            </a>
          </p>
          <p style={{ fontSize: 11, color: INK_SOFT, textAlign: 'center', marginTop: 18, opacity: 0.8 }}>
            Грезина Ксения Викторовна (Ksenia Grezina) &middot; Tax ID (ИНН) 710607167655
          </p>
        </div>
      </footer>

      {/* Плавающая кнопка "нужна помощь" — как на всех остальных продуктах */}
      <button
        onClick={() => {
          playPopSound(!showHelpBubble);
          setShowHelpBubble(v => !v);
        }}
        aria-label="Need help?"
        className={showHelpBubble ? '' : 'help-bubble-btn'}
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

      {/* Полное описание функции — открывается по клику на карточку на главной */}
      {expandedFeature !== null && (
        <div
          onClick={() => setExpandedFeature(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,20,30,0.45)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 18, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: SKY_PALE, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FeatureIcon type={FEATURES[expandedFeature].icon} color={SKY_DEEP} size={24} />
            </div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 22, margin: '0 0 12px' }}>{FEATURES[expandedFeature].title}</h3>
            <p style={{ fontSize: 14, color: INK, lineHeight: 1.6, margin: '0 0 24px' }}>{FEATURES[expandedFeature].fullBody}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setPage(FEATURES[expandedFeature].page); setExpandedFeature(null); }} className="premium-btn"
                style={{ flex: 1, padding: '12px 20px', borderRadius: 999, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Try it now &rarr;
              </button>
              <button onClick={() => setExpandedFeature(null)}
                style={{ padding: '12px 20px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF', color: INK_SOFT, cursor: 'pointer', fontSize: 14 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Короткий тест на уровень английского — без ИИ, статичные вопросы */}
      {quizOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,20,30,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#FFF', borderRadius: 18, padding: 32, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {!quizResult ? (
              <>
                <div style={{ fontSize: 11, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  Question {quizStep + 1} of {QUIZ_QUESTIONS.length}
                </div>
                <p style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 20, color: INK }}>{QUIZ_QUESTIONS[quizStep].q}</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {QUIZ_QUESTIONS[quizStep].options.map((opt, i) => (
                    <button key={i} onClick={() => answerQuiz(i)}
                      style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#FAFBFC', cursor: 'pointer', fontSize: 14 }}>
                      {opt}
                    </button>
                  ))}
                </div>
                <button onClick={resetQuiz} style={{ marginTop: 20, background: 'none', border: 'none', color: INK_SOFT, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: SKY_DEEP, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Result</p>
                <p style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, marginBottom: 8 }}>
                  {quizResult.correctCount} / {QUIZ_QUESTIONS.length} correct
                </p>
                <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 24 }}>
                  Set to <strong style={{ color: SKY_DEEP }}>{quizResult.level === 'Simple' ? 'Simple wording' : quizResult.level === 'Medium' ? 'Everyday wording' : 'Fluent, natural wording'}</strong> for your talking points. You can always change this manually.
                </p>
                <button onClick={resetQuiz} className="premium-btn"
                  style={{ padding: '12px 24px', borderRadius: 999, border: 'none', background: SKY, color: '#FFF', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
