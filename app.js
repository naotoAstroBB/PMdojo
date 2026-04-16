const LESSONS = (window.PM_DOJO_LESSONS || []).sort((a, b) => a.day - b.day);
const ESSAYS = window.PM_DOJO_ESSAYS || [];
const ESSAY_DRILLS = window.PM_DOJO_ESSAY_DRILLS || [];
const PAST_QUESTIONS = window.PM_DOJO_PAST_QUESTIONS || [];
const KEY = "pm-dojo-local-v2";
const app = document.getElementById("app");

const catClass = {
  "基礎":"cat-basic","立上げ":"cat-launch","計画":"cat-plan","実行・監視":"cat-monitor",
  "終結":"cat-close","試験対策":"cat-exam","午後I対策":"cat-essay1","深化":"cat-deep",
  "論述対策":"cat-essay2","振り返り":"cat-review"
};
const ranks = ["見習い","初級PM","中級PM","上級PM","PM達人","PM師範","PMマスター","PM伝説"];
const defaultProfile = {
  industry:"製造業",
  system:"生産管理システム刷新",
  size:"10名・8か月・2000万円",
  role:"プロジェクトマネージャ",
  background:"老朽化した既存システムを刷新し、現場部門と経営層の要求を調整しながら段階的に移行した。"
};

let state = load();
let toastTimer = null;
const initialTab = new URLSearchParams(location.search).get("tab");
if (["learn", "practice", "essay", "tree"].includes(initialTab)) state.tab = initialTab;
const initialEssayMode = new URLSearchParams(location.search).get("essayMode");
if (["framework", "short"].includes(initialEssayMode)) state.essayMode = initialEssayMode;

function load() {
  const base = {
    tab:"learn", day:0, phase:"lesson", qIndex:0, selected:null, answered:false, session:[],
    allResults:{}, showMap:false, totalStudyDays:0, lastStudyDate:"", currentStreak:0, bestStreak:0,
    practiceMode:"all", practicePool:[], practiceIndex:0, practiceSelected:null, practiceAnswered:false,
    practiceScore:{correct:0,total:0}, wrongIds:[], essayMode:"framework", essayIndex:null,
    essayDrillIndex:0, essayDrillAnswer:"", essayDrillRevealed:false,
    profile:defaultProfile, essayNotes:{}, toast:""
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved) return base;
    const migrated = migrateStudyStatus(saved);
    return {
      ...base,
      ...saved,
      ...migrated,
      tab: saved.tab || "learn",
      day: clamp(saved.day, 0, LESSONS.length - 1),
      phase: "lesson",
      qIndex: 0,
      selected: null,
      answered: false,
      session: [],
      showMap: false,
      practicePool: [],
      practiceIndex: 0,
      practiceSelected: null,
      practiceAnswered: false,
      profile: {...defaultProfile, ...(saved.profile || {})}
    };
  } catch {
    return base;
  }
}

function save() {
  const keep = {
    tab: state.tab, day: state.day, allResults: state.allResults,
    totalStudyDays: state.totalStudyDays, lastStudyDate: state.lastStudyDate,
    currentStreak: state.currentStreak, bestStreak: state.bestStreak,
    wrongIds: state.wrongIds, practiceMode: state.practiceMode,
    essayMode: state.essayMode, essayDrillIndex: state.essayDrillIndex,
    profile: state.profile, essayNotes: state.essayNotes
  };
  localStorage.setItem(KEY, JSON.stringify(keep));
}

function clamp(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
}

function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayNumber(dateKey) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(new Date(y, m - 1, d).getTime() / 86400000);
}

function daysBetween(fromKey, toKey) {
  const from = dayNumber(fromKey);
  const to = dayNumber(toKey);
  if (from === null || to === null) return null;
  return to - from;
}

function shiftDateKey(dateKey, offset) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function migrateStudyStatus(saved) {
  if (!Array.isArray(saved.studyDates)) {
    return {
      totalStudyDays: Math.max(0, Number(saved.totalStudyDays) || 0),
      lastStudyDate: saved.lastStudyDate || "",
      currentStreak: Math.max(0, Number(saved.currentStreak) || 0),
      bestStreak: Math.max(0, Number(saved.bestStreak) || 0),
    };
  }

  const dates = [...new Set(saved.studyDates.filter(Boolean))].sort();
  const lastStudyDate = dates[dates.length - 1] || "";
  const set = new Set(dates);
  let streak = 0;
  for (let i = 0; i < dates.length; i++) {
    const d = shiftDateKey(lastStudyDate, -i);
    if (!set.has(d)) break;
    streak += 1;
  }
  const bestStreak = Math.max(Number(saved.bestStreak) || 0, streak);
  return { totalStudyDays: dates.length, lastStudyDate, currentStreak: streak, bestStreak };
}

