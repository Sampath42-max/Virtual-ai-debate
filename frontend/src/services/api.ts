import axios from "axios";

declare const __API_BASE_URL__: string; // Injected via vite.config.ts

// Axios instance with baseURL
const api = axios.create({
  baseURL: `${__API_BASE_URL__}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add JWT to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Signup API call
export const signup = async (name: string, email: string, password: string, confirmPassword: string) => {
  try {
    const response = await api.post("/signup", {
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  } catch (error: any) {
    const err = error?.response?.data || { error: "Signup failed", message: "Please try again." };
    throw { error: err.error || "Signup failed", message: err.message || "Please try again." };
  }
};

// Login API call
export const login = async (email: string, password: string) => {
  try {
    const response = await api.post("/login", {
      email,
      password,
    });
    return response.data;
  } catch (error: any) {
    const err = error?.response?.data || { error: "Login failed", message: "Check your credentials." };
    throw { error: err.error || "Login failed", message: err.message || "Check your credentials." };
  }
};

// Profile fetch
export const getProfile = async () => {
  try {
    const response = await api.post("/profile", {});
    return response.data;
  } catch (error: any) {
    const err = error?.response?.data || { error: "Failed to load profile", message: "Please try again." };
    throw { error: err.error || "Failed to load profile", message: err.message || "Please try again." };
  }
};

// Debate AI response
export const getDebateResponse = async (message: string, topic: string, stance: string, level: string) => {
  try {
    const response = await api.post("/debate/response", {
      message,
      topic,
      stance,
      level,
    });
    return response.data;
  } catch (error: any) {
    const err = error?.response?.data || { error: "Failed to generate AI response", message: "Please try again." };
    throw { error: err.error || "Failed to generate AI response", message: err.message || "Please try again." };
  }
};

// Complete Debate
export const completeDebate = async () => {
  try {
    const response = await api.post("/debate/complete", {});
    return response.data;
  } catch (error: any) {
    const err = error?.response?.data || { error: "Failed to complete debate", message: "Please try again." };
    throw { error: err.error || "Failed to complete debate", message: err.message || "Please try again." };
  }
};

// Audio fetch (direct URL)
export const getAudioUrl = (filename: string) => {
  return `${__API_BASE_URL__}/api/debate/audio/${filename}`;
};