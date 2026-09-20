# NEXUS Social Platform

A React + Vite frontend with a real Node/Express backend — **every feature is
backed by real data**, nothing is sample/mock data:
- **Real login with emailed codes** — the 6-digit code is sent to your inbox by the
  server.
- **Stories** — post a photo/video/text story that disappears after 24 hours.
- **Posts** — real posts, likes, saves, comments, and photo uploads, stored on the server.
- **Spaces** — real communities with real join/leave and real member counts.
- **Follow system** — real follow/unfollow, real follower/following lists and counts.
- **Chat** — real 1:1 conversations between real accounts, with image attachments,
  voice notes, read receipts, and reactions. Start one from the "New chat" button.
- **Search** — real live search across people, spaces, and posts.
- **Notifications** — generated automatically from real likes, comments, and follows.
- **Settings** — a real settings screen (profile shortcut, theme, sign out).

## Quick start (do this once)

You need two things running at the same time: the **backend** (the server that
sends emails and stores everything) and the **frontend** (the app you see in
the browser). Open two terminals.

**Terminal 1 — backend**
```bash
cd server
npm install
cp .env.example .env
```
Now open `server/.env` in any text editor and set up email (see below), then:
```bash
npm run dev
```
You should see `NEXUS API running at http://localhost:8787`.

**Terminal 2 — frontend**
```bash
npm install
npm run dev
```
Open the URL it shows (usually http://localhost:5173).

## Setting up real email for the login code

Open `server/.env` and fill in the SMTP section. Easiest way, using a free
Gmail account:
1. Turn on 2-Step Verification: https://myaccount.google.com/security
2. Create an "App Password": https://myaccount.google.com/apppasswords
3. Put that 16-character password in `SMTP_PASS`, and your Gmail address in
   `SMTP_USER` and `MAIL_FROM`.

Any other provider (Resend, Brevo, SendGrid, Zoho, your own mail server) works
too — just fill in its SMTP host/port/user/password instead.

If you skip this step, the server still works: it prints the code in the
backend terminal instead of emailing it, and (while `MAIL_DEBUG=true`) also
sends it back to the app so you can keep testing. Set `MAIL_DEBUG=false` once
real email is working so codes are never shown on-screen.

## How the pieces talk to each other

- The frontend calls the backend at the address in `.env` → `VITE_API_URL`
  (defaults to `http://localhost:8787/api`).
- Everything — accounts, stories, posts, spaces, follows, chat, notifications —
  is stored in `server/data/db.json` (created automatically — no database
  installation needed).
- Uploaded photos and voice notes are saved in `server/uploads/` and served at
  `http://localhost:8787/uploads/...`.

## Deploying for real (not just localhost)

See **DEPLOYMENT.md** in this folder for a full step-by-step guide to putting
this live on the internet with your own domain.

Short version: this app needs **two live services**:
1. The `server/` folder needs to run somewhere that stays on (Render, Railway,
   Fly.io, a VPS, etc — not Vercel/Netlify's static hosting, since it's a
   long-running Node process). Set the same environment variables from
   `server/.env.example` there, and make sure `server/data` and
   `server/uploads` are on a **persistent disk** (see DEPLOYMENT.md) or your
   data will be wiped on every redeploy.
2. The frontend (`npm run build`) goes on Vercel/Netlify — set `VITE_API_URL`
   in that host's environment settings to point at wherever you deployed the
   backend, e.g. `https://api.yourdomain.com/api`.

## What's honestly still missing

- **Voice/video calling** (the phone/video icons in chat) — these need a paid
  third-party calling service (Twilio, Agora, etc.) with your own account and
  API keys, so they aren't wired up. Everything else in chat — text, images,
  and voice *notes* (recorded messages) — is real and working.
- No rate limiting beyond a basic OTP cooldown, no content moderation, and no
  legal docs (Terms/Privacy) — reasonable next steps but outside what was
  asked here.
