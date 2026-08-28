import React, { useState, useEffect, useCallback } from "react";
import { FaEdit, FaRegTrashAlt, FaPlus, FaMinus, FaChevronLeft, FaChevronRight, FaTag, FaWallet, FaCheck, FaTimes, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import TransactionModal from "./TransactionModal";
import FilterBoard from "./FilterBoard";
import { transactionAPI, categoryAPI, accountAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';
import axios from "axios";

const TransactionForm = () => {
  const { t } = useTranslation();

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const [showModalType, setShowModalType] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState("All Transaction");

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Pending Transactions State
  const [pendingList, setPendingList] = useState([]);
  const [pendingSelections, setPendingSelections] = useState({});

  const [isLoading, setIsLoading] = useState(true);

  // 🟢 Styled Modal State (Replaces browser confirm/alert)
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    type: "confirm", // "confirm" or "alert"
    title: "",
    message: "",
    onConfirm: null
  });

  const showAlert = (title, message) => {
    setDialogConfig({
      isOpen: true,
      type: "alert",
      title,
      message,
      onConfirm: null
    });
  };

  const showConfirm = (title, message, onConfirmAction) => {
    setDialogConfig({
      isOpen: true,
      type: "confirm",
      title,
      message,
      onConfirm: onConfirmAction
    });
  };

  const closeDialog = () => {
    setDialogConfig({ isOpen: false, type: "confirm", title: "", message: "", onConfirm: null });
  };

  const [filters, setFilters] = useState({
    searchTerm: "",
    filterType: "all",
    selectedAccount: "all",
    selectedCategory: "all",
    selectedCurrency: "all",
    statusFilter: "all",
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: ""
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🟢 Helper Function for Currency Formatting
  const formatMoney = (amount, currency = "USD") => {
    const val = Number(amount) || 0;
    if (currency === "KHR") {
      return new Intl.NumberFormat("km-KH", {
        style: "currency",
        currency: "KHR",
        maximumFractionDigits: 0,
      }).format(val);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  // 🟢 Helper to dynamically find the account currency for a transaction
  const getItemCurrency = (accountId) => {
    const acc = accounts.find(a => String(a.id) === String(accountId));
    return acc?.currency || "USD";
  };

  // --- CRUD: READ MAIN DATA ---
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

  const fetchPendingData = async () => {
    try {
      const res = await axios.get("https://personal-financial-tracking.onrender.com/budgets/pending/", getAuthHeaders());
      setPendingList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch pending transactions:", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchPendingData();
  }, []);

  useEffect(() => {
    if (activeTab === "Pending Inbox") {
      fetchPendingData();
    }
  }, [activeTab]);

  // 🟢 Instant Optimistic Delete
  const handleDelete = (id) => {
    showConfirm(
      "Delete Transaction",
      "Are you sure you want to permanently delete this transaction?",
      async () => {
        closeDialog();
        // Optimistic UI update: remove instantly from screen
        setExpenses(prev => prev.filter(tx => tx.id !== id));
        try {
          const response = await transactionAPI.delete(id);
          if (response.status === 200) {
            fetchInitialData();
          }
        } catch (error) {
          console.error("Axios delete operation failure:", error);
          showAlert("Error", "Failed to delete transaction on server. Syncing data...");
          fetchInitialData(); // Re-sync if API failed
        }
      }
    );
  };

  const handleApprovePending = async (pendingId) => {
    const selectedCategoryId = pendingSelections[pendingId];
    if (!selectedCategoryId) {
      showAlert("Action Required", "Please select a category first!");
      return;
    }

    // Optimistic UI update
    setPendingList(prev => prev.filter(item => item.id !== pendingId));

    try {
      await axios.post(
        `https://personal-financial-tracking.onrender.com/budgets/pending/${pendingId}/approve`,
        {
          category_id: parseInt(selectedCategoryId),
          remember_rule: true
        },
        getAuthHeaders()
      );

      fetchPendingData();
      fetchInitialData();
    } catch (error) {
      console.error("Failed to approve transaction:", error);
      showAlert("Approval Failed", "Transaction approval failed. Refreshing list...");
      fetchPendingData();
    }
  };

  const handleRejectPending = (pendingId) => {
    showConfirm(
      "Reject Pending Item",
      "Reject and remove this item from your pending inbox?",
      async () => {
        closeDialog();
        // Optimistic UI update
        setPendingList(prev => prev.filter(item => item.id !== pendingId));
        try {
          await axios.delete(
            `https://personal-financial-tracking.onrender.com/budgets/pending/${pendingId}`,
            getAuthHeaders()
          );
          fetchPendingData();
        } catch (error) {
          console.error("Failed to reject pending transaction:", error);
          showAlert("Error", "Failed to delete pending item.");
          fetchPendingData();
        }
      }
    );
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

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setCurrentPage(1);
  };

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const getCatName = (id) => {
    if (!categories || categories.length === 0) return "Loading...";
    const currentCat = categories.find(c => c.id === id);
    if (!currentCat) return `Category #${id}`;
    if (currentCat.parent_id) {
      const parentCat = categories.find(c => c.id === currentCat.parent_id);
      if (parentCat) return `${parentCat.name} ➔ ${currentCat.name}`;
    }
    return currentCat.name;
  };

  const getAccName = (id) => accounts.find(a => a.id === id)?.account_name || `Account #${id}`;

  const filteredData = expenses.filter(item => {
    const verifiedSearch = String(filters?.searchTerm || "").toLowerCase().trim();
    const verifiedAccount = String(filters?.selectedAccount || "all");
    const verifiedType = String(filters?.filterType || "all");
    const verifiedCategory = String(filters?.selectedCategory || "all");
    const verifiedCurrency = String(filters?.selectedCurrency || "all");

    let matchesTab = true;
    if (activeTab === "Income" || activeTab === "Expense") {
      matchesTab = item.type.toLowerCase() === activeTab.toLowerCase();
    } else if (verifiedType !== "all") {
      matchesTab = item.type.toLowerCase() === verifiedType.toLowerCase();
    }

    const matchesAccount = verifiedAccount === "all" || String(item.account_id) === verifiedAccount;
    const matchesCategory = verifiedCategory === "all" || String(item.category_id) === verifiedCategory;

    const itemCurrency = getItemCurrency(item.account_id);
    const matchesCurrency = verifiedCurrency === "all" || itemCurrency === verifiedCurrency;

    let matchesDate = true;
    if (item.transaction_date) {
      const transactionISOString = item.transaction_date.split("T")[0];
      if (filters?.startDate && transactionISOString < filters.startDate) matchesDate = false;
      if (filters?.endDate && transactionISOString > filters.endDate) matchesDate = false;
    }

    let matchesAmount = true;
    const currentPriceFloat = parseFloat(item.amount || 0);
    if (filters?.minAmount && currentPriceFloat < parseFloat(filters.minAmount)) matchesAmount = false;
    if (filters?.maxAmount && currentPriceFloat > parseFloat(filters.maxAmount)) matchesAmount = false;

    const categoryFullName = getCatName(item.category_id);
    const matchesSearch =
      String(item.description || "").toLowerCase().includes(verifiedSearch) ||
      String(categoryFullName).toLowerCase().includes(verifiedSearch);

    return matchesTab && matchesAccount && matchesCategory && matchesCurrency && matchesDate && matchesAmount && matchesSearch;
  });

  const filteredPendingList = pendingList.filter(item => {
    const verifiedSearch = String(filters?.searchTerm || "").toLowerCase().trim();
    const verifiedAccount = String(filters?.selectedAccount || "all");
    const verifiedCurrency = String(filters?.selectedCurrency || "all");

    const matchesSearch = String(item.raw_beneficiary_name || "").toLowerCase().includes(verifiedSearch);
    const matchesAccount = verifiedAccount === "all" || String(item.account_id) === verifiedAccount;

    const itemCurrency = getItemCurrency(item.account_id);
    const matchesCurrency = verifiedCurrency === "all" || itemCurrency === verifiedCurrency;

    let matchesDate = true;
    if (item.transaction_date) {
      const transactionISOString = item.transaction_date.split("T")[0];
      if (filters?.startDate && transactionISOString < filters.startDate) matchesDate = false;
      if (filters?.endDate && transactionISOString > filters.endDate) matchesDate = false;
    }

    let matchesAmount = true;
    const currentPriceFloat = parseFloat(item.amount || 0);
    if (filters?.minAmount && currentPriceFloat < parseFloat(filters.minAmount)) matchesAmount = false;
    if (filters?.maxAmount && currentPriceFloat > parseFloat(filters.maxAmount)) matchesAmount = false;

    return matchesSearch && matchesAccount && matchesCurrency && matchesDate && matchesAmount;
  });

  const isShowingPending = filters?.statusFilter === "pending" || (filters?.statusFilter === "all" && activeTab === "Pending Inbox");
  const dataSource = isShowingPending ? filteredPendingList : filteredData;

  const totalPages = Math.ceil(dataSource.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedData = dataSource.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) {
    return (
      <div className="w-full max-w-[1400px] mx-auto py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 dark:text-slate-400 font-semibold text-sm">Syncing with database ledger boards...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95vw] lg:max-w-[1400px] mx-auto py-10 space-y-6 overflow-x-hidden pb-40 md:pb-24">

      <FilterBoard
        accounts={accounts}
        categories={categories}
        onFilterChange={handleFilterChange}
      />

      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors duration-200">

        <div className="flex bg-[#f1f3f6] dark:bg-slate-800/60 p-1 overflow-x-auto">
          {[
            { key: "All Transaction", label: t("transactions.all_transactions") },
            { key: "Pending Inbox", label: t("transactions.pending_inbox") },
            { key: "Income", label: t("transactions.income") },
            { key: "Expense", label: t("transactions.expense") }
          ].map((tab) => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)}
              className={`flex-1 min-w-[120px] py-4 text-sm md:text-lg font-bold rounded-xl transition-all duration-200 whitespace-nowrap px-2 cursor-pointer ${
                  activeTab === tab.key
                  ? "bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 shadow-sm"
                  : "text-gray-400 dark:text-slate-400 hover:text-gray-500 dark:hover:text-slate-200"
              }`}>
              {tab.key === "Pending Inbox" ? (
                  <span className={pendingList.length > 0 ? "text-amber-500 dark:text-amber-400" : ""}>
                      {tab.label} {pendingList.length > 0 && `(${pendingList.length}) 🟡`}
                  </span>
              ) : tab.label}
            </button>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-separate border-spacing-y-2 px-6 table-auto">
            <thead>
              <tr className="text-gray-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider text-center border-b border-gray-100 dark:border-slate-800">
                <th className="py-4 px-2 text-center w-12">{t("transactions.id")}</th>
                <th className="py-4 px-2 text-center w-16">{t("transactions.icon")}</th>
                <th className="py-4 px-4 text-left w-44">{isShowingPending ? t("transactions.raw_beneficiary") : t("transactions.category")}</th>
                <th className="py-4 px-4 text-right w-40">{t("transactions.amount")}</th>
                <th className="py-4 px-6 text-center w-48">{t("transactions.account")}</th>
                <th className="py-4 px-4 text-center w-36">{t("transactions.date")}</th>
                {isShowingPending ? (
                  <th className="py-4 px-4 text-left">{t("transactions.assign_category")}</th>
                ) : (
                  <th className="py-4 px-4 text-left max-w-xs">{t("transactions.desc")}</th>
                )}
                <th className="py-4 px-2 text-center w-24">{t("transactions.type")}</th>
                <th className="py-4 px-2 text-center w-32">{t("transactions.actions")}</th>
              </tr>
            </thead>

            <tbody className="text-gray-600 dark:text-slate-300 text-sm font-medium">

              {isShowingPending && paginatedData.map((item) => (
                 <tr key={item.id} className="bg-amber-50/30 dark:bg-amber-950/20 hover:brightness-95 transition-all">
                    <td className="py-4 px-2 text-center text-gray-400 dark:text-slate-500 font-normal">{item.id}</td>
                    <td className="py-3 px-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-amber-200 dark:border-amber-900/50 shadow-sm text-amber-500">
                        <FaCheck size={12} />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-left font-bold text-gray-800 dark:text-slate-200 uppercase text-xs">
                      {item.raw_beneficiary_name}
                    </td>
                    <td className="py-4 px-4 text-right font-black text-base tracking-tight text-red-500 dark:text-red-400">
                      -{formatMoney(Math.abs(item.amount), getItemCurrency(item.account_id))}
                    </td>
                    <td className="py-4 px-6 text-center text-gray-500 dark:text-slate-400 uppercase text-xs font-bold">{getAccName(item.account_id)}</td>
                    <td className="py-4 px-4 text-center text-gray-500 dark:text-slate-400 text-xs font-semibold">{item.transaction_date ? item.transaction_date.split("T")[0] : "—"}</td>

                    <td className="py-4 px-4 text-left">
                       <select
                          className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 py-1.5 px-3 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-amber-400 outline-none"
                          value={pendingSelections[item.id] || ""}
                          onChange={(e) => setPendingSelections({...pendingSelections, [item.id]: e.target.value})}
                       >
                          <option value="" disabled className="dark:bg-slate-900">-- {t("transactions.assign_category")} --</option>
                          {categories.map(cat => (
                             <option key={cat.id} value={cat.id} className="dark:bg-slate-900">{getCatName(cat.id)}</option>
                          ))}
                       </select>
                    </td>

                    <td className="py-4 px-2 text-center">
                       <span className="px-2.5 py-1 rounded-md font-extrabold text-[10px] uppercase tracking-wide bg-white dark:bg-slate-800 shadow-sm border text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50">
                          Telegram
                       </span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <button onClick={() => handleApprovePending(item.id)} className="bg-green-500 text-white p-1.5 rounded-md hover:bg-green-600 hover:scale-110 transition-all shadow-sm cursor-pointer">
                          <FaCheck size={12} />
                        </button>
                        <button onClick={() => handleRejectPending(item.id)} className="bg-red-500 text-white p-1.5 rounded-md hover:bg-red-600 hover:scale-110 transition-all shadow-sm cursor-pointer">
                          <FaTimes size={12} />
                        </button>
                      </div>
                    </td>
                 </tr>
              ))}

              {!isShowingPending && paginatedData.map((item) => {
                const isSystemOpeningBalance = item.description === "Opening Balance Baseline";
                const matchedCategory = categories.find(c => c.id === item.category_id);
                const categoryFullName = getCatName(item.category_id);
                const finalIconSrc = matchedCategory ? (getCategoryIconSource(matchedCategory) || matchedCategory.icon || "") : "";

                const rawAmount = parseFloat(item.amount || 0);
                const isExpenseType = String(item.type || "").toLowerCase().trim() === 'expense';
                const isPositive = !isExpenseType && rawAmount > 0;
                const displayAmount = Math.abs(rawAmount).toFixed(2);

                const txCurrency = getItemCurrency(item.account_id);
                const formattedMoney = formatMoney(displayAmount, txCurrency);

                return (
                  <tr key={item.id} className={`${isPositive ? 'bg-green-50/30 dark:bg-green-950/15' : 'bg-red-50/40 dark:bg-red-950/15'} hover:brightness-95 transition-all`}>
                    <td className="py-4 px-2 text-center text-gray-400 dark:text-slate-500 font-normal">{item.id}</td>
                    <td className="py-3 px-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm">
                        {finalIconSrc && typeof finalIconSrc === 'string' ? (
                            <img src={finalIconSrc} alt="Icon" className="w-full h-full object-cover" />
                                ) : (
                            <div className="text-gray-400 dark:text-slate-500 text-xs"><FaTag /></div>
                                )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-left font-semibold text-gray-800 dark:text-slate-200">
                      {isSystemOpeningBalance ? (
                        <span className="text-sm font-bold text-gray-800 dark:text-slate-100 capitalize">{t("transactions.starting_balance")}</span>
                      ) : categoryFullName.includes("➔") ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase w-fit">
                            {categoryFullName.split("➔")[0].trim()}
                          </span>
                          <span className="text-gray-300 dark:text-slate-600 hidden sm:inline text-xs">/</span>
                          <span className="text-sm font-bold text-gray-800 dark:text-slate-200 capitalize">
                            {categoryFullName.split("➔")[1].trim()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-gray-800 dark:text-slate-200 capitalize">{categoryFullName}</span>
                      )}
                    </td>
                    <td className={`py-4 px-4 text-right font-black text-base tracking-tight ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {isPositive ? '+' : '-'}{formattedMoney}
                    </td>
                    <td className="py-4 px-6 text-center text-gray-500 dark:text-slate-400 uppercase text-xs font-bold tracking-wider">{getAccName(item.account_id)}</td>
                    <td className="py-4 px-4 text-center text-gray-500 dark:text-slate-400 text-xs font-semibold">{item.transaction_date ? item.transaction_date.split("T")[0] : "—"}</td>
                    <td className="py-4 px-4 text-left text-gray-400 dark:text-slate-500 italic font-normal max-w-xs truncate">{item.description || "—"}</td>
                    <td className="py-4 px-2 text-center">
                       <span className={`px-2.5 py-1 rounded-md font-extrabold text-[10px] uppercase tracking-wide bg-white dark:bg-slate-800 shadow-sm border ${isPositive ? 'text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/40' : 'text-red-500 dark:text-red-400 border-red-100 dark:border-red-900/40'}`}>
                          {item.type}
                       </span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center gap-3.5 text-gray-400 dark:text-slate-500">
                        <button onClick={() => openEditModal(item)} className="hover:text-blue-500 dark:hover:text-blue-400 hover:scale-110 active:scale-95 transition-all text-base cursor-pointer">
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="hover:text-red-600 dark:hover:text-red-400 hover:scale-110 active:scale-95 transition-all text-base cursor-pointer">
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

        {/* Mobile Card List View */}
        <div className="block md:hidden px-4 py-4 space-y-3 bg-[#fdfefe] dark:bg-slate-900">
          {paginatedData.map((item) => {
             const isPending = isShowingPending;
             const isSystemOpeningBalance = item.description === "Opening Balance Baseline";
             const matchedCategory = categories.find(c => c.id === item.category_id);
             const categoryFullName = isPending ? item.raw_beneficiary_name : getCatName(item.category_id);
             const finalIconSrc = matchedCategory ? (getCategoryIconSource(matchedCategory) || matchedCategory.icon || "") : "";

             const rawAmount = parseFloat(item.amount || 0);
             const isExpenseType = String(item.type || "").toLowerCase().trim() === 'expense' || isPending;
             const isPositive = !isExpenseType && rawAmount > 0;
             const displayAmount = Math.abs(rawAmount).toFixed(2);

             const txCurrency = getItemCurrency(item.account_id);
             const formattedMoney = formatMoney(displayAmount, txCurrency);

             return (
              <div key={item.id} className={`p-4 rounded-xl border flex flex-col gap-3 shadow-xs ${isPending ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40' : isPositive ? 'bg-green-50/20 dark:bg-green-950/20 border-green-100 dark:border-green-900/40' : 'bg-red-50/20 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'}`}>

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden border shadow-sm flex-shrink-0 ${isPending ? 'border-amber-200 dark:border-amber-900/50 text-amber-500' : 'border-gray-100 dark:border-slate-700'}`}>
                      {isPending ? <FaCheck size={12} /> : isSystemOpeningBalance ? (
                        <FaWallet className="text-blue-500 text-sm" />
                      ) : finalIconSrc && typeof finalIconSrc === 'string' ? (
                        <img src={finalIconSrc} alt="Icon" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-400 dark:text-slate-500 text-xs"><FaTag /></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 font-normal">#{item.id}</p>
                      <h4 className="font-bold text-gray-800 dark:text-slate-100 text-sm">
                        {isSystemOpeningBalance ? t("transactions.starting_balance") : categoryFullName.replace("➔", "»")}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-400 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700 shadow-xs">
                    {isPending ? (
                       <>
                         <button onClick={() => handleApprovePending(item.id)} className="text-green-500 text-sm active:scale-95 transition-all cursor-pointer"><FaCheck /></button>
                         <div className="w-[1px] h-3 bg-gray-200 dark:bg-slate-700" />
                         <button onClick={() => handleRejectPending(item.id)} className="text-red-500 text-sm active:scale-95 transition-all cursor-pointer"><FaTimes /></button>
                       </>
                    ) : (
                       <>
                         <button onClick={() => openEditModal(item)} className="hover:text-blue-500 dark:hover:text-blue-400 text-sm active:scale-95 transition-all cursor-pointer"><FaEdit /></button>
                         <div className="w-[1px] h-3 bg-gray-200 dark:bg-slate-700" />
                         <button onClick={() => handleDelete(item.id)} className="hover:text-red-600 dark:hover:text-red-400 text-sm active:scale-95 transition-all cursor-pointer"><FaRegTrashAlt /></button>
                       </>
                    )}
                  </div>
                </div>

                {isPending && (
                   <select
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 py-2 px-3 rounded-lg text-sm shadow-sm mt-1 focus:ring-2 focus:ring-amber-400 outline-none"
                      value={pendingSelections[item.id] || ""}
                      onChange={(e) => setPendingSelections({...pendingSelections, [item.id]: e.target.value})}
                   >
                      <option value="" disabled className="dark:bg-slate-900">-- {t("transactions.assign_category")} --</option>
                      {categories.map(cat => (
                         <option key={cat.id} value={cat.id} className="dark:bg-slate-900">{getCatName(cat.id)}</option>
                      ))}
                   </select>
                )}

                <div className="flex justify-between items-center bg-white/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-gray-100/50 dark:border-slate-700/50 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase block tracking-wider">{t("transactions.account")}</span>
                    <span className="font-bold text-gray-600 dark:text-slate-300 text-[11px] block mt-0.5 truncate max-w-[120px]">{getAccName(item.account_id)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase block tracking-wider">{t("transactions.date")}</span>
                    <span className="font-medium text-gray-500 dark:text-slate-400 text-[11px] block mt-0.5">{item.transaction_date ? item.transaction_date.split("T")[0] : "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase block tracking-wider">{t("transactions.amount")}</span>
                    <span className={`font-black text-sm block mt-0.5 tracking-tight ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {isPositive ? '+' : '-'}{formattedMoney}
                    </span>
                  </div>
                </div>

                {!isPending && item.description && (
                  <p className="text-xs text-gray-400 dark:text-slate-400 italic bg-white/40 dark:bg-slate-800/40 p-2 rounded-lg border border-gray-100/30 dark:border-slate-700/30 truncate">
                    Note: "{item.description}"
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center px-8 py-5 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 relative">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold text-center md:absolute md:left-8">
            {t("transactions.showing")} {dataSource.length > 0 ? indexOfFirstItem + 1 : 0} {t("transactions.to")} {Math.min(indexOfLastItem, dataSource.length)} {t("transactions.of")} <span className="text-gray-800 dark:text-slate-100 font-bold">{dataSource.length}</span> {isShowingPending ? t("transactions.pending_items") : t("transactions.all_transactions")}
          </p>
          <div className="flex items-center gap-3">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 transition-all cursor-pointer">
              <FaChevronLeft size={12} />
            </button>
            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 px-2">{t("transactions.page")} {currentPage} {t("transactions.of")} {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-800 transition-all cursor-pointer">
              <FaChevronRight size={12} />
            </button>
          </div>
        </div>

      </div>

      <div className="fixed bottom-4 right-4 md:bottom-3 flex flex-col space-y-3 z-40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xs p-2 rounded-full shadow-xs border border-white/20 dark:border-slate-800/20 md:bg-transparent md:backdrop-blur-none md:p-0 md:border-none md:shadow-none">
        <button onClick={() => openCreateModal("income")} className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#56a55a] text-white flex items-center justify-center text-lg md:text-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"><FaPlus /></button>
        <button onClick={() => openCreateModal("expense")} className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-lg md:text-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"><FaMinus /></button>
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

      {/* 🟢 STYLED MODAL DIALOG FOR CONFIRMATIONS & ALERTS */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#151D2A] border border-gray-100 dark:border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                dialogConfig.type === "confirm"
                  ? "bg-red-50 dark:bg-red-950/40 text-red-500"
                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-500"
              }`}>
                {dialogConfig.type === "confirm" ? <FaExclamationTriangle /> : <FaInfoCircle />}
              </div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">{dialogConfig.title}</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
              {dialogConfig.message}
            </p>

            <div className="flex justify-end items-center gap-3 pt-2">
              {dialogConfig.type === "confirm" ? (
                <>
                  <button
                    onClick={closeDialog}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={dialogConfig.onConfirm}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-md transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={closeDialog}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TransactionForm;