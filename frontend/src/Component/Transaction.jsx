import React, { useState, useEffect, useCallback } from "react";
import { FaEdit, FaRegTrashAlt, FaPlus, FaMinus, FaChevronLeft, FaChevronRight, FaTag, FaWallet } from "react-icons/fa";
import TransactionModal from "./TransactionModal";
import FilterBoard from "./FilterBoard";
import { transactionAPI, categoryAPI, accountAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';

const TransactionForm = () => {
  const [showModalType, setShowModalType] = useState(null); // "income" | "expense" | null
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState("All Transaction");
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🚀 UPDATED FILTER STATE MATRIX TO MATCH ADVANCED CONTROLS
  const [filters, setFilters] = useState({
    searchTerm: "",
    filterType: "all",
    selectedAccount: "all",
    selectedCategory: "all",
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: ""
  });

  // 🚀 NEW: Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- CRUD: READ ---
  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [txRes, catRes, accRes] = await Promise.all([
        transactionAPI.getAll(),
        categoryAPI.getAll(),
        accountAPI.getAll()
      ]);

      setExpenses(Array.isArray(txRes.data) ? txRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
    } catch (error) {
      console.error("Axios database synchronization failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // --- CRUD: DELETE ---
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this transaction?")) {
      try {
        const response = await transactionAPI.delete(id);
        if (response.status === 200) {
          fetchInitialData();
        }
      } catch (error) {
        console.error("Axios delete operation failure:", error);
      }
    }
  };

  const closeModal = () => {
    setShowModalType(null);
    setEditingTransaction(null);
  };

  const openCreateModal = (type) => {
    setShowModalType(type);
  };

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction);
    setShowModalType(transaction.type);
  };

  // Reset pagination to page 1 whenever user switches tabs
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setCurrentPage(1);
  };

  // 🚀 MEMOIZED INTERCEPTOR
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  // 🚀 HOIST FIX: Declaring helper data parsing functions up here so they are ready for the filter loop
  const getCatName = (id) => {
    if (!categories || categories.length === 0) return "Loading...";

    const currentCat = categories.find(c => c.id === id);
    if (!currentCat) return `Category #${id}`;

    if (currentCat.parent_id) {
      const parentCat = categories.find(c => c.id === currentCat.parent_id);
      if (parentCat) {
        return `${parentCat.name} ➔ ${currentCat.name}`;
      }
    }
    return currentCat.name;
  };

  const getAccName = (id) => accounts.find(a => a.id === id)?.account_name || `Account #${id}`;

  // 1. Unified Multivariable Filter Engine
  const filteredData = expenses.filter(item => {
    // 🟢 MOUNT SAFEST FALLBACK EXTRACTIONS
    const verifiedSearch = String(filters?.searchTerm || "").toLowerCase().trim();
    const verifiedAccount = String(filters?.selectedAccount || "all");
    const verifiedType = String(filters?.filterType || "all");
    const verifiedCategory = String(filters?.selectedCategory || "all");

    // A. Tab Type & Dropdown Entry Type Matching Matrix
    let matchesTab = true;
    if (activeTab !== "All Transaction") {
      matchesTab = item.type.toLowerCase() === activeTab.toLowerCase();
    } else if (verifiedType !== "all") {
      matchesTab = item.type.toLowerCase() === verifiedType.toLowerCase();
    }

    // B. Dropdown Linked Account Selector Rule
    const matchesAccount = verifiedAccount === "all" || String(item.account_id) === verifiedAccount;

    // 🚀 NEW C. Dropdown Linked Category Tag Rule
    const matchesCategory = verifiedCategory === "all" || String(item.category_id) === verifiedCategory;

    // 🚀 NEW D. High-Performance Calendar Date Range Boundary Rules
    let matchesDate = true;
    if (item.transaction_date) {
      const transactionISOString = item.transaction_date.split("T")[0]; // Isolates YYYY-MM-DD template segments safely
      if (filters?.startDate && transactionISOString < filters.startDate) matchesDate = false;
      if (filters?.endDate && transactionISOString > filters.endDate) matchesDate = false;
    }

    // 🚀 NEW E. Absolute Quantitative Price Range Rules
    let matchesAmount = true;
    const currentPriceFloat = parseFloat(item.amount || 0);
    if (filters?.minAmount && currentPriceFloat < parseFloat(filters.minAmount)) matchesAmount = false;
    if (filters?.maxAmount && currentPriceFloat > parseFloat(filters.maxAmount)) matchesAmount = false;

    // F. Advanced Text String Matching Check (Searches Descriptions, Subtitles, & Full Hierarchical Names)
    const categoryFullName = getCatName(item.category_id);
    const matchesSearch =
      String(item.description || "").toLowerCase().includes(verifiedSearch) ||
      String(categoryFullName).toLowerCase().includes(verifiedSearch);

    return matchesTab && matchesAccount && matchesCategory && matchesDate && matchesAmount && matchesSearch;
  });

  // 🚀 2. Next, calculate slices for client-side pagination indices
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedData = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // 🚀 MOUNT SAFEGUARD
  if (isLoading) {
    return (
      <div className="w-full max-w-[1400px] mx-auto py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-semibold text-sm">Syncing with database ledger boards...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95vw] lg:max-w-[1400px] mx-auto py-10 space-y-6 overflow-x-hidden pb-40 md:pb-24">

      {/* 🚀 CONNECTED FILTERBOARD CONTROL BOARD WITH ACCOUNT AND CATEGORY PROPS */}
      <FilterBoard accounts={accounts} categories={categories} onFilterChange={handleFilterChange} />

      <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

        {/* Navigation Tabs */}
        <div className="flex bg-[#f1f3f6] p-1">
          {["All Transaction", "Income", "Expense"].map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`flex-1 py-4 text-sm md:text-lg font-bold rounded-xl transition-all duration-200 ${activeTab === tab ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-500"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* 💻 VIEW A: DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-separate border-spacing-y-2 px-6 table-auto">
            <thead>
              <tr className="text-gray-400 text-[11px] font-bold uppercase tracking-wider text-center border-b border-gray-100">
                <th className="py-4 px-2 text-center w-12">Id</th>
                <th className="py-4 px-2 text-center w-16">Icon</th>
                <th className="py-4 px-4 text-left w-44">Category</th>
                <th className="py-4 px-4 text-right w-40">Amount</th>
                <th className="py-4 px-6 text-center w-48">Account</th>
                <th className="py-4 px-4 text-center w-36">Date</th>
                <th className="py-4 px-4 text-left max-w-xs">Desc</th>
                <th className="py-4 px-2 text-center w-24">Type</th>
                <th className="py-4 px-2 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-medium">
              {paginatedData.map((item) => {
                const isSystemOpeningBalance = item.description === "Opening Balance Baseline";
                const matchedCategory = categories.find(c => c.id === item.category_id);
                const categoryFullName = getCatName(item.category_id);
                const finalIconSrc = matchedCategory ? (getCategoryIconSource(matchedCategory) || matchedCategory.icon || "") : "";

                return (
                  <tr key={item.id} className={`${item.type === 'income' ? 'bg-green-50/30' : 'bg-red-50/40'} hover:brightness-95 transition-all`}>
                    <td className="py-4 px-2 text-center text-gray-400 font-normal">{item.id}</td>

                    <td className="py-3 px-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                        {isSystemOpeningBalance ? (
                          <FaWallet className="text-blue-500 text-sm" />
                        ) : finalIconSrc && typeof finalIconSrc === 'string' ? (
                          <img src={finalIconSrc} alt="Icon" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-gray-400 text-xs"><FaTag /></div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-left font-semibold text-gray-800">
                      {isSystemOpeningBalance ? (
                        <span className="text-sm font-bold text-gray-800 capitalize">Starting Balance</span>
                      ) : categoryFullName.includes("➔") ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase w-fit">
                            {categoryFullName.split("➔")[0].trim()}
                          </span>
                          <span className="text-gray-300 hidden sm:inline text-xs">/</span>
                          <span className="text-sm font-bold text-gray-800 capitalize">
                            {categoryFullName.split("➔")[1].trim()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-gray-800 capitalize">{categoryFullName}</span>
                      )}
                    </td>

                    <td className={`py-4 px-4 text-right font-black text-base tracking-tight ${item.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)}
                    </td>

                    <td className="py-4 px-6 text-center text-gray-500 uppercase text-xs font-bold tracking-wider">{getAccName(item.account_id)}</td>
                    <td className="py-4 px-4 text-center text-gray-500 text-xs font-semibold">{item.transaction_date ? item.transaction_date.split("T")[0] : "—"}</td>
                    <td className="py-4 px-4 text-left text-gray-400 italic font-normal max-w-xs truncate">{item.description || "—"}</td>

                    <td className="py-4 px-2 text-center">
                       <span className={`px-2.5 py-1 rounded-md font-extrabold text-[10px] uppercase tracking-wide bg-white shadow-sm border ${item.type === 'income' ? 'text-green-600 border-green-100' : 'text-red-500 border-red-100'}`}>
                          {item.type}
                       </span>
                    </td>

                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center gap-3.5 text-gray-400">
                        <button onClick={() => openEditModal(item)} className="hover:text-blue-500 hover:scale-110 active:scale-95 transition-all text-base cursor-pointer">
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="hover:text-red-600 hover:scale-110 active:scale-95 transition-all text-base cursor-pointer">
                          <FaRegTrashAlt />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 📱 VIEW B: MOBILE CARD LIST VIEW */}
        <div className="block md:hidden px-4 py-4 space-y-3 bg-[#fdfefe]">
          {paginatedData.map((item) => {
            const isSystemOpeningBalance = item.description === "Opening Balance Baseline";
            const matchedCategory = categories.find(c => c.id === item.category_id);
            const categoryFullName = getCatName(item.category_id);
            const finalIconSrc = matchedCategory ? (getCategoryIconSource(matchedCategory) || matchedCategory.icon || "") : "";

            return (
              <div key={item.id} className={`p-4 rounded-xl border flex flex-col gap-3 shadow-xs ${item.type === 'income' ? 'bg-green-50/20 border-green-100' : 'bg-red-50/20 border-red-100'}`}>

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm flex-shrink-0">
                      {isSystemOpeningBalance ? (
                        <FaWallet className="text-blue-500 text-sm" />
                      ) : finalIconSrc && typeof finalIconSrc === 'string' ? (
                        <img src={finalIconSrc} alt="Icon" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-400 text-xs"><FaTag /></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-normal">#{item.id}</p>
                      <h4 className="font-bold text-gray-800 text-sm">
                        {isSystemOpeningBalance ? "Starting Balance" : categoryFullName.replace("➔", "»")}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-400 bg-white px-2 py-1.5 rounded-lg border border-gray-100 shadow-xs">
                    <button onClick={() => openEditModal(item)} className="hover:text-blue-500 text-sm active:scale-95 transition-all cursor-pointer">
                      <FaEdit />
                    </button>
                    <div className="w-[1px] h-3 bg-gray-200" />
                    <button onClick={() => handleDelete(item.id)} className="hover:text-red-600 text-sm active:scale-95 transition-all cursor-pointer">
                      <FaRegTrashAlt />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/60 p-2.5 rounded-lg border border-gray-100/50 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Account</span>
                    <span className="font-bold text-gray-600 text-[11px] block mt-0.5 truncate max-w-[120px]">{getAccName(item.account_id)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Date</span>
                    <span className="font-medium text-gray-500 text-[11px] block mt-0.5">{item.transaction_date ? item.transaction_date.split("T")[0] : "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Amount</span>
                    <span className={`font-black text-sm block mt-0.5 tracking-tight ${item.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-gray-400 italic bg-white/40 p-2 rounded-lg border border-gray-100/30 truncate">
                    Note: "{item.description}"
                  </p>
                )}

              </div>
            );
          })}
        </div>

        {/* Clean Interactive Pagination Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center px-8 py-5 bg-gray-50 border-t border-gray-100 relative">
          <p className="text-xs text-gray-500 font-semibold text-center md:absolute md:left-8">
            Showing {filteredData.length > 0 ? indexOfFirstItem + 1 : 0} to {Math.min(indexOfLastItem, filteredData.length)} of <span className="text-gray-800 font-bold">{filteredData.length}</span> transactions
          </p>
          <div className="flex items-center gap-3">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <FaChevronLeft size={12} />
            </button>
            <span className="text-xs font-bold text-gray-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <FaChevronRight size={12} />
            </button>
          </div>
        </div>

      </div>

      {/* Floating Action Buttons Area */}
      <div className="fixed bottom-4 right-4 md:bottom-3 flex flex-col space-y-3 z-40 bg-white/40 backdrop-blur-xs p-2 rounded-full shadow-xs border border-white/20 md:bg-transparent md:backdrop-blur-none md:p-0 md:border-none md:shadow-none">
        <button
          onClick={() => openCreateModal("income")}
          className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#56a55a] text-white flex items-center justify-center text-lg md:text-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaPlus />
        </button>
        <button
          onClick={() => openCreateModal("expense")}
          className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-lg md:text-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaMinus />
        </button>
      </div>

      {showModalType && (
        <TransactionModal
          type={showModalType}
          closeModal={closeModal}
          categories={categories}
          accounts={accounts}
          fetchInitialData={fetchInitialData}
          editData={editingTransaction}
        />
      )}
    </div>
  );
};

export default TransactionForm;