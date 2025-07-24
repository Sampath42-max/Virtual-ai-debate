import axios from 'axios';

// NOTE: API_URL uses the /api proxy. For production, set VITE_API_BASE_URL in your .env file and use it in fetch/axios calls if needed.
const API_URL = '/api'; // Proxy will handle the routing to http://localhost:5000

export const signup = async (name, email, password, confirmPassword) => {
  try {
    const response = await axios.post(`${API_URL}/signup`, {
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const getDebateTip = async () => {
  try {
    const response = await axios.get(`${API_URL}/debate`); // Note: Changed to /debate to match your backend route
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};
