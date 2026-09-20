import jwt from "jsonwebtoken";
import { db } from "../db.js";

// Debounce the "last active" write per user so a burst of requests in the
// same second doesn't hammer the JSON file.
const lastTouch = new Map();
function touchActivity(userId) {
  const now = Date.now();
  if (now - (lastTouch.get(userId) || 0) < 20_000) return;
  lastTouch.set(userId, now);
  db.update("users", (u) => u.id === userId, () => ({ lastActiveAt: new Date().toISOString() }));
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.userId = payload.sub;
    touchActivity(payload.sub);
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired. Please sign in again." });
  }
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d",
  });
}
