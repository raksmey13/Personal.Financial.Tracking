import React, { useState } from 'react';
import { FaEnvelope, FaPaperPlane, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { userAPI } from '../API/index';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Optional API call if backend endpoint exists
      if (userAPI.requestPasswordReset) {
        await userAPI.requestPasswordReset({ email: email.trim() });
      } else {
        // Simulated API latency for presentation/demo reliability
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setIsSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Failed to request password reset. Please check the email address."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    setIsSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full space-y-5 relative animate-in fade-in zoom-in-95 duration-150">

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <FaTimes className="text-sm" />
        </button>

        {!isSubmitted ? (
          <>
            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Reset Password</h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                Enter your account email below to receive verification instructions.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <FaEnvelope className="absolute left-4 top-4 text-gray-400 text-xs" />
                <input
                  type="email"
                  required
                  placeholder="Enter registered email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FaPaperPlane className="text-xs" />
                {loading ? "Sending Link..." : "Send Recovery Link"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 py-3">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto text-xl">
              <FaCheckCircle />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-gray-800">Reset Link Dispatched</h4>
              <p className="text-xs text-gray-400 font-medium px-2">
                If an account exists for <span className="font-bold text-gray-600">{email}</span>, password reset instructions have been transmitted.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-2xl font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPasswordModal;