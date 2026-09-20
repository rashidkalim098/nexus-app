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
  posts: [],
  postLikes: [],
  postSaves: [],
  comments: [],
  spaces: [],
  spaceMembers: [],
  notifications: [],
  conversations: [],
  messages: [],
  follows: [],
};

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
