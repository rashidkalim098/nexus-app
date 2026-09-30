import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { miniUser, notify } from "../serialize.js";

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
      status: n.status || null, // "pending" | "accepted" | "declined" for follow requests
      read: n.read,
      createdAt: n.createdAt,
      actor: n.actorId ? miniUser(db.find("users", (u) => u.id === n.actorId)) : null,
    }));
  res.json({ notifications: notifs });
});

/* POST /api/notifications/:id/respond — accept or decline a follow request */
router.post("/:id/respond", requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!["accepted", "declined"].includes(status)) {
    return res.status(400).json({ error: "Status must be \"accepted\" or \"declined\"." });
  }
  const notif = db.find("notifications", (n) => n.id === req.params.id && n.userId === req.userId);
  if (!notif) return res.status(404).json({ error: "Notification not found." });
  if (notif.type !== "follow_request") return res.status(400).json({ error: "This notification can't be responded to." });
  if (notif.status !== "pending") return res.status(400).json({ error: "This request was already handled." });

  const followRow = db.find("follows", (f) => f.followerId === notif.actorId && f.followingId === req.userId);
  if (!followRow) return res.status(404).json({ error: "This follow request no longer exists." });

  if (status === "accepted") {
    db.update("follows", (f) => f.followerId === notif.actorId && f.followingId === req.userId, () => ({ status: "accepted" }));
    notify(notif.actorId, { type: "follow_accepted", actorId: req.userId, text: "accepted your follow request" });
  } else {
    db.remove("follows", (f) => f.followerId === notif.actorId && f.followingId === req.userId);
  }

  db.update("notifications", (n) => n.id === notif.id, () => ({ status, read: true }));
  res.json({ ok: true, status });
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
