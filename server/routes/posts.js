import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { miniUser, notify } from "../serialize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 8) || ".jpg";
    cb(null, `${genId("post")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed."));
    cb(null, true);
  },
});

const router = Router();

function serialize(post, viewerId) {
  const author = db.find("users", (u) => u.id === post.authorId);
  const space = post.spaceId ? db.find("spaces", (s) => s.id === post.spaceId) : null;
  const likeCount = db.filter("postLikes", (l) => l.postId === post.id).length;
  const saveCount = db.filter("postSaves", (s) => s.postId === post.id).length;
  const commentCount = db.filter("comments", (c) => c.postId === post.id).length;
  return {
    id: post.id,
    body: post.body,
    mediaUrl: post.mediaUrl,
    createdAt: post.createdAt,
    author: miniUser(author),
    space: space ? { id: space.id, name: space.name } : null,
    likes: likeCount,
    saves: saveCount,
    commentCount,
    liked: !!db.find("postLikes", (l) => l.postId === post.id && l.userId === viewerId),
    saved: !!db.find("postSaves", (s) => s.postId === post.id && s.userId === viewerId),
    isOwn: post.authorId === viewerId,
  };
}

/* GET /api/posts?spaceId=&authorId=&saved=true */
router.get("/", requireAuth, (req, res) => {
  const { spaceId, authorId, saved } = req.query;
  let posts = db.get("posts");
  if (spaceId) posts = posts.filter((p) => p.spaceId === spaceId);
  if (authorId) posts = posts.filter((p) => p.authorId === authorId);
  if (saved === "true") {
    const savedIds = new Set(db.filter("postSaves", (s) => s.userId === req.userId).map((s) => s.postId));
    posts = posts.filter((p) => savedIds.has(p.id));
  }
  const sorted = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ posts: sorted.map((p) => serialize(p, req.userId)) });
});

/* POST /api/posts */
router.post("/", requireAuth, upload.single("media"), (req, res) => {
  const { body, spaceId } = req.body || {};
  if ((!body || !body.trim()) && !req.file) {
    return res.status(400).json({ error: "Write something or add a photo to post." });
  }
  if (body && body.length > 500) return res.status(400).json({ error: "Posts are limited to 500 characters." });
  if (spaceId && !db.find("spaces", (s) => s.id === spaceId)) {
    return res.status(404).json({ error: "That space doesn't exist." });
  }

  const post = {
    id: genId("post"),
    authorId: req.userId,
    spaceId: spaceId || null,
    body: (body || "").trim(),
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString(),
  };
  db.insert("posts", post);
  res.status(201).json({ post: serialize(post, req.userId) });
});

/* DELETE /api/posts/:id */
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

/* POST /api/posts/:id/like — toggle */
router.post("/:id/like", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const existing = db.find("postLikes", (l) => l.postId === post.id && l.userId === req.userId);
  if (existing) {
    db.remove("postLikes", (l) => l.postId === post.id && l.userId === req.userId);
  } else {
    db.insert("postLikes", { postId: post.id, userId: req.userId, createdAt: new Date().toISOString() });
    notify(post.authorId, { type: "like", actorId: req.userId, text: "liked your post", postId: post.id });
  }
  res.json({ post: serialize(post, req.userId) });
});

/* POST /api/posts/:id/save — toggle */
router.post("/:id/save", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const existing = db.find("postSaves", (s) => s.postId === post.id && s.userId === req.userId);
  if (existing) db.remove("postSaves", (s) => s.postId === post.id && s.userId === req.userId);
  else db.insert("postSaves", { postId: post.id, userId: req.userId, createdAt: new Date().toISOString() });
  res.json({ post: serialize(post, req.userId) });
});

/* GET /api/posts/:id/comments */
router.get("/:id/comments", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const comments = db.filter("comments", (c) => c.postId === post.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((c) => ({ id: c.id, text: c.text, createdAt: c.createdAt, author: miniUser(db.find("users", (u) => u.id === c.authorId)) }));
  res.json({ comments });
});

/* POST /api/posts/:id/comments */
router.post("/:id/comments", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Write a comment first." });

  const comment = {
    id: genId("cmt"),
    postId: post.id,
    authorId: req.userId,
    text: text.trim().slice(0, 280),
    createdAt: new Date().toISOString(),
  };
  db.insert("comments", comment);
  notify(post.authorId, { type: "comment", actorId: req.userId, text: "commented on your post", postId: post.id });
  res.status(201).json({ comment: { ...comment, author: miniUser(db.find("users", (u) => u.id === req.userId)) } });
});

/* POST /api/posts/:id/report */
router.post("/:id/report", requireAuth, (req, res) => {
  const post = db.find("posts", (p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  const { reason } = req.body || {};
  db.insert("reports", {
    id: genId("rpt"),
    postId: post.id,
    reporterId: req.userId,
    reason: (reason || "Not specified").slice(0, 300),
    createdAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

export default router;
