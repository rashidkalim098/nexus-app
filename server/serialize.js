import { db } from "./db.js";

function computeStatus(user) {
  if (!user?.lastSeenAt) return "offline";
  const mins = (Date.now() - new Date(user.lastSeenAt).getTime()) / 60000;
  if (mins < 2) return "online";
  if (mins < 15) return "away";
  return "offline";
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return { ...safe, status: computeStatus(user) };
}

export function miniUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, handle: user.handle, avatar: user.avatar, status: computeStatus(user) };
}

export function notify(userId, { type, actorId = null, text, postId = null }) {
  if (userId === actorId) return; // never notify yourself
  db.insert("notifications", {
    id: `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type,
    actorId,
    postId,
    text,
    read: false,
    createdAt: new Date().toISOString(),
  });
}
