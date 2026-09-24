import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { publicUser, miniUser, notify } from "../serialize.js";

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

function withCounts(user, viewerId) {
  const followers = db.filter("follows", (f) => f.followingId === user.id).length;
  const following = db.filter("follows", (f) => f.followerId === user.id).length;
  const postsCount = db.filter("posts", (p) => p.authorId === user.id).length;
  const isFollowing = !!db.find("follows", (f) => f.followerId === viewerId && f.followingId === user.id);
  return { ...publicUser(user), followers, following, postsCount, isFollowing, isSelf: user.id === viewerId };
}

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

    const { name, handle, bio, location, website, social } = req.body || {};
    const updates = {};

    function normalizeUrl(raw) {
      const v = String(raw).trim();
      if (!v) return "";
      if (/^https?:\/\//i.test(v)) return v.slice(0, 200);
      return `https://${v}`.slice(0, 200);
    }

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
    if (website !== undefined) updates.website = normalizeUrl(website);
    if (social !== undefined) updates.social = normalizeUrl(social);

    if (req.files?.avatar?.[0]) updates.avatar = `/uploads/${req.files.avatar[0].filename}`;
    if (req.files?.cover?.[0]) updates.cover = `/uploads/${req.files.cover[0].filename}`;

    const updated = db.update("users", (u) => u.id === user.id, () => updates);
    res.json({ user: publicUser(updated) });
  }
);

/* ---------------------------------------------------------------- */
/* GET /api/users/search?q= — find people to follow or message        */
/* ---------------------------------------------------------------- */
router.get("/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 1) return res.json({ users: [] });
  const results = db.filter(
    "users",
    (u) => u.id !== req.userId && (u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q))
  ).slice(0, 15).map((u) => withCounts(u, req.userId));
  res.json({ users: results });
});

/* ---------------------------------------------------------------- */
/* GET /api/users/by-handle/:handle — exact lookup (includes yourself)*/
/* Declared before "/:id" so the literal path wins the match.         */
/* ---------------------------------------------------------------- */
router.get("/by-handle/:handle", requireAuth, (req, res) => {
  const handle = String(req.params.handle || "").toLowerCase();
  const user = db.find("users", (u) => u.handle.toLowerCase() === handle);
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ user: withCounts(user, req.userId) });
});

/* ---------------------------------------------------------------- */
/* GET /api/users/:id — public profile with follow/post counts        */
/* ---------------------------------------------------------------- */
router.get("/:id", requireAuth, (req, res) => {
  const user = db.find("users", (u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ user: withCounts(user, req.userId) });
});

/* GET /api/users/:id/followers */
router.get("/:id/followers", requireAuth, (req, res) => {
  const followers = db.filter("follows", (f) => f.followingId === req.params.id)
    .map((f) => miniUser(db.find("users", (u) => u.id === f.followerId)))
    .filter(Boolean);
  res.json({ users: followers });
});

/* GET /api/users/:id/following */
router.get("/:id/following", requireAuth, (req, res) => {
  const following = db.filter("follows", (f) => f.followerId === req.params.id)
    .map((f) => miniUser(db.find("users", (u) => u.id === f.followingId)))
    .filter(Boolean);
  res.json({ users: following });
});

/* POST /api/users/:id/follow — toggle */
router.post("/:id/follow", requireAuth, (req, res) => {
  const target = db.find("users", (u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Account not found." });
  if (target.id === req.userId) return res.status(400).json({ error: "You can't follow yourself." });

  const existing = db.find("follows", (f) => f.followerId === req.userId && f.followingId === target.id);
  if (existing) {
    db.remove("follows", (f) => f.followerId === req.userId && f.followingId === target.id);
  } else {
    db.insert("follows", { followerId: req.userId, followingId: target.id, createdAt: new Date().toISOString() });
    notify(target.id, { type: "follow", actorId: req.userId, text: "started following you" });
  }
  res.json({ user: withCounts(target, req.userId) });
});

export default router;
