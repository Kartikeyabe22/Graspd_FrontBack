import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isLoggedIn } from "../utils/auth";
import styles from "./AuthPage.module.css";

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
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          graspd
        </div>
        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.subtitle}>Set up your space and start building on the canvas.</p>

        <form className={styles.form} onSubmit={handleRegister}>
          <label className={styles.fieldLabel} htmlFor="register-username">Username</label>
          <input
            id="register-username"
            className={styles.input}
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label className={styles.fieldLabel} htmlFor="register-password">Password</label>
          <input
            id="register-password"
            className={styles.input}
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className={styles.primaryBtn}>Register</button>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerText}>
          Already have an account?{' '}
          <Link to="/login" className={styles.link}>Login</Link>
        </div>
      </div>
    </div>
  );
}