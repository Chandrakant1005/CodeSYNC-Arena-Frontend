import axios from "axios";

function normalizeApiBaseUrl(rawUrl) {
  const trimmedUrl = rawUrl?.trim();

  if (!trimmedUrl) {
    return "";
  }

  return trimmedUrl.endsWith("/api") ? trimmedUrl : `${trimmedUrl.replace(/\/+$/, "")}/api`;
}

const apiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000")
);

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

export default api;
