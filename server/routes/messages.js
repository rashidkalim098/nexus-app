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
    const ext = path.extname(file.originalname || "").slice(0, 8) || (file.mimetype.startsWith("audio/") ? ".webm" : ".jpg");
    cb(null, `${genId("msg")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only image or voice-note attachments are allowed."));
    }
    cb(null, true);
  },
});

function otherUserId(convo, viewerId) {
  return convo.userAId === viewerId ? convo.userBId : convo.userAId;
}

function serializeMessage(m, viewerId, otherId) {
  return {
    id: m.id,
    from: m.senderId === viewerId ? "me" : m.senderId,
    text: m.text,
    mediaUrl: m.mediaUrl || null,
    mediaType: m.mediaType || null,
    reactions: m.reactions || [],
    read: (m.readBy || []).includes(otherId),
    createdAt: m.createdAt,
  };
}

function serializeConvo(convo, viewerId) {
  const otherId = otherUserId(convo, viewerId);
  const msgs = db.filter("messages", (m) => m.convoId === convo.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const unread = msgs.filter((m) => m.senderId !== viewerId && !(m.readBy || []).includes(viewerId)).length;
  return {
    id: convo.id,
    userId: otherId,
    unread,
    messages: msgs.map((m) => serializeMessage(m, viewerId, otherId)),
  };
}

/* ---------------------------------------------------------------- */
/* GET /api/conversations                                             */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const convos = db.filter("conversations", (c) => c.userAId === req.userId || c.userBId === req.userId);
  res.json({ conversations: convos.map((c) => serializeConvo(c, req.userId)) });
});

/* ---------------------------------------------------------------- */
/* POST /api/conversations { userId } — get-or-create                 */
/* ---------------------------------------------------------------- */
router.post("/", requireAuth, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId." });
  if (userId === req.userId) return res.status(400).json({ error: "You can't message yourself." });

  const target = db.find("users", (u) => u.id === userId);
  if (!target) return res.status(404).json({ error: "That person doesn't exist." });

  let convo = db.find(
    "conversations",
    (c) => (c.userAId === req.userId && c.userBId === userId) || (c.userAId === userId && c.userBId === req.userId)
  );
  if (!convo) {
    convo = { id: genId("convo"), userAId: req.userId, userBId: userId, createdAt: new Date().toISOString() };
    db.insert("conversations", convo);
  }
  res.status(201).json({ conversation: serializeConvo(convo, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/conversations/:id/read — mark all incoming as read       */
/* ---------------------------------------------------------------- */
router.post("/:id/read", requireAuth, (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || (convo.userAId !== req.userId && convo.userBId !== req.userId)) {
    return res.status(404).json({ error: "Conversation not found." });
  }
  const msgs = db.filter("messages", (m) => m.convoId === convo.id && m.senderId !== req.userId);
  for (const m of msgs) {
    if (!(m.readBy || []).includes(req.userId)) {
      db.update("messages", (x) => x.id === m.id, (x) => ({ readBy: [...(x.readBy || []), req.userId] }));
    }
  }
  res.json({ conversation: serializeConvo(convo, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/conversations/:id/messages — multipart (text + optional  */
/* image or voice note)                                               */
/* ---------------------------------------------------------------- */
router.post("/:id/messages", requireAuth, upload.single("media"), (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || (convo.userAId !== req.userId && convo.userBId !== req.userId)) {
    return res.status(404).json({ error: "Conversation not found." });
  }
  const text = (req.body?.text || "").trim();
  if (!text && !req.file) return res.status(400).json({ error: "Write a message or attach something first." });
  if (text.length > 1000) return res.status(400).json({ error: "Messages are limited to 1000 characters." });

  const message = {
    id: genId("msg"),
    convoId: convo.id,
    senderId: req.userId,
    text,
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    mediaType: req.file ? (req.file.mimetype.startsWith("audio/") ? "audio" : "image") : null,
    reactions: [],
    readBy: [req.userId],
    createdAt: new Date().toISOString(),
  };
  db.insert("messages", message);
  res.status(201).json({ conversation: serializeConvo(convo, req.userId) });
});

/* ---------------------------------------------------------------- */
/* POST /api/conversations/:id/messages/:msgId/react — toggles        */
/* ---------------------------------------------------------------- */
router.post("/:id/messages/:msgId/react", requireAuth, (req, res) => {
  const convo = db.find("conversations", (c) => c.id === req.params.id);
  if (!convo || (convo.userAId !== req.userId && convo.userBId !== req.userId)) {
    return res.status(404).json({ error: "Conversation not found." });
  }
  const message = db.find("messages", (m) => m.id === req.params.msgId && m.convoId === convo.id);
  if (!message) return res.status(404).json({ error: "Message not found." });

  const emoji = req.body?.emoji;
  if (!emoji) return res.status(400).json({ error: "Missing emoji." });

  const reactions = message.reactions || [];
  const next = reactions.includes(emoji) ? reactions.filter((r) => r !== emoji) : [...reactions, emoji];
  db.update("messages", (m) => m.id === message.id, () => ({ reactions: next }));

  res.json({ conversation: serializeConvo(convo, req.userId) });
});

export default router;
