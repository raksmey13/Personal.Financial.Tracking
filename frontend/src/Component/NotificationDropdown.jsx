import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCog,
  FaMoneyCheckAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaChartLine,
  FaLock,
  FaFolderOpen
} from "react-icons/fa";
import API from "../API/index";

const NotificationDropdown = () => {
  const navigate = useNavigate();

  // Local State
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const dropdownRef = useRef(null);

  // Fetch Notifications on Mount & Set Polling Interval
  const fetchNotifications = async () => {
    try {
      const response = await API.get('/notifications/');
      if (response && response.data) {
        setNotifications(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 15 seconds to catch real-time transaction & limit alerts
    const intervalId = setInterval(fetchNotifications, 15000);
    return () => clearInterval(intervalId);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeAgo = (dateString) => {
    if (!dateString) return "Just now";
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const handleMarkAsRead = async (id, entity_type, entity_id, e) => {
    if (e) e.stopPropagation();

    // Optimistic UI Update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    try {
      await API.put(`/notifications/${id}/read`);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }

    setIsOpen(false);

    // Dynamic Entity Routing
    if (entity_type === "budget") navigate(`/budget?highlight=${entity_id}`);
    else if (entity_type === "account") navigate(`/accounts?highlight=${entity_id}`);
    else if (entity_type === "transaction") navigate(`/transactions?highlight=${entity_id}`);
    else if (entity_type === "security") navigate(`/settings`);
    else navigate(`/accounts`);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    unreadIds.forEach(async (id) => {
      try {
        await API.put(`/notifications/${id}/read`);
      } catch (error) {
        console.error("Batch mark as read error:", error);
      }
    });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const displayedNotifications =
    activeTab === "inbox"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const renderAvatar = (notif) => {
    const type = notif.notification_type;
    const title = (notif.title || "").toLowerCase();

    if (title.includes("security") || title.includes("password")) {
      return (
        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
          <FaLock size={16} />
        </div>
      );
    }

    if (type === "danger") {
      return (
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          <FaExclamationTriangle size={16} />
        </div>
      );
    }

    if (type === "warning") {
      return (
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <FaChartLine size={16} />
        </div>
      );
    }

    if (type === "success") {
      return (
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <FaCheckCircle size={16} />
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <FaMoneyCheckAlt size={16} />
      </div>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-all cursor-pointer flex justify-center items-center"
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[440px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">

          {/* Header */}
          <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-gray-900 tracking-wide">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-black">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-between items-center px-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex gap-6 text-xs font-bold">
              <button
                onClick={() => setActiveTab("inbox")}
                className={`py-3 flex items-center gap-2 cursor-pointer transition-colors ${
                  activeTab === "inbox"
                    ? "text-blue-600 border-b-2 border-blue-600 font-extrabold"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                Inbox
                {unreadCount > 0 && (
                  <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("general")}
                className={`py-3 cursor-pointer transition-colors ${
                  activeTab === "general"
                    ? "text-blue-600 border-b-2 border-blue-600 font-extrabold"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                General Log
              </button>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="py-3 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              title="Notification Settings"
            >
              <FaCog size={15} />
            </button>
          </div>

          {/* Notification Items Stream */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {displayedNotifications.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-xs flex flex-col items-center gap-2 font-medium">
                <FaInfoCircle size={22} className="text-gray-300" />
                No unread notifications right now.
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={(e) =>
                    handleMarkAsRead(notif.id, notif.entity_type, notif.entity_id, e)
                  }
                  className={`flex gap-3.5 p-4 hover:bg-gray-50/80 cursor-pointer transition-colors relative group ${
                    !notif.is_read ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  {renderAvatar(notif)}

                  <div className="flex-1 pr-2">
                    <p className="text-xs text-gray-800 leading-relaxed break-words">
                      <strong className="font-extrabold text-gray-900 block mb-0.5">{notif.title}</strong>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>{timeAgo(notif.created_at)}</span>
                      <span>•</span>
                      <span>{notif.entity_type ? `${notif.entity_type} alert` : "System Log"}</span>
                    </div>

                    {notif.notification_type === "danger" && !notif.is_read && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id, null, null, e);
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-200 cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={(e) => handleMarkAsRead(notif.id, notif.entity_type, notif.entity_id, e)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 cursor-pointer shadow-sm"
                        >
                          Review Target
                        </button>
                      </div>
                    )}
                  </div>

                  {!notif.is_read && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-2"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;