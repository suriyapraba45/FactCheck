# FactCheck AI 🔍

A WhatsApp-native AI fact-checker for Indian languages: **Tamil, Telugu, Bengali, Hindi, and English** — powered by Claude.

---

## 🚀 One-Click Deploy

### Deploy to Vercel (recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/factcheck-ai&env=REACT_APP_ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key&envLink=https://console.anthropic.com/)

1. Click the button above
2. Connect your GitHub account
3. Add `REACT_APP_ANTHROPIC_API_KEY` when prompted
4. Click **Deploy** — live in ~60 seconds ✅

### Deploy to Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/factcheck-ai)

1. Click above → connect GitHub
2. In **Environment Variables** add:
   - Key: `REACT_APP_ANTHROPIC_API_KEY`
   - Value: your Anthropic key from [console.anthropic.com](https://console.anthropic.com)
3. Click **Deploy site** ✅

---

## 💻 Run Locally

```bash
# 1. Clone / unzip the project
cd factcheck-ai

# 2. Install dependencies
npm install

# 3. Set your API key
cp .env.example .env
# Edit .env → paste your REACT_APP_ANTHROPIC_API_KEY

# 4. Start dev server
npm start
# → http://localhost:3000
```

---

## 🏗️ Build for Production

```bash
npm run build
# Output in /build — deploy this folder to any static host
```

---

## 📁 Project Structure

```
factcheck-ai/
├── public/
│   └── index.html          # App shell
├── src/
│   ├── index.js            # React root
│   ├── App.js              # Entry component
│   └── FactChecker.js      # Main WhatsApp UI + Claude API logic
├── .env.example            # Copy → .env, add your key
├── vercel.json             # Vercel config
├── netlify.toml            # Netlify config
└── package.json
```

---

## 🔑 Get an Anthropic API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy and paste into your `.env` or deployment environment variable

---

## ✨ Features

- WhatsApp-pixel-perfect phone UI
- Color-coded verdicts: ✅ True · ❌ False · ⚠️ Mixed · 🔍 Unverified
- Animated confidence bar + virality meter
- Multilingual: Tamil · Telugu · Bengali · Hindi · English
- In-memory cache — repeat claims answered instantly
- Works on mobile & desktop browsers
- Zero backend — pure static React app

---

## ⚠️ Security Note

This app calls the Anthropic API directly from the browser using `REACT_APP_ANTHROPIC_API_KEY`. This is fine for demos and hackathons. For production, proxy the API call through your own backend to keep the key secret.