function markStudied() {
  const today = todayKey();
  if (state.lastStudyDate === today) return false;

  const gap = daysBetween(state.lastStudyDate, today);
  state.totalStudyDays = Math.max(0, Number(state.totalStudyDays) || 0) + 1;
  state.lastStudyDate = today;

  if (gap === 1) {
    state.currentStreak = Math.max(0, Number(state.currentStreak) || 0) + 1;
    showToast(`連続${state.currentStreak}日。木に水が入りました。`);
  } else if (gap === null) {
    state.currentStreak = 1;
    showToast("学習開始。今日から木が育ちます。");
  } else {
    state.currentStreak = 1;
    showToast(`${gap}日ぶりに再開。木はそのまま、連続記録は今日から再スタートです。`);
  }

  state.bestStreak = Math.max(state.bestStreak || 0, state.currentStreak);
  return true;
}

function currentStreak() {
  const gap = daysBetween(state.lastStudyDate, todayKey());
  if (gap === 0 || gap === 1) return Math.max(0, Number(state.currentStreak) || 0);
  return 0;
}

function streakStatus() {
  const gap = daysBetween(state.lastStudyDate, todayKey());
  if (!state.lastStudyDate) return "今日から開始";
  if (gap === 0) return "今日記録済み";
  if (gap === 1) return "今日やれば継続";
  return "休眠中・再開OK";
}

function stats() {
  const answers = Object.values(state.allResults || {}).flat();
  const totalCorrect = answers.filter(Boolean).length;
  const totalAnswered = answers.length;
  const daysCompleted = Object.keys(state.allResults || {}).length;
  const studyDays = Math.max(0, Number(state.totalStudyDays) || 0);
  const studiedToday = state.lastStudyDate === todayKey();
  const learningDay = Math.max(1, studyDays + (studiedToday ? 0 : 1));
  const accuracy = totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0;
  const xp = totalCorrect * 10 + daysCompleted * 5 + studyDays * 3;
  const level = Math.floor(xp / 100) + 1;
  return {
    totalCorrect, totalAnswered, daysCompleted, studyDays, accuracy, xp, level,
    xpInLevel: xp % 100, rank: ranks[Math.min(level - 1, ranks.length - 1)],
    streak: currentStreak(), bestStreak: state.bestStreak || 0, learningDay, streakStatus: streakStatus()
  };
}

function allQuestions() {
  const lessonQuestions = LESSONS.flatMap((lesson, dayIndex) =>
    lesson.quiz.map((q, qi) => ({...q, id:`${dayIndex}-${qi}`, dayIndex, qi, day:lesson.day, title:lesson.title, cat:lesson.cat}))
  );
  const pastChoiceQuestions = PAST_QUESTIONS
    .filter(q => q.kind === "choice" && Array.isArray(q.choices))
    .map((q, i) => ({
      id: q.id || `past-${i}`,
      dayIndex: LESSONS.length + i,
      qi: 0,
      day: "過去問",
      title: q.source?.attribution || q.source?.period || "過去問",
      cat: "過去問",
      q: q.question,
      c: q.choices,
      a: q.answer,
      source: q.source
    }));
  return lessonQuestions.concat(pastChoiceQuestions);
}

function pastChoiceQuestions() {
  return allQuestions().filter(q => q.id && String(q.id).startsWith("past"));
}

function allEssayDrills() {
  const pastShort = PAST_QUESTIONS
    .filter(q => q.kind === "short")
    .map((q, i) => ({
      id: q.id || `past-short-${i}`,
      theme: q.tags?.[0] || q.source?.period || "過去問",
      type: q.source?.questionNo || "短文",
      limit: q.limit || "指定字数",
      prompt: q.prompt,
      points: q.expectedPoints || [],
      sample: q.sampleAnswer || "",
      source: q.source
    }));
  return ESSAY_DRILLS.concat(pastShort);
}

