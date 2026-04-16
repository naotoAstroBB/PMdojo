// IPA過去問を追加するときのテンプレートです。
// 実データとして使う場合は、このファイル名を `past-questions.js` に変更し、
// index.htmlで `./data/past-questions.js` を読み込んでください。
//
// IPA公式FAQでは、公表過去問題の利用に許諾・使用料は不要とされています。
// ただし、著作権は放棄されていません。年度・期・試験区分・時間区分・問番号の出典を必ず残してください。

window.PM_DOJO_PAST_QUESTIONS = [
  {
    id: "pm-2025-autumn-am2-q01",
    source: {
      year: "令和7年度",
      season: "秋期",
      exam: "プロジェクトマネージャ試験",
      period: "午前II",
      questionNo: 1,
      url: "https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html",
      attribution: "出典：令和7年度 秋期 プロジェクトマネージャ試験 午前II 問1"
    },
    kind: "choice",
    tags: ["PMBOK", "スコープ", "午前II"],
    question: "ここに問題文を入れる",
    choices: ["ア", "イ", "ウ", "エ"],
    answer: 0,
    explanation: "ここに自分用の解説を入れる",
    note: "原文を一部改変した場合は、その旨をここに書く"
  },
  {
    id: "pm-2025-autumn-pm1-q1-s1",
    source: {
      year: "令和7年度",
      season: "秋期",
      exam: "プロジェクトマネージャ試験",
      period: "午後I",
      questionNo: "問1 設問1",
      url: "https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html",
      attribution: "出典：令和7年度 秋期 プロジェクトマネージャ試験 午後I 問1 設問1"
    },
    kind: "short",
    tags: ["午後I", "原因", "ステークホルダー"],
    prompt: "ここに設問を入れる",
    expectedPoints: ["採点観点1", "採点観点2"],
    sampleAnswer: "ここに自分用の短文回答例を入れる",
    note: "問題文全体を転載する場合は出典を保持する"
  },
  {
    id: "pm-2025-autumn-pm2-q1",
    source: {
      year: "令和7年度",
      season: "秋期",
      exam: "プロジェクトマネージャ試験",
      period: "午後II",
      questionNo: "問1",
      url: "https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html",
      attribution: "出典：令和7年度 秋期 プロジェクトマネージャ試験 午後II 問1"
    },
    kind: "essay",
    tags: ["午後II", "論述", "リスク管理"],
    theme: "ここに論述テーマを入れる",
    requirements: ["設問ア", "設問イ", "設問ウ"],
    outlineHint: "ここに自分用の構成メモを入れる",
    note: "テーマを要約・改変した場合は、その旨を明記する"
  }
];
