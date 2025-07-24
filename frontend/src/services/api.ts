// Updated api.ts
import axios from 'axios';

// Prefer environment variable or fallback to '/api' for local proxy
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const signup = async (name: string, email: string, password: string, confirmPassword: string) => {
  try {
    const response = await axios.post(`${API_URL}/signup`, {
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    return response.data as { user: { name: string; email: string; profile_picture: string } };
  } catch (error: any) {
    throw error.response?.data || { error: "Signup failed" };
  }
};

export const login = async (email: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
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
    const response = await axios.get(`${API_URL}/debate`);
    return response.data as { tip: string };
  } catch (error: any) {
    throw error.response?.data || { error: "Failed to fetch tip" };
  }
};