function allEssayTopics() {
  const pastEssay = PAST_QUESTIONS
    .filter(q => q.kind === "essay")
    .map((q, i) => ({
      theme: q.theme || q.source?.attribution || `過去問論述 ${i + 1}`,
      icon: "pen",
      scenario: q.source?.attribution || "IPA過去問の午後II論述テーマ",
      keywords: q.tags || [],
      structure: [
        ["出典", q.source?.attribution || ""],
        ["設問要求", (q.requirements || []).join(" / ")],
        ["構成メモ", q.outlineHint || ""]
      ],
      source: q.source
    }));
  return ESSAYS.concat(pastEssay);
}

function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function icon(name) {
  const p = {
    book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
    shuffle:'<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
    pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    tree:'<path d="M12 22V8"/><path d="m7 12 5-5 5 5"/><path d="m5 17 7-7 7 7"/>',
    left:'<path d="m15 18-6-6 6-6"/>',
    right:'<path d="m9 18 6-6-6-6"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    zap:'<path d="M13 2 3 14h8l-1 8 10-12h-8Z"/>',
    award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
    brain:'<path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5.2A4 4 0 0 0 8 19h1"/><path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5.2A4 4 0 0 1 16 19h-1"/><path d="M9 3v16M15 3v16"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    rotate:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/>',
    trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    star:'<path d="m12 2 3 6 6 .9-4.5 4.4 1.1 6.2L12 16.6 6.4 19.5l1.1-6.2L3 8.9 9 8Z"/>',
    warn:'<path d="m12 3 10 18H2Z"/><path d="M12 9v4M12 17h.01"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    calendar:'<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>'
  };
  return `<svg class="icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name] || ""}</svg>`;
}

function render() {
  const s = stats();
  app.innerHTML = `
    <header class="topbar">
      <div class="wrap top-main">
        <div class="brand"><strong>PM道場</strong><span>ローカル専用・積み上げ版</span></div>
        <div class="top-xp">Lv.${s.level} ${esc(s.rank)} | ${s.xp} XP</div>
      </div>
      <nav class="wrap tabs" aria-label="メイン">
        ${tabButton("learn","book","学習")}
        ${tabButton("practice","shuffle","無限練習")}
        ${tabButton("essay","pen","論文道場")}
        ${tabButton("tree","tree","成長の木")}
      </nav>
    </header>
    <main class="wrap">${renderTab(s)}</main>
    ${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}
  `;
}

function tabButton(id, ic, label) {
  return `<button class="tab ${state.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" type="button">${icon(ic)}<span>${label}</span></button>`;
}

function renderTab(s) {
  if (state.tab === "practice") return practiceTab();
  if (state.tab === "essay") return essayTab();
  if (state.tab === "tree") return treeTab(s);
  return learnTab(s);
}

function statChip(label, val) {
  return `<div class="stat"><small>${label}</small><strong>${esc(val)}</strong></div>`;
}

function learnTab(s) {
  const lesson = LESSONS[state.day];
  return `
    <section class="grid-4">
      ${statChip("連続学習", `${s.streak}日`)}
      ${statChip("正答率", `${s.accuracy}%`)}
      ${statChip("XP", s.xp)}
      ${statChip("学習日", `${s.studyDays}日`)}
    </section>
    <div class="streak-note">${esc(s.streakStatus)}。累計DAYと木は減りません。</div>
    <div class="learn-progress-row">
      <div class="bar"><i style="width:${s.xpInLevel}%"></i></div>
      ${treeWipe(s)}
    </div>
    <section class="day-head">
      <button class="icon-btn" data-action="prev" aria-label="前の教材">${icon("left")}</button>
      <div class="day-title">
        <b>DAY ${s.learningDay}</b>
        <h1>${esc(lesson.title)}</h1>
        <span class="pill ${catClass[lesson.cat] || ""}">教材 ${lesson.day}・${esc(lesson.cat)}</span>
      </div>
      <button class="icon-btn" data-action="next" aria-label="次の教材">${icon("right")}</button>
    </section>
    <div class="map-toggle"><button class="link-btn" data-action="toggle-map">${state.showMap ? "教材バンクを閉じる" : "教材バンクを見る"}</button></div>
    ${state.showMap ? dayMap() : ""}
    ${state.phase === "quiz" ? quizView() : state.phase === "result" ? resultView() : lessonView(lesson)}
  `;
}

