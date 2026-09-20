import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Heart, MessageCircle, Share2, Bookmark, Search, Bell, Sun, Moon,
  ChevronLeft, Send, Image as ImageIcon, Mic, Users, Plus,
  Check, X, LogOut, Settings, User, Home, MessageSquare, Sparkles,
  Smile, MoreHorizontal, Eye, EyeOff, Phone, Video, MapPin, Award,
  Hash, AtSign, ChevronRight, Loader2, Compass, Gamepad2, Palette,
  Code2, Music2, Dumbbell, Plane, Camera, ThumbsUp, Type, Trash2
} from "lucide-react";
import { api, setToken, mediaUrl } from "./api";

/* ---------------------------------------------------------------- */
/* Tokens                                                            */
/* ---------------------------------------------------------------- */
const TOKENS = {
  dark: {
    bg: "#0E0E14", bg2: "#16161F", bg3: "#1E1E2A",
    accent: "#7B6EF6", accent2: "#A99FF8", accentGlow: "rgba(123,110,246,.18)",
    pink: "#E2608A", green: "#4ECB94", amber: "#F0A94A", red: "#E25858",
    text: "#F0EFF8", text2: "#9B98B8", text3: "#5A5875",
  },
  light: {
    bg: "#F5F4FF", bg2: "#FFFFFF", bg3: "#EEEDFB",
    accent: "#534AB7", accent2: "#7B6EF6", accentGlow: "rgba(83,74,183,.10)",
    pink: "#E2608A", green: "#2D9F6B", amber: "#C47B00", red: "#C0392B",
    text: "#12101F", text2: "#5C5A7A", text3: "#A09EC0",
  },
};

const genId = () => Math.random().toString(36).slice(2, 10);
const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const initials = (name) =>
  name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/* ---------------------------------------------------------------- */
/* Static config (real data now comes from the API)                  */
/* ---------------------------------------------------------------- */
const SPACE_ICONS = { Design: Palette, Tech: Code2, Art: Camera, Music: Music2, Gaming: Gamepad2, Fitness: Dumbbell, Travel: Plane };
const REACTION_EMOJIS = ["\u2764\uFE0F","\uD83D\uDD25","\uD83D\uDC4D","\uD83D\uDE02","\uD83D\uDE2E","\uD83D\uDC4F","\uD83C\uDF89","\uD83D\uDE22","\uD83D\uDC80","\u2728"];
const CATEGORIES = ["All", "Design", "Tech", "Art", "Music", "Gaming", "Fitness", "Travel"];

/* ---------------------------------------------------------------- */
/* Small primitives                                                  */
/* ---------------------------------------------------------------- */
function Avatar({ user, size = 40, ring }) {
  if (!user) return null;
  const src = mediaUrl(user.avatar);
  if (src) {
    return (
      <img
        src={src}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          flexShrink: 0, border: ring ? `2px solid ${ring}` : "2px solid var(--bg2)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, var(--accent), var(--pink))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
        border: ring ? `2px solid ${ring}` : "2px solid var(--bg2)",
      }}
    >
      {initials(user.name)}
    </div>
  );
}

function StatusDot({ status }) {
  const color = status === "online" ? "var(--green)" : status === "away" ? "var(--amber)" : "var(--text3)";
  return (
    <span style={{
      position: "absolute", width: 10, height: 10, borderRadius: "50%",
      background: color, border: "2px solid var(--bg2)", right: -1, bottom: -1,
    }} />
  );
}

function InterlinkRenderer({ text, onNavigate }) {
  const parts = text.split(/(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+|\+[A-Za-z0-9]+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
          return <span key={i} style={{ color: "var(--accent2)", fontWeight: 600, cursor: "pointer" }}>{part}</span>;
        }
        if (/^#[a-zA-Z0-9_]+$/.test(part)) {
          return <span key={i} style={{ color: "var(--accent2)", fontWeight: 600, cursor: "pointer" }}>{part}</span>;
        }
        if (/^\+[A-Za-z0-9]+$/.test(part)) {
          return (
            <span key={i} style={{
              color: "var(--pink)", background: "var(--accent-glow)", fontWeight: 600,
              padding: "1px 6px", borderRadius: 999, cursor: "pointer",
            }}>{part}</span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function PillButton({ active, children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
        border: active ? "1px solid var(--accent)" : "1px solid var(--bg3)",
        background: active ? "var(--accent-glow)" : "transparent",
        color: active ? "var(--accent2)" : "var(--text2)",
        cursor: "pointer", whiteSpace: "nowrap", ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Password strength                                                 */
/* ---------------------------------------------------------------- */
function strengthOf(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["var(--red)", "var(--red)", "var(--amber)", "var(--accent2)", "var(--green)"];
  return { score, label: labels[score], color: colors[score] };
}

function StrengthMeter({ pw }) {
  const { score, label, color } = strengthOf(pw);
  if (!pw) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i < score ? color : "var(--bg3)" }} />
        ))}
      </div>
      <div style={{ fontSize: 12, color, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Field + input helpers                                             */
/* ---------------------------------------------------------------- */
function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, color: "var(--text2)", marginBottom: 6, fontWeight: 600 }}>{label}</label>
      {children}
      {error && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 5 }}>{error}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--bg3)",
  background: "var(--bg3)", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

function PrimaryButton({ children, onClick, disabled, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
        background: disabled ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), var(--pink))",
        color: disabled ? "var(--text3)" : "#fff", fontWeight: 700, fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer", ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Auth screens                                                      */
/* ---------------------------------------------------------------- */
function AuthShell({ children }) {
  return (
    <div style={{ padding: "40px 24px 24px", height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, var(--accent), var(--pink))",
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, color: "var(--text)" }}>NEXUS</span>
      </div>
      {children}
    </div>
  );
}

function LoginScreen({ onOtpRequested, goto, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || loading) return;
    setLoading(true); setError("");
    try {
      const r = await api.login({ email, password });
      showToast("Code sent to your email \u2726");
      onOtpRequested(r.email, r.purpose, r.debugCode);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Welcome back</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>Sign in to keep pulsing.</p>

      <Field label="Email">
        <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
      </Field>
      <Field label="Password" error={error}>
        <div style={{ position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingRight: 42 }}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
      <div style={{ textAlign: "right", marginBottom: 20 }}>
        <span onClick={() => goto("forgotEmail")} style={{ fontSize: 12.5, color: "var(--accent2)", cursor: "pointer", fontWeight: 600 }}>Forgot password?</span>
      </div>
      <PrimaryButton onClick={submit} disabled={!email || !password || loading}>{loading ? "Signing in\u2026" : "Sign in"}</PrimaryButton>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", marginTop: 20 }}>
        New to NEXUS?{" "}
        <span onClick={() => goto("register")} style={{ color: "var(--accent2)", fontWeight: 700, cursor: "pointer" }}>Create an account</span>
      </p>
    </AuthShell>
  );
}

function RegisterScreen({ goto, onOtpRequested, showToast }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "", terms: false });
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    if (touched.name && (form.name.length < 2 || form.name.length > 60)) e.name = "Enter your full name (min 2 chars)";
    if (touched.username && !/^[a-z0-9_]{3,20}$/.test(form.username)) e.username = "3\u201320 chars: letters, numbers, underscore only";
    if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (touched.password) {
      if (form.password.length < 8) e.password = "Must be at least 8 characters";
      else if (!/[A-Z]/.test(form.password)) e.password = "Add at least 1 uppercase letter";
      else if (!/[0-9]/.test(form.password)) e.password = "Add at least 1 number";
    }
    if (touched.confirm && form.confirm !== form.password) e.confirm = "Passwords do not match";
    return e;
  }, [form, touched]);

  const valid =
    form.name.length >= 2 && /^[a-z0-9_]{3,20}$/.test(form.username) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) &&
    form.confirm === form.password && form.terms;

  const touchAll = () => setTouched({ name: true, username: true, email: true, password: true, confirm: true, terms: true });

  const submit = async () => {
    touchAll();
    setServerError("");
    if (!valid || loading) return;
    setLoading(true);
    try {
      const r = await api.register({
        name: form.name.trim(), handle: form.username, email: form.email.trim(), password: form.password,
      });
      showToast("Code sent to your email \u2726");
      onOtpRequested(r.email, r.purpose, r.debugCode);
    } catch (e) {
      setServerError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Create your account</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>Ad-free. Privacy-native. Yours.</p>

      <Field label="Full name" error={errors.name}>
        <input style={inputStyle} value={form.name} onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jamie Rivera" />
      </Field>
      <Field label="Username" error={errors.username}>
        <input style={inputStyle} value={form.username} onBlur={() => setTouched((t) => ({ ...t, username: true }))}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
          placeholder="jamierivera" />
      </Field>
      <Field label="Email address" error={errors.email}>
        <input style={inputStyle} value={form.email} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@email.com" />
      </Field>
      <Field label="Password" error={errors.password}>
        <input style={inputStyle} type="password" value={form.password} onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
        <StrengthMeter pw={form.password} />
      </Field>
      <Field label="Confirm password" error={errors.confirm}>
        <input style={inputStyle} type="password" value={form.confirm} onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repeat your password" />
      </Field>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--text2)", marginBottom: 18, cursor: "pointer" }}>
        <input type="checkbox" checked={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.checked }))} style={{ marginTop: 2 }} />
        I agree to the Terms of Service and Privacy Policy
      </label>
      {touched.terms && !form.terms && <div style={{ fontSize: 12, color: "var(--red)", marginTop: -12, marginBottom: 14 }}>You must accept the terms to continue</div>}
      {serverError && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 14 }}>{serverError}</div>}

      <PrimaryButton onClick={submit} disabled={loading}>{loading ? "Creating account\u2026" : "Create account"}</PrimaryButton>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", marginTop: 20 }}>
        Already have an account?{" "}
        <span onClick={() => goto("login")} style={{ color: "var(--accent2)", fontWeight: 700, cursor: "pointer" }}>Sign in</span>
      </p>
    </AuthShell>
  );
}

