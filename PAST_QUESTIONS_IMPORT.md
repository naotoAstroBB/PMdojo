# 過去問データ追加手順

PM道場に過去問を増やすときは、アプリ本体を触らず、`data/`配下にデータファイルを追加します。

大量抽出した直後のデータは、まず`.tmp/ipa-pm-bank/draft/`に置きます。確認済みのものだけ`data/past-questions.js`へ移します。

## 今回のDownloads PDF抽出

直人さんが`C:\Users\naoto.takahashi\Downloads`に置いたIPA過去問PDFから、次の流れで抽出しました。

1. `tools/render_downloaded_pdfs_for_ocr.py`で問題冊子PDFをPNG化
2. `tools/windows_ocr_images.ps1`でWindows標準の日本語OCRを実行
3. `tools/build_past_choices_from_downloads.py`でOCR本文と解答PDFを突き合わせて`data/past-questions.js`を生成

生成結果は次のとおりです。

```txt
data/past-questions.js
├─ choice: 220件（2022〜2025 午前I 120問 + 午前II 100問）
├─ short: 18件（午後I 短文Q&A）
└─ essay: 12件（午後II 論文テーマ）
```

OCRの生データはGitHubに載せず、ローカルの`.tmp/ipa-pm-bank/local-ocr/`に置きます。公開するのは軽量化済みの`data/past-questions.js`だけです。

OCR由来の択一問題は図表や記号に認識ゆれが残る可能性があります。各レコードの`_review`にその旨を残しています。

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

## 大量抽出時の作業場所

抽出ツールの出力先は次の通りです。

```txt
.tmp/
└─ ipa-pm-bank/
   ├─ raw/
   │  ├─ pdf/   ← 公式PDFの一時保存
   │  └─ text/  ← PDFから抽出した生テキスト
   ├─ draft/
   │  └─ past-questions.generated.js  ← アプリ形式の下書き
   └─ manifest.json  ← PDF一覧と出典情報
```

`.tmp/ipa-pm-bank/draft/past-questions.generated.js`の中身は、次のような形式になります。

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

下書きには`_status`や`_rawTextPath`が付くことがあります。これは確認作業用なので、公開用に移すときは残しても消しても構いません。

## 追加の流れ

1. `data/past-questions.js`を開く
2. `window.PM_DOJO_PAST_QUESTIONS = [...]`の配列に過去問を追加する
3. GitHubへアップロードする

`index.html`には、すでに次の読み込み行が入っています。

```html
<script src="./data/past-questions.js"></script>
```

`kind: "choice"`の過去問は無限練習モードに自動で混ざります。`kind: "short"`は論文道場の短文Q&A、`kind: "essay"`は論文道場の論文テーマ一覧に自動で混ざります。

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