function treeWipe(s) {
  return `<button class="tree-wipe" data-action="tab" data-tab="tree" type="button" aria-label="成長の木を見る">
    ${treeMiniSvg(treeStage(s.studyDays))}
    <span><b>DAY ${s.learningDay}</b><small>${esc(s.streakStatus)}</small></span>
  </button>`;
}

function dayMap() {
  return `<section class="card day-map">
    <div class="day-grid">
      ${LESSONS.map((l, i) => {
        const done = state.allResults[i];
        const score = done ? done.filter(Boolean).length : null;
        const cls = i === state.day ? "current" : done ? score >= 2 ? "pass" : "fail" : "";
        return `<button class="day-btn ${cls}" data-action="go-day" data-day="${i}" title="Day ${l.day}: ${esc(l.title)}">${l.day}</button>`;
      }).join("")}
    </div>
    <div class="legend"><span>合格: 2問以上</span><span>要復習: 0〜1問</span><span>未実施: 無印</span></div>
  </section>`;
}

function lessonView(lesson) {
  return `<section class="stack">
    <article class="card">
      <div class="card-title">${icon("brain")}今日のポイント</div>
      <p class="lesson-text">${esc(lesson.exp)}</p>
    </article>
    <button class="btn primary" data-action="start-quiz">${icon("zap")}クイズ挑戦（3問）</button>
  </section>`;
}

function quizView() {
  const lesson = LESSONS[state.day];
  const q = lesson.quiz[state.qIndex];
  return `<section class="stack">
    <div class="quiz-top">
      <span>問題 ${state.qIndex + 1} / 3</span>
      <span class="marks">${[0,1,2].map(i => {
        const r = state.session[i];
        return `<i class="mark ${r === true ? "ok" : r === false ? "ng" : ""}">${r === true ? "○" : r === false ? "×" : ""}</i>`;
      }).join("")}</span>
    </div>
    <article class="card">
      <p class="question">${esc(q.q)}</p>
      <div class="choices">${q.c.map((choice, i) => choiceButton(q, choice, i, "answer", state.selected, state.answered)).join("")}</div>
    </article>
    ${state.answered ? `<button class="btn primary" data-action="next-question">${state.qIndex < 2 ? "次の問題" : "結果を見る"} ${icon("right")}</button>` : ""}
  </section>`;
}

function choiceButton(q, choice, i, action, selected, answered) {
  let cls = "";
  let status = "";
  if (answered) {
    if (i === q.a) { cls = "correct"; status = icon("check"); }
    else if (i === selected) { cls = "wrong"; status = icon("x"); }
    else cls = "dim";
  }
  return `<button class="choice ${cls}" data-action="${action}" data-choice="${i}" ${answered ? "disabled" : ""}>
    <span class="letter">${["A","B","C","D"][i]}</span><span class="choice-text">${esc(choice)}</span><span>${status}</span>
  </button>`;
}

function resultView() {
  const done = state.allResults[state.day] || state.session;
  const correct = done.filter(Boolean).length;
  const pass = correct >= 2;
  const cls = correct === 3 ? "perfect" : pass ? "pass" : "retry";
  return `<section class="stack">
    <article class="card result ${cls}">
      <div class="big">${correct === 3 ? icon("award") : pass ? icon("star") : icon("rotate")}</div>
      <div class="score">${correct} / 3 正解</div>
      <p class="muted">${correct === 3 ? "満点。かなりいい仕上がりです。" : pass ? "合格ライン突破。木が育ちました。" : "要復習。ここが伸びしろです。"}</p>
      <strong style="color:var(--amber)">+${correct * 10 + 5} XP</strong>
    </article>
    <div class="actions">
      <button class="btn" data-action="retry">${icon("rotate")}もう一度</button>
      <button class="btn primary" data-action="next">次の教材へ ${icon("right")}</button>
    </div>
    <button class="btn" data-action="tab" data-tab="tree">${icon("tree")}成長の木を見る</button>
  </section>`;
}

