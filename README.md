# PM道場

ローカルだけで使うIPAプロジェクトマネージャ試験対策アプリです。表示上のDAYは累計学習日に応じて増え続け、教材バンクを循環しながら使えます。

公開URL: https://naotoastrobb.github.io/PMdojo/

## 使い方

`index.html`をブラウザで開くだけで動きます。npm install、ビルド、外部CDN、サーバーは不要です。

GitHub Pagesで公開する場合は、このフォルダの中身を`PMdojo`リポジトリのルートに置き、`Settings` → `Pages`で`main`ブランチの`/root`を公開元にしてください。

## 構成

- `index.html`: アプリの入口
- `styles.css`: 画面デザイン
- `app.js`: 学習、無限練習、論文道場、成長の木、保存処理
- `data/lessons-*.js`: 循環利用する学習データ
- `data/essays.js`: 午後II論述フレームワーク

## 保存先

進捗、弱点問題、架空プロジェクト設定、論文メモはブラウザの`localStorage`に保存されます。データは外部に送信されません。

学習日の履歴リストは保存せず、`totalStudyDays`、`lastStudyDate`、`currentStreak`、`bestStreak`だけを保存します。何千日使っても、日々の学習記録による保存量はほぼ一定です。

## 拡張方法

問題を増やす場合は、`data/lessons-*.js`に同じ形式で教材またはquizを追加します。外部依存がないため、ファイルサイズの増加は追加したテキスト分だけです。
