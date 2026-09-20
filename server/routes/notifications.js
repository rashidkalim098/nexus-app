import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function serialize(n) {
  return {
    id: n.id,
    type: n.type,
    actorId: n.actorId || null,
    postId: n.postId || null,
    text: n.text,
    read: n.read,
    createdAt: n.createdAt,
  };
}

/* ---------------------------------------------------------------- */
/* GET /api/notifications                                             */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const notifs = db
    .filter("notifications", (n) => n.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100)
    .map(serialize);
  res.json({ notifications: notifs });
});

/* ---------------------------------------------------------------- */
/* POST /api/notifications/mark-all-read                              */
/* ---------------------------------------------------------------- */
router.post("/mark-all-read", requireAuth, (req, res) => {
  const mine = db.filter("notifications", (n) => n.userId === req.userId);
  for (const n of mine) {
    db.update("notifications", (x) => x.id === n.id, () => ({ read: true }));
  }
  res.json({ ok: true });
});

export default router;
