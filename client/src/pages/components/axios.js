import axios from 'axios';

const API = axios.create({
    baseURL: 'https://your-railway-url.app/api', // Replace with your URL
});

// The "Security Guard"
API.interceptors.response.use(
    (response) => response, 
    (error) => {
        // If the backend sends 401 (Expired or No Token)
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('user'); // Clear the local storage
            
            // Redirect to login page and add a message to the URL
            window.location.href = '/login?error=expired';
        }
        return Promise.reject(error);
    }
);

export default API;
