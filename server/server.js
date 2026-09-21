import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import storiesRoutes from "./routes/stories.js";
import usersRoutes from "./routes/users.js";
import spacesRoutes from "./routes/spaces.js";
import postsRoutes from "./routes/posts.js";
import notificationsRoutes from "./routes/notifications.js";
import conversationsRoutes from "./routes/conversations.js";
import { seedStarterSpaces } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Safety net: never let one bad request or a stray rejected promise take
// the whole server down. Log it and keep running.
process.on("unhandledRejection", (err) => {
  console.error("\n[UNHANDLED REJECTION] The server kept running, but this needs a look:\n", err);
});
process.on("uncaughtException", (err) => {
  console.error("\n[UNCAUGHT EXCEPTION] The server kept running, but this needs a look:\n", err);
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "2mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/spaces", spacesRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/conversations", conversationsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Friendly error handler (e.g. multer file-too-large / bad file type errors)
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Something went wrong." });
  }
  next();
});

seedStarterSpaces();

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`\n  NEXUS API running at http://localhost:${PORT}`);
  console.log(`  Allowing requests from ${FRONTEND_URL}\n`);
});