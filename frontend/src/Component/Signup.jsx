import React, { useState } from 'react';
import { FaUser, FaEnvelope, FaLock, FaUserPlus, FaEye, FaEyeSlash, FaCheck, FaKey, FaArrowLeft, FaRedo } from 'react-icons/fa';
import { userAPI } from '../API/index';

const Signup = ({ onSwitchToLogin }) => {
  // Step State: 1 = Registration Form, 2 = 6-Digit OTP Entry Form
  const [step, setStep] = useState(1);

  // Form Input States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP Input State
  const [otpCode, setOtpCode] = useState("");

  // UI Toggle & Feedback States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Dynamic Password Strength Calculator
  const calculateStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = calculateStrength(password);

  const getStrengthLabel = () => {
    if (!password) return { text: "", color: "bg-gray-200" };
    if (strength <= 1) return { text: "Weak Password", color: "bg-red-500", textCol: "text-red-500" };
    if (strength === 2 || strength === 3) return { text: "Moderate Password", color: "bg-amber-500", textCol: "text-amber-500" };
    return { text: "Strong Password", color: "bg-emerald-500", textCol: "text-emerald-500" };
  };

  // 🚀 STEP 1: SUBMIT ACCOUNT CREATION
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify entry values.");
      return;
    }

    setLoading(true);

    try {
      await userAPI.signup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: password
      });

      setSuccessMsg(`Account created! A 6-digit OTP code has been sent to ${email}. Please check your inbox.`);
      setStep(2);

    } catch (err) {
      console.error("Signup submission error:", err);
      const serverDetail = err.response?.data?.detail;
      if (typeof serverDetail === 'string') {
        setError(serverDetail);
      } else if (Array.isArray(serverDetail)) {
        setError(serverDetail[0]?.msg || "Invalid registration input parameters.");
      } else {
        setError("Registration failed. Please check your inputs and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 🚀 STEP 2: SUBMIT 6-DIGIT OTP VERIFICATION
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!otpCode || otpCode.trim().length < 6) {
      setError("Please enter a valid 6-digit OTP code.");
      return;
    }

    setLoading(true);

    try {
      const response = await userAPI.verifyOTP({
        email: email.trim(),
        otp_code: otpCode.trim()
      });

      alert(response.data?.message || "Account verified successfully! Redirecting to login.");
      onSwitchToLogin();

    } catch (err) {
      console.error("OTP verification error:", err);
      setError(
        err.response?.data?.detail ||
        "Invalid OTP code. Please check the code and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // 🚀 STEP 2: RESEND OTP ACTION
  const handleResendOtp = async () => {
    setError("");
    setSuccessMsg("");
    setResendLoading(true);

    try {
      const response = await userAPI.resendOTP({
        email: email.trim()
      });

      setSuccessMsg(response.data?.message || "A new OTP has been sent to your email.");
    } catch (err) {
      console.error("Resend OTP error:", err);
      setError(
        err.response?.data?.detail ||
        "Failed to resend OTP. Please try again."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const strengthInfo = getStrengthLabel();

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full space-y-6">

        {/* Header Block */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            {step === 1 ? "Create Your Account" : "Verify Account OTP"}
          </h2>
          <p className="text-xs text-gray-400 font-semibold">
            {step === 1
              ? "Join PFTrack to begin tracking personal finances"
              : `Enter the 6-digit OTP code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-500 text-center">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-600 text-center break-all">
            ✅ {successMsg}
          </div>
        )}

        {/* ================= STEP 1: ACCOUNT REGISTRATION FORM ================= */}
        {step === 1 && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">

            {/* First Name & Last Name Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FaUser className="absolute left-4 top-4 text-gray-400 text-xs" />
                <input
                  type="text"
                  required
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
                />
              </div>

              <div className="relative">
                <FaUser className="absolute left-4 top-4 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Email Address */}
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

            {/* Password with Strength Meter */}
            <div className="space-y-1.5">
              <div className="relative">
                <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Choose Secure Password"
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

              {password && (
                <div className="space-y-1 pt-1">
                  <div className="flex h-1.5 w-full bg-gray-100 rounded-full overflow-hidden gap-1">
                    <div className={`h-full flex-1 transition-all duration-300 ${strength >= 1 ? strengthInfo.color : 'bg-gray-200'}`}></div>
                    <div className={`h-full flex-1 transition-all duration-300 ${strength >= 2 ? strengthInfo.color : 'bg-gray-200'}`}></div>
                    <div className={`h-full flex-1 transition-all duration-300 ${strength >= 3 ? strengthInfo.color : 'bg-gray-200'}`}></div>
                    <div className={`h-full flex-1 transition-all duration-300 ${strength >= 4 ? strengthInfo.color : 'bg-gray-200'}`}></div>
                  </div>
                  <p className={`text-[10px] font-bold text-right ${strengthInfo.textCol}`}>
                    {strengthInfo.text}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400 text-xs" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="Confirm Chosen Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
              </button>
              {confirmPassword && password === confirmPassword && (
                <FaCheck className="absolute right-10 top-3.5 text-emerald-500 text-xs" />
              )}
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaUserPlus />
              {loading ? "Registering Credentials..." : "Create Account & Send OTP"}
            </button>
          </form>
        )}

        {/* ================= STEP 2: 6-DIGIT OTP ENTRY FORM ================= */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="relative">
              <FaKey className="absolute left-4 top-4 text-gray-400 text-xs" />
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-Digit OTP Code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-center text-sm font-black tracking-widest placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading || resendLoading}
              className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/10 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaCheck />
              {loading ? "Verifying Code..." : "Verify OTP & Activate Account"}
            </button>

            {/* Back to Registration & Resend OTP Action Row */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); setSuccessMsg(""); }}
                className="py-2 text-gray-400 font-bold text-xs hover:text-gray-600 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FaArrowLeft /> Back
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendLoading || loading}
                className="py-2 text-blue-600 font-bold text-xs hover:underline transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <FaRedo className={`${resendLoading ? "animate-spin" : ""}`} />
                {resendLoading ? "Sending..." : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {/* Switch Route Footer */}
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