function practiceTab() {
  const total = allQuestions().length;
  const q = state.practicePool[state.practiceIndex];
  const acc = state.practiceScore.total ? Math.round(state.practiceScore.correct / state.practiceScore.total * 100) : 0;
  return `<section class="stack">
    <article class="card screen-title">
      <h2>無限練習モード</h2>
      <p>登録済み教材 ${LESSONS.length}本・${total}問。弱点だけの再演習にも切り替えられます。</p>
    </article>
    <div class="mode-row">
      ${seg("all","全問ランダム")}
      ${seg("past","過去問")}
      ${seg("wrong","弱点優先")}
      ${seg("recent","最近の範囲")}
    </div>
    ${!q ? `<button class="btn alt" data-action="start-practice">${icon("shuffle")}練習スタート</button>` : `
      <div class="quiz-top"><span>練習 ${state.practiceScore.total + 1}問目</span><span>正答率 ${acc}% (${state.practiceScore.correct}/${state.practiceScore.total})</span></div>
      <div class="note" style="padding:9px;text-align:center;color:var(--muted);font-size:.78rem">Day${q.day}: ${esc(q.title)}</div>
      <article class="card"><p class="question">${esc(q.q)}</p><div class="choices">${q.c.map((c, i) => choiceButton(q, c, i, "practice-answer", state.practiceSelected, state.practiceAnswered)).join("")}</div>${sourceLine(q.source)}</article>
      ${state.practiceAnswered ? `<button class="btn alt" data-action="next-practice">次の問題 ${icon("right")}</button>` : ""}
      <button class="btn" data-action="start-practice">${icon("shuffle")}出題を作り直す</button>
    `}
  </section>`;
}

function seg(id, label) {
  return `<button class="seg ${state.practiceMode === id ? "active" : ""}" data-action="practice-mode" data-mode="${id}">${label}</button>`;
}

function essayTab() {
  if (state.essayMode === "short") return essayShortTab();
  const topics = allEssayTopics();
  const topic = topics[state.essayIndex];
  return topic ? essayDetail(topic) : `<section class="stack">
    <article class="card screen-title">
      <h2>論文道場</h2>
      <p>午後IIは「架空プロジェクト」を固定して、頻出テーマごとにPMBOKの型へ流し込む練習が効きます。</p>
    </article>
    ${essayModeSwitch()}
    ${profileEditor()}
    <div class="essay-list">${topics.map((t, i) => `<button class="essay-topic" data-action="essay-open" data-essay="${i}">
      <span>${icon(t.icon)}</span><span><b>${esc(t.theme)}</b><small>${esc(t.scenario)}</small></span><span>${icon("right")}</span>
    </button>`).join("")}</div>
  </section>`;
}

function essayModeSwitch() {
  return `<div class="mode-row essay-mode-row">
    <button class="seg ${state.essayMode === "framework" ? "active" : ""}" data-action="essay-mode" data-mode="framework">論文フレーム</button>
    <button class="seg ${state.essayMode === "short" ? "active" : ""}" data-action="essay-mode" data-mode="short">短文Q&A</button>
  </div>`;
}

function essayShortTab() {
  const drills = allEssayDrills();
  const drill = drills[state.essayDrillIndex % Math.max(drills.length, 1)];
  if (!drill) {
    return `<section class="stack"><article class="card screen-title"><h2>短文Q&A</h2><p>短文回答データがまだありません。</p></article>${essayModeSwitch()}</section>`;
  }
  const count = state.essayDrillAnswer.trim().length;
  return `<section class="stack">
    <article class="card screen-title">
      <h2>短文Q&A</h2>
      <p>原因・対策・評価・教訓を短く答える練習です。午後Iの記述と午後IIの部品作りに効きます。</p>
    </article>
    ${essayModeSwitch()}
    <article class="card">
      <div class="quiz-top"><span>${esc(drill.theme)}・${esc(drill.type)}</span><span>${esc(drill.limit)}目安</span></div>
      <p class="question">${esc(drill.prompt)}</p>
      <textarea class="short-answer" data-essay-drill-answer placeholder="ここに自分の回答を書く">${esc(state.essayDrillAnswer)}</textarea>
      <div class="answer-count">${count}字</div>
    </article>
    <div class="actions">
      <button class="btn" data-action="essay-drill-prev">${icon("left")}前の問い</button>
      <button class="btn primary" data-action="essay-drill-reveal">${state.essayDrillRevealed ? "採点観点を隠す" : "採点観点を見る"}</button>
    </div>
    ${state.essayDrillRevealed ? essayDrillFeedback(drill) : ""}
    <button class="btn pink" data-action="essay-drill-next">次の問い ${icon("right")}</button>
  </section>`;
}

function essayDrillFeedback(drill) {
  return `<article class="card">
    <div class="card-title">${icon("check")}採点観点</div>
    <div class="badge-row">${drill.points.map(p => `<span class="badge">${esc(p)}</span>`).join("")}</div>
    <div class="sample-answer"><b>模範例</b><p>${esc(drill.sample)}</p></div>
    ${sourceLine(drill.source)}
  </article>`;
}

function sourceLine(source) {
  if (!source?.attribution) return "";
  const url = source.url ? ` <a href="${esc(source.url)}" target="_blank" rel="noopener">IPA</a>` : "";
  return `<p class="source-line">${esc(source.attribution)}${url}</p>`;
}

function profileEditor() {
  const p = state.profile;
  return `<article class="card">
    <div class="card-title">${icon("pen")}私の架空プロジェクト設定</div>
    <div class="profile">
      ${field("industry","業種",p.industry)}
      ${field("system","システム名",p.system)}
      ${field("size","規模",p.size)}
      ${field("role","自分の役割",p.role)}
      <div class="field full"><label>背景</label><textarea data-profile="background">${esc(p.background)}</textarea></div>
    </div>
  </article>`;
}

function field(key, label, value) {
  return `<div class="field"><label>${label}</label><input data-profile="${key}" value="${esc(value)}"></div>`;
}

function essayDetail(topic) {
  const note = state.essayNotes[topic.theme] || draftEssay(topic);
  return `<section class="stack">
    <button class="link-btn" data-action="essay-back">${icon("left")}テーマ一覧に戻る</button>
    <article class="card"><div class="card-title">${icon(topic.icon)}${esc(topic.theme)}</div><p class="lesson-text">${esc(topic.scenario)}</p>${sourceLine(topic.source)}</article>
    <article class="card"><div class="card-title">${icon("star")}使うキーワード</div><div class="badge-row">${topic.keywords.map(k => `<span class="badge">${esc(k)}</span>`).join("")}</div></article>
    <section class="outline">${topic.structure.map(([h, body]) => `<article><b>${esc(h)}</b><p>${esc(body)}</p></article>`).join("")}</section>
    <article class="card">
      <div class="card-title">${icon("pen")}論文メモ</div>
      <textarea class="template" data-essay-note="${esc(topic.theme)}">${esc(note)}</textarea>
    </article>
  </section>`;
}

function draftEssay(topic) {
  const p = state.profile;
  return `私は${p.industry}における${p.system}プロジェクトで、${p.role}を担当した。規模は${p.size}である。${p.background}

テーマ: ${topic.theme}
想定課題: ${topic.scenario}

序論:
プロジェクト概要、制約条件、当該テーマが重要になった背景を書く。

本論①:
課題の発生状況、PMとしての判断、PMBOKの手法を使った対応を書く。

本論②:
対応結果を可能な限り定量的に示し、評価、残課題、改善点を書く。

結論:
得た教訓と、次回プロジェクトでの改善方針を書く。`;
}

function treeTab(s) {
  const stage = treeStage(s.studyDays);
  const treeLevel = Math.floor(Math.max(0, s.studyDays - 1) / 60) + 1;
  const labels = ["種","芽吹き","小さな苗","若木","大きな木","花の木","実りの木","完成した大樹"];
  return `<section class="stack">
    <article class="card tree-wrap">${treeSvg(stage)}<div class="tree-label"><b>${labels[stage]} Lv.${treeLevel}</b><span>累計学習 ${s.studyDays}日・現在 DAY ${s.learningDay}</span></div></article>
    <section class="grid-4">
      ${statChip("累計学習", `${s.studyDays}日`)}
      ${statChip("連続", `${s.streak}日`)}
      ${statChip("最高連続", `${s.bestStreak}日`)}
      ${statChip("弱点", `${state.wrongIds.length}問`)}
    </section>
    <article class="card"><div class="card-title">${icon("trend")}成長記録</div><div class="milestones">${milestones(s.studyDays)}</div></article>
    <button class="btn" data-action="reset-progress">進捗をリセット</button>
  </section>`;
}

function treeStage(done) {
  if (done <= 0) return 0;
  if (done <= 4) return 1;
  if (done <= 9) return 2;
  if (done <= 19) return 3;
  if (done <= 34) return 4;
  if (done <= 49) return 5;
  if (done <= 59) return 6;
  return 7;
}

