import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { peerUser } from "../lib/serialize.js";

const router = Router();

// The original set of default communities NEXUS ships with. These are real
// rows in the database — anyone can join/leave/post in them like any other
// space, they're just seeded once so the app isn't an empty room on day one.
const DEFAULT_SPACES = [
  { id: "sp_design", name: "Design Collective", category: "Design", emoji: "\u25C8", desc: "Critique, share, and grow as a designer.",
    rules: ["Be constructive in critiques", "No unsolicited DMs from posts", "Credit original sources"] },
  { id: "sp_fe", name: "Frontend Devs", category: "Tech", emoji: "\u25C6", desc: "React, Vite, and the modern web.",
    rules: ["Format code blocks", "Search before asking", "No unpaid job posts"] },
  { id: "sp_photo", name: "Analog Photography", category: "Art", emoji: "\u25C9", desc: "Film shooters sharing frames and technique.",
    rules: ["Include camera + film stock", "No AI-generated images"] },
  { id: "sp_indie", name: "Indie Music Makers", category: "Music", emoji: "\u266B", desc: "Bedroom producers and songwriters.",
    rules: ["Feedback Fridays only for full tracks", "Tag genre in post"] },
  { id: "sp_speed", name: "Speedrun Central", category: "Gaming", emoji: "\u25B2", desc: "Routes, splits, and world records.",
    rules: ["Verify runs with video", "No spoilers without tags"] },
  { id: "sp_run", name: "Morning Runners", category: "Fitness", emoji: "\u25CF", desc: "Early miles and accountability.",
    rules: ["Log your run to post", "Be kind to beginners"] },
  { id: "sp_pack", name: "Backpackers Guild", category: "Travel", emoji: "\u25A0", desc: "Budget routes and packing lists.",
    rules: ["No unlicensed tour ads", "Share real costs"] },
];

export function ensureDefaultSpaces() {
  const existing = db.filter("spaces", () => true);
  for (const def of DEFAULT_SPACES) {
    if (!existing.some((s) => s.id === def.id)) {
      db.insert("spaces", { ...def, createdAt: new Date().toISOString() });
    }
  }
}

function serializeSpace(space, viewerId) {
  const members = db.filter("spaceMembers", (m) => m.spaceId === space.id);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const postsToday = db.filter("posts", (p) => p.communityId === space.id && new Date(p.createdAt).getTime() > dayAgo).length;
  return {
    id: space.id,
    name: space.name,
    category: space.category,
    emoji: space.emoji,
    desc: space.desc,
    rules: space.rules,
    members: members.length,
    postsToday,
    joined: members.some((m) => m.userId === viewerId),
  };
}

/* ---------------------------------------------------------------- */
/* GET /api/spaces                                                    */
/* ---------------------------------------------------------------- */
router.get("/", requireAuth, (req, res) => {
  const spaces = db.filter("spaces", () => true);
  res.json({ spaces: spaces.map((s) => serializeSpace(s, req.userId)) });
});

/* ---------------------------------------------------------------- */
/* POST /api/spaces/:id/join — toggles                                */
/* ---------------------------------------------------------------- */
router.post("/:id/join", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });

  const existing = db.find("spaceMembers", (m) => m.spaceId === space.id && m.userId === req.userId);
  if (existing) {
    db.remove("spaceMembers", (m) => m.spaceId === space.id && m.userId === req.userId);
  } else {
    db.insert("spaceMembers", { spaceId: space.id, userId: req.userId, joinedAt: new Date().toISOString() });
  }
  res.json({ space: serializeSpace(space, req.userId) });
});

/* ---------------------------------------------------------------- */
/* GET /api/spaces/:id/members                                        */
/* ---------------------------------------------------------------- */
router.get("/:id/members", requireAuth, (req, res) => {
  const space = db.find("spaces", (s) => s.id === req.params.id);
  if (!space) return res.status(404).json({ error: "Space not found." });

  const rows = db.filter("spaceMembers", (m) => m.spaceId === space.id).sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  const members = rows
    .map((m, i) => {
      const user = db.find("users", (u) => u.id === m.userId);
      if (!user) return null;
      return { ...peerUser(user, req.userId), role: i === 0 ? "Owner" : i === 1 ? "Moderator" : "Member" };
    })
    .filter(Boolean);
  res.json({ members });
});

export default router;
