<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Frontend (Vite + React)

This is the Daily Report Automator UI. Data is persisted through the backend API (MongoDB) instead of browser localStorage.

## Run Locally

**Prerequisites:**  Node.js and the backend running on `http://localhost:4000` (default).

1. Install dependencies: `npm install`
2. Configure [.env.local](.env.local):
   - `GEMINI_API_KEY` (if you want AI parsing)
   - `VITE_API_BASE_URL` (defaults to `http://localhost:4000/api`)
3. Start the dev server: `npm run dev`
