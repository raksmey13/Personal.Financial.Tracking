import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaUsers, FaExchangeAlt, FaHourglassHalf, FaUserShield, FaUserSlash, FaUserCheck } from "react-icons/fa";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ total_users: 0, total_transactions: 0, total_pending_queue: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/admin/stats", getAuthHeaders()),
        axios.get("http://127.0.0.1:8000/admin/users", getAuthHeaders())
      ]);

      setStats(statsRes.data);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      console.error("Admin data fetch error:", err);
      setError(err.response?.data?.detail || "Failed to load admin panel. Ensure you have admin access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleActive = async (userId) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/admin/users/${userId}/toggle-active`, {}, getAuthHeaders());
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update user status.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-semibold text-sm">Loading Admin Console...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <h3 className="text-lg font-bold text-red-600 mb-2">Access Restricted</h3>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto py-10 px-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
        <FaUserShield className="text-blue-600" /> Admin Control Center
      </h1>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Users</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">{stats.total_users}</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">
            <FaUsers />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Ledger Entries</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">{stats.total_transactions}</h3>
          </div>
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl">
            <FaExchangeAlt />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Telegram Receipts</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">{stats.total_pending_queue}</h3>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl">
            <FaHourglassHalf />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">User Management</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead className="bg-gray-50 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Telegram ID</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6 text-gray-400 font-normal">#{u.id}</td>
                  <td className="py-4 px-6 font-bold text-gray-800">{u.email}</td>
                  <td className="py-4 px-6">
                    {u.is_admin ? (
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-md text-xs font-bold">
                        Superadmin
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-md text-xs font-bold">
                        User
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-gray-500">
                    {u.telegram_id ? u.telegram_id : "Not Linked"}
                  </td>
                  <td className="py-4 px-6">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span> Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {u.is_admin ? (
                          <span className="text-xs font-semibold text-gray-400 italic">Self (Protected)</span>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(u.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto ${
                              u.is_active
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            {u.is_active ? <><FaUserSlash /> Suspend</> : <><FaUserCheck /> Activate</>}
                          </button>
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;