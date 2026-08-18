import React, { useState } from 'react';
import { FaEnvelope, FaLock, FaSignInAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { userAPI } from '../API/index';
import ForgotPasswordModal from './ForgotPasswordModal';

const Login = ({ onSwitchToSignup, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await userAPI.login({
        identifier: identifier.trim(),
        password: password
      });

      const token = response.data?.access_token || response.access_token;

      if (!token) {
        throw new Error("No authentication token returned from server.");
      }

      localStorage.setItem("token", token);

      // 🟢 FIX: Use direct fetch to guarantee the brand new token is sent in the headers
      const backendUrl = import.meta.env.VITE_API_BASE_URL || "https://personal-financial-tracking.onrender.com";
      const profileRes = await fetch(`${backendUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await profileRes.json();

      alert("Login successful! Welcome To PFTrack.");

      // Pass both to App.jsx
      if (onLoginSuccess) {
        onLoginSuccess(token, userData);
      }

    } catch (err) {
      console.error("Login authentication error:", err);
      setError(
        err.response?.data?.detail ||
        err.message ||
        "Invalid login credentials. Please verify data entry."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full space-y-6">

        {/* Header Block */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Welcome to PFTrack</h2>
          <p className="text-xs text-gray-400 font-semibold">Enter your account details to access your secure ledger metrics</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <FaEnvelope className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="text"
              required
              placeholder="Email Address or Username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Account Access Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
              </button>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FaSignInAlt />
            {loading ? "Authenticating Session..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-400">
          New to the platform?{" "}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-blue-600 font-bold hover:underline cursor-pointer"
          >
            Create an Account
          </button>
        </div>

      </div>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
      />
    </div>
  );
};

export default Login;