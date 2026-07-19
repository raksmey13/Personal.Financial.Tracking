import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import TransactionForm from "./Component/Transaction";
import CategoryForm from "./Component/CategoryForm";
import AccountPage from "./Component/Account";
import Dashboard from "./Component/Overview";
import BudgetPage from "./Component/Budget";
import ExportImport from "./Component/ExportImport";
import CalendarPage from "./Component/Calendar";
import Settings from "./Component/Setting";
import AnalyticsReport from "./Component/Report";
import Profile from "./Component/Profile";
import NotificationPage from "./Component/NotificationPage";
import Login from "./Component/Login";
import Signup from "./Component/Signup";

// 🚀 IMPORT YOUR LOGO ASSET
import logoImg from "./assets/Applogo.png";

import "./index.css";
import {
  FaThLarge, FaExchangeAlt, FaChartPie, FaRegAddressCard,
  FaWallet, FaChartBar, FaFileImport, FaCalendarAlt,
  FaCog, FaChevronRight, FaSignOutAlt, FaBell
} from "react-icons/fa";

// --- 1. Sidebar Component ---
const Sidebar = ({ onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { name: "Dashboard", icon: <FaThLarge />, path: "/" },
    { name: "Transaction", icon: <FaExchangeAlt />, path: "/transaction" },
    { name: "Category", icon: <FaChartPie />, path: "/category" },
    { name: "Accounts", icon: <FaRegAddressCard />, path: "/accounts" },
    { name: "Budget", icon: <FaWallet />, path: "/budget" },
    { name: "Analytic", icon: <FaChartBar />, path: "/analytic" },
  ];

  const footerItems = [
    {
      name: "Import/Export",
      icon: <FaFileImport />,
      path: "#",
      isDropdown: true,
      subItems: [
        { name: "Export PDF", path: "/export-pdf" },
        { name: "Export CSV", path: "/export-csv" },
        { name: "Import CSV/XLSX", path: "/import" },
      ]
    },
    { name: "Calendar", icon: <FaCalendarAlt />, path: "/calendar" },
    { name: "Settings", icon: <FaCog />, path: "/settings" },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path ||
                     (item.subItems?.some(sub => location.pathname === sub.path)) ||
                     (item.path === "/" && location.pathname === "/dashboard");

    if (item.isDropdown) {
      return (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setIsImportOpen(!isImportOpen)}
            className={`w-full flex items-center px-6 py-3 transition-colors text-xs font-bold ${
              isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="text-base min-w-[24px]">{item.icon}</span>
            {!isCollapsed && (
              <div className="flex justify-between items-center w-full ml-3.5">
                <span className="tracking-tight">{item.name}</span>
                <FaChevronRight size={10} className={`transition-transform ${isImportOpen ? "rotate-90" : ""}`} />
              </div>
            )}
          </button>

          {isImportOpen && !isCollapsed && (
            <div className="bg-gray-50/50 py-1.5 space-y-0.5">
              {item.subItems.map((sub) => (
                <Link
                  key={sub.path}
                  to={sub.path}
                  className={`block pl-16 py-2 text-xs font-semibold transition-colors ${
                    location.pathname === sub.path ? "text-blue-600 font-bold" : "text-gray-400 hover:text-blue-500"
                  }`}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        to={item.path}
        className={`flex items-center px-6 py-3 transition-all text-xs font-bold ${
          isActive
            ? "text-blue-600 border-l-4 border-blue-600 bg-blue-50/50 rounded-l-none"
            : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className="text-base min-w-[24px]">{item.icon}</span>
        {!isCollapsed && (
          <div className="flex justify-between items-center w-full ml-3.5">
            <span className="tracking-tight">{item.name}</span>
          </div>
        )}
      </Link>
    );
  };

  return (
    <aside className={`${isCollapsed ? "w-20" : "w-64"} h-screen bg-white border-r border-gray-100 flex flex-col justify-between sticky top-0 transition-all duration-300 flex-shrink-0 z-50`}>
      <div>
        <div className="p-6 flex items-center gap-3 h-20">
          <img
            src={logoImg}
            alt="PFTrack Logo"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          {!isCollapsed && <span className="text-xl font-black text-gray-800 tracking-tight">PFTrack</span>}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm z-50 cursor-pointer"
        >
          {isCollapsed ? <FaChevronRight size={10} /> : <FaChevronRight className="rotate-180" size={10} />}
        </button>

        <nav className="flex-1 mt-4 overflow-y-auto">
          {menuItems.map((item) => <NavItem key={item.name} item={item} />)}
          <div className="my-4 border-t border-gray-100 mx-4"></div>
          {footerItems.map((item) => <NavItem key={item.name} item={item} />)}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100 space-y-3 bg-white">
        <div className="flex items-center justify-between px-2">
          {!isCollapsed && <span className="text-xs font-bold text-gray-400">Dark Mode</span>}
          <div
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-9 h-5 rounded-full relative cursor-pointer p-0.5 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl text-xs font-bold border border-gray-100 transition-all cursor-pointer"
        >
          <FaSignOutAlt /> {!isCollapsed && "Sign Out Session"}
        </button>
      </div>
    </aside>
  );
};

// --- 2. Navbar Component ---
const Navbar = ({ unreadCount }) => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return "Dashboard Panel";
    if (path === "/transaction") return "Transactions";
    if (path === "/category") return "Category";
    if (path === "/accounts") return "Accounts";
    if (path === "/budget") return "Budget";
    if (path === "/analytic") return "Analytical";
    if (path === "/notifications") return "Notification Logs";
    if (path === "/export-pdf") return "Export PDF";
    if (path === "/export-csv") return "Export CSV";
    if (path === "/import") return "CSV Data";
    if (path === "/calendar") return "Calendar";
    if (path === "/settings") return "System Setting";
    if (path === "/profile") return "User Profile Settings";
    return "PFTrack Portal";
  };

  return (
    <header className="bg-white border-b border-gray-100 h-20 px-8 flex justify-between items-center sticky top-0 z-40 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase font-black tracking-widest text-gray-300">PFTrack</span>
        <span className="text-gray-300 text-xs font-normal">/</span>
        <h1 className="text-base font-black text-gray-800 tracking-tight capitalize">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <Link
          to="/notifications"
          className="relative text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1"
        >
          {unreadCount > 0 && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></div>
          )}
          <FaBell className="text-lg" />
        </Link>

        <Link to="/profile">
          <img
            src="https://ui-avatars.com/api/?name=User+Profile&background=random"
            alt="User Profile"
            className="w-9 h-9 rounded-full border border-gray-200 hover:brightness-90 transition-all cursor-pointer shadow-xs object-cover"
          />
        </Link>
      </div>
    </header>
  );
};

