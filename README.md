# Daily Report Automator (Mongo-backed)

This repo now has a split frontend (Vite + React) and backend (Express + MongoDB) so reports, settings, colors, and editor data are stored in MongoDB instead of browser localStorage.

## Project structure
- `frontend/` – Vite React app (Daily Report UI)
- `backend/` – Express API + Mongoose models for users and reports

## Backend setup
1. `cd backend`
2. `cp .env.example .env` (the provided Mongo URI and port are prefilled; change if needed)
3. `npm install`
4. `npm start` (defaults to `http://localhost:4000`)

## Frontend setup
1. `cd frontend`
2. Update `.env.local` with your keys and API base (defaults to `http://localhost:4000/api`)
3. `npm install`
4. `npm run dev`

## API overview
- `POST /api/auth/signup` (email-only auth)
- `POST /api/auth/login`
- `PUT /api/auth/user/:id` (update theme, recipients, saved colors, etc.)
- `GET /api/reports/:userId`
- `POST /api/reports` (create/update; enforces 30 reports per user)
- `DELETE /api/reports/:id`

All report fields (tasks, planning tasks, colors, pre/post text, etc.) persist to MongoDB.
