import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { peerUser, publicUser } from "../lib/serialize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 8) || ".jpg";
    cb(null, `${genId(file.fieldname)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed."));
    cb(null, true);
  },
});

const router = Router();

/* ---------------------------------------------------------------- */
/* GET /api/users — everyone on NEXUS (for mentions, chat, members)   */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const all = db.filter("users", () => true).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ users: all.map((u) => peerUser(u, req.userId)) });
});

/* ---------------------------------------------------------------- */
/* PATCH /api/users/me — update profile fields + avatar/cover photo   */
/* ---------------------------------------------------------------- */
router.patch(
  "/me",
  requireAuth,
  upload.fields([{ name: "avatar", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
  (req, res) => {
    const user = db.find("users", (u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: "Account not found." });

    const { name, handle, bio, location } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (name.trim().length < 2 || name.trim().length > 60) {
        return res.status(400).json({ error: "Name must be 2-60 characters." });
      }
      updates.name = name.trim();
    }

    if (handle !== undefined && handle !== user.handle) {
      if (!HANDLE_RE.test(handle)) {
        return res.status(400).json({ error: "Username must be 3-20 chars: letters, numbers, underscore." });
      }
      if (db.find("users", (u) => u.handle === handle && u.id !== user.id)) {
        return res.status(409).json({ error: "That username is taken." });
      }
      updates.handle = handle;
    }

    if (bio !== undefined) updates.bio = String(bio).slice(0, 160);
    if (location !== undefined) updates.location = String(location).slice(0, 60);

    if (req.files?.avatar?.[0]) updates.avatar = `/uploads/${req.files.avatar[0].filename}`;
    if (req.files?.cover?.[0]) updates.cover = `/uploads/${req.files.cover[0].filename}`;

    const updated = db.update("users", (u) => u.id === user.id, () => updates);
    res.json({ user: publicUser(updated) });
  }
);

/* ---------------------------------------------------------------- */
/* Follow / unfollow — real, stored in the "follows" table            */
/* ---------------------------------------------------------------- */
router.post("/:id/follow", requireAuth, (req, res) => {
  const target = db.find("users", (u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "That person doesn't exist." });
  if (target.id === req.userId) return res.status(400).json({ error: "You can't follow yourself." });

  const existing = db.find("follows", (f) => f.followerId === req.userId && f.followingId === target.id);
  if (existing) {
    db.remove("follows", (f) => f.followerId === req.userId && f.followingId === target.id);
  } else {
    db.insert("follows", { followerId: req.userId, followingId: target.id, createdAt: new Date().toISOString() });
    db.insert("notifications", {
      id: genId("notif"), userId: target.id, actorId: req.userId, type: "follow",
      text: "started following you", read: false, createdAt: new Date().toISOString(),
    });
  }
  res.json({
    followed: !existing,
    followerCount: db.filter("follows", (f) => f.followingId === target.id).length,
  });
});

router.get("/:id/followers", requireAuth, (req, res) => {
  const rows = db.filter("follows", (f) => f.followingId === req.params.id);
  const followers = rows.map((f) => peerUser(db.find("users", (u) => u.id === f.followerId), req.userId)).filter(Boolean);
  res.json({ followers });
});

router.get("/:id/following", requireAuth, (req, res) => {
  const rows = db.filter("follows", (f) => f.followerId === req.params.id);
  const following = rows.map((f) => peerUser(db.find("users", (u) => u.id === f.followingId), req.userId)).filter(Boolean);
  res.json({ following });
});

export default router;
