const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

function getToken() {
  return localStorage.getItem("nexus_token") || "";
}
export function setToken(token) {
  if (token) localStorage.setItem("nexus_token", token);
  else localStorage.removeItem("nexus_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the NEXUS server. Is it running?");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  verifyOtp: (payload) => request("/auth/verify-otp", { method: "POST", body: payload }),
  resendOtp: (payload) => request("/auth/resend-otp", { method: "POST", body: payload }),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),
  me: () => request("/auth/me"),

  listStories: () => request("/stories"),
  createStory: (formData) => request("/stories", { method: "POST", body: formData, isForm: true }),
  viewStory: (id) => request(`/stories/${id}/view`, { method: "POST" }),
  deleteStory: (id) => request(`/stories/${id}`, { method: "DELETE" }),

  updateProfile: (formData) => request("/users/me", { method: "PATCH", body: formData, isForm: true }),
  listUsers: () => request("/users"),

  listPosts: (communityId) => request(communityId ? `/posts?communityId=${encodeURIComponent(communityId)}` : "/posts"),
  createPost: (formData) => request("/posts", { method: "POST", body: formData, isForm: true }),
  likePost: (id) => request(`/posts/${id}/like`, { method: "POST" }),
  savePost: (id) => request(`/posts/${id}/save`, { method: "POST" }),
  commentOnPost: (id, text) => request(`/posts/${id}/comments`, { method: "POST", body: { text } }),
  deletePost: (id) => request(`/posts/${id}`, { method: "DELETE" }),

  followUser: (id) => request(`/users/${id}/follow`, { method: "POST" }),
  listFollowers: (id) => request(`/users/${id}/followers`),
  listFollowing: (id) => request(`/users/${id}/following`),

  listSpaces: () => request("/spaces"),
  joinSpace: (id) => request(`/spaces/${id}/join`, { method: "POST" }),
  spaceMembers: (id) => request(`/spaces/${id}/members`),

  listNotifications: () => request("/notifications"),
  markAllNotificationsRead: () => request("/notifications/mark-all-read", { method: "POST" }),

  listConversations: () => request("/conversations"),
  startConversation: (userId) => request("/conversations", { method: "POST", body: { userId } }),
  markConvoRead: (id) => request(`/conversations/${id}/read`, { method: "POST" }),
  sendMessage: (convoId, formData) => request(`/conversations/${convoId}/messages`, { method: "POST", body: formData, isForm: true }),
  reactToMessage: (convoId, msgId, emoji) => request(`/conversations/${convoId}/messages/${msgId}/react`, { method: "POST", body: { emoji } }),
};

export function mediaUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${BASE_URL.replace(/\/api$/, "")}${pathOrUrl}`;
}
