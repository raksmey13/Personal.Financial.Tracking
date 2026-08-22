import React, { useState, useEffect, useRef } from 'react';
import { FaUser, FaEnvelope, FaLock, FaSave, FaCamera, FaKey } from 'react-icons/fa';
import { userAPI } from '../API/index';

const Profile = () => {
  // 💾 Core Database Cached Snapshots (Keeps your top avatar header stable while typing)
  const [dbSnapshot, setDbSnapshot] = useState({ firstName: "", lastName: "", email: "", avatarUrl: "" });

  // 📝 Active Form Input States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Password structural states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI Processing States
  const [infoMessage, setInfoMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  // 📸 Avatar Native File Explorer Ref Hook
  const fileInputRef = useRef(null);

  // --- CRUD: READ USER DETAILS ---
  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getProfile();

      const initialData = {
        firstName: response.data.first_name || "",
        lastName: response.data.last_name || "",
        email: response.data.email || "",
        avatarUrl: response.data.avatar_url || ""
      };

      setDbSnapshot(initialData);
      setFirstName(initialData.firstName);
      setLastName(initialData.lastName);
      setEmail(initialData.email);
    } catch (error) {
      console.error("Failed to fetch server profile details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((firstName || "PF") + ' ' + (lastName || ""))}&background=3B82F6&color=fff&size=128`;

  // --- CRUD: UPDATE PREFERENCES ---
  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    try {
      const response = await userAPI.updateProfile({
        first_name: firstName,
        last_name: lastName,
        email: email
      });

      setDbSnapshot(prev => ({
        ...prev,
        firstName: firstName,
        lastName: lastName,
        email: email
      }));

      setInfoMessage(`🟢 ${response.data.message || "Profile updated successfully!"}`);
    } catch (error) {
      setInfoMessage(`🔴 ${error.response?.data?.detail || "Failed to push update parameters."}`);
      console.error(error);
    }
    setTimeout(() => setInfoMessage(""), 3000);
  };

  // --- CRUD: UPDATE ACCESS PASSWORDS ---
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage("🔴 New passwords do not match.");
      return;
    }

    try {
      const response = await userAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setPasswordMessage(`🟢 ${response.data.message || "Access keys updated successfully!"}`);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordMessage(`🔴 ${error.response?.data?.detail || "Credential modification failed."}`);
    }
    setTimeout(() => setPasswordMessage(""), 3000);
  };

  // --- IMAGE UPLOAD FILE PICKER HANDLERS ---
  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setInfoMessage("📤 Uploading profile picture to server...");

      const response = await userAPI.uploadAvatar(formData);

      setAvatarError(false);
      setDbSnapshot(prev => ({
        ...prev,
        avatarUrl: response.data.avatar_url
      }));

      setInfoMessage("🟢 Profile avatar uploaded and committed cleanly!");
    } catch (error) {
      console.error("Avatar streaming file write error:", error);
      setInfoMessage("🔴 Upload pipeline failed. Verify network access.");
    }
    setTimeout(() => setInfoMessage(""), 4000);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F8F9FD] dark:bg-[#0B0F17] py-20 flex flex-col items-center justify-center space-y-3 transition-colors">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 dark:text-gray-500 font-semibold text-xs">Pulling master profile metrics...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F8F9FD] dark:bg-[#0B0F17] py-10 px-6 font-sans space-y-6 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Upper Profile Overview Header Badge */}
        <div className="bg-white dark:bg-[#151D2A] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-6 transition-colors">
          <div className="relative group">
            <img
              src={(!avatarError && dbSnapshot.avatarUrl) ? dbSnapshot.avatarUrl : fallbackAvatar}
              onError={() => setAvatarError(true)}
              alt="User Avatar"
              className="w-24 h-24 rounded-full border-2 border-gray-100 dark:border-gray-700 object-cover shadow-xs select-none"
            />
            <button
              type="button"
              onClick={handleCameraClick}
              className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md transition-all text-xs cursor-pointer border border-white dark:border-gray-800 flex items-center justify-center active:scale-90"
            >
              <FaCamera size={12} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight">
              {dbSnapshot.firstName || "Anonymous"} {dbSnapshot.lastName}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-400 font-semibold">{dbSnapshot.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold text-[10px] tracking-wider uppercase rounded-md border border-blue-100/30 dark:border-blue-900/40">
              Premium Ledger Tier
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card Block 1: Account Information Update */}
          <div className="bg-white dark:bg-[#151D2A] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 flex flex-col justify-between transition-colors">
            <form onSubmit={handleUpdateInfo} className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
                  <FaUser className="text-blue-500" /> Account Preferences
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">Update your profile identity handles and base credentials</p>

                {infoMessage && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-[11px] font-bold text-center rounded-2xl text-blue-600 dark:text-blue-400">
                    {infoMessage}
                  </div>
                )}

                <div className="space-y-4 mt-4">
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500 text-xs"><FaUser /></span>
                    <input
                      type="text"
                      required
                      placeholder="First Name / Handle"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500 text-xs"><FaUser /></span>
                    <input
                      type="text"
                      placeholder="Last Name (Optional)"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500 text-xs"><FaEnvelope /></span>
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/10 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <FaSave /> Save Changes
              </button>
            </form>
          </div>

          {/* Card Block 2: Security & Password Gateway Change */}
          <div className="bg-white dark:bg-[#151D2A] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 transition-colors">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
              <FaKey className="text-blue-500" /> Security Gateway
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">Change your credentials securely to block unauthorized entries</p>

            {passwordMessage && (
              <div className="p-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-[11px] font-bold text-center rounded-2xl text-blue-600 dark:text-blue-400">
                {passwordMessage}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 dark:text-gray-500 text-xs"><FaLock /></span>
                <input
                  type="password"
                  required
                  placeholder="Current Security Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all"
                />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 dark:text-gray-500 text-xs"><FaLock /></span>
                <input
                  type="password"
                  required
                  placeholder="New Secure Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all"
                />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 dark:text-gray-500 text-xs"><FaLock /></span>
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-gray-800 dark:bg-gray-700 text-white rounded-2xl font-bold text-xs hover:bg-gray-900 dark:hover:bg-gray-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <FaLock /> Update Access Keys
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;