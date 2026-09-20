import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db.js";
import { sendOtpEmail, mailDebugEnabled } from "../mailer.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { publicUser } from "../lib/serialize.js";

const router = Router();

const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

function makeCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function issueOtp(email, purpose) {
  const existing = db
    .filter("otps", (o) => o.email === email && o.purpose === purpose)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (existing && Date.now() - new Date(existing.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    const waitMs = RESEND_COOLDOWN_MS - (Date.now() - new Date(existing.createdAt).getTime());
    return { cooldown: Math.ceil(waitMs / 1000) };
  }

  // Invalidate any older codes for this email+purpose.
  db.remove("otps", (o) => o.email === email && o.purpose === purpose);

  const code = makeCode();
  const codeHash = await bcrypt.hash(code, 8);
  const record = {
    id: genId("otp"),
    email,
    purpose,
    codeHash,
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  };
  db.insert("otps", record);

  const { sent } = await sendOtpEmail(email, code, purpose);
  return { sent, debugCode: mailDebugEnabled ? code : undefined };
}

/* ---------------------------------------------------------------- */
/* POST /api/auth/register                                           */
/* ---------------------------------------------------------------- */
router.post("/register", async (req, res) => {
  const { name, handle, email, password } = req.body || {};

  if (!name || name.trim().length < 2) return res.status(400).json({ error: "Enter your full name." });
  if (!HANDLE_RE.test(handle || "")) return res.status(400).json({ error: "Username must be 3-20 chars: letters, numbers, underscore." });
  if (!EMAIL_RE.test(email || "")) return res.status(400).json({ error: "Enter a valid email address." });
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: "Password needs 8+ chars, one uppercase letter and one number." });
  }

  const emailLower = email.trim().toLowerCase();
  if (db.find("users", (u) => u.email === emailLower)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  if (db.find("users", (u) => u.handle === handle)) {
    return res.status(409).json({ error: "That username is taken." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: genId("u"),
    name: name.trim(),
    handle,
    email: emailLower,
    passwordHash,
    avatar: null,
    cover: null,
    bio: "",
    location: "",
    isPro: false,
    isVerified: false,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  db.insert("users", user);

  const otpResult = await issueOtp(emailLower, "verify");
  res.json({ email: emailLower, purpose: "verify", ...otpResult });
});

/* ---------------------------------------------------------------- */
/* POST /api/auth/login                                              */
/* ---------------------------------------------------------------- */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!EMAIL_RE.test(email || "") || !password) {
    return res.status(400).json({ error: "Enter your email and password." });
  }

  const emailLower = email.trim().toLowerCase();
  const user = db.find("users", (u) => u.email === emailLower);
  if (!user) return res.status(401).json({ error: "Incorrect email or password." });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Incorrect email or password." });

  // Every login goes through a fresh emailed code (matches the app's OTP screen).
  const otpResult = await issueOtp(emailLower, "login");
  res.json({ email: emailLower, purpose: "login", ...otpResult });
});

/* ---------------------------------------------------------------- */
/* POST /api/auth/verify-otp                                         */
/* ---------------------------------------------------------------- */
router.post("/verify-otp", async (req, res) => {
  const { email, code, purpose } = req.body || {};
  if (!EMAIL_RE.test(email || "") || !code || !purpose) {
    return res.status(400).json({ error: "Missing code." });
  }
  const emailLower = email.trim().toLowerCase();
  const record = db.find("otps", (o) => o.email === emailLower && o.purpose === purpose);

  if (!record) return res.status(400).json({ error: "Request a new code first." });
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    db.remove("otps", (o) => o.id === record.id);
    return res.status(400).json({ error: "This code has expired. Request a new one." });
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    db.remove("otps", (o) => o.id === record.id);
    return res.status(429).json({ error: "Too many incorrect attempts. Please restart." });
  }

  const match = await bcrypt.compare(String(code), record.codeHash);
  if (!match) {
    db.update("otps", (o) => o.id === record.id, (o) => ({ attempts: o.attempts + 1 }));
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return res.status(400).json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, attemptsRemaining: remaining });
  }

  db.remove("otps", (o) => o.id === record.id);

  if (purpose === "reset") {
    // Give the client a short-lived reset ticket instead of a full session.
    const resetTicket = genId("reset");
    db.insert("otps", {
      id: resetTicket,
      email: emailLower,
      purpose: "reset-ticket",
      codeHash: "",
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return res.json({ resetTicket });
  }

  let user = db.find("users", (u) => u.email === emailLower);
  if (purpose === "verify" && user) {
    user = db.update("users", (u) => u.id === user.id, () => ({ isVerified: true }));
  }
  if (!user) return res.status(404).json({ error: "Account not found." });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

/* ---------------------------------------------------------------- */
/* POST /api/auth/resend-otp                                         */
/* ---------------------------------------------------------------- */
router.post("/resend-otp", async (req, res) => {
  const { email, purpose } = req.body || {};
  if (!EMAIL_RE.test(email || "") || !purpose) return res.status(400).json({ error: "Missing email." });
  const otpResult = await issueOtp(email.trim().toLowerCase(), purpose);
  if (otpResult.cooldown) return res.status(429).json({ error: `Please wait ${otpResult.cooldown}s before requesting another code.`, ...otpResult });
  res.json({ ok: true, ...otpResult });
});

/* ---------------------------------------------------------------- */
/* POST /api/auth/forgot-password                                    */
/* ---------------------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!EMAIL_RE.test(email || "")) return res.status(400).json({ error: "Enter a valid email address." });
  const emailLower = email.trim().toLowerCase();
  const user = db.find("users", (u) => u.email === emailLower);

  // Always respond the same way whether or not the account exists, so
  // outsiders can't use this to find out which emails are registered.
  if (user) {
    const otpResult = await issueOtp(emailLower, "reset");
    return res.json({ email: emailLower, purpose: "reset", ...otpResult });
  }
  res.json({ email: emailLower, purpose: "reset" });
});

/* ---------------------------------------------------------------- */
/* POST /api/auth/reset-password                                     */
/* ---------------------------------------------------------------- */
router.post("/reset-password", async (req, res) => {
  const { email, resetTicket, newPassword } = req.body || {};
  if (!EMAIL_RE.test(email || "") || !resetTicket || !newPassword) {
    return res.status(400).json({ error: "Missing fields." });
  }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: "Password needs 8+ chars, one uppercase letter and one number." });
  }
  const emailLower = email.trim().toLowerCase();
  const ticket = db.find("otps", (o) => o.id === resetTicket && o.email === emailLower && o.purpose === "reset-ticket");
  if (!ticket || new Date(ticket.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "This reset session expired. Start over." });
  }
  const user = db.find("users", (u) => u.email === emailLower);
  if (!user) return res.status(404).json({ error: "Account not found." });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.update("users", (u) => u.id === user.id, () => ({ passwordHash }));
  db.remove("otps", (o) => o.id === ticket.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- */
/* GET /api/auth/me                                                   */
/* ---------------------------------------------------------------- */
router.get("/me", requireAuth, (req, res) => {
  const user = db.find("users", (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ user: publicUser(user) });
});

export default router;
