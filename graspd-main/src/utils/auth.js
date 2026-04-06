// src/utils/auth.js
export function isLoggedIn() {
  try {
    return !!localStorage.getItem("access_token");
  } catch {
    return false;
  }
}

export function logout() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
  } catch {}
}