function OtpScreen({ email, purpose, debugCode, onVerified, goto, showToast }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(600);
  const [cooldown, setCooldown] = useState(45);
  const [loading, setLoading] = useState(false);
  const refs = useRef([]);
  const intervalRef = useRef(null);
  const cooldownRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);
  useEffect(() => {
    cooldownRef.current = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(cooldownRef.current);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const setDigit = (i, val) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits]; next[i] = val; setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };
  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length) { setDigits(Array.from({ length: 6 }, (_, i) => text[i] || "")); refs.current[Math.min(text.length, 5)]?.focus(); }
    e.preventDefault();
  };

  const submit = async () => {
    const code = digits.join("");
    if (code.length < 6 || loading) return;
    if (seconds === 0) { setError("This code has expired. Request a new one."); return; }
    setLoading(true); setError("");
    try {
      const r = await api.verifyOtp({ email, code, purpose });
      onVerified(purpose, r);
    } catch (e) {
      setError(e.message);
      if (/restart/i.test(e.message)) setTimeout(() => goto(purpose === "reset" ? "forgotEmail" : "register"), 1400);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      await api.resendOtp({ email, purpose });
      showToast("New code sent \u2726");
      setCooldown(45); setSeconds(600); setError(""); setDigits(Array(6).fill(""));
    } catch (e) {
      showToast(e.message);
    }
  };

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Verify your email</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 20px" }}>
        Enter the 6-digit code sent to <strong style={{ color: "var(--text)" }}>{email}</strong>
      </p>

      {debugCode && (
        <div style={{ background: "var(--amber)", opacity: 0.9, borderRadius: 12, padding: "10px 12px", fontSize: 12.5, color: "#1a1400", marginBottom: 20, fontWeight: 600 }}>
          Email isn't configured yet on the server \u2014 your code is <strong>{debugCode}</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10, justifyContent: "space-between" }} onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i} ref={(el) => (refs.current[i] = el)} value={d} maxLength={1}
            onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)}
            style={{ ...inputStyle, width: 42, textAlign: "center", padding: "12px 0", fontSize: 18, fontWeight: 700 }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: seconds < 60 ? "var(--red)" : "var(--text2)", marginBottom: 4, fontWeight: 600 }}>
        Code expires in {mm}:{ss}
      </div>
      {error && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 10 }}>{error}</div>}

      <div style={{ margin: "16px 0 22px" }}>
        <PrimaryButton onClick={submit} disabled={loading}>{loading ? "Verifying\u2026" : "Verify"}</PrimaryButton>
      </div>

      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text2)" }}>
        {cooldown > 0 ? (
          <span>Resend code in {cooldown}s</span>
        ) : (
          <span onClick={resend} style={{ color: "var(--accent2)", fontWeight: 700, cursor: "pointer" }}>
            Resend code
          </span>
        )}
      </div>
    </AuthShell>
  );
}

function ForgotEmailScreen({ goto, onOtpRequested, showToast }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || loading) return;
    setLoading(true); setError("");
    try {
      const r = await api.forgotPassword({ email });
      showToast("If that account exists, a code was sent \u2726");
      onOtpRequested(r.email, r.purpose, r.debugCode);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell>
      <button onClick={() => goto("login")} style={{ background: "none", border: "none", color: "var(--text2)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginBottom: 18, padding: 0 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Reset your password</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>We'll email you a one-time code.</p>
      <Field label="Email address" error={error}>
        <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
      </Field>
      <PrimaryButton onClick={submit} disabled={!email || loading}>{loading ? "Sending\u2026" : "Send code"}</PrimaryButton>
    </AuthShell>
  );
}

function ResetPasswordScreen({ email, resetTicket, onReset }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const valid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && password === confirm;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true); setError("");
    try {
      await api.resetPassword({ email, resetTicket, newPassword: password });
      onReset();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Set a new password</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>Make it strong \u2014 at least 8 characters with a number and a capital letter.</p>
      <Field label="New password">
        <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
        <StrengthMeter pw={password} />
      </Field>
      <Field label="Confirm new password" error={confirm && confirm !== password ? "Passwords do not match" : ""}>
        <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
      </Field>
      {error && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 14 }}>{error}</div>}
      <PrimaryButton onClick={submit} disabled={!valid || loading}>{loading ? "Saving\u2026" : "Save password"}</PrimaryButton>
    </AuthShell>
  );
}

