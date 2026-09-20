import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import storiesRoutes from "./routes/stories.js";
import usersRoutes from "./routes/users.js";
import postsRoutes from "./routes/posts.js";
import spacesRoutes, { ensureDefaultSpaces } from "./routes/spaces.js";
import notificationsRoutes from "./routes/notifications.js";
import messagesRoutes from "./routes/messages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "2mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

ensureDefaultSpaces();

app.use("/api/auth", authRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/spaces", spacesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/conversations", messagesRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Friendly error handler (e.g. multer file-too-large / bad file type errors)
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Something went wrong." });
  }
  next();
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`\n  NEXUS API running at http://localhost:${PORT}`);
  console.log(`  Allowing requests from ${FRONTEND_URL}\n`);
});