function treeSvg(stage) {
  const bloom = stage >= 5 ? '<circle cx="58" cy="34" r="5" fill="#f299c8"/><circle cx="100" cy="30" r="5" fill="#f299c8"/><circle cx="80" cy="16" r="5" fill="#ffd5e8"/>' : "";
  const fruit = stage >= 6 ? '<circle cx="52" cy="50" r="5" fill="#f6c453"/><circle cx="108" cy="50" r="5" fill="#f6c453"/><circle cx="80" cy="30" r="5" fill="#ee7d4a"/>' : "";
  const glow = stage >= 7 ? '<circle cx="80" cy="52" r="55" fill="#f6c453" opacity=".12"/>' : "";
  const crown = stage >= 3 ? '<circle cx="80" cy="50" r="30" fill="#66d287"/><circle cx="55" cy="62" r="19" fill="#39b96d"/><circle cx="105" cy="62" r="19" fill="#2f985a"/>' : "";
  const top = stage >= 4 ? '<circle cx="80" cy="31" r="20" fill="#8ee7a7"/><line x1="80" y1="86" x2="52" y2="61" stroke="#8b5a22" stroke-width="5" stroke-linecap="round"/><line x1="80" y1="86" x2="108" y2="61" stroke="#8b5a22" stroke-width="5" stroke-linecap="round"/>' : "";
  const sprout = stage >= 1 ? '<rect x="77" y="104" width="6" height="34" rx="3" fill="#7a521f"/><ellipse cx="65" cy="112" rx="13" ry="7" fill="#66d287" transform="rotate(-28 65 112)"/><ellipse cx="95" cy="112" rx="13" ry="7" fill="#39b96d" transform="rotate(28 95 112)"/>' : '<ellipse cx="80" cy="138" rx="8" ry="6" fill="#a87534"/>';
  const trunk = stage >= 2 ? '<rect x="74" y="78" width="12" height="62" rx="5" fill="#8b5a22"/><circle cx="80" cy="80" r="20" fill="#66d287"/>' : "";
  return `<svg class="tree-svg" viewBox="0 0 160 160" role="img" aria-label="成長の木">${glow}<ellipse cx="80" cy="148" rx="58" ry="10" fill="#6b4c18" opacity=".55"/><rect x="22" y="141" width="116" height="13" rx="7" fill="#7b5421"/>${sprout}${trunk}${top}${crown}${bloom}${fruit}</svg>`;
}

function treeMiniSvg(stage) {
  return treeSvg(stage).replace('class="tree-svg"', 'class="tree-mini-svg"');
}

function milestones(done) {
  const rows = [[1,"芽吹き","最初の1日"],[5,"小さな苗","基礎が育つ"],[10,"若木","計画知識が根付く"],[20,"大きな木","実行・監視へ"],[35,"花の木","午後I対策へ"],[50,"実りの木","論述対策へ"],[60,"大樹完成","ここから年輪が増える"],[100,"百日樹","習慣化の大台"],[365,"一年樹","一年分の積み重ね"],[1000,"千日樹","完全に自分の武器"]];
  return rows.map(([n, name, note]) => `<div class="milestone ${done >= n ? "done" : ""}"><span>${done >= n ? icon("check") : icon("star")}</span><div><b>Day ${n}: ${name}</b><small>${note}</small></div></div>`).join("");
}

function showToast(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = ""; render(); }, 2600);
}

function goDay(i) {
  state.day = clamp(i, 0, LESSONS.length - 1);
  state.phase = "lesson"; state.qIndex = 0; state.selected = null; state.answered = false; state.session = []; state.showMap = false;
  save(); render();
}

function completeDay() {
  const correct = state.session.filter(Boolean).length;
  state.allResults[state.day] = [...state.session];
  markStudied();
  LESSONS[state.day].quiz.forEach((_, i) => state.session[i] ? removeWrong(`${state.day}-${i}`) : addWrong(`${state.day}-${i}`));
  state.phase = "result";
  save(); render();
}

function addWrong(id) {
  if (!state.wrongIds.includes(id)) state.wrongIds.push(id);
}

function removeWrong(id) {
  state.wrongIds = state.wrongIds.filter(x => x !== id);
}

