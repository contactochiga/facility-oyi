import axios from "axios";

export const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json", "X-Ochiga-Surface": "facility" },
  timeout: 90000,
});

API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("oyi_facility_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers["Authorization"] = `Bearer ${token}`;
      config.headers["X-Oyi-Contract-Version"] = "ochiga.tier1.2026-05-16";
    }
  }
  return config;
});

export default API;
