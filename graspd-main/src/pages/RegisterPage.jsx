import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "../utils/auth";

const API_URL = "http://127.0.0.1:8000";

export default function RegisterPage() {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Registration failed");
        return;
      }

      // Go to login after success
      navigate("/login", { replace: true });

    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>

      <form onSubmit={handleRegister}>
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

        <button type="submit">Register</button>
      </form>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}