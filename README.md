# ふらっとAI - スマホ用チャットアプリ

スマートフォン向けチャットUIアプリケーションです。（PCからでももちろん操作可能）
Open AIのAPIを使用する前提のUIです。（API利用には利用料金がかかりますので注意してください）
APIをさくっと使ってみたい方におすすめです！改変などご自由にどうぞ！

## 特徴

- 📱 **レスポンシブデザイン**: スマートフォン画面（320-428px）に最適化
- 🎨 **シンプルなUI**: 使いやすくてシンプルなデザインを目指しました
- 💬 **リアルタイムチャット**: OpenAI APIとの連携でリアルタイム会話
- ⚙️ **カスタマイズ可能**: アシスタント名、アバター、システムプロンプトを設定可能
- 🔒 **ローカル保存**: ブラウザのローカルストレージでデータを安全に保存

## ファイル構成

```
├── index.html          # メインHTMLファイル
├── styles.css          # スタイルシート
├── script.js           # JavaScript機能
└── README.md           # このファイル
```

## 使用方法

## ✅ はじめに（必要なもの）
- いずれかの方法でデプロイします。**最短は「A. ワンクリック」**です。
  - A. ワンクリック：**GitHubアカウント** + **Vercelアカウント**（無料プランで使用できます）
  - B. GitHubなし：Vercelアカウント + PC + Vercel CLI
  - C. デモ：APIなしのモックでUIだけ試す

> セキュリティ上の理由で **GitHub Pages では動作させないでください**。  
> OpenAIのAPIキーが公開されます。必ず Vercel でデプロイし、キーは**環境変数**に設定してください。

---

## A.（推奨）ワンクリックでデプロイ
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/<YOUR>/<REPO>&project-name=flatto-ai&repository-name=flatto-ai&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20API%20Key)

1. ボタンを押す → （GitHub未所持なら）**その場で無料作成** → Vercelに接続  
2. `OPENAI_API_KEY` を入力してデプロイ  
3. できたURLにアクセスして完了

---

## B. GitHubアカウントなしでデプロイ（Vercel CLI）
1. 右上 **Code → Download ZIP** でコード取得（GitHubアカウント不要）  
2. PCで解凍し、フォルダで以下を実行：

```bash
npm i -g vercel
vercel login
vercel env add OPENAI_API_KEY   # OpenAIのAPIキーを入力
vercel --prod

## デプロイ後の手順

1. デプロイしたURL（PCの場合は`index.html`）をブラウザで開く
2. 設定ボタン（⚙️）をクリックしてOpenAI APIキーを設定
3. メッセージを入力してAIと会話開始

## 設定項目

- **アシスタント名**: AIアシスタントの表示名
- **ステータステキスト**: アシスタントの状態表示
- **APIキー**: OpenAI APIキー（必須）
- **モデル**: 使用するOpenAIモデル（GPT-4o Latest推奨）
- **システムプロンプト**: AIアシスタントの性格や役割を定義
- **アバター画像**: アシスタントのアイコン画像

## 技術仕様

- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript
- **API連携**: OpenAI Chat Completions API
- **データ保存**: localStorage
- **対応ブラウザ**: Safari iOS16+, Chrome Android, Chromium Desktop

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。


---

**注意**: OpenAI APIキーは安全に管理し、他人と共有しないでください。
