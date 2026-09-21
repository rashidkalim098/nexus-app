import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { miniUser } from "../serialize.js";

const router = Router();

/* GET /api/notifications */
router.get("/", requireAuth, (req, res) => {
  const notifs = db.filter("notifications", (n) => n.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100)
    .map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      postId: n.postId,
      read: n.read,
      createdAt: n.createdAt,
      actor: n.actorId ? miniUser(db.find("users", (u) => u.id === n.actorId)) : null,
    }));
  res.json({ notifications: notifs });
});

/* POST /api/notifications/read-all */
router.post("/read-all", requireAuth, (req, res) => {
  db.set(
    "notifications",
    db.get("notifications").map((n) => (n.userId === req.userId ? { ...n, read: true } : n))
  );
  res.json({ ok: true });
});

export default router;