/* ---------------------------------------------------------------- */
/* Top bar + bottom nav                                              */
/* ---------------------------------------------------------------- */
function TopBar({ theme, setTheme, screen, goto, currentUser, unreadNotifs, showToast, onLogout, users, posts, spaces, onSelectUser, onSelectSpace }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ref = useRef(null);
  const searchRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return { people: [], spaces: [], posts: [] };
    return {
      people: users.filter((u) => u.id !== currentUser.id && (u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q))).slice(0, 4),
      spaces: spaces.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 3),
      posts: posts.filter((p) => p.body.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [q, users, spaces, posts, currentUser.id]);
  const hasResults = results.people.length + results.spaces.length + results.posts.length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--bg3)", background: "var(--bg2)", position: "sticky", top: 0, zIndex: 20 }}>
      <div onClick={() => goto("feed")} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--pink))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: 0.3 }}>NEXUS</span>
      </div>

      <div ref={searchRef} style={{ flex: 1, position: "relative", marginLeft: 6 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 9, color: "var(--text3)" }} />
        <input
          value={query} onChange={(e) => { setQuery(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowResults(false); } }}
          placeholder="Search NEXUS" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 30px", borderRadius: 999, border: "1px solid var(--bg3)", background: "var(--bg3)", color: "var(--text)", fontSize: 13, outline: "none" }}
        />
        {showResults && q && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: "var(--bg2)", border: "1px solid var(--bg3)", borderRadius: 12, overflow: "hidden", zIndex: 30, boxShadow: "0 12px 30px rgba(0,0,0,.35)", maxHeight: 360, overflowY: "auto" }}>
            {!hasResults && <div style={{ padding: "14px 12px", fontSize: 12.5, color: "var(--text3)" }}>No matches for "{query.trim()}"</div>}
            {results.people.length > 0 && (
              <div>
                <div style={{ padding: "8px 12px 2px", fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>People</div>
                {results.people.map((u) => (
                  <div key={u.id} onClick={() => { onSelectUser(u.id); setShowResults(false); setQuery(""); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer" }}>
                    <Avatar user={u} size={26} />
                    <div><div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{u.name}</div><div style={{ fontSize: 11, color: "var(--text2)" }}>@{u.handle}</div></div>
                  </div>
                ))}
              </div>
            )}
            {results.spaces.length > 0 && (
              <div>
                <div style={{ padding: "8px 12px 2px", fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Spaces</div>
                {results.spaces.map((s) => (
                  <div key={s.id} onClick={() => { onSelectSpace(s.id); setShowResults(false); setQuery(""); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer" }}>
                    <span style={{ fontSize: 15 }}>{s.emoji}</span>
                    <div><div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--text2)" }}>{s.members} members</div></div>
                  </div>
                ))}
              </div>
            )}
            {results.posts.length > 0 && (
              <div>
                <div style={{ padding: "8px 12px 2px", fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Posts</div>
                {results.posts.map((p) => {
                  const author = users.find((u) => u.id === p.authorId);
                  return (
                    <div key={p.id} onClick={() => { goto("feed"); setShowResults(false); setQuery(""); }} style={{ padding: "7px 12px", cursor: "pointer" }}>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>{author?.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.body}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label="Toggle theme" style={{ background: "var(--bg3)", border: "none", width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", cursor: "pointer" }}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <button onClick={() => goto("notifications")} aria-label="Notifications" style={{ background: "var(--bg3)", border: "none", width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", cursor: "pointer", position: "relative" }}>
        <Bell size={16} />
        {unreadNotifs > 0 && <span style={{ position: "absolute", top: -3, right: -3, background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unreadNotifs}</span>}
      </button>

      <div ref={ref} style={{ position: "relative" }}>
        <div onClick={() => setMenuOpen((o) => !o)} style={{ cursor: "pointer" }}>
          <Avatar user={currentUser} size={32} />
        </div>
        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: 40, width: 190, background: "var(--bg2)", border: "1px solid var(--bg3)", borderRadius: 12, padding: 8, boxShadow: "0 12px 30px rgba(0,0,0,.35)", zIndex: 30 }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--bg3)", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{currentUser.name}</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>@{currentUser.handle}</div>
            </div>
            {[
              { label: "Profile", icon: User, action: () => goto("profile") },
              { label: "Settings", icon: Settings, action: () => goto("settings") },
              { label: "Spaces", icon: Users, action: () => goto("spaces") },
            ].map((it) => (
              <div key={it.label} onClick={() => { it.action(); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: "var(--text)" }}>
                <it.icon size={15} color="var(--text2)" /> {it.label}
              </div>
            ))}
            <div onClick={() => { setMenuOpen(false); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: "var(--red)", fontWeight: 600 }}>
              <LogOut size={15} /> Sign out
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BottomNav({ screen, goto, unreadChats, unreadNotifs }) {
  const items = [
    { key: "feed", icon: Home, label: "Feed" },
    { key: "spaces", icon: Compass, label: "Spaces" },
    { key: "chat", icon: MessageSquare, label: "Chat", badge: unreadChats },
    { key: "notifications", icon: Bell, label: "Alerts", badge: unreadNotifs },
    { key: "profile", icon: User, label: "Profile" },
  ];
  const active = (k) => k === screen || (k === "spaces" && screen === "spaceDetail") || (k === "chat" && screen === "chatThread");
  return (
    <div style={{ display: "flex", borderTop: "1px solid var(--bg3)", background: "var(--bg2)", padding: "8px 4px", position: "sticky", bottom: 0 }}>
      {items.map((it) => (
        <div key={it.key} onClick={() => goto(it.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", position: "relative", padding: "4px 0" }}>
          <it.icon size={20} color={active(it.key) ? "var(--accent2)" : "var(--text3)"} fill={active(it.key) ? "var(--accent-glow)" : "none"} />
          <span style={{ fontSize: 10, fontWeight: 600, color: active(it.key) ? "var(--accent2)" : "var(--text3)" }}>{it.label}</span>
          {!!it.badge && <span style={{ position: "absolute", top: 0, right: "28%", background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.badge}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Feed                                                               */
/* ---------------------------------------------------------------- */
function Composer({ currentUser, users, spaces, communityId, onPost, showToast }) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  const mentionQuery = useMemo(() => {
    const upTo = text.slice(0, taRef.current?.selectionStart ?? text.length);
    const m = upTo.match(/@([a-zA-Z0-9_]*)$/);
    return m ? m[1] : null;
  }, [text]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return users.filter((u) => u.id !== currentUser.id && (u.handle.includes(mentionQuery.toLowerCase()) || u.name.toLowerCase().includes(mentionQuery.toLowerCase()))).slice(0, 4);
  }, [mentionQuery, users, currentUser]);

  const insertMention = (u) => {
    const pos = taRef.current.selectionStart;
    const before = text.slice(0, pos).replace(/@([a-zA-Z0-9_]*)$/, `@${u.handle} `);
    const after = text.slice(pos);
    const newText = before + after;
    setText(newText);
    requestAnimationFrame(() => { taRef.current.focus(); const p = before.length; taRef.current.setSelectionRange(p, p); });
  };

  const insertAtCursor = (snippet) => {
    const pos = taRef.current?.selectionStart ?? text.length;
    const newText = text.slice(0, pos) + snippet + text.slice(pos);
    setText(newText);
    requestAnimationFrame(() => { taRef.current?.focus(); const p = pos + snippet.length; taRef.current?.setSelectionRange(p, p); });
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Only image files are supported."); return; }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    e.target.value = "";
  };
  const removeImage = () => { setMediaFile(null); if (mediaPreview) URL.revokeObjectURL(mediaPreview); setMediaPreview(null); };

  const addLocation = () => {
    const loc = window.prompt("Add a location to this post:");
    if (loc && loc.trim()) insertAtCursor(`\uD83D\uDCCD ${loc.trim()} `);
  };

  const submit = () => {
    const trimmed = text.trim();
    if ((!trimmed && !mediaFile) || trimmed.length > 500) return;
    const fd = new FormData();
    fd.append("body", trimmed);
    if (communityId) fd.append("communityId", communityId);
    if (mediaFile) fd.append("media", mediaFile);
    onPost(fd);
    setText(""); removeImage(); setShowEmoji(false);
  };

  const count = text.length;
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 14, margin: "12px 14px", border: "1px solid var(--bg3)" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar user={currentUser} size={38} />
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            ref={taRef} value={text} rows={2}
            onChange={(e) => { setText(e.target.value); setShowMentions(true); }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); if (e.key === "Escape") setShowMentions(false); if (e.key === " ") setShowMentions(false); }}
            placeholder="What's pulsing today? Use @name, #hashtag, +Space"
            style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", color: "var(--text)", fontSize: 14.5, resize: "none", outline: "none", fontFamily: "inherit" }}
          />
          {showMentions && mentionQuery !== null && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--accent)", overflow: "hidden", zIndex: 10 }}>
              {suggestions.map((u) => (
                <div key={u.id} onClick={() => insertMention(u)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer" }}>
                  <Avatar user={u} size={26} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>@{u.handle}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ display: "flex", gap: 10, position: "relative" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickImage} />
          <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", color: mediaFile ? "var(--accent2)" : "var(--text3)", cursor: "pointer" }}><ImageIcon size={17} /></button>
          <button onClick={() => insertAtCursor("#")} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><Hash size={17} /></button>
          <button onClick={addLocation} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><MapPin size={17} /></button>
          <button onClick={() => setShowEmoji((s) => !s)} style={{ background: "none", border: "none", color: showEmoji ? "var(--accent2)" : "var(--text3)", cursor: "pointer" }}><Smile size={17} /></button>
          {showEmoji && (
            <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 4, width: 190, padding: 8, borderRadius: 10, background: "var(--bg3)", border: "1px solid var(--accent)", zIndex: 10 }}>
              {REACTION_EMOJIS.concat(["\uD83D\uDE0D","\uD83E\uDD14","\uD83D\uDE4C","\u2600\uFE0F","\uD83C\uDF08","\u26A1"]).map((em) => (
                <button key={em} onClick={() => { insertAtCursor(em); setShowEmoji(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: 2 }}>{em}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {count > 400 && <span style={{ fontSize: 11.5, color: count >= 500 ? "var(--red)" : "var(--text2)", fontWeight: 700 }}>{count}/500</span>}
          <button onClick={submit} disabled={(!text.trim() && !mediaFile) || count > 500} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: ((!text.trim() && !mediaFile) || count > 500) ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), var(--pink))", color: ((!text.trim() && !mediaFile) || count > 500) ? "var(--text3)" : "#fff", fontWeight: 700, fontSize: 13, cursor: ((!text.trim() && !mediaFile) || count > 500) ? "not-allowed" : "pointer" }}>
            \u2726 Pulse
          </button>
        </div>
      </div>
      {mediaPreview && (
        <div style={{ position: "relative", marginTop: 10, display: "inline-block" }}>
          <img src={mediaPreview} alt="" style={{ maxHeight: 140, borderRadius: 10, display: "block" }} />
          <button onClick={removeImage} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, author, space, currentUser, users, onLike, onSave, onComment, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  if (!author) return null;
  const isMine = post.authorId === currentUser.id;
  const handleDelete = () => {
    if (window.confirm("Delete this post? This can't be undone.")) onDelete(post.id);
  };
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 14, margin: "0 14px 12px", border: "1px solid var(--bg3)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 8px" }}>
        <Avatar user={author} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{author.name}</span>
            {space && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--pink)", background: "var(--accent-glow)", padding: "1px 7px", borderRadius: 999 }}>{space.name}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)" }}>@{author.handle} \u00B7 {timeAgo(post.createdAt)}</div>
        </div>
        {isMine && (
          <button onClick={handleDelete} title="Delete post" style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><Trash2 size={16} /></button>
        )}
      </div>

      <div style={{ padding: "0 14px 12px", fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
        <InterlinkRenderer text={post.body} />
      </div>

      {post.mediaUrl && (
        <img src={mediaUrl(post.mediaUrl)} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "8px 14px", borderTop: "1px solid var(--bg3)" }}>
        <button onClick={() => onLike(post.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: post.liked ? "var(--pink)" : "var(--text2)" }}>
          <Heart size={17} fill={post.liked ? "var(--pink)" : "none"} /> <span style={{ fontSize: 12.5, fontWeight: 600 }}>{post.likes}</span>
        </button>
        <button onClick={() => setExpanded((e) => !e)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--text2)" }}>
          <MessageCircle size={17} /> <span style={{ fontSize: 12.5, fontWeight: 600 }}>{post.comments.length}</span>
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(post.body); showToast("Post text copied \u2726"); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--text2)" }}>
          <Share2 size={17} />
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onSave(post.id)} style={{ background: "none", border: "none", cursor: "pointer", color: post.saved ? "var(--accent2)" : "var(--text2)" }}>
          <Bookmark size={17} fill={post.saved ? "var(--accent2)" : "none"} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--bg3)", background: "var(--bg3)" }}>
          {post.comments.map((c) => {
            const cu = users.find((u) => u.id === c.authorId);
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Avatar user={cu} size={26} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)", marginRight: 6 }}>{cu?.name}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{c.text}</span>
                </div>
              </div>
            );
          })}
          {post.comments.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 8 }}>No comments yet \u2014 start the conversation.</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Avatar user={currentUser} size={26} />
            <input
              value={comment} maxLength={280} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { onComment(post.id, comment.trim()); setComment(""); } }}
              placeholder="Add a comment\u2026" style={{ flex: 1, padding: "7px 10px", borderRadius: 999, border: "1px solid var(--bg2)", background: "var(--bg2)", color: "var(--text)", fontSize: 12.5, outline: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ background: "var(--bg2)", borderRadius: 14, margin: "0 14px 12px", border: "1px solid var(--bg3)", padding: 14 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: "40%", height: 10, borderRadius: 4, background: "var(--bg3)", marginBottom: 6 }} />
              <div style={{ width: "25%", height: 8, borderRadius: 4, background: "var(--bg3)" }} />
            </div>
          </div>
          <div style={{ width: "90%", height: 10, borderRadius: 4, background: "var(--bg3)", marginBottom: 6 }} />
          <div style={{ width: "60%", height: 10, borderRadius: 4, background: "var(--bg3)" }} />
        </div>
      ))}
    </div>
  );
}

function FeedScreen({ posts, users, spaces, currentUser, onPost, onLike, onSave, onComment, onDelete, showToast, loading, storyGroups, onOpenStory, onAddStory }) {
  const [activeTag, setActiveTag] = useState(null);

  const trending = useMemo(() => {
    const counts = new Map();
    for (const p of posts) {
      const tags = p.body.match(/#[a-zA-Z0-9_]+/g) || [];
      for (const t of tags) counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag]) => tag);
  }, [posts]);

  const visiblePosts = activeTag ? posts.filter((p) => p.body.toLowerCase().includes(activeTag)) : posts;

  return (
    <div style={{ paddingBottom: 10 }}>
      <div style={{ background: "linear-gradient(135deg, var(--accent-glow), transparent)", margin: "10px 14px 0", padding: "9px 12px", borderRadius: 12, fontSize: 11.5, color: "var(--accent2)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} /> 100% ad-free \u00B7 your data is never sold
      </div>
      <StoriesBar currentUser={currentUser} storyGroups={storyGroups} onOpenStory={onOpenStory} onAddStory={onAddStory} />
      {trending.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 14px 2px" }}>
          {trending.map((t) => (
            <PillButton key={t} active={activeTag === t} onClick={() => setActiveTag((cur) => (cur === t ? null : t))}>{t}</PillButton>
          ))}
        </div>
      )}
      <Composer currentUser={currentUser} users={users} spaces={spaces} onPost={onPost} showToast={showToast} />
      {activeTag && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 14px 8px", fontSize: 12, color: "var(--text2)" }}>
          <span>Showing posts with <strong style={{ color: "var(--text)" }}>{activeTag}</strong></span>
          <button onClick={() => setActiveTag(null)} style={{ background: "none", border: "none", color: "var(--accent2)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Clear</button>
        </div>
      )}
      {loading ? <FeedSkeleton /> : visiblePosts.map((p) => (
        <PostCard key={p.id} post={p} author={users.find((u) => u.id === p.authorId)} space={spaces.find((s) => s.id === p.communityId)}
          currentUser={currentUser} users={users} onLike={onLike} onSave={onSave} onComment={onComment} onDelete={onDelete} showToast={showToast} />
      ))}
      {!loading && visiblePosts.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "30px 20px", fontSize: 13 }}>No posts here yet.</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Stories                                                            */
/* ---------------------------------------------------------------- */
function StoryRing({ children, seen, size = 60 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", padding: 2.5, flexShrink: 0,
      background: seen ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), var(--pink))",
    }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "var(--bg)", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function StoryAvatarImg({ user, size }) {
  return <Avatar user={user} size={size - 4} />;
}

function StoriesBar({ currentUser, storyGroups, onOpenStory, onAddStory }) {
  const myGroupIndex = storyGroups.findIndex((g) => g.author.id === currentUser.id);
  const myGroup = myGroupIndex >= 0 ? storyGroups[myGroupIndex] : null;
  const others = storyGroups.filter((g) => g.author.id !== currentUser.id);

  return (
    <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "14px 14px 6px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
        onClick={() => (myGroup ? onOpenStory(myGroupIndex) : onAddStory())}>
        <div style={{ position: "relative" }}>
          {myGroup ? (
            <StoryRing seen={!myGroup.hasUnseen}><StoryAvatarImg user={currentUser} size={60} /></StoryRing>
          ) : (
            <div style={{ width: 60, height: 60, borderRadius: "50%", border: "2px dashed var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <StoryAvatarImg user={currentUser} size={60} />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAddStory(); }}
            style={{
              position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent), var(--pink))", border: "2px solid var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
            }}
          >
            <Plus size={12} color="#fff" strokeWidth={3} />
          </button>
        </div>
        <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>Your story</span>
      </div>

      {others.map((group) => {
        const groupIndex = storyGroups.findIndex((g) => g.author.id === group.author.id);
        return (
          <div key={group.author.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
            onClick={() => onOpenStory(groupIndex)}>
            <StoryRing seen={!group.hasUnseen}><StoryAvatarImg user={group.author} size={60} /></StoryRing>
            <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.author.name.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STORY_COLORS = ["#7B6EF6", "#E2608A", "#4ECB94", "#F0A94A", "#3B82F6", "#E25858"];

function CreateStoryModal({ onClose, onCreated, showToast }) {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(STORY_COLORS[0]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode("photo");
  };

  const submit = async () => {
    if (loading) return;
    if (mode === "text" && !text.trim()) { setError("Write something for your story."); return; }
    if (mode === "photo" && !file) { setError("Choose a photo or video."); return; }
    setLoading(true); setError("");
    try {
      const form = new FormData();
      if (mode === "photo" && file) form.append("media", file);
      if (text.trim()) form.append("text", text.trim());
      form.append("bgColor", bgColor);
      await api.createStory(form);
      showToast("Story posted \u2726");
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg2)", width: "100%", borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>Add to your story</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <PillButton active={mode === "text"} onClick={() => setMode("text")} style={{ flex: 1, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Type size={14} /> Text
          </PillButton>
          <PillButton active={mode === "photo"} onClick={() => fileRef.current?.click()} style={{ flex: 1, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ImageIcon size={14} /> Photo / Video
          </PillButton>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={pickFile} />
        </div>

        {mode === "photo" && preview && (
          <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 14, maxHeight: 220, background: "#000" }}>
            {file?.type.startsWith("video/")
              ? <video src={preview} style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} controls />
              : <img src={preview} style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />}
          </div>
        )}

        <div style={{
          borderRadius: 14, padding: mode === "text" ? "36px 16px" : "0", marginBottom: 14,
          background: mode === "text" ? bgColor : "transparent",
          minHeight: mode === "text" ? 120 : 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} maxLength={280}
            placeholder={mode === "text" ? "What's on your mind?" : "Add a caption (optional)"}
            style={{
              width: "100%", background: "transparent", border: mode === "text" ? "none" : "1px solid var(--bg3)",
              borderRadius: mode === "text" ? 0 : 10, color: mode === "text" ? "#fff" : "var(--text)",
              fontSize: mode === "text" ? 17 : 13, fontWeight: mode === "text" ? 700 : 400, textAlign: mode === "text" ? "center" : "left",
              resize: "none", outline: "none", padding: mode === "text" ? 0 : 10, minHeight: mode === "text" ? 60 : 44,
              fontFamily: "inherit",
            }}
          />
        </div>

        {mode === "text" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {STORY_COLORS.map((c) => (
              <button key={c} onClick={() => setBgColor(c)} style={{
                width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                border: bgColor === c ? "2px solid var(--text)" : "2px solid transparent",
              }} />
            ))}
          </div>
        )}

        {error && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 12 }}>{error}</div>}
        <PrimaryButton onClick={submit} disabled={loading}>{loading ? "Posting\u2026" : "Share to story"}</PrimaryButton>
      </div>
    </div>
  );
}

function StoryViewer({ groups, startIndex, currentUser, onClose, onAdvancePastEnd, showToast }) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const viewedRef = useRef(new Set());
  const rafRef = useRef(null);
  const DURATION = 5000;

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = group?.author.id === currentUser.id;

  useEffect(() => {
    if (!story) return;
    if (!viewedRef.current.has(story.id)) {
      viewedRef.current.add(story.id);
      api.viewStory(story.id).catch(() => {});
    }
  }, [story?.id]);

  const goNext = useCallback(() => {
    if (storyIndex < (group?.stories.length || 0) - 1) {
      setStoryIndex((i) => i + 1); setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1); setStoryIndex(0); setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, group, groups.length, onClose]);

  const goPrev = () => {
    if (storyIndex > 0) { setStoryIndex((i) => i - 1); setProgress(0); }
    else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((i) => i - 1); setStoryIndex(prevGroup.stories.length - 1); setProgress(0);
    }
  };

  useEffect(() => {
    if (paused || !story) return;
    let start = performance.now() - progress * DURATION;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / DURATION);
      setProgress(p);
      if (p >= 1) { goNext(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIndex, groupIndex, paused]);

  const handleDelete = async () => {
    try {
      await api.deleteStory(story.id);
      showToast("Story deleted");
      onClose();
    } catch (e) {
      showToast(e.message);
    }
  };

  if (!group || !story) return null;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 300, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 4, padding: "10px 10px 0" }}>
        {group.stories.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "#fff", borderRadius: 2,
              width: i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%",
            }} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StoryAvatarImg user={group.author} size={34} />
          <div>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{group.author.name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{timeAgo(story.createdAt)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isOwn && <button onClick={handleDelete} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><Trash2 size={18} /></button>}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X size={22} /></button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
        onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
        {story.type === "text" && (
          <div style={{ width: "100%", height: "100%", background: story.bgColor, display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
            <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, textAlign: "center", margin: 0 }}>{story.text}</p>
          </div>
        )}
        {story.type === "image" && (
          <>
            <img src={mediaUrl(story.mediaUrl)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            {story.text && <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, color: "#fff", fontSize: 14, textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{story.text}</div>}
          </>
        )}
        {story.type === "video" && (
          <video src={mediaUrl(story.mediaUrl)} autoPlay muted={false} style={{ maxWidth: "100%", maxHeight: "100%" }} onEnded={goNext} />
        )}

        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={goPrev} />
          <div style={{ flex: 1, cursor: "pointer" }} onClick={goNext} />
        </div>
      </div>

      {isOwn && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", color: "#fff", fontSize: 12.5 }}>
          <Eye size={15} /> {story.viewCount} view{story.viewCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Spaces                                                             */
/* ---------------------------------------------------------------- */
function SpaceCard({ space, onOpen, onToggleJoin }) {
  const Icon = SPACE_ICONS[space.category] || Users;
  return (
    <div onClick={() => onOpen(space.id)} style={{ background: "var(--bg2)", border: "1px solid var(--bg3)", borderRadius: 14, padding: 14, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg, var(--accent-glow), var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} color="var(--accent2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}>{space.name}</div>
          <div style={{ fontSize: 12, color: "var(--text2)", margin: "2px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{space.desc}</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{space.members.toLocaleString()} members \u00B7 {space.postsToday} posts today</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleJoin(space.id); }}
          style={{ alignSelf: "center", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: space.joined ? "1px solid var(--bg3)" : "none",
            background: space.joined ? "transparent" : "linear-gradient(135deg, var(--accent), var(--pink))", color: space.joined ? "var(--text2)" : "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
          {space.joined ? "Joined" : "Join"}
        </button>
      </div>
    </div>
  );
}

function SpacesScreen({ spaces, onOpen, onToggleJoin }) {
  const [cat, setCat] = useState("All");
  const filtered = spaces.filter((s) => cat === "All" || s.category === cat);
  const yours = filtered.filter((s) => s.joined);
  const discover = filtered.filter((s) => !s.joined);
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 12px" }}>
        {CATEGORIES.map((c) => <PillButton key={c} active={cat === c} onClick={() => setCat(c)}>{c}</PillButton>)}
      </div>
      <div style={{ padding: "0 14px" }}>
        {yours.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text2)", margin: "6px 0 8px" }}>Your spaces</div>
            {yours.map((s) => <SpaceCard key={s.id} space={s} onOpen={onOpen} onToggleJoin={onToggleJoin} />)}
          </>
        )}
        {discover.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text2)", margin: "14px 0 8px" }}>Discover</div>
            {discover.map((s) => <SpaceCard key={s.id} space={s} onOpen={onOpen} onToggleJoin={onToggleJoin} />)}
          </>
        )}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0", fontSize: 13 }}>No spaces in this category yet.</div>}
      </div>
    </div>
  );
}

function SpaceDetailScreen({ space, posts, users, currentUser, onBack, onToggleJoin, onPost, onLike, onSave, onComment, onDelete, onMessage, onFollow, showToast }) {
  const [tab, setTab] = useState("posts");
  const [members, setMembers] = useState([]);
  const Icon = SPACE_ICONS[space.category] || Users;
  const spacePosts = posts.filter((p) => p.communityId === space.id);

  useEffect(() => {
    if (tab !== "members") return;
    api.spaceMembers(space.id).then(({ members }) => setMembers(members)).catch(() => {});
  }, [tab, space.id]);

  const handleFollow = (uid) => {
    onFollow(uid);
    setMembers((ms) => ms.map((m) => (m.id === uid ? { ...m, isFollowedByMe: !m.isFollowedByMe } : m)));
  };

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, var(--accent-glow), var(--bg3))", padding: "14px 14px 18px", position: "relative" }}>
        <button onClick={onBack} style={{ background: "var(--bg2)", border: "none", width: 30, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}>
          <ChevronLeft size={17} color="var(--text)" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={22} color="var(--accent2)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>{space.name}</div>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>{space.members.toLocaleString()} members</div>
          </div>
          <button onClick={() => onToggleJoin(space.id)} style={{ padding: "7px 16px", borderRadius: 999, fontWeight: 700, fontSize: 12.5, border: space.joined ? "1px solid var(--text3)" : "none", background: space.joined ? "transparent" : "linear-gradient(135deg, var(--accent), var(--pink))", color: space.joined ? "var(--text2)" : "#fff", cursor: "pointer" }}>
            {space.joined ? "Joined" : "Join"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--bg3)" }} role="tablist">
        {["posts", "members", "about"].map((t) => (
          <div key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: "center", padding: "11px 0", fontSize: 13, fontWeight: 700, color: tab === t ? "var(--accent2)" : "var(--text3)", borderBottom: tab === t ? "2px solid var(--accent2)" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>
            {t}
          </div>
        ))}
      </div>

      {tab === "posts" && (
        <div style={{ paddingTop: 10 }}>
          <Composer currentUser={currentUser} users={users} spaces={[space]} communityId={space.id} onPost={onPost} showToast={showToast} />
          {spacePosts.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "30px 0", fontSize: 13 }}>No posts here yet — be the first to pulse.</div>}
          {spacePosts.map((p) => (
            <PostCard key={p.id} post={p} author={users.find((u) => u.id === p.authorId)} space={null} currentUser={currentUser} users={users} onLike={onLike} onSave={onSave} onComment={onComment} onDelete={onDelete} showToast={showToast} />
          ))}
        </div>
      )}

      {tab === "members" && (
        <div style={{ padding: "12px 14px" }}>
          {members.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>No members yet — be the first to join.</div>}
          {members.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bg3)" }}>
              <Avatar user={u} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text2)" }}>{u.role}</div>
              </div>
              {u.id !== currentUser.id && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleFollow(u.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 999, border: u.isFollowedByMe ? "1px solid var(--bg3)" : "none",
                      background: u.isFollowedByMe ? "transparent" : "linear-gradient(135deg, var(--accent), var(--pink))",
                      color: u.isFollowedByMe ? "var(--text2)" : "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {u.isFollowedByMe ? "Following" : "Follow"}
                  </button>
                  <button onClick={() => onMessage(u.id)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--bg3)", background: "transparent", color: "var(--text2)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Message</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "about" && (
        <div style={{ padding: "14px" }}>
          <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 16, lineHeight: 1.6 }}>{space.desc}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text2)", marginBottom: 8 }}>Community rules</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--text)", fontSize: 13, lineHeight: 2 }}>
            {space.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Chat                                                                */
/* ---------------------------------------------------------------- */
function ChatListScreen({ convos, users, onOpen, onNewChat }) {
  const sorted = [...convos].sort((a, b) => new Date(b.messages.at(-1)?.createdAt || 0) - new Date(a.messages.at(-1)?.createdAt || 0));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px 2px" }}>
        <button onClick={onNewChat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, var(--accent), var(--pink))", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          <Plus size={14} /> New chat
        </button>
      </div>
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "50px 20px", fontSize: 13 }}>
          No conversations yet — start one with the button above.
        </div>
      )}
      {sorted.map((c) => {
        const u = users.find((x) => x.id === c.userId);
        const last = c.messages.at(-1);
        return (
          <div key={c.id} onClick={() => onOpen(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--bg3)", cursor: "pointer" }}>
            <div style={{ position: "relative" }}><Avatar user={u} size={44} /><StatusDot status={u.status} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{u.name}</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>{timeAgo(last?.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: c.unread ? "var(--text)" : "var(--text2)", fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {last?.from === "me" ? "You: " : ""}{last?.text}
              </div>
            </div>
            {c.unread > 0 && <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ChatThreadScreen({ convo, user, onBack, onSend, onReact, showToast }) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file, url, type: "image"|"audio" }
  const [isRecording, setIsRecording] = useState(false);
  const bottomRef = useRef(null);
  const timeoutRef = useRef(null);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [convo.messages.length, typing]);

  useEffect(() => () => {
    clearTimeout(timeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const clearAttachment = () => {
    if (attachment?.url) URL.revokeObjectURL(attachment.url);
    setAttachment(null);
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Only image files are supported."); return; }
    clearAttachment();
    setAttachment({ file, url: URL.createObjectURL(file), type: "image" });
    e.target.value = "";
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        clearAttachment();
        setAttachment({ file, url: URL.createObjectURL(blob), type: "audio" });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      showToast("Couldn't access your microphone \u2014 check browser permissions.");
    }
  };

  const send = () => {
    const t = text.trim();
    if (!t && !attachment) return;
    if (t.length > 1000) return;
    const fd = new FormData();
    fd.append("text", t);
    if (attachment) fd.append("media", attachment.file);
    onSend(convo.id, fd);
    setText(""); clearAttachment();
    setTyping(true);
    timeoutRef.current = setTimeout(() => setTyping(false), 1800);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--bg3)", background: "var(--bg2)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer" }}><ChevronLeft size={19} /></button>
        <div style={{ position: "relative" }}><Avatar user={user} size={36} /><StatusDot status={user.status} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "capitalize" }}>{user.status}</div>
        </div>
        <Phone size={17} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => showToast("Voice calling needs a calling service (like Twilio) that isn't connected yet.")} />
        <Video size={17} color="var(--text3)" style={{ cursor: "pointer" }} onClick={() => showToast("Video calling needs a calling service (like Twilio) that isn't connected yet.")} />
      </div>

      <div role="log" aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {convo.messages.map((m) => {
          const mine = m.from === "me";
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div onDoubleClick={() => onReact(convo.id, m.id, REACTION_EMOJIS[0])} style={{
                maxWidth: "76%", padding: m.mediaType === "image" ? 4 : "9px 12px", borderRadius: 16,
                borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
                background: mine ? "linear-gradient(135deg, var(--accent), var(--pink))" : "var(--bg3)",
                color: mine ? "#fff" : "var(--text)", fontSize: 13.5, lineHeight: 1.4,
              }}>
                {m.mediaType === "image" && <img src={mediaUrl(m.mediaUrl)} alt="" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 12, display: "block" }} />}
                {m.mediaType === "audio" && <audio controls src={mediaUrl(m.mediaUrl)} style={{ maxWidth: 220 }} />}
                {m.text && <div style={{ padding: m.mediaType ? "6px 4px 2px" : 0 }}>{m.text}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                {m.reactions?.map((r, i) => <span key={i} style={{ fontSize: 12 }}>{r}</span>)}
                <span style={{ fontSize: 10, color: "var(--text3)" }}>{timeAgo(m.createdAt)}</span>
                {mine && <span style={{ fontSize: 11, color: m.read ? "var(--accent2)" : "var(--text3)" }}>{m.read ? "\u2713\u2713" : "\u2713"}</span>}
              </div>
            </div>
          );
        })}
        {typing && (
          <div style={{ display: "flex", gap: 4, padding: "9px 12px", borderRadius: 16, background: "var(--bg3)", width: "fit-content" }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text3)", animation: `bounce 1s ${i * 0.15}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderTop: "1px solid var(--bg3)", overflowX: "auto" }}>
        {REACTION_EMOJIS.map((e) => (
          <span key={e} onClick={() => { const last = convo.messages.at(-1); if (last) onReact(convo.id, last.id, e); }} style={{ fontSize: 17, cursor: "pointer" }}>{e}</span>
        ))}
      </div>

      {attachment && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderTop: "1px solid var(--bg3)" }}>
          {attachment.type === "image"
            ? <img src={attachment.url} alt="" style={{ height: 44, borderRadius: 8 }} />
            : <audio controls src={attachment.url} style={{ height: 32 }} />}
          <button onClick={clearAttachment} style={{ background: "var(--bg3)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--bg3)", background: "var(--bg2)" }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickImage} />
        <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", color: attachment?.type === "image" ? "var(--accent2)" : "var(--text3)", cursor: "pointer" }}><ImageIcon size={18} /></button>
        <button onClick={toggleRecording} style={{ background: "none", border: "none", color: isRecording ? "var(--red)" : (attachment?.type === "audio" ? "var(--accent2)" : "var(--text3)"), cursor: "pointer", animation: isRecording ? "pulse 1s infinite" : "none" }}><Mic size={18} /></button>
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={isRecording ? "Recording\u2026 tap mic to stop" : "Message"} style={{ flex: 1, padding: "9px 12px", borderRadius: 999, border: "1px solid var(--bg3)", background: "var(--bg3)", color: "var(--text)", fontSize: 13.5, outline: "none" }} />
        <button onClick={send} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, var(--accent), var(--pink))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={15} color="#fff" />
        </button>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>
  );
}

function NewChatModal({ users, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) => !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.handle.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg2)", width: "100%", maxHeight: "80%", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>New chat</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--text3)" }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder="Search people" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: 999, border: "1px solid var(--bg3)", background: "var(--bg3)", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "24px 0", fontSize: 13 }}>Nobody on NEXUS matches that yet.</div>}
        {filtered.map((u) => (
          <div key={u.id} onClick={() => onPick(u.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", cursor: "pointer", borderBottom: "1px solid var(--bg3)" }}>
            <div style={{ position: "relative" }}><Avatar user={u} size={38} /><StatusDot status={u.status} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{u.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text2)" }}>@{u.handle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ currentUser, theme, setTheme, onEditProfile, onBack, onLogout }) {
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--bg3)" };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--bg3)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} /></button>
        <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Settings</span>
      </div>

      <div style={{ padding: "14px 16px 4px", fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Account</div>
      <div onClick={onEditProfile} style={{ ...row, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar user={currentUser} size={30} /><div><div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{currentUser.name}</div><div style={{ fontSize: 11, color: "var(--text2)" }}>Edit profile →</div></div></div>
        <ChevronRight size={16} color="var(--text3)" />
      </div>
      <div style={row}>
        <span style={{ fontSize: 13.5, color: "var(--text)" }}>Email</span>
        <span style={{ fontSize: 12.5, color: "var(--text2)" }}>{currentUser.email}</span>
      </div>

      <div style={{ padding: "14px 16px 4px", fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Appearance</div>
      <div style={row}>
        <span style={{ fontSize: 13.5, color: "var(--text)" }}>Theme</span>
        <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg3)", border: "none", borderRadius: 999, padding: "6px 12px", color: "var(--text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {theme === "dark" ? <><Moon size={13} /> Dark</> : <><Sun size={13} /> Light</>}
        </button>
      </div>

      <div style={{ padding: "14px 16px 4px", fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Session</div>
      <div onClick={onLogout} style={{ ...row, cursor: "pointer", borderBottom: "none" }}>
        <span style={{ fontSize: 13.5, color: "var(--red)", fontWeight: 700 }}>Sign out</span>
        <LogOut size={16} color="var(--red)" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Notifications                                                      */
/* ---------------------------------------------------------------- */
const NOTIF_META = {
  like: { icon: Heart, ring: "var(--pink)" },
  comment: { icon: MessageCircle, ring: "var(--accent2)" },
  friend: { icon: Users, ring: "var(--green)" },
  trending: { icon: Sparkles, ring: "var(--amber)" },
};

function NotificationsScreen({ notifs, users, onMarkAll, onRespond }) {
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
        <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>{unread} unread</span>
        {unread > 0 && <span onClick={onMarkAll} style={{ fontSize: 12.5, color: "var(--accent2)", fontWeight: 700, cursor: "pointer" }}>Mark all read</span>}
      </div>
      {notifs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>\u2726 All caught up!</div>
        </div>
      )}
      {notifs.map((n) => {
        const meta = NOTIF_META[n.type];
        const Icon = meta.icon;
        const actor = users.find((u) => u.id === n.actorId);
        return (
          <div key={n.id} style={{ display: "flex", gap: 10, padding: "12px 14px", background: !n.read ? "var(--accent-glow)" : "transparent", borderBottom: "1px solid var(--bg3)", position: "relative" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg3)", border: `2px solid ${meta.ring}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={15} color={meta.ring} fill={n.type === "like" ? meta.ring : "none"} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--text)" }}>
                {actor && <strong>{actor.name} </strong>}{n.text}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
              {n.type === "friend" && n.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => onRespond(n.id, "accepted")} style={{ padding: "5px 14px", borderRadius: 999, border: "none", background: "var(--green)", color: "#04342C", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Accept</button>
                  <button onClick={() => onRespond(n.id, "declined")} style={{ padding: "5px 14px", borderRadius: 999, border: "1px solid var(--bg3)", background: "transparent", color: "var(--text2)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Decline</button>
                </div>
              )}
              {n.type === "friend" && n.status !== "pending" && (
                <div style={{ fontSize: 11.5, color: n.status === "accepted" ? "var(--green)" : "var(--text3)", marginTop: 4, fontWeight: 600, textTransform: "capitalize" }}>{n.status}</div>
              )}
            </div>
            {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent2)", flexShrink: 0, marginTop: 4 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Profile                                                            */
/* ---------------------------------------------------------------- */
function EditProfileModal({ currentUser, onClose, onUpdated, showToast }) {
  const [name, setName] = useState(currentUser.name || "");
  const [handle, setHandle] = useState(currentUser.handle || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [location, setLocation] = useState(currentUser.location || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(mediaUrl(currentUser.avatar));
  const [coverPreview, setCoverPreview] = useState(mediaUrl(currentUser.cover));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));
  };
  const pickCover = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f));
  };

  const valid = name.trim().length >= 2 && /^[a-z0-9_]{3,20}$/.test(handle);

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("handle", handle);
      form.append("bio", bio);
      form.append("location", location);
      if (avatarFile) form.append("avatar", avatarFile);
      if (coverFile) form.append("cover", coverFile);
      const { user } = await api.updateProfile(form);
      showToast("Profile updated \u2726");
      onUpdated(user);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg2)", width: "100%", maxHeight: "88%", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>Edit profile</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div
          style={{
            height: 100, borderRadius: 14, marginBottom: -30, cursor: "pointer", position: "relative",
            background: coverPreview ? `center/cover url(${coverPreview})` : "linear-gradient(135deg, var(--accent), var(--pink))",
          }}
          onClick={() => coverRef.current?.click()}
        >
          <div style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,.4)", borderRadius: 8, padding: "4px 8px", fontSize: 10.5, color: "#fff", fontWeight: 600 }}>Change cover</div>
          <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickCover} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => avatarRef.current?.click()}>
            {avatarPreview ? (
              <img src={avatarPreview} style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--bg2)" }} />
            ) : (
              <div style={{ width: 68, height: 68, borderRadius: "50%", border: "3px solid var(--bg2)", background: "linear-gradient(135deg, var(--accent), var(--pink))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>
                {initials(name || currentUser.name)}
              </div>
            )}
            <div style={{ position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: "50%", background: "var(--accent2)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg2)" }}>
              <Camera size={12} color="#fff" />
            </div>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickAvatar} />
          </div>
        </div>

        <Field label="Name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} />
        </Field>
        <Field label="Username">
          <input style={inputStyle} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="username" maxLength={20} />
        </Field>
        <Field label="Bio">
          <textarea
            value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3}
            placeholder="Tell people a bit about yourself"
            style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{bio.length}/160</div>
        </Field>
        <Field label="Location">
          <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" maxLength={60} />
        </Field>

        {error && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 12 }}>{error}</div>}
        <PrimaryButton onClick={submit} disabled={!valid || loading}>{loading ? "Saving\u2026" : "Save changes"}</PrimaryButton>
      </div>
    </div>
  );
}

function ProfileScreen({ currentUser, posts, users, spaces, showToast, onProfileUpdated, onFollow, onMessage }) {
  const [tab, setTab] = useState("posts");
  const [showEdit, setShowEdit] = useState(false);
  const [peopleModal, setPeopleModal] = useState(null); // { title, items }
  const [showSpaces, setShowSpaces] = useState(false);
  const myPosts = posts.filter((p) => p.authorId === currentUser.id);
  const myMedia = myPosts.filter((p) => p.mediaUrl);
  const mySpaces = spaces.filter((s) => s.joined);
  const coverUrl = mediaUrl(currentUser.cover);

  const openFollowers = () => api.listFollowers(currentUser.id).then(({ followers }) => setPeopleModal({ title: "Followers", items: followers })).catch((e) => showToast(e.message));
  const openFollowing = () => api.listFollowing(currentUser.id).then(({ following }) => setPeopleModal({ title: "Following", items: following })).catch((e) => showToast(e.message));
  const handleFollowInModal = (uid) => {
    onFollow(uid);
    setPeopleModal((m) => (m ? { ...m, items: m.items.map((u) => (u.id === uid ? { ...u, isFollowedByMe: !u.isFollowedByMe } : u)) } : m));
  };

  return (
    <div>
      <div style={{ height: 108, background: coverUrl ? `center/cover url(${coverUrl})` : "linear-gradient(135deg, var(--accent), var(--pink))", position: "relative" }}>
        <button onClick={() => setShowEdit(true)} style={{ position: "absolute", right: 10, bottom: 10, background: "rgba(0,0,0,.35)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 11, cursor: "pointer" }}>Edit</button>
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ marginTop: -32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Avatar user={currentUser} size={64} ring="var(--bg)" />
          <button onClick={() => setShowEdit(true)} style={{ background: "var(--bg2)", border: "1px solid var(--bg3)", color: "var(--text)", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 4 }}>
            Edit profile
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>{currentUser.name}</span>
          {currentUser.isVerified && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--green)", color: "#04342C", padding: "2px 7px", borderRadius: 999 }}>Verified</span>}
          {currentUser.isPro && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--amber)", color: "#412402", padding: "2px 7px", borderRadius: 999 }}>Top Creator</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>@{currentUser.handle}</div>
        {currentUser.bio && <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 8, lineHeight: 1.4 }}>{currentUser.bio}</div>}
        {currentUser.location && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {currentUser.location}</div>}

        <div style={{ display: "flex", background: "var(--bg2)", border: "1px solid var(--bg3)", borderRadius: 12, overflow: "hidden", margin: "14px 0 12px" }}>
          {[
            ["Posts", myPosts.length, () => setTab("posts")],
            ["Following", currentUser.followingCount || 0, openFollowing],
            ["Followers", currentUser.followerCount || 0, openFollowers],
            ["Spaces", mySpaces.length, () => setShowSpaces(true)],
          ].map(([label, val, onClick], i) => (
            <div key={label} onClick={onClick} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderLeft: i ? "1px solid var(--bg3)" : "none", cursor: "pointer" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{val}</div>
              <div style={{ fontSize: 10.5, color: "var(--text2)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--bg3)" }} role="tablist">
        {["posts", "media", "about"].map((t) => (
          <div key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13, fontWeight: 700, color: tab === t ? "var(--accent2)" : "var(--text3)", borderBottom: tab === t ? "2px solid var(--accent2)" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>{t}</div>
        ))}
      </div>

      {tab === "posts" && (
        <div style={{ paddingTop: 10 }}>
          {myPosts.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "30px 0", fontSize: 13 }}>Nothing pulsed yet.</div>}
          {myPosts.map((p) => (
            <div key={p.id} style={{ background: "var(--bg2)", border: "1px solid var(--bg3)", borderRadius: 14, margin: "0 14px 12px", padding: 14 }}>
              <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 8 }}><InterlinkRenderer text={p.body} /></div>
              {p.mediaUrl && <img src={mediaUrl(p.mediaUrl)} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />}
              <div style={{ fontSize: 11, color: "var(--text3)" }}>{p.likes} likes \u00B7 {p.comments.length} comments \u00B7 {timeAgo(p.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
      {tab === "media" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 14 }}>
          {myMedia.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>No photos posted yet.</div>}
          {myMedia.map((p) => (
            <div key={p.id} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
              <img src={mediaUrl(p.mediaUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      )}
      {tab === "about" && (
        <div style={{ padding: 14, fontSize: 13.5, color: "var(--text)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><MapPin size={15} color="var(--text3)" /> {currentUser.location || "Location not set"}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Award size={15} color="var(--text3)" /> Joined {new Date(currentUser.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        </div>
      )}

      {showEdit && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setShowEdit(false)}
          onUpdated={onProfileUpdated}
          showToast={showToast}
        />
      )}

      {peopleModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setPeopleModal(null)}>
          <div style={{ background: "var(--bg2)", width: "100%", maxHeight: "75%", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>{peopleModal.title}</h2>
              <button onClick={() => setPeopleModal(null)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            {peopleModal.items.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>Nobody here yet.</div>}
            {peopleModal.items.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bg3)" }}>
                <Avatar user={u} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text2)" }}>@{u.handle}</div>
                </div>
                <button onClick={() => onMessage(u.id)} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid var(--bg3)", background: "transparent", color: "var(--text2)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Message</button>
                <button
                  onClick={() => handleFollowInModal(u.id)}
                  style={{ padding: "6px 10px", borderRadius: 999, border: u.isFollowedByMe ? "1px solid var(--bg3)" : "none", background: u.isFollowedByMe ? "transparent" : "linear-gradient(135deg, var(--accent), var(--pink))", color: u.isFollowedByMe ? "var(--text2)" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {u.isFollowedByMe ? "Following" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSpaces && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setShowSpaces(false)}>
          <div style={{ background: "var(--bg2)", width: "100%", maxHeight: "75%", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>Your Spaces</h2>
              <button onClick={() => setShowSpaces(false)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            {mySpaces.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>You haven't joined any spaces yet.</div>}
            {mySpaces.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bg3)" }}>
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text2)" }}>{s.members} members</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Error boundary                                                     */
/* ---------------------------------------------------------------- */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 30, textAlign: "center" }}>
          <p style={{ color: "var(--text)", fontWeight: 700, marginBottom: 10 }}>Something went wrong.</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------------------------------------------------------- */
/* Toast                                                              */
/* ---------------------------------------------------------------- */
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position: "absolute", bottom: 74, left: "50%", transform: "translateX(-50%)", background: "var(--text)", color: "var(--bg)", padding: "9px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>
      {message}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Main App                                                           */
/* ---------------------------------------------------------------- */
export default function NexusApp() {
  const [theme, setTheme] = useState("dark");
  const [users, setUsers] = useState([]);
  const [authStep, setAuthStep] = useState("login");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpPurpose, setOtpPurpose] = useState("verify");
  const [debugOtp, setDebugOtp] = useState("");
  const [resetTicket, setResetTicket] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [screen, setScreen] = useState("feed");
  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [activeConvoId, setActiveConvoId] = useState(null);

  const [posts, setPosts] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [convos, setConvos] = useState([]);

  const [storyGroups, setStoryGroups] = useState([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const loadRef = useRef(null);

  useEffect(() => () => { clearTimeout(toastRef.current); clearTimeout(loadRef.current); }, []);

  // Restore a session from a saved login token, if there is one.
  useEffect(() => {
    api.me()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => setToken(null))
      .finally(() => setAuthChecking(false));
  }, []);

  // Real data, pulled from the API. Every one of these is a live table on
  // the server (server/data/db.json) — nothing here is sample data.
  const refreshStories = useCallback(() => {
    api.listStories().then(({ groups }) => setStoryGroups(groups)).catch(() => {});
  }, []);
  const refreshUsers = useCallback(() => {
    api.listUsers().then(({ users }) => setUsers(users)).catch(() => {});
  }, []);
  const refreshPosts = useCallback(() => {
    api.listPosts().then(({ posts }) => setPosts(posts)).catch(() => {});
  }, []);
  const refreshSpaces = useCallback(() => {
    api.listSpaces().then(({ spaces }) => setSpaces(spaces)).catch(() => {});
  }, []);
  const refreshNotifs = useCallback(() => {
    api.listNotifications().then(({ notifications }) => setNotifs(notifications)).catch(() => {});
  }, []);
  const refreshConvos = useCallback(() => {
    api.listConversations().then(({ conversations }) => setConvos(conversations)).catch(() => {});
  }, []);
  const refreshMe = useCallback(() => {
    api.me().then(({ user }) => setCurrentUser(user)).catch(() => {});
  }, []);

  const loggedIn = !!currentUser;
  useEffect(() => {
    if (!loggedIn) return;
    const refreshAll = () => {
      refreshMe(); refreshStories(); refreshUsers(); refreshPosts(); refreshSpaces(); refreshNotifs(); refreshConvos();
    };
    refreshAll();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, refreshMe, refreshStories, refreshUsers, refreshPosts, refreshSpaces, refreshNotifs, refreshConvos]);

  const showToast = useCallback((msg) => {
    clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(""), 2500);
  }, []);

  const t = TOKENS[theme];
  const rootVars = {
    "--bg": t.bg, "--bg2": t.bg2, "--bg3": t.bg3,
    "--accent": t.accent, "--accent2": t.accent2, "--accent-glow": t.accentGlow,
    "--pink": t.pink, "--green": t.green, "--amber": t.amber, "--red": t.red,
    "--text": t.text, "--text2": t.text2, "--text3": t.text3,
  };

  const goto = (s) => {
    setScreen(s);
    if (s === "feed") { setLoading(true); clearTimeout(loadRef.current); loadRef.current = setTimeout(() => setLoading(false), 450); }
  };

  const handleOtpRequested = (email, purpose, debugCode) => {
    setPendingEmail(email); setOtpPurpose(purpose); setDebugOtp(debugCode || ""); setAuthStep("otp");
  };

  const handleOtpVerified = (purpose, result) => {
    if (purpose === "reset") {
      setResetTicket(result.resetTicket);
      setAuthStep("resetPassword");
      return;
    }
    setToken(result.token);
    setCurrentUser(result.user);
    showToast(purpose === "verify" ? "Account created \u2726" : "Welcome back \u2726");
    goto("feed");
  };

  const handleResetDone = () => {
    showToast("Password updated \u2014 sign in with your new password");
    setAuthStep("login");
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setStoryGroups([]);
    setUsers([]); setPosts([]); setSpaces([]); setNotifs([]); setConvos([]);
    setAuthStep("login");
  };

  const addPost = (formData) => {
    api.createPost(formData)
      .then(({ post }) => { setPosts((ps) => [post, ...ps]); if (post.communityId) refreshSpaces(); showToast("Post published \u2726"); })
      .catch((e) => showToast(e.message));
  };
  const deletePost = (id) => {
    api.deletePost(id).then(() => setPosts((ps) => ps.filter((p) => p.id !== id))).catch((e) => showToast(e.message));
  };
  const toggleLike = (id) => {
    api.likePost(id).then(({ post }) => setPosts((ps) => ps.map((p) => (p.id === id ? post : p)))).catch((e) => showToast(e.message));
  };
  const toggleSave = (id) => {
    api.savePost(id)
      .then(({ post }) => { setPosts((ps) => ps.map((p) => (p.id === id ? post : p))); showToast("Post saved \u2726"); })
      .catch((e) => showToast(e.message));
  };
  const addComment = (id, text) => {
    api.commentOnPost(id, text).then(({ post }) => setPosts((ps) => ps.map((p) => (p.id === id ? post : p)))).catch((e) => showToast(e.message));
  };

  const toggleJoin = (id) => {
    api.joinSpace(id).then(({ space }) => setSpaces((ss) => ss.map((s) => (s.id === id ? space : s)))).catch((e) => showToast(e.message));
  };

  const markAllRead = () => {
    api.markAllNotificationsRead().then(() => setNotifs((ns) => ns.map((n) => ({ ...n, read: true })))).catch(() => {});
  };
  // No UI currently creates "friend request" notifications, but keep this
  // wired locally so the accept/decline buttons never crash if one appears.
  const respondFriend = (id, status) => setNotifs((ns) => ns.map((n) => n.id === id ? { ...n, status, read: true } : n));

  const sendMessage = (convoId, formData) => {
    api.sendMessage(convoId, formData)
      .then(({ conversation }) => setConvos((cs) => cs.map((c) => (c.id === convoId ? conversation : c))))
      .catch((e) => showToast(e.message));
  };
  const reactMessage = (convoId, msgId, emoji) => {
    api.reactToMessage(convoId, msgId, emoji)
      .then(({ conversation }) => setConvos((cs) => cs.map((c) => (c.id === convoId ? conversation : c))))
      .catch(() => {});
  };
  const openConvo = (id) => {
    setActiveConvoId(id); goto("chatThread");
    api.markConvoRead(id).then(({ conversation }) => setConvos((cs) => cs.map((c) => (c.id === id ? conversation : c)))).catch(() => {});
  };
  const startConvo = (userId) => {
    api.startConversation(userId)
      .then(({ conversation }) => {
        setConvos((cs) => (cs.some((c) => c.id === conversation.id) ? cs.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...cs]));
        setActiveConvoId(conversation.id);
        setShowNewChat(false);
        goto("chatThread");
      })
      .catch((e) => showToast(e.message));
  };
  const followUser = (userId) => {
    api.followUser(userId)
      .then(() => { refreshUsers(); refreshMe(); })
      .catch((e) => showToast(e.message));
  };

  const unreadNotifs = notifs.filter((n) => !n.read).length;
  const unreadChats = convos.reduce((s, c) => s + c.unread, 0);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const activeConvo = convos.find((c) => c.id === activeConvoId);
  const activeConvoUser = activeConvo ? users.find((u) => u.id === activeConvo.userId) : null;

  const frame = {
    width: "100%", maxWidth: 430, height: "100%", maxHeight: 900, margin: "0 auto",
    background: "var(--bg)", display: "flex", flexDirection: "column",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative", overflow: "hidden",
    boxShadow: "0 0 0 1px var(--bg3)",
  };

  return (
    <div style={{ ...rootVars, background: theme === "dark" ? "#050507" : "#E5E3F5", height: "100vh", display: "flex", alignItems: "stretch", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; } ::placeholder { color: var(--text3); } input, textarea { font-family: inherit; } @keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; } @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } .spin { animation: none !important; } }`}</style>
      <div style={frame} role="application" aria-label="NEXUS social platform">
        {authChecking ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={28} color="var(--accent2)" className="spin" />
          </div>
        ) : (
          <ErrorBoundary key={currentUser ? screen : authStep}>
            {!currentUser ? (
              <div style={{ flex: 1, overflow: "hidden" }}>
                {authStep === "login" && <LoginScreen onOtpRequested={handleOtpRequested} goto={setAuthStep} showToast={showToast} />}
                {authStep === "register" && <RegisterScreen goto={setAuthStep} onOtpRequested={handleOtpRequested} showToast={showToast} />}
                {authStep === "otp" && <OtpScreen email={pendingEmail} debugCode={debugOtp} purpose={otpPurpose} onVerified={handleOtpVerified} goto={setAuthStep} showToast={showToast} />}
                {authStep === "forgotEmail" && <ForgotEmailScreen goto={setAuthStep} onOtpRequested={handleOtpRequested} showToast={showToast} />}
                {authStep === "resetPassword" && <ResetPasswordScreen email={pendingEmail} resetTicket={resetTicket} onReset={handleResetDone} />}
              </div>
            ) : (
              <>
                {screen !== "chatThread" && (
                  <TopBar theme={theme} setTheme={setTheme} screen={screen} goto={goto} currentUser={currentUser} unreadNotifs={unreadNotifs} showToast={showToast} onLogout={handleLogout} users={users} posts={posts} spaces={spaces} onSelectUser={startConvo} onSelectSpace={(id) => { setActiveSpaceId(id); goto("spaceDetail"); }} />
                )}
                <div style={{ flex: 1, overflowY: screen === "chatThread" ? "hidden" : "auto" }}>
                  {screen === "feed" && <FeedScreen posts={posts} users={users} spaces={spaces} currentUser={currentUser} onPost={addPost} onLike={toggleLike} onSave={toggleSave} onComment={addComment} onDelete={deletePost} showToast={showToast} loading={loading} storyGroups={storyGroups} onOpenStory={setStoryViewerIndex} onAddStory={() => setShowCreateStory(true)} />}
                  {screen === "spaces" && <SpacesScreen spaces={spaces} onOpen={(id) => { setActiveSpaceId(id); goto("spaceDetail"); }} onToggleJoin={toggleJoin} />}
                  {screen === "spaceDetail" && activeSpace && <SpaceDetailScreen space={activeSpace} posts={posts} users={users} currentUser={currentUser} onBack={() => goto("spaces")} onToggleJoin={toggleJoin} onPost={addPost} onLike={toggleLike} onSave={toggleSave} onComment={addComment} onDelete={deletePost} onMessage={startConvo} onFollow={followUser} showToast={showToast} />}
                  {screen === "chat" && <ChatListScreen convos={convos} users={users} onOpen={openConvo} onNewChat={() => setShowNewChat(true)} />}
                  {screen === "chatThread" && activeConvo && <ChatThreadScreen convo={activeConvo} user={activeConvoUser} onBack={() => goto("chat")} onSend={sendMessage} onReact={reactMessage} showToast={showToast} />}
                  {screen === "notifications" && <NotificationsScreen notifs={notifs} users={users} onMarkAll={markAllRead} onRespond={respondFriend} />}
                  {screen === "profile" && <ProfileScreen currentUser={currentUser} posts={posts} users={users} spaces={spaces} showToast={showToast} onProfileUpdated={setCurrentUser} onFollow={followUser} onMessage={startConvo} onOpenSettings={() => goto("settings")} />}
                  {screen === "settings" && <SettingsScreen currentUser={currentUser} theme={theme} setTheme={setTheme} onEditProfile={() => goto("profile")} onBack={() => goto("profile")} onLogout={handleLogout} />}
                </div>
                {screen !== "chatThread" && <BottomNav screen={screen} goto={goto} unreadChats={unreadChats} unreadNotifs={unreadNotifs} />}
                {showCreateStory && (
                  <CreateStoryModal
                    onClose={() => setShowCreateStory(false)}
                    onCreated={() => { setShowCreateStory(false); refreshStories(); }}
                    showToast={showToast}
                  />
                )}
                {storyViewerIndex !== null && storyGroups[storyViewerIndex] && (
                  <StoryViewer
                    groups={storyGroups}
                    startIndex={storyViewerIndex}
                    currentUser={currentUser}
                    onClose={() => { setStoryViewerIndex(null); refreshStories(); }}
                    showToast={showToast}
                  />
                )}
                {showNewChat && (
                  <NewChatModal
                    users={users.filter((u) => u.id !== currentUser.id)}
                    onClose={() => setShowNewChat(false)}
                    onPick={startConvo}
                  />
                )}
              </>
            )}
          </ErrorBoundary>
        )}
        <Toast message={toast} />
      </div>
    </div>
  );
}
