// Makes photo / voice-note uploads permanent.
// With DATABASE_URL set, files are stored inside the Postgres database
// (instead of Render's disk, which is wiped on every restart).
// This file must be imported FIRST in server.js.
import multer from "multer";
import { pool } from "./db.js";

if (pool) {
  const originalDiskStorage = multer.diskStorage;

  multer.diskStorage = function dbStorage(opts = {}) {
    return {
      _handleFile(req, file, cb) {
        const chunks = [];
        file.stream.on("data", (c) => chunks.push(c));
        file.stream.on("error", cb);
        file.stream.on("end", () => {
          const buf = Buffer.concat(chunks);
          const pickName = opts.filename || ((r, f, done) => done(null, `${Date.now()}`));
          pickName(req, file, async (err, filename) => {
            if (err) return cb(err);
            try {
              await pool.query(
                "INSERT INTO nexus_files (name, mime, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data",
                [filename, file.mimetype, buf]
              );
              cb(null, { filename, size: buf.length });
            } catch (e) { cb(e); }
          });
        });
      },
      _removeFile(req, file, cb) {
        pool.query("DELETE FROM nexus_files WHERE name = $1", [file.filename]).then(() => cb(null), cb);
      },
    };
  };
  multer.__originalDiskStorage = originalDiskStorage;
}

// Express handler that serves files from the database (falls through to disk if not found).
export async function serveUpload(req, res, next) {
  if (!pool) return next();
  try {
    const name = decodeURIComponent(req.path.replace(/^\//, ""));
    const r = await pool.query("SELECT mime, data FROM nexus_files WHERE name = $1", [name]);
    if (!r.rows.length) return next();
    res.set("Content-Type", r.rows[0].mime || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(r.rows[0].data);
  } catch (e) { next(e); }
}
