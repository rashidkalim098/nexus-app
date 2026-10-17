import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

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

// ---------------------------------------------------------------
// Storage: if DATABASE_URL is set (Render), everything is saved in a
// hosted Postgres database so it survives restarts/redeploys.
// If not set (your laptop), it falls back to the local JSON file.
// ---------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL || "";
export const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4 })
  : null;

async function loadRemote() {
  await pool.query("CREATE TABLE IF NOT EXISTS nexus_state (id INT PRIMARY KEY, data JSONB NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS nexus_files (name TEXT PRIMARY KEY, mime TEXT, data BYTEA NOT NULL)");
  const r = await pool.query("SELECT data FROM nexus_state WHERE id = 1");
  if (r.rows.length) return { ...EMPTY_DB, ...r.rows[0].data };
  return { ...EMPTY_DB };
}

let cache = pool ? await loadRemote() : load();
console.log(pool ? "  Database: hosted Postgres (permanent)" : "  Database: local JSON file (temporary on free hosting!)");
let writeTimer = null;
let saving = Promise.resolve();

function saveNow() {
  if (pool) {
    const snapshot = JSON.stringify(cache);
    // queue writes one after another so they never overlap
    saving = saving
      .then(() => pool.query(
        "INSERT INTO nexus_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [snapshot]
      ))
      .catch((e) => console.error("[DB SAVE FAILED]", e.message));
    return saving;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
  return Promise.resolve();
}

function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(saveNow, pool ? 300 : 25);
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

// Flush any pending write on shutdown so nothing is lost.
export async function flushDb() {
  clearTimeout(writeTimer);
  try { await saveNow(); } catch { /* ignore */ }
}
if (!pool) process.on("exit", () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2)); } catch {} });
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => { await flushDb(); process.exit(0); });
}

seedSpacesIfEmpty();