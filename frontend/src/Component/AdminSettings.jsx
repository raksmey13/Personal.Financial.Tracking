import React, { useState } from "react";
import { FaServer, FaTelegramPlane, FaSave, FaShieldAlt } from "react-icons/fa";

const AdminSettings = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowSignups, setAllowSignups] = useState(true);
  const [telegramBotActive, setTelegramBotActive] = useState(true);
  const [smtpStatus] = useState("Connected");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMessage("");

    setTimeout(() => {
      setSaving(false);
      setSavedMessage("System configurations updated successfully.");
      setTimeout(() => setSavedMessage(""), 3000);
    }, 800);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
          <FaShieldAlt className="text-blue-600" /> Platform System Settings
        </h1>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          Manage global server behavior, user onboarding rules, and third-party API integrations
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-xs font-bold text-green-600">
          ✅ {savedMessage}
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <FaServer className="text-gray-400" /> Platform Controls
          </h2>

          <div className="divide-y divide-gray-50">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Maintenance Mode</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  Temporarily lock non-admin user access for server updates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer ${
                  maintenanceMode ? "bg-red-500" : "bg-gray-200"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    maintenanceMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Allow New User Registrations</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  Enable or disable public account signups on the login gateway
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllowSignups(!allowSignups)}
                className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer ${
                  allowSignups ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    allowSignups ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <FaTelegramPlane className="text-gray-400" /> External Services
          </h2>

          <div className="divide-y divide-gray-50">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Telegram Receipt Processing Bot</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  Active webhook polling for incoming transaction photos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTelegramBotActive(!telegramBotActive)}
                className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer ${
                  telegramBotActive ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    telegramBotActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">SMTP Verification Mailer</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  Service state for delivering OTP signup codes via Gmail SMTP
                </p>
              </div>
              <span className="px-2.5 py-1 bg-green-50 text-green-600 border border-green-100 rounded-md text-xs font-bold">
                {smtpStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <FaSave />
            {saving ? "Saving Changes..." : "Save System Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;