function startPractice() {
  const qs = allQuestions();
  let pool = qs;
  if (state.practiceMode === "past") {
    pool = qs.filter(q => q.id && String(q.id).startsWith("past"));
    if (!pool.length) pool = qs;
  }
  if (state.practiceMode === "wrong") {
    const set = new Set(state.wrongIds);
    pool = qs.filter(q => set.has(q.id));
    if (!pool.length) pool = qs;
  }
  if (state.practiceMode === "recent") {
    const max = Math.max(0, state.day - 9);
    pool = qs.filter(q => q.dayIndex >= max && q.dayIndex <= state.day);
  }
  state.practicePool = shuffle(pool);
  state.practiceIndex = 0;
  state.practiceSelected = null;
  state.practiceAnswered = false;
  state.practiceScore = {correct:0,total:0};
  render();
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "tab") { state.tab = el.dataset.tab; save(); render(); return; }
  if (a === "prev") return goDay((state.day - 1 + LESSONS.length) % LESSONS.length);
  if (a === "next") return goDay((state.day + 1) % LESSONS.length);
  if (a === "go-day") return goDay(Number(el.dataset.day));
  if (a === "toggle-map") { state.showMap = !state.showMap; render(); return; }
  if (a === "retry") return goDay(state.day);
  if (a === "start-quiz") { state.phase = "quiz"; state.qIndex = 0; state.session = []; state.selected = null; state.answered = false; render(); return; }
  if (a === "answer" && !state.answered) {
    const choice = Number(el.dataset.choice);
    const q = LESSONS[state.day].quiz[state.qIndex];
    const ok = choice === q.a;
    state.selected = choice; state.answered = true; state.session[state.qIndex] = ok;
    ok ? removeWrong(`${state.day}-${state.qIndex}`) : addWrong(`${state.day}-${state.qIndex}`);
    render(); return;
  }
  if (a === "next-question") {
    if (state.qIndex < 2) { state.qIndex += 1; state.selected = null; state.answered = false; render(); }
    else completeDay();
    return;
  }
  if (a === "practice-mode") { state.practiceMode = el.dataset.mode; state.practicePool = []; save(); render(); return; }
  if (a === "start-practice") return startPractice();
  if (a === "practice-answer" && !state.practiceAnswered) {
    const q = state.practicePool[state.practiceIndex];
    const choice = Number(el.dataset.choice);
    const ok = choice === q.a;
    state.practiceSelected = choice; state.practiceAnswered = true;
    state.practiceScore.correct += ok ? 1 : 0; state.practiceScore.total += 1;
    ok ? removeWrong(q.id) : addWrong(q.id);
    if (state.practiceScore.total % 5 === 0) markStudied();
    save(); render(); return;
  }
  if (a === "next-practice") {
    state.practiceIndex = (state.practiceIndex + 1) % state.practicePool.length;
    state.practiceSelected = null; state.practiceAnswered = false;
    if (state.practiceIndex === 0) state.practicePool = shuffle(state.practicePool);
    render(); return;
  }
  if (a === "essay-mode") {
    state.essayMode = el.dataset.mode;
    state.essayIndex = null;
    state.essayDrillRevealed = false;
    save(); render(); return;
  }
  if (a === "essay-open") { state.essayIndex = Number(el.dataset.essay); render(); return; }
  if (a === "essay-back") { state.essayIndex = null; render(); return; }
  if (a === "essay-drill-reveal") { state.essayDrillRevealed = !state.essayDrillRevealed; render(); return; }
  if (a === "essay-drill-next") {
    const len = Math.max(allEssayDrills().length, 1);
    state.essayDrillIndex = (state.essayDrillIndex + 1) % len;
    state.essayDrillAnswer = "";
    state.essayDrillRevealed = false;
    markStudied(); save(); render(); return;
  }
  if (a === "essay-drill-prev") {
    const len = Math.max(allEssayDrills().length, 1);
    state.essayDrillIndex = (state.essayDrillIndex - 1 + len) % len;
    state.essayDrillAnswer = "";
    state.essayDrillRevealed = false;
    render(); return;
  }
  if (a === "reset-progress") {
    if (confirm("PM道場の進捗をすべてリセットしますか？")) { localStorage.removeItem(KEY); state = load(); render(); }
  }
});

app.addEventListener("input", (e) => {
  const profileKey = e.target.dataset.profile;
  if (profileKey) {
    state.profile[profileKey] = e.target.value;
    save();
  }
  const topic = e.target.dataset.essayNote;
  if (topic) {
    state.essayNotes[topic] = e.target.value;
    markStudied();
    save();
  }
  if (e.target.dataset.essayDrillAnswer !== undefined) {
    state.essayDrillAnswer = e.target.value;
    save();
  }
});

render();
