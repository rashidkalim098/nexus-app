import crypto from "crypto";
import { db } from "./db.js";

// Starter communities, created once on first server start so the Spaces tab
// isn't an empty screen on a brand-new install. These are real, joinable,
// postable spaces — not placeholder content. ownerId is null, meaning nobody
// owns them, so any member is just a member.

const genId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const STARTER_SPACES = [
  {
    name: "General",
    category: "Tech",
    emoji: "\u25C6",
    desc: "Anything and everything. Say hi, share what you're working on.",
    rules: ["Be decent to each other", "No spam or self-promo dumps"],
  },
  {
    name: "Design Collective",
    category: "Design",
    emoji: "\u25C8",
    desc: "Critique, share, and grow as a designer.",
    rules: ["Be constructive in critiques", "Credit original sources"],
  },
  {
    name: "Developers",
    category: "Tech",
    emoji: "\u25C7",
    desc: "Code, tools, bugs, and the occasional win.",
    rules: ["Format your code blocks", "Search before asking"],
  },
  {
    name: "Photography",
    category: "Art",
    emoji: "\u25C9",
    desc: "Share frames and talk technique.",
    rules: ["Share your settings where you can", "Only post your own work"],
  },
  {
    name: "Music",
    category: "Music",
    emoji: "\u266B",
    desc: "Producers, singers, and listeners welcome.",
    rules: ["Tag the genre in your post", "Give feedback if you ask for it"],
  },
  {
    name: "Fitness",
    category: "Fitness",
    emoji: "\u25CF",
    desc: "Training, progress, and accountability.",
    rules: ["Be kind to beginners", "No extreme diet advice"],
  },
  {
    name: "Travel",
    category: "Travel",
    emoji: "\u25A0",
    desc: "Routes, tips, and places worth the trip.",
    rules: ["Share real costs where you can", "No unlicensed tour ads"],
  },
  {
    name: "Gaming",
    category: "Gaming",
    emoji: "\u25B2",
    desc: "Runs, reviews, and lobbies.",
    rules: ["Tag spoilers", "No cheat or exploit selling"],
  },
];

export function seedStarterSpaces() {
  if (db.get("spaces").length > 0) return; // already seeded or user made their own

  for (const s of STARTER_SPACES) {
    db.insert("spaces", {
      id: genId("space"),
      name: s.name,
      category: s.category,
      emoji: s.emoji,
      desc: s.desc,
      rules: s.rules,
      ownerId: null,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`  Seeded ${STARTER_SPACES.length} starter spaces.`);
}
