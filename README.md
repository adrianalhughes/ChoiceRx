# ChoiceRx

Formulary reference tool for value-based care settings.

**Current formulary:** Florida Blue ValueScript Rx, April 2026

## Deploy to Vercel

1. Push this repo to GitHub
2. Import in Vercel — it will auto-detect Vite
3. Deploy

## Add a future formulary

1. Add a parsed JSON file to `src/data/`
2. Register it in the `PLANS` array at the top of `src/App.jsx`

## Run locally

```bash
npm install
npm run dev
```
