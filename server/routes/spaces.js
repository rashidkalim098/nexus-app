import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { miniUser } from "../serialize.js";

const router = Router();
const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function serialize(space, userId) {
  const memberCount = db.filter("spaceMembers", (m) => m.spaceId === space.id).length;
  const postsToday = db.filter(
    "posts",
    (p) => p.spaceId === space.id && new Date(p.createdAt) >= startOfToday()
  ).length;
  const joined = !!db.find("spaceMembers", (m) => m.spaceId === space.id && m.userId === userId);
  return {
    id: space.id,
    name: space.name,
    category: space.category,
    emoji: space.emoji,
    desc: space.desc,
    rules: space.rules,
    ownerId: space.ownerId,
    createdAt: space.createdAt,
    members: memberCount,
    postsToday,
    joined,
  };
}

/* GET /api/spaces */
router.get("/", requireAuth, (req, res) => {
  const spaces = db.get("spaces").map((s) => serialize(s, req.userId));
  res.json({ spaces });
});

/* GET /api/spaces/:id */
router.get("/:id", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });
  res.json({ space: serialize(space, req.userId) });
});

/* GET /api/spaces/:id/members */
router.get("/:id/members", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });
  const members = db.filter("spaceMembers", (m) => m.spaceId === space.id).map((m) => {
    const u = db.find("users", (u) => u.id === m.userId);
    return { ...miniUser(u), isOwner: space.ownerId === m.userId, joinedAt: m.joinedAt };
  }).filter((m) => m.id);
  res.json({ members });
});

/* POST /api/spaces — create a new space (creator auto-joins) */
router.post("/", requireAuth, (req, res) => {
  const { name, category, emoji, desc } = req.body || {};
  if (!name || name.trim().length < 3) return res.status(400).json({ error: "Give your space a name (3+ characters)." });
  if (!category) return res.status(400).json({ error: "Choose a category." });

  const space = {
    id: genId("sp"),
    name: name.trim(),
    category,
    emoji: emoji || "\u25C6",
    desc: (desc || "").trim().slice(0, 300),
    rules: ["Be respectful", "Stay on topic"],
    ownerId: req.userId,
    createdAt: new Date().toISOString(),
  };
  db.insert("spaces", space);
  db.insert("spaceMembers", { spaceId: space.id, userId: req.userId, joinedAt: new Date().toISOString() });
  res.status(201).json({ space: serialize(space, req.userId) });
});

/* POST /api/spaces/:id/join */
router.post("/:id/join", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });
  if (!db.find("spaceMembers", (m) => m.spaceId === space.id && m.userId === req.userId)) {
    db.insert("spaceMembers", { spaceId: space.id, userId: req.userId, joinedAt: new Date().toISOString() });
  }
  res.json({ space: serialize(space, req.userId) });
});

/* POST /api/spaces/:id/leave */
router.post("/:id/leave", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });
  db.remove("spaceMembers", (m) => m.spaceId === space.id && m.userId === req.userId);
  res.json({ space: serialize(space, req.userId) });
});

export default router;
