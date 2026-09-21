import jwt from "jsonwebtoken";
import { db } from "../db.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.userId = payload.sub;
    db.update("users", (u) => u.id === payload.sub, () => ({ lastSeenAt: new Date().toISOString() }));
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
