import axios from "axios";
import { appConfig } from "./config/appConfig";

const axiosInstance = axios.create({
  baseURL: appConfig.baseURL,
  timeout: 30000,

  // ✅ Only treat server failures as errors
  validateStatus: (status) => {
    return status < 500;
  },
});

/* =======================
   REQUEST INTERCEPTOR
======================= */
axiosInstance.interceptors.request.use(
  async (config) => {
    if (config.withToken) {
      try {
        // ✅ Web localStorage
        const token = localStorage.getItem("jwt_token");

        if (token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
          };
        }
      } catch (err) {
        console.warn("⚠ Unable to read token from localStorage:", err);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =======================
   RESPONSE INTERCEPTOR
======================= */
axiosInstance.interceptors.response.use(
  (response) => {
    const { status, data } = response;

    // Log business errors but do not throw them
    if (status >= 400) {
      const errorMessage =
        data?.responseMessage ||
        data?.message ||
        "Something went wrong";

      console.warn(`⚠ API Warning (${status}):`, errorMessage);

      if (status === 401) {
        console.warn("⚠ Unauthorized (401)");

        // ✅ Clear localStorage
        localStorage.clear();
      }

      if (status === 403) {
        console.warn("🚫 Forbidden (403)");
      }

      if (status === 404) {
        console.warn("❓ Resource not found (404)");
      }

      if (status === 409) {
        console.warn("⚠ Conflict (409)");
      }
    }

    return response;
  },

  (error) => {
    // Only server failures and network issues reach here
    if (error.response) {
      console.error("💥 Server Error:", error.response.status);
      console.error("Response:", error.response.data);
    } else if (error.request) {
      console.error("📡 Network Error: No response from API");
    } else {
      console.error("⚙ Axios Setup Error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;