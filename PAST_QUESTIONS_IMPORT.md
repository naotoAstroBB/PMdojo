# 過去問データ追加手順

PM道場に過去問を増やすときは、アプリ本体を触らず、`data/`配下にデータファイルを追加します。

## まず入れる場所

GitHubの`PMdojo`リポジトリでは、次の場所に置きます。

```txt
PMdojo/
├─ index.html
├─ app.js
├─ styles.css
└─ data/
   ├─ lessons-01-20.js
   ├─ lessons-21-40.js
   ├─ lessons-41-60.js
   ├─ essays.js
   ├─ essay-drills.js
   └─ past-questions.js  ← 追加するならここ
```

## 追加の流れ

1. `data/past-questions-template.js`をコピーする
2. コピーしたファイル名を`past-questions.js`にする
3. `window.PM_DOJO_PAST_QUESTIONS = [...]`の配列に過去問を追加する
4. `index.html`に次の1行を追加する

```html
<script src="./data/past-questions.js"></script>
```

置く位置は、`essay-drills.js`の下、`app.js`の上です。

```html
<script src="./data/essays.js"></script>
<script src="./data/essay-drills.js"></script>
<script src="./data/past-questions.js"></script>
<script src="./app.js"></script>
```

この行を追加すると、`kind: "choice"`の過去問は無限練習モードに自動で混ざります。`kind: "short"`と`kind: "essay"`は、午後I・午後II用のデータとして管理できます。

## 午前IIの形式

```js
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
  tags: ["EVM", "午前II"],
  question: "問題文",
  choices: ["ア", "イ", "ウ", "エ"],
  answer: 0,
  explanation: "自分用の解説"
}
```

## 午後Iの形式

```js
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
  tags: ["午後I", "原因", "スコープ"],
  prompt: "設問",
  expectedPoints: ["採点観点1", "採点観点2"],
  sampleAnswer: "短文回答例"
}
```

## 午後IIの形式

```js
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
  tags: ["午後II", "論述", "リスク"],
  theme: "論述テーマ",
  requirements: ["設問ア", "設問イ", "設問ウ"],
  outlineHint: "構成メモ"
}
```

## 安全な運用ルール

- 実案件名、勤務先名、顧客名、個人名は入れない
- IPA過去問を入れる場合は`source.attribution`を必ず残す
- 問題を要約・改変した場合は`note`に書く
- 大量データは年度ごとに分割する

年度ごとに分ける場合は、次のようにします。

```txt
data/past/
├─ pm-2025.js
├─ pm-2024.js
├─ pm-2023.js
└─ pm-2022.js
```

その場合は`index.html`に読み込み行を年度ごとに追加します。