// --- 3. Main App Export ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [authView, setAuthView] = useState("login"); // 🟢 FIXED: Brought back missing auth state
  const [notifications, setNotifications] = useState([]);

  // 1. Define the fetch logic as a reusable function
  const loadNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch("http://127.0.0.1:8000/notifications/?user_id=1");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Error refreshing notifications:", error);
    }
  };

  // 2. Initial load
  useEffect(() => {
    loadNotifications();
  }, [token]);

  // Global keyboard listener guard that bypasses layout shortcuts while typing
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      const activeTag = e.target.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.key.toLowerCase() === 'b') {
        console.log("Budget shortcut caught safely outside of inputs.");
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const handleLoginSuccess = (receivedToken) => {
    localStorage.setItem("token", receivedToken);
    setToken(receivedToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthView("login");
  };

  return (
    <Router>
      {!token ? (
        authView === "login" ? (
          <Login onSwitchToSignup={() => setAuthView("signup")} onLoginSuccess={handleLoginSuccess} />
        ) : (
          <Signup onSwitchToLogin={() => setAuthView("login")} onSignupSuccess={() => setAuthView("login")} />
        )
      ) : (
        <div className="flex min-h-screen bg-[#F8F9FD] font-sans antialiased selection:bg-blue-500/10">
          <Sidebar onLogout={handleLogout} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Navbar unreadCount={notifications.filter(n => !n.is_read).length} />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* 🟢 FIXED: Safely mounted with the correct notification refresh callback */}
                <Route
                  path="/transaction"
                  element={
                    <TransactionForm
                      categories={[]}
                      accounts={[]}
                      onTransactionSuccess={loadNotifications}
                      closeModal={() => {}}
                    />
                  }
                />

                <Route path="/category" element={<CategoryForm />} />
                <Route path="/accounts" element={<AccountPage />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route
                  path="/notifications"
                  element={<NotificationPage notifications={notifications} setNotifications={setNotifications} />}
                />

                <Route path="/analytic" element={<AnalyticsReport />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/export-pdf" element={<ExportImport mode="pdf" />} />
                <Route path="/export-csv" element={<ExportImport mode="csv" />} />
                <Route path="/import" element={<ExportImport mode="import" />} />
                <Route path="/settings" element={<Settings />}/>
                <Route path="/calendar" element={<CalendarPage />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </Router>
  );
}