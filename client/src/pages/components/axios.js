import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Response Interceptor: Catches 401 errors globally
API.interceptors.response.use(
    (response) => response, 
    (error) => {
        // If the backend sends 401 (Expired or No Token)
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('user'); 
            // Redirect with a flag so we can show a message on the login page
            window.location.href = '/login?error=expired';
        }
        return Promise.reject(error);
    }
);

export default API;
