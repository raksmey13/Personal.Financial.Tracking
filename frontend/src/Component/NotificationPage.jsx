import React from "react";
import { FaBell, FaTrashAlt, FaCheckSquare, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";

const NotificationPage = ({ notifications, setNotifications }) => {

  const handleClearSingle = async (id) => {
    try {
      // 🟢 UPDATED: Matches your @router.put("/{notification_id}/read") path architecture
      const response = await fetch(`http://127.0.0.1:8000/notifications/${id}/read`, {
        method: "PUT",
      });

      if (response.ok) {
        // Drop it out of the active view collection once marked as read
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } else {
        console.error("Backend database failed to update notification status item.");
      }
    } catch (error) {
      console.error("Network error while trying to update read state:", error);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl text-xl">
            <FaBell />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">Notification Center</h2>
            <p className="text-xs font-semibold text-gray-400">Review and manage your system and budget alerts</p>
          </div>
        </div>
      </div>

      {/* Main List Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-sm font-medium text-gray-400">
            🎉 All caught up! You have no notifications.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-5 hover:bg-gray-50/40 transition-colors flex justify-between items-center gap-4">
                <div className="flex items-start gap-4">

                  {/* 🟢 FIXED: Check notif.notification_type instead of undefined notif.type */}
                  <div className={`mt-0.5 text-base ${notif.notification_type === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {notif.notification_type === 'warning' ? <FaExclamationTriangle /> : <FaCheckCircle />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-gray-800 tracking-tight">{notif.title}</span>
                      <span className="text-[10px] font-bold text-gray-300">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-500 leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleClearSingle(notif.id)}
                  className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                  title="Mark as Read"
                >
                  <FaCheckSquare size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPage;