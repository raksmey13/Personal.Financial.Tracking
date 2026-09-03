import React, { useState } from 'react';
import { FaEnvelope, FaPaperPlane, FaTimes, FaCheckCircle, FaKey, FaLock } from 'react-icons/fa';
import API, { userAPI } from '../API/index';
import { useTranslation } from 'react-i18next';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Step 1: Request OTP | Step 2: Input OTP & New Password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // STEP 1: Send OTP to Email
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (userAPI.requestPasswordReset) {
        await userAPI.requestPasswordReset({ email: email.trim() });
      } else if (userAPI.forgotPassword) {
        await userAPI.forgotPassword({ email: email.trim() });
      } else {
        await API.post('/users/forgot-password', { email: email.trim() });
      }
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        t("auth.reset_failed_error")
      );
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP & Change Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (userAPI.resetPassword) {
        await userAPI.resetPassword({
          email: email.trim(),
          otp_code: otpCode.trim(),
          new_password: newPassword,
        });
      } else {
        await API.post('/users/reset-password', {
          email: email.trim(),
          otp_code: otpCode.trim(),
          new_password: newPassword,
        });
      }
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setOtpCode("");
    setNewPassword("");
    setError("");
    setStep(1);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full space-y-5 relative animate-in fade-in zoom-in-95 duration-150">

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <FaTimes className="text-sm" />
        </button>

        {!isSuccess ? (
          <>
            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">
                {step === 1 ? t("auth.reset_password_title") : "Enter OTP Code"}
              </h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                {step === 1
                  ? t("auth.reset_password_subtitle")
                  : `Enter the 6-digit code sent to ${email} and your new password.`}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
                ⚠️ {error}
              </div>
            )}

            {step === 1 ? (
              /* FORM 1: Enter Email */
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-4 text-gray-400 text-xs" />
                  <input
                    type="email"
                    required
                    placeholder={t("auth.registered_email_placeholder")}
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
                  {loading ? t("auth.sending_link") : "Send Verification Code"}
                </button>
              </form>
            ) : (
              /* FORM 2: Enter OTP Code + New Password */
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="relative">
                  <FaKey className="absolute left-4 top-4 text-gray-400 text-xs" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="6-Digit OTP Code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 tracking-widest text-center"
                  />
                </div>

                <div className="relative">
                  <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Updating..." : "Reset Password"}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-center text-xs text-gray-400 hover:underline pt-1 cursor-pointer"
                >
                  Change Email
                </button>
              </form>
            )}
          </>
        ) : (
          /* SUCCESS SCREEN */
          <div className="text-center space-y-4 py-3">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto text-xl">
              <FaCheckCircle />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-gray-800">Password Updated!</h4>
              <p className="text-xs text-gray-400 font-medium px-2">
                Your password has been changed successfully. You can now log in.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-2xl font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer"
            >
              {t("auth.return_to_login")}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPasswordModal;