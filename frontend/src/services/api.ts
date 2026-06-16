// Updated api.ts
import axios from 'axios';

export const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "/api"
    : "https://virtual-ai-debate.onrender.com");

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const signup = async (name: string, email: string, password: string, confirmPassword: string) => {
  try {
    const response = await api.post("/signup", {
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    return response.data as { user: { name: string; email: string; profile_picture: string } };
  } catch (error: any) {
    throw error.response?.data || { error: error.code === "ECONNABORTED" ? "Signup request timed out. Please try again." : "Signup failed" };
  }
};

export const login = async (email: string, password: string) => {
  try {
    const response = await api.post("/login", {
      email,
      password,
    });
    return response.data as { user: { name: string; email: string; profile_picture: string } };
  } catch (error: any) {
    throw error.response?.data || { error: "Login failed" };
  }
};

export const getDebateTip = async () => {
  try {
    const response = await api.get("/debate");
    return response.data as { tip: string };
  } catch (error: any) {
    throw error.response?.data || { error: "Failed to fetch tip" };
  }
};
