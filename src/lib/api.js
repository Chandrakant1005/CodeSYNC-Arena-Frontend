import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:5000/api");

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

export default api;
