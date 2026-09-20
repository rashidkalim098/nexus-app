import { db } from "../db.js";

// Shared helpers for turning raw DB rows into the shape the frontend expects,
// and for never leaking private fields (passwordHash, email) to other users.

function computeStatus(lastActiveAt) {
  if (!lastActiveAt) return "offline";
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  if (ms < 2 * 60 * 1000) return "online";
  if (ms < 15 * 60 * 1000) return "away";
  return "offline";
}

function followCounts(userId) {
  return {
    followerCount: db.filter("follows", (f) => f.followingId === userId).length,
    followingCount: db.filter("follows", (f) => f.followerId === userId).length,
  };
}

// Full "me" view — includes email, keeps everything except the password hash.
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return { ...safe, status: computeStatus(user.lastActiveAt), ...followCounts(user.id) };
}

// Slim view for *other* people's profiles (mentions, comments, chat, members)
// — never exposes another person's email address. Pass viewerId to also
// know whether the requester already follows this person.
export function peerUser(user, viewerId) {
  if (!user) return null;
  const { passwordHash, email, ...safe } = user;
  const isFollowedByMe = viewerId ? !!db.find("follows", (f) => f.followerId === viewerId && f.followingId === user.id) : undefined;
  return { ...safe, status: computeStatus(user.lastActiveAt), ...followCounts(user.id), isFollowedByMe };
}
