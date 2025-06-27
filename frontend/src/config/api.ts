import axios from 'axios';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:3000';

// Create an axios instance with default configuration
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Export the base URL for use in other parts of the application
export const getApiUrl = () => API_URL; 