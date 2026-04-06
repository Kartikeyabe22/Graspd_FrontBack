import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isLoggedIn } from "../utils/auth";

const API_URL = "http://127.0.0.1:8000";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      navigate("/login", { replace: true });
    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f6f8fa"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        padding: "40px 32px 28px 32px",
        width: 340,
        maxWidth: "90vw"
      }}>
        <h2 style={{
          marginBottom: 24,
          fontWeight: 700,
          fontSize: 28,
          color: "#222"
        }}>Register</h2>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: 16,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 16
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: 20,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 16
            }}
          />
          <button type="submit" style={{
            width: "100%",
            background: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "12px 0",
            fontWeight: 600,
            fontSize: 17,
            cursor: "pointer",
            marginBottom: 8,
            boxShadow: "0 2px 8px rgba(34,197,94,0.10)",
            transition: "background 0.15s"
          }}>Register</button>
        </form>
        {error && <div style={{
          color: "#e11d48",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          padding: "8px 12px",
          marginTop: 8,
          marginBottom: 8,
          fontSize: 15
        }}>{error}</div>}
        <div style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 15,
          color: "#666"
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{
            color: "#22c55e",
            textDecoration: "none",
            fontWeight: 600
          }}>Login</Link>
        </div>
      </div>
    </div>
  );
}