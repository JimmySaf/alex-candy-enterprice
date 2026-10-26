
import axios from "axios";

export const api = axios.create({
  baseURL: (
    import.meta.env.VITE_API_BASE_URL as string | undefined
  )?.trim() || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});
