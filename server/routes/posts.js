import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 8) || ".jpg";
    cb(null, `${genId("post")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed on posts."));
    cb(null, true);
  },
});

function notify(userId, actorId, type, text, extra = {}) {
  if (!userId || userId === actorId) return; // never notify yourself
  db.insert("notifications", {
    id: genId("notif"),
    userId,
    actorId,
    type,
    text,
    read: false,
    createdAt: new Date().toISOString(),
    ...extra,
  });
}

function serializeComment(c) {
  return { id: c.id, authorId: c.authorId, text: c.text, createdAt: c.createdAt };
}

function serializePost(post, viewerId) {
  const likes = db.filter("postLikes", (l) => l.postId === post.id);
  const saves = db.filter("postSaves", (s) => s.postId === post.id);
  const comments = db
    .filter("comments", (c) => c.postId === post.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(serializeComment);
  return {
    id: post.id,
    authorId: post.authorId,
    communityId: post.communityId || null,
    body: post.body,
    mediaUrl: post.mediaUrl || null,
    createdAt: post.createdAt,
    likes: likes.length,
    liked: likes.some((l) => l.userId === viewerId),
    saves: saves.length,
    saved: saves.some((s) => s.userId === viewerId),
    comments,
  };
}

/* ---------------------------------------------------------------- */
/* GET /api/posts?communityId=xxx                                     */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const { communityId } = req.query;
  let posts = db.filter("posts", () => true);
  if (communityId) posts = posts.filter((p) => p.communityId === communityId);
  posts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ posts: posts.map((p) => serializePost(p, req.userId)) });
});

/* ---------------------------------------------------------------- */
/* POST /api/posts — multipart (text + optional image)                */
/* ---------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("media"), (req, res) => {
  const text = (req.body?.body || "").trim();
  const communityId = req.body?.communityId || null;
  if (!text && !req.file) return res.status(400).json({ error: "Write something or attach an image to post." });
  if (text.length > 500) return res.status(400).json({ error: "Posts are limited to 500 characters." });

  if (communityId) {
    const space = db.find("spaces", (s) => s.id === communityId);
    if (!space) return res.status(404).json({ error: "That space no longer exists." });
  }

  const post = {
    id: genId("post"),
    authorId: req.userId,
    communityId: communityId || null,
    body: text,
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString(),
  };
  db.insert("posts", post);
  res.status(201).json({ post: serializePost(post, req.userId) });
});

/* ---------------------------------------------------------------- */
/* DELETE /api/posts/:id                                              */
/* ---------------------------------------------------------------- */
router.delete("/:id", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (post.authorId !== req.userId) return res.status(403).json({ error: "You can only delete your own posts." });

  db.remove("posts", (p) => p.id === post.id);
  db.remove("postLikes", (l) => l.postId === post.id);
  db.remove("postSaves", (s) => s.postId === post.id);
  db.remove("comments", (c) => c.postId === post.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- */
/* POST /api/posts/:id/like — toggles                                 */
/* ---------------------------------------------------------------- */
router.post("/:id/like", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });

  const existing = db.find("postLikes", (l) => l.postId === post.id && l.userId === req.userId);
  if (existing) {
    db.remove("postLikes", (l) => l.postId === post.id && l.userId === req.userId);
  } else {
    db.insert("postLikes", { postId: post.id, userId: req.userId, createdAt: new Date().toISOString() });
    notify(post.authorId, req.userId, "like", "liked your post", { postId: post.id });
  }
  res.json({ post: serializePost(post, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/posts/:id/save — toggles                                 */
/* ---------------------------------------------------------------- */
router.post("/:id/save", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });

  const existing = db.find("postSaves", (s) => s.postId === post.id && s.userId === req.userId);
  if (existing) db.remove("postSaves", (s) => s.postId === post.id && s.userId === req.userId);
  else db.insert("postSaves", { postId: post.id, userId: req.userId, createdAt: new Date().toISOString() });

  res.json({ post: serializePost(post, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/posts/:id/comments                                       */
/* ---------------------------------------------------------------- */
router.post("/:id/comments", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });

  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Write a comment first." });
  if (text.length > 280) return res.status(400).json({ error: "Comments are limited to 280 characters." });

  const comment = { id: genId("cmt"), postId: post.id, authorId: req.userId, text, createdAt: new Date().toISOString() };
  db.insert("comments", comment);
  notify(post.authorId, req.userId, "comment", "commented on your post", { postId: post.id });

  res.status(201).json({ post: serializePost(post, req.userId) });
});

export default router;
