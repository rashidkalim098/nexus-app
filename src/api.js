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
  changePassword: (payload) => request("/auth/change-password", { method: "POST", body: payload }),
  deleteAccount: (password) => request("/auth/me", { method: "DELETE", body: { password } }),

  listStories: () => request("/stories"),
  createStory: (formData) => request("/stories", { method: "POST", body: formData, isForm: true }),
  viewStory: (id) => request(`/stories/${id}/view`, { method: "POST" }),
  deleteStory: (id) => request(`/stories/${id}`, { method: "DELETE" }),

  updateProfile: (formData) => request("/users/me", { method: "PATCH", body: formData, isForm: true }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id) => request(`/users/${id}`),
  getUserByHandle: (handle) => request(`/users/by-handle/${encodeURIComponent(handle)}`),
  getFollowers: (id) => request(`/users/${id}/followers`),
  getFollowing: (id) => request(`/users/${id}/following`),
  toggleFollow: (id) => request(`/users/${id}/follow`, { method: "POST" }),

  listSpaces: () => request("/spaces"),
  getSpace: (id) => request(`/spaces/${id}`),
  getSpaceMembers: (id) => request(`/spaces/${id}/members`),
  createSpace: (payload) => request("/spaces", { method: "POST", body: payload }),
  joinSpace: (id) => request(`/spaces/${id}/join`, { method: "POST" }),
  leaveSpace: (id) => request(`/spaces/${id}/leave`, { method: "POST" }),

  listPosts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/posts${qs ? `?${qs}` : ""}`);
  },
  createPost: (formData) => request("/posts", { method: "POST", body: formData, isForm: true }),
  deletePost: (id) => request(`/posts/${id}`, { method: "DELETE" }),
  reportPost: (id, reason) => request(`/posts/${id}/report`, { method: "POST", body: { reason } }),
  toggleLike: (id) => request(`/posts/${id}/like`, { method: "POST" }),
  toggleSave: (id) => request(`/posts/${id}/save`, { method: "POST" }),
  getComments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, text) => request(`/posts/${id}/comments`, { method: "POST", body: { text } }),

  listNotifications: () => request("/notifications"),
  markAllNotifsRead: () => request("/notifications/read-all", { method: "POST" }),

  listConversations: () => request("/conversations"),
  startConversation: (userId) => request("/conversations/start", { method: "POST", body: { userId } }),
  getMessages: (convoId) => request(`/conversations/${convoId}/messages`),
  sendMessage: (convoId, text) => request(`/conversations/${convoId}/messages`, { method: "POST", body: { text } }),
  sendMessageMedia: (convoId, formData) => request(`/conversations/${convoId}/messages`, { method: "POST", body: formData, isForm: true }),
  reactMessage: (convoId, msgId, emoji) => request(`/conversations/${convoId}/messages/${msgId}/react`, { method: "POST", body: { emoji } }),
};

export function mediaUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${BASE_URL.replace(/\/api$/, "")}${pathOrUrl}`;
}