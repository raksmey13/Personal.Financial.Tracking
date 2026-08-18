import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";

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
import Login from "./Component/Login";
import Signup from "./Component/Signup";
import NotificationDropdown from "./Component/NotificationDropdown";
import AdminDashboard from "./Component/AdminDashboard";
import AdminSettings from "./Component/AdminSettings";
import AIChatDrawer from "./Component/AIChatDrawer";

import logoImg from "./assets/Applogo.png";
import "./index.css";
import {
  FaThLarge, FaExchangeAlt, FaChartPie, FaRegAddressCard,
  FaWallet, FaChartBar, FaFileImport, FaCalendarAlt,
  FaCog, FaChevronRight, FaSignOutAlt, FaUserShield, FaMoon, FaSun
} from "react-icons/fa";

// --- 1. Sidebar Component ---
const Sidebar = ({ onLogout, currentUser, isDarkMode, setIsDarkMode }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const location = useLocation();

  const menuItems = currentUser?.is_admin
  ? [
      { name: "Admin Control", icon: <FaUserShield className="text-amber-500" />, path: "/admin" },
      { name: "Admin Settings", icon: <FaCog />, path: "/admin/settings" }
    ]
  : [
      { name: t("nav.dashboard"), icon: <FaThLarge />, path: "/" },
      { name: t("nav.transaction", "Transaction"), icon: <FaExchangeAlt />, path: "/transaction" },
      { name: t("nav.category", "Category"), icon: <FaChartPie />, path: "/category" },
      { name: t("nav.accounts", "Accounts"), icon: <FaRegAddressCard />, path: "/accounts" },
      { name: t("nav.budget", "Budget"), icon: <FaWallet />, path: "/budget" },
      { name: t("nav.analytics"), icon: <FaChartBar />, path: "/analytic" }
    ];

  const footerItems = currentUser?.is_admin
  ? []
  : [
      {
        name: t("nav.import_export", "Import/Export"),
        icon: <FaFileImport />,
        path: "#",
        isDropdown: true,
        subItems: [
          { name: t("nav.export_pdf", "Export PDF"), path: "/export-pdf" },
          { name: t("nav.export_csv", "Export CSV"), path: "/export-csv" },
          { name: t("nav.import_csv", "Import CSV/XLSX"), path: "/import" }
        ]
      },
      { name: t("nav.calendar"), icon: <FaCalendarAlt />, path: "/calendar" },
      { name: t("nav.settings"), icon: <FaCog />, path: "/settings" }
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
              isActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/50"
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
            <div className="bg-gray-50/50 dark:bg-slate-800/30 py-1.5 space-y-0.5">
              {item.subItems.map((sub) => (
                <Link
                  key={sub.path}
                  to={sub.path}
                  className={`block pl-16 py-2 text-xs font-semibold transition-colors ${
                    location.pathname === sub.path
                      ? "text-blue-600 dark:text-blue-400 font-bold"
                      : "text-gray-400 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400"
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
            ? "text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded-l-none"
            : "text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/50"
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
    <aside className={`${isCollapsed ? "w-20" : "w-64"} h-screen bg-white dark:bg-[#0f172a] border-r border-gray-100 dark:border-slate-800 flex flex-col justify-between sticky top-0 transition-colors duration-300 flex-shrink-0 z-50`}>
      <div>
        <div className="p-6 flex items-center gap-3 h-20">
          <img
            src={logoImg}
            alt="PFTrack Logo"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          {!isCollapsed && <span className="text-xl font-black text-gray-800 dark:text-white tracking-tight">PFTrack</span>}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm z-50 cursor-pointer"
        >
          {isCollapsed ? <FaChevronRight size={10} /> : <FaChevronRight className="rotate-180" size={10} />}
        </button>

        <nav className="flex-1 mt-4 overflow-y-auto">
          {menuItems.map((item) => <NavItem key={item.path} item={item} />)}

          {footerItems.length > 0 && (
            <>
              <div className="my-4 border-t border-gray-100 dark:border-slate-800 mx-4"></div>
              {footerItems.map((item) => <NavItem key={item.name} item={item} />)}
            </>
          )}
        </nav>
      </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 space-y-3 bg-white dark:bg-[#0f172a]">        <div className="flex items-center justify-between px-2">
          {!isCollapsed && (
            <span className="text-xs font-bold text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
              {isDarkMode ? <FaMoon className="text-blue-400" /> : <FaSun className="text-amber-500" />}
              {t("settings.dark_mode", "Dark Mode")}
            </span>
          )}
          <div
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-9 h-5 rounded-full relative cursor-pointer p-0.5 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 transition-all cursor-pointer"
        >
          <FaSignOutAlt /> {!isCollapsed && t("nav.sign_out", "Sign Out Session")}
        </button>
      </div>
    </aside>
  );
};

// --- 2. Navbar Component ---
const Navbar = ({ notifications, setNotifications, token, currentUser }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return t("nav.dashboard", "Dashboard Panel");
    if (path === "/admin") return "Superadmin Control Center";
    if (path === "/admin/settings") return "System Settings & Controls";
    if (path === "/transaction") return t("nav.transaction", "Transactions");
    if (path === "/category") return t("nav.category", "Category");
    if (path === "/accounts") return t("nav.accounts", "Accounts");
    if (path === "/budget") return t("nav.budget", "Budget");
    if (path === "/analytic") return t("nav.analytics", "Analytical");
    if (path === "/export-pdf") return t("nav.export_pdf", "Export PDF");
    if (path === "/export-csv") return t("nav.export_csv", "Export CSV");
    if (path === "/import") return t("nav.import_csv", "CSV Data");
    if (path === "/calendar") return t("nav.calendar", "Calendar");
    if (path === "/settings") return t("nav.settings", "System Setting");
    if (path === "/profile") return t("nav.profile", "User Profile Settings");
    return "PFTrack Portal";
  };

  return (
    <header className="bg-white dark:bg-[#0f172a] border-b border-gray-100 dark:border-slate-800 h-20 px-8 flex justify-between items-center sticky top-0 z-40 flex-shrink-0 transition-colors duration-300">      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase font-black tracking-widest text-gray-300 dark:text-slate-500">PFTrack</span>
        <span className="text-gray-300 dark:text-slate-600 text-xs font-normal">/</span>
        <h1 className="text-base font-black text-gray-800 dark:text-slate-100 tracking-tight capitalize">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <NotificationDropdown
          notifications={notifications}
          setNotifications={setNotifications}
          token={token}
        />

        <Link to="/profile" className="flex items-center gap-2">
          <img
            src={currentUser?.avatar_url || "https://ui-avatars.com/api/?name=User+Profile&background=random"}
            alt="User Profile"
            className="w-9 h-9 rounded-full border border-gray-200 dark:border-slate-700 hover:brightness-90 transition-all cursor-pointer shadow-xs object-cover"
          />
        </Link>
      </div>
    </header>
  );
};

// --- 3. Protected Admin Route Wrapper ---
const AdminRoute = ({ currentUser, children }) => {
  if (!currentUser) return null;
  if (!currentUser.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// --- 4. Main App Export ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [notifications, setNotifications] = useState([]);

  // 🟢 Global Dark Mode State (Persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
  const savedTheme = localStorage.getItem("theme");
  return savedTheme === "dark"; // Returns false by default if localStorage is empty
});

// 🟢 Apply or remove dark class directly on root <html>
useEffect(() => {
  if (isDarkMode) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}, [isDarkMode]);

  // Fetch Current User Details & Settings
  const fetchUserProfile = async (authToken) => {
    if (!authToken) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/users/me", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  useEffect(() => {
    if (!token) return;

    fetchUserProfile(token);

    fetch("http://127.0.0.1:8000/settings/", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (res.ok) return res.json();
      })
      .then((data) => {
        if (data && data.language) {
          i18n.changeLanguage(data.language);
        }
      })
      .catch((err) => console.error("Error fetching user settings:", err));
  }, [token]);

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch("http://127.0.0.1:8000/notifications/", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Error refreshing notifications:", error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [token]);

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

  const handleLoginSuccess = async (receivedToken, userData) => {
    localStorage.setItem("token", receivedToken);
    setToken(receivedToken);

    if (userData) {
      setCurrentUser(userData);

      if (userData.is_admin) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/";
      }

    } else {
      await fetchUserProfile(receivedToken);
      window.location.href = "/";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
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
        <div className="flex min-h-screen bg-[#F8F9FD] dark:bg-slate-950 font-sans antialiased selection:bg-blue-500/10 transition-colors duration-200">
          <Sidebar
            onLogout={handleLogout}
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Navbar
              notifications={notifications}
              setNotifications={setNotifications}
              token={token}
              currentUser={currentUser}
            />

            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route
                  path="/"
                  element={
                    !currentUser ? (
                      <div className="h-screen w-full flex items-center justify-center bg-[#F8F9FD] dark:bg-slate-950">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : currentUser.is_admin ? (
                      <Navigate to="/admin" replace />
                    ) : (
                      <Dashboard />
                    )
                  }
                />
                <Route path="/dashboard" element={<Dashboard />} />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute currentUser={currentUser}>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute currentUser={currentUser}>
                      <AdminSettings />
                    </AdminRoute>
                  }
                />

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
                <Route path="/analytic" element={<AnalyticsReport />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/export-pdf" element={<ExportImport mode="pdf" />} />
                <Route path="/export-csv" element={<ExportImport mode="csv" />} />
                <Route path="/import" element={<ExportImport mode="import" />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/calendar" element={<CalendarPage />} />
              </Routes>
            </main>

            <AIChatDrawer />
          </div>
        </div>
      )}
    </Router>
  );
}