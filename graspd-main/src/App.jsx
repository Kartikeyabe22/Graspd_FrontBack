import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CanvasPage from './pages/CanvasPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import { isLoggedIn } from './utils/auth';

// 🔒 Protected Route
function ProtectedRoute({ children }) {
  const location = useLocation();

  let loggedIn = false;

  try {
    loggedIn = isLoggedIn();
  } catch (e) {
    console.error("Auth check failed:", e);
    loggedIn = false;
  }

  if (!loggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected route */}
        <Route
          path="/canvas"
          element={
            <ProtectedRoute>
              <CanvasPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}