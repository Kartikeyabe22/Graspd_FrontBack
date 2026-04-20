import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isLoggedIn } from "../utils/auth";
import styles from "./AuthPage.module.css";

const API_URL = "http://127.0.0.1:8000";

export default function LoginPage() {
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
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("username", username);
      navigate("/canvas", { replace: true });
    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          graspd
        </div>
        <h2 className={styles.title}>Sign In</h2>
        <p className={styles.subtitle}>Continue where your canvas left off.</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.fieldLabel} htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className={styles.input}
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label className={styles.fieldLabel} htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className={styles.input}
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className={styles.primaryBtn}>Login</button>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerText}>
          Don't have an account?{' '}
          <Link to="/register" className={styles.link}>Register</Link>
        </div>
      </div>
    </div>
  );
}