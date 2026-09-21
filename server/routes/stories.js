import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 8) || ".jpg";
    cb(null, `${genId("story")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
      return cb(new Error("Only image or video files are allowed."));
    }
    cb(null, true);
  },
});

const router = Router();

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function isExpired(story) {
  return new Date(story.expiresAt).getTime() < Date.now();
}

function serialize(story, viewerId) {
  const user = db.find("users", (u) => u.id === story.userId);
  const views = db.filter("storyViews", (v) => v.storyId === story.id);
  return {
    id: story.id,
    type: story.type,
    mediaUrl: story.mediaUrl,
    text: story.text,
    bgColor: story.bgColor,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    author: user ? { id: user.id, name: user.name, handle: user.handle, avatar: user.avatar } : null,
    viewCount: views.length,
    viewedByMe: views.some((v) => v.viewerId === viewerId),
    viewers: story.userId === viewerId
      ? views.map((v) => publicUser(db.find("users", (u) => u.id === v.viewerId))).filter(Boolean)
      : undefined,
  };
}

/* ---------------------------------------------------------------- */
/* GET /api/stories — active stories, grouped by author               */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const active = db.filter("stories", (s) => !isExpired(s));
  const serialized = active
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => serialize(s, req.userId));

  const byAuthor = new Map();
  for (const s of serialized) {
    if (!s.author) continue;
    if (!byAuthor.has(s.author.id)) byAuthor.set(s.author.id, []);
    byAuthor.get(s.author.id).push(s);
  }
  const groups = Array.from(byAuthor.values()).map((stories) => ({
    author: stories[0].author,
    stories: stories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    hasUnseen: stories.some((s) => !s.viewedByMe),
  }));

  res.json({ groups });
});

/* ---------------------------------------------------------------- */
/* POST /api/stories — create a text or media story                   */
/* ---------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("media"), (req, res) => {
  const { text, bgColor } = req.body || {};
  if (!req.file && !(text && text.trim())) {
    return res.status(400).json({ error: "Add a photo/video or write something for your story." });
  }

  const story = {
    id: genId("story"),
    userId: req.userId,
    type: req.file ? (req.file.mimetype.startsWith("video/") ? "video" : "image") : "text",
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    text: text ? text.trim().slice(0, 280) : null,
    bgColor: bgColor || "#7B6EF6",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
  };
  db.insert("stories", story);
  res.status(201).json({ story: serialize(story, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/stories/:id/view                                         */
/* ---------------------------------------------------------------- */
router.post("/:id/view", requireAuth, (req, res) => {
  const story = db.find("stories", (s) => s.id === req.params.id);
  if (!story || isExpired(story)) return res.status(404).json({ error: "This story is no longer available." });

  const already = db.find("storyViews", (v) => v.storyId === story.id && v.viewerId === req.userId);
  if (!already && story.userId !== req.userId) {
    db.insert("storyViews", { storyId: story.id, viewerId: req.userId, viewedAt: new Date().toISOString() });
  }
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- */
/* DELETE /api/stories/:id                                            */
/* ---------------------------------------------------------------- */
router.delete("/:id", requireAuth, (req, res) => {
  const story = db.find("stories", (s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: "Story not found." });
  if (story.userId !== req.userId) return res.status(403).json({ error: "You can only delete your own story." });

  db.remove("stories", (s) => s.id === story.id);
  db.remove("storyViews", (v) => v.storyId === story.id);
  res.json({ ok: true });
});

export default router;
