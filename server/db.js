import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// A tiny dependency-free JSON file "database". This is plenty for a small
// app like this and — unlike sqlite-style native modules — it can never
// fail to install on someone's machine, which matters more here than raw
// speed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  users: [],
  otps: [],
  stories: [],
  storyViews: [],
  spaces: [],
  spaceMembers: [],
  posts: [],
  postLikes: [],
  postSaves: [],
  comments: [],
  follows: [],
  notifications: [],
  conversations: [],
  messages: [],
  reports: [],
};

const SEED_SPACES = [
  { name: "Design Collective", category: "Design", emoji: "\u25C8", desc: "Critique, share, and grow as a designer.",
    rules: ["Be constructive in critiques", "No unsolicited DMs from posts", "Credit original sources"] },
  { name: "Frontend Devs", category: "Tech", emoji: "\u25C6", desc: "React, Vite, and the modern web.",
    rules: ["Format code blocks", "Search before asking", "No unpaid job posts"] },
  { name: "Analog Photography", category: "Art", emoji: "\u25C9", desc: "Film shooters sharing frames and technique.",
    rules: ["Include camera + film stock", "No AI-generated images"] },
  { name: "Indie Music Makers", category: "Music", emoji: "\u266B", desc: "Bedroom producers and songwriters.",
    rules: ["Feedback Fridays only for full tracks", "Tag genre in post"] },
  { name: "Speedrun Central", category: "Gaming", emoji: "\u25B2", desc: "Routes, splits, and world records.",
    rules: ["Verify runs with video", "No spoilers without tags"] },
  { name: "Morning Runners", category: "Fitness", emoji: "\u25CF", desc: "Early miles and accountability.",
    rules: ["Log your run to post", "Be kind to beginners"] },
  { name: "Backpackers Guild", category: "Travel", emoji: "\u25A0", desc: "Budget routes and packing lists.",
    rules: ["No unlicensed tour ads", "Share real costs"] },
];

function seedSpacesIfEmpty() {
  if (cache.spaces.length > 0) return;
  cache.spaces = SEED_SPACES.map((s, i) => ({
    id: `sp_${i}_${Date.now().toString(36)}`,
    ownerId: null,
    createdAt: new Date().toISOString(),
    ...s,
  }));
  persist();
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return { ...EMPTY_DB, ...parsed };
  } catch {
    return { ...EMPTY_DB };
  }
}

let cache = load();
let writeTimer = null;

function persist() {
  clearTimeout(writeTimer);
  // Debounce disk writes slightly so bursts of calls in one request don't
  // hit the filesystem repeatedly.
  writeTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
  }, 25);
}

export const db = {
  get(table) {
    return cache[table];
  },
  set(table, rows) {
    cache[table] = rows;
    persist();
  },
  insert(table, row) {
    cache[table].push(row);
    persist();
    return row;
  },
  update(table, predicate, updater) {
    let updated = null;
    cache[table] = cache[table].map((row) => {
      if (predicate(row)) {
        updated = { ...row, ...updater(row) };
        return updated;
      }
      return row;
    });
    persist();
    return updated;
  },
  remove(table, predicate) {
    const before = cache[table].length;
    cache[table] = cache[table].filter((row) => !predicate(row));
    persist();
    return before !== cache[table].length;
  },
  find(table, predicate) {
    return cache[table].find(predicate) || null;
  },
  filter(table, predicate) {
    return cache[table].filter(predicate);
  },
};

// Flush any pending write immediately on shutdown so nothing is lost.
process.on("exit", () => {
  clearTimeout(writeTimer);
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
  } catch {
    /* ignore */
  }
});

seedSpacesIfEmpty();
