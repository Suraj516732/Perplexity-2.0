// Central API config — change NEXT_PUBLIC_API_URL in .env.local to switch between local/prod
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export default API;
