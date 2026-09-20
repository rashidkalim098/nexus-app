# NEXUS ko Live Karna + Apna Domain Lagana — Poora Guide

Ye guide 3 hisso me hai:
1. Backend live karna (Render)
2. Frontend live karna (Vercel)
3. Domain kharidna aur dono se jodna

Poora process free tier pe ho sakta hai (sirf domain paid hoga, ~₹700–1200/year).

---

## 0. Pehle GitHub pe code daalo

Render aur Vercel dono GitHub se deploy karte hain, isliye pehle code ko GitHub repo me push karna hoga.

1. https://github.com pe account banao (agar nahi hai)
2. Naya repository banao (e.g. `nexus-app`) — **Private** rakh sakte ho
3. Apne computer pe terminal khol kar project folder me jao aur:
   ```bash
   git init
   git add .
   git commit -m "NEXUS app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/nexus-app.git
   git push -u origin main
   ```

`.gitignore` pehle se set hai — `.env`, `node_modules`, aur `server/data/db.json` push nahi honge (ye zaroori hai, warna aapke real users ka data aur secret keys GitHub pe public ho jaate).

---

## 1. Backend live karna (Render — free)

Backend ek "long-running server" hai (Express + JSON file database), isliye ye Vercel/Netlify pe nahi chalega — Render, Railway ya Fly.io jaisi service chahiye. Render sabse aasan hai.

1. https://render.com pe GitHub se sign up karo
2. **New +** → **Web Service** → apna `nexus-app` repo select karo
3. Ye settings bharo:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Environment Variables** add karo (`server/.env.example` dekh kar):
   | Key | Value |
   |---|---|
   | `PORT` | `8787` (Render apna PORT khud bhi de sakta hai, dono chalega) |
   | `FRONTEND_URL` | abhi ke liye kuch bhi daal do, Step 2 ke baad update karenge |
   | `JWT_SECRET` | koi bhi lamba random string (e.g. `openssl rand -hex 32` se banao) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | apni email ki details (Gmail App Password wagera) |
   | `MAIL_DEBUG` | `false` (live pe ye hamesha false rakho) |
5. **Persistent Disk zaroor add karo** (bahut important!) — Settings → Disks → Add Disk:
   - Mount path: `/opt/render/project/src/server/data`
   - Aur ek aur disk: `/opt/render/project/src/server/uploads`
   - **Ye na kiya toh har naye deploy pe saara data (users, posts, chats) delete ho jaayega**, kyunki Render ka normal filesystem restart pe reset ho jaata hai.
6. **Create Web Service** dabao. Kuch minute me build hoga, URL milega jaise `https://nexus-api-xxxx.onrender.com`

Test karo: browser me `https://nexus-api-xxxx.onrender.com/api/health` khol kar `{"ok":true}` dikhna chahiye.

> Free tier note: Render ka free service 15 min bina traffic ke "sleep" ho jaata hai, phir agli request pe 30-50 second lagta hai jagne me. Real users ke liye paid plan ($7/month) better hai.

---

## 2. Frontend live karna (Vercel — free)

1. https://vercel.com pe GitHub se sign up karo
2. **Add New** → **Project** → apna `nexus-app` repo select karo
3. **Root Directory**: root hi rehne do (server folder nahi)
4. Framework apne aap "Vite" detect ho jaayega
5. **Environment Variables** me add karo:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://nexus-api-xxxx.onrender.com/api` (Step 1 ka URL + `/api`) |
6. **Deploy** dabao. Kuch second me URL milega jaise `https://nexus-app-xxxx.vercel.app`

Ab wapas Render pe jao aur `FRONTEND_URL` env variable ko is Vercel URL se update karo (CORS ke liye zaroori), phir "Manual Deploy" se restart karo.

Test karo: Vercel wala URL khol kar signup/login try karo — real email pe OTP aana chahiye.

---

## 3. Apna domain kharidna aur jodna

### Domain kharido
Kahin se bhi kharid sakte ho:
- **Namecheap** (namecheap.com) — sabse popular, saste
- **GoDaddy** (godaddy.com)
- **Hostinger** (hostinger.in) — India me popular, INR me payment

.com domain roughly ₹700–1200/year ka aata hai. Kharidte waqt "auto-renew" on rakhna taaki expire na ho.

### Domain ko Vercel (frontend) se jodo
1. Vercel project → **Settings** → **Domains** → apna domain type karo (e.g. `yourdomain.com`)
2. Vercel kuch DNS records dikhayega (usually ek `A` record aur ek `CNAME` for `www`)
3. Jahan se domain kharida hai (Namecheap/GoDaddy) uski site pe jao → Domain → **DNS Settings** / **Manage DNS**
4. Vercel ne jo records diye the wahi wahan add karo (copy-paste karo, exact same)
5. DNS update hone me 10 min se 24 ghante lag sakte hain. Vercel automatically SSL (https) laga dega.

### Backend ke liye subdomain (recommended)
Backend ko bhi apne domain se jodna ho toh best tarika ek subdomain hai, jaise `api.yourdomain.com`:
1. Render project → **Settings** → **Custom Domain** → `api.yourdomain.com` add karo
2. Render jo CNAME record de, usko apni domain provider ki DNS settings me add karo
3. Ye ho jaane ke baad, Vercel me `VITE_API_URL` ko `https://api.yourdomain.com/api` kar do, aur Render me `FRONTEND_URL` ko `https://yourdomain.com` kar do
4. Dono jagah redeploy/restart karo

Bas — ab `https://yourdomain.com` khulega aur backend `https://api.yourdomain.com` pe real traffic serve karega.

---

## Live jaane se pehle final checklist

- [ ] `server/.env` (ya Render env vars) me `JWT_SECRET` strong random hai, `dev_secret` nahi
- [ ] `MAIL_DEBUG=false` hai (warna OTP codes screen pe dikh jaayenge, security risk)
- [ ] Real SMTP set hai (Gmail App Password ya koi provider) — bina iske login emails nahi jaayenge
- [ ] Render pe persistent disk laga hai `server/data` aur `server/uploads` ke liye
- [ ] `FRONTEND_URL` (backend) aur `VITE_API_URL` (frontend) dono ek dusre ko sahi point kar rahe hain
- [ ] Domain ke DNS records propagate ho chuke hain (`https://yourdomain.com` khul raha hai)

## Ek zaroori honest baat: Voice/Video Calling

Chat me Phone aur Video icons hain, lekin actual live calling (jaise WhatsApp call) ke liye ek paid third-party service chahiye hoti hai (Twilio, Agora, ya similar) jiska apna account/API key aapko banana padega — ye main khud nahi bana sakta. Baaki sab chat features — text, image, aur voice **notes** (recorded audio messages, jo abhi already real hai) — bina kisi paid service ke kaam karte hain.

Agar aap live calling chahte ho, mujhe bataiye — main aapko Twilio/Agora setup ka guide de dunga, aur unki keys milne ke baad wire kar dunga.

---

Kahin bhi stuck ho (Render build fail, DNS not resolving, CORS error, email na jaana) — screenshot ya error message bhej dena, main us step ko fix karwa dunga.
