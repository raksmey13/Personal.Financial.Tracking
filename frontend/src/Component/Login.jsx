import React, { useState } from 'react';
import { FaEnvelope, FaLock, FaSignInAlt } from 'react-icons/fa';

const Login = ({ onSwitchToSignup, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState(""); // 🚀 CHANGED: Can hold either Email or Username string
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🚀 MOCK AUTH RESPONSE: Simulates a secure backend verification window
      setTimeout(() => {
        console.log("Authenticating session credentials for:", identifier);

        const mockJwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockTokenData";

        // 🟢 FIXED TRIGGER: Instantly mounts the main dashboard layout workspace via App.jsx
        onLoginSuccess(mockJwtToken);
        setLoading(false);
      }, 1000);

    } catch (err) {
      setError(err.response?.data?.detail || "Invalid login credentials. Please verify data entry.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full space-y-6">

        {/* Header Block */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Welcome Back to NetStream</h2>
          <p className="text-xs text-gray-400 font-semibold">Enter your account details to access your secure ledger metrics</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity Field Input Box (Handles Email or Username entry values seamlessly) */}
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

          {/* Password Input Line */}
          <div className="relative">
            <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="password"
              required
              placeholder="Account Access Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FaSignInAlt />
            {loading ? "Authenticating Session..." : "Sign In to Dashboard"}
          </button>
        </form>

        {/* Dynamic Route Switcher Footer */}
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
    </div>
  );
};

export default Login;