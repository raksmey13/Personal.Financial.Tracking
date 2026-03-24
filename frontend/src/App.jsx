import React, { useState, useEffect } from "react";
// 1. Added BrowserRouter, Routes, and Route
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import IncomeForm from "./Component/IncomeForm";
import ExpenseForm from "./Component/ExpenseForm";
import CategoryForm from "./Component/CategoryForm";
import "./index.css";
// 2. Added the Chevron icons to the import list
import { FaHome, FaWallet, FaChartPie, FaCog, FaUserCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";

// --- 1. Sidebar Component ---
const Sidebar = () => {
  // 3. Moved state inside Sidebar and changed to a standard function body
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);

  return (
    <aside className="w-64 h-screen bg-gray-900 text-white flex flex-col sticky top-0">
      <div className="p-6 text-2xl font-bold border-b border-gray-800 text-blue-400">Netstream</div>
      <nav className="flex-1 mt-4">

        <Link to="/" className="flex items-center px-6 py-4 hover:bg-gray-800 text-blue-400 border-l-4 border-blue-400 cursor-pointer">
          <FaHome className="mr-3" /> <span>Overview</span>
        </Link>

        {/* Transaction Dropdown */}
        <div>
          <div
            onClick={() => setIsTransactionOpen(!isTransactionOpen)}
            className="flex items-center justify-between px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer transition-colors"
          >
            <div className="flex items-center">
              <FaWallet className="mr-3" />
              <span>Transaction</span>
            </div>
            {isTransactionOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
          </div>

          {isTransactionOpen && (
            <div className="bg-gray-800/50 flex flex-col text-sm">
              <Link to="/expenses" className="pl-14 py-3 text-gray-400 hover:text-white hover:bg-gray-700 transition">
                Income
              </Link>
              <Link to="/income" className="pl-14 py-3 text-gray-400 hover:text-white hover:bg-gray-700 transition">
                Expenses
              </Link>
            </div>
          )}
        </div>

        <Link to="/category" className="flex items-center px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer transition-colors hover:text-blue-400">
                <FaChartPie className="mr-3" /> <span>Category</span>
        </Link>




        <div className="flex items-center px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer">
          <FaWallet className="mr-3" /> <span>Budget</span>
        </div>
        <div className="flex items-center px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer">
          <FaWallet className="mr-3" /> <span>Account</span>
        </div>
        <div className="flex items-center px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer">
          <FaWallet className="mr-3" /> <span>Calander</span>
        </div>
        <div className="flex items-center px-6 py-4 hover:bg-gray-800 text-gray-400 cursor-pointer">
          <FaWallet className="mr-3" /> <span>Setting</span>
        </div>
      </nav>
    </aside>
  );
};

// --- 2. Navbar Component ---
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
      <div className="text-gray-500 font-medium">Overview </div>
      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 outline-none">
          <FaUserCircle size={28} className="text-gray-400" />
          <span className="font-semibold text-gray-700">John Richard</span>
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-xl z-50">
            <div className="p-3 hover:bg-gray-50 cursor-pointer">Profile</div>
            <div className="p-3 hover:bg-red-50 text-red-600 cursor-pointer">Logout</div>
          </div>
        )}
      </div>
    </header>
  );
};

// --- 3. Main App Component ---
export default function App() {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/expenses")
      .then((res) => res.json())
      .then((data) => setExpenses(data))
      .catch((err) => console.log("Backend not running?"));
  }, []);

  return (
    <Router> {/* 4. Wrapped everything in Router */}
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="p-8">
            <Routes>
              {/* 5. Added Routes for the content */}
              <Route path="/" element={
                <>
                  <h1 className="text-2xl font-bold text-gray-800 mb-6">Recent Expenses</h1>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="p-4">ID</th>
                          <th className="p-4">Title</th>
                          <th className="p-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp) => (
                          <tr key={exp.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">{exp.id}</td>
                            <td className="p-4 font-medium">{exp.title}</td>
                            <td className="p-4 text-green-600">${exp.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              } />
              <Route path="/income" element={
                  <div className="flex-2 flex flex-col items-start justify-start pt-4">
                    <ExpenseForm/>
                  </div>}
              />
              <Route path="/expenses" element={
                    <div className="flex-2 flex flex-col items-start justify-start pt-4">
                    <IncomeForm />
                    </div>
}             />
              <Route path="/category" element={
                    <div className="flex-1 flex flex-row items-start justify-start gap-12">
                    <CategoryForm />
                    </div>
}             />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}