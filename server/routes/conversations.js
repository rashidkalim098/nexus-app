import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { miniUser } from "../serialize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const router = Router();
const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 8) || (file.mimetype.startsWith("audio/") ? ".webm" : ".jpg");
    cb(null, `${genId("msg")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only images or voice notes can be attached."));
    }
    cb(null, true);
  },
});

function otherUserId(convo, userId) {
  return convo.memberIds.find((id) => id !== userId);
}

function serializeConvo(convo, viewerId) {
  const otherId = otherUserId(convo, viewerId);
  const other = db.find("users", (u) => u.id === otherId);
  const messages = db.filter("messages", (m) => m.conversationId === convo.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const last = messages[messages.length - 1] || null;
  const unread = messages.filter((m) => m.fromUserId !== viewerId && !m.readBy.includes(viewerId)).length;
  return {
    id: convo.id,
    user: miniUser(other),
    unread,
    lastMessage: last ? { text: last.text || (last.mediaType === "audio" ? "\uD83C\uDFA4 Voice note" : "\uD83D\uDDBC\uFE0F Photo"), fromMe: last.fromUserId === viewerId, createdAt: last.createdAt } : null,
  };
}

function serializeMessage(m, viewerId) {
  return {
    id: m.id,
    text: m.text,
    mediaUrl: m.mediaUrl || null,
    mediaType: m.mediaType || null,
    from: m.fromUserId === viewerId ? "me" : m.fromUserId,
    read: m.readBy.length > 1,
    reactions: m.reactions.map((r) => r.emoji),
    createdAt: m.createdAt,
  };
}

/* GET /api/conversations */
router.get("/", requireAuth, (req, res) => {
  const convos = db.filter("conversations", (c) => c.memberIds.includes(req.userId))
    .map((c) => serializeConvo(c, req.userId))
    .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  res.json({ conversations: convos });
});

/* POST /api/conversations/start  { userId } */
router.post("/start", requireAuth, (req, res) => {
  const { userId } = req.body || {};
  const target = db.find("users", (u) => u.id === userId);
  if (!target) return res.status(404).json({ error: "Account not found." });
  if (target.id === req.userId) return res.status(400).json({ error: "You can't message yourself." });

  let convo = db.find(
    "conversations",
    (c) => c.memberIds.includes(req.userId) && c.memberIds.includes(target.id)
  );
  if (!convo) {
    convo = { id: genId("convo"), memberIds: [req.userId, target.id], createdAt: new Date().toISOString() };
    db.insert("conversations", convo);
  }
  res.json({ conversation: serializeConvo(convo, req.userId) });
});

/* GET /api/conversations/:id/messages — also marks messages as read */
router.get("/:id/messages", requireAuth, (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || !convo.memberIds.includes(req.userId)) return res.status(404).json({ error: "Conversation not found." });

  db.set(
    "messages",
    db.get("messages").map((m) =>
      m.conversationId === convo.id && !m.readBy.includes(req.userId)
        ? { ...m, readBy: [...m.readBy, req.userId] }
        : m
    )
  );

  const messages = db.filter("messages", (m) => m.conversationId === convo.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((m) => serializeMessage(m, req.userId));
  res.json({ messages, user: miniUser(db.find("users", (u) => u.id === otherUserId(convo, req.userId))) });
});

/* POST /api/conversations/:id/messages  { text } or multipart { text?, media } */
router.post("/:id/messages", requireAuth, upload.single("media"), (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || !convo.memberIds.includes(req.userId)) return res.status(404).json({ error: "Conversation not found." });
  const { text } = req.body || {};
  if ((!text || !text.trim()) && !req.file) return res.status(400).json({ error: "Write a message or attach something first." });
  if (text && text.length > 1000) return res.status(400).json({ error: "Messages are limited to 1000 characters." });

  const message = {
    id: genId("msg"),
    conversationId: convo.id,
    fromUserId: req.userId,
    text: text ? text.trim() : "",
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    mediaType: req.file ? (req.file.mimetype.startsWith("audio/") ? "audio" : "image") : null,
    readBy: [req.userId],
    reactions: [],
    createdAt: new Date().toISOString(),
  };
  db.insert("messages", message);
  res.status(201).json({ message: serializeMessage(message, req.userId) });
});

/* POST /api/conversations/:id/messages/:msgId/react  { emoji } */
router.post("/:id/messages/:msgId/react", requireAuth, (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || !convo.memberIds.includes(req.userId)) return res.status(404).json({ error: "Conversation not found." });
  const message = db.find("messages", (m) => m.id === req.params.msgId && m.conversationId === convo.id);
  if (!message) return res.status(404).json({ error: "Message not found." });
  const { emoji } = req.body || {};
  if (!emoji) return res.status(400).json({ error: "Missing emoji." });

  const already = message.reactions.some((r) => r.userId === req.userId && r.emoji === emoji);
  const updated = db.update("messages", (m) => m.id === message.id, (m) => ({
    reactions: already
      ? m.reactions.filter((r) => !(r.userId === req.userId && r.emoji === emoji))
      : [...m.reactions, { userId: req.userId, emoji }],
  }));
  res.json({ message: serializeMessage(updated, req.userId) });
});

export default router;
