import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "../utils/auth";

const API_URL = "http://127.0.0.1:8000";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    try {
      if (isLoggedIn()) {
        navigate("/canvas", { replace: true });
      }
    } catch (e) {
      console.error(e);
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const res = await fetch(`${API_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      // Save token
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("username", username);

      // Redirect
      navigate("/canvas", { replace: true });

    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Login</button>
      </form>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}