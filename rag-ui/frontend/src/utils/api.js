// Detect if we're running behind the code-server /proxy/{port}/ prefix
// In that case the browser can reach the backend via /proxy/3001/api/...
// In direct access (localhost:3000) it can reach /api/... via Vite proxy

const isProxied = window.location.pathname.startsWith("/proxy/");
export const API_BASE = isProxied ? "/proxy/3001" : "";
