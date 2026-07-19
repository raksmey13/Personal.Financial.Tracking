import React, { useState } from 'react';
import { FaUser, FaEnvelope, FaLock, FaUserPlus } from 'react-icons/fa';
import { userAPI } from '../API/index'; // Ensure this points to your index.js file

const Signup = ({ onSwitchToLogin, onSignupSuccess }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Password validation guard clause
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-verify entry values.");
      return;
    }

    setLoading(true);

    try {
      // 🚀 REAL REGISTRATION PIPELINE: Calls your FastAPI backend via the fixed /users/signup router
      await userAPI.signup({
        username: username, // 🟢 FIXED: Sends raw string matching SignupRequest Pydantic model
        email: email,
        password: password
      });

      console.log("Successfully generated master account for:", username, email);

      // Switches view layout to login screen only after successful backend response
      onSignupSuccess();
      setLoading(false);

    } catch (err) {
      // Catch errors from the server (like email already taken)
      setError(err.response?.data?.detail || "Registration failed. Account might already exist.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full space-y-6">

        {/* Header Block */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Create Your Account</h2>
          <p className="text-xs text-gray-400 font-semibold">Join NetStream to begin tracking personal ledger metrics</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field Input Line */}
          <div className="relative">
            <FaUser className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="text"
              required
              placeholder="Full Name / Handle"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Email Input Line */}
          <div className="relative">
            <FaEnvelope className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="email"
              required
              placeholder="Valid Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Master Password Input Line */}
          <div className="relative">
            <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="password"
              required
              placeholder="Choose Secure Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Confirm Password Input Line */}
          <div className="relative">
            <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
            <input
              type="password"
              required
              placeholder="Confirm Chosen Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FaUserPlus />
            {loading ? "Registering Credentials..." : "Generate Master Account"}
          </button>
        </form>

        {/* Dynamic Route Switcher Footer */}
        <div className="text-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-blue-600 font-bold hover:underline cursor-pointer"
          >
            Sign In Instead
          </button>
        </div>

      </div>
    </div>
  );
};

export default Signup;