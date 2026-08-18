import React, { useState, useEffect, useRef } from "react";
import { FaPlus, FaChevronDown, FaSyncAlt, FaEye, FaEyeSlash, FaEllipsisV, FaTrashAlt, FaPen, FaCalendarAlt } from "react-icons/fa";
import { accountAPI, transactionAPI } from "../API/index";

const AccountPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [editingAccountId, setEditingAccountId] = useState(null);

  // Custom Dropdown State for Payment Due Day Selector
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const dayDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    account_type: "Normal",
    currency: "USD",
    initialAmount: "0",
    credit_limit: "0",
    payment_due_day: "",
    note: "",
  });

  // Helper Function for Currency Formatting
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

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      setActiveMenuId(null);
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(e.target)) {
        setIsDayDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const fetchAccounts = async () => {
    setIsRefreshing(true);
    try {
      const [accResponse, txResponse] = await Promise.all([
        accountAPI.getAll(),
        transactionAPI.getAll()
      ]);

      setAccounts(Array.isArray(accResponse.data) ? accResponse.data : []);
      setTransactions(Array.isArray(txResponse.data) ? txResponse.data : []);
    } catch (error) {
      console.error("Axios failure while syncing account inventory:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingAccountId(null);
    setFormData({ name: "", account_type: "Normal", currency: "USD", initialAmount: "0", credit_limit: "0", payment_due_day: "", note: "" });
    setIsDayDropdownOpen(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (e, acc) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingAccountId(acc.id);

    const cleanDisplayAmount = Math.abs(acc.computedBalance || acc.balance || 0);

    setFormData({
      name: acc.account_name,
      account_type: acc.account_type || "Normal",
      currency: acc.currency || "USD",
      initialAmount: String(cleanDisplayAmount),
      credit_limit: String(acc.credit_limit || 0),
      payment_due_day: acc.payment_due_day ? String(acc.payment_due_day) : "",
      note: acc.note || "",
    });
    setIsDayDropdownOpen(false);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    let initialBalanceValue = parseFloat(formData.initialAmount || 0);

    if (formData.account_type === "Credit Card" || formData.account_type === "Loan") {
      if (initialBalanceValue > 0) {
        initialBalanceValue = -initialBalanceValue;
      }
    }

    const payload = {
      account_name: formData.name.trim(),
      account_type: formData.account_type,
      currency: formData.currency,
      balance: initialBalanceValue,
      credit_limit: formData.account_type === "Credit Card" ? parseFloat(formData.credit_limit || 0) : 0,
      payment_due_day: !["Normal", "Savings"].includes(formData.account_type) && formData.payment_due_day ? parseInt(formData.payment_due_day, 10) : null,
      note: formData.note.trim() || null,
      is_active: true,
      is_savings_target: formData.account_type === "Savings"
    };

    try {
      let response;
      if (editingAccountId) {
        response = await accountAPI.update(editingAccountId, payload);
      } else {
        response = await accountAPI.create(payload);
      }

      if (response.status === 200 || response.status === 201) {
        setFormData({ name: '', account_type: 'Normal', currency: 'USD', initialAmount: '0', credit_limit: '0', payment_due_day: "", note: '' });
        setShowModal(false);
        setEditingAccountId(null);
        await fetchAccounts();
      }
    } catch (error) {
      console.error("Failed to commit account transaction mutation:", error);
      alert(error.response?.data?.detail || "An error occurred while saving this account.");
    }
  };

  const handleDeleteAccount = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this Account? All associated transaction history could be affected.")) {
      try {
        const response = await accountAPI.delete(id);
        if (response.status === 200 || response.status === 204) {
          fetchAccounts();
        }
      } catch (error) {
        console.error("Error destroying wallet block structure:", error);
        alert("Could not remove account. It might be tied to active transaction logs.");
      }
    }
  };

  // Process accounts and ledger totals cleanly
  const enhancedAccounts = accounts.map(acc => {
    const accountTx = transactions.filter(tx => String(tx.account_id) === String(acc.id));

    const totalInflow = accountTx
      .filter(tx => tx.type?.toLowerCase() === 'income')
      .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

    const totalOutflow = accountTx
      .filter(tx => tx.type?.toLowerCase() === 'expense')
      .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

    let dbBalance = parseFloat(acc.balance || 0);

    return {
      ...acc,
      computedBalance: dbBalance,
      totalInflow,
      totalOutflow,
      accountTx
    };
  });

  const totalAssetsUSD = enhancedAccounts
    .filter(acc => (acc.account_type === "Normal" || acc.account_type === "Savings") && (acc.currency || "USD") === "USD")
    .reduce((sum, acc) => sum + acc.computedBalance, 0);

  const totalLiabilitiesUSD = enhancedAccounts
    .filter(acc => (acc.account_type === "Credit Card" || acc.account_type === "Loan") && (acc.currency || "USD") === "USD")
    .reduce((sum, acc) => sum + Math.abs(acc.computedBalance), 0);

  const totalAssetsKHR = enhancedAccounts
    .filter(acc => (acc.account_type === "Normal" || acc.account_type === "Savings") && acc.currency === "KHR")
    .reduce((sum, acc) => sum + acc.computedBalance, 0);

  const netWorthUSD = totalAssetsUSD - totalLiabilitiesUSD;
  const currentDayOfMonth = new Date().getDate();

  const renderLedgerAnalyticsBreakdown = (acc) => {
    const curr = acc.currency || "USD";

    if (acc.account_type === "Loan") {
      const totalBorrowed = Math.abs(acc.computedBalance);

      const totalPaid = acc.accountTx
        .filter(tx => {
          const isTxTransfer = tx.type?.toLowerCase() === 'transfer';
          const isLoanCat = String(tx.category_id) === "3" || (tx.category_name && String(tx.category_name).toLowerCase().includes("loan"));
          return tx.type?.toLowerCase() === 'income' || (isTxTransfer && isLoanCat);
        })
        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

      return (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 gap-2 text-left px-1">
          {acc.note && (
            <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-100 text-xs mb-1">
              <span className="font-bold text-gray-400 block uppercase text-[9px] tracking-wider mb-0.5">Account Note</span>
              <p className="text-gray-600 font-medium italic">{acc.note}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Borrowed Base</span>
              <span className="text-sm font-extrabold text-gray-700">{formatMoney(totalBorrowed, curr)}</span>
            </div>
            <div className="bg-green-50 p-3 rounded-xl">
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider block mb-1">Total Paid</span>
              <span className="text-sm font-extrabold text-green-700">{formatMoney(totalPaid, curr)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (acc.account_type === "Credit Card") {
      const totalSpent = acc.accountTx
        .filter(tx => tx.type?.toLowerCase() === 'expense')
        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

      const totalPayments = acc.accountTx
        .filter(tx => {
          const isTxTransfer = tx.type?.toLowerCase() === 'transfer';
          const isCreditCat = String(tx.category_id) === "2" || (tx.category_name && (String(tx.category_name).toLowerCase().includes("credit") || String(tx.category_name).toLowerCase().includes("card")));
          return tx.type?.toLowerCase() === 'income' || (isTxTransfer && isCreditCat);
        })
        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

      return (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 gap-2 text-left px-1">
          {acc.note && (
            <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-100 text-xs mb-1">
              <span className="font-bold text-gray-400 block uppercase text-[9px] tracking-wider mb-0.5">Account Note</span>
              <p className="text-gray-600 font-medium italic">{acc.note}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-red-50 p-3 rounded-xl">
              <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider block mb-1">Total Spending Swipe</span>
              <span className="text-sm font-extrabold text-red-700">{formatMoney(totalSpent, curr)}</span>
            </div>
            <div className="bg-green-50 p-3 rounded-xl">
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider block mb-1">Payments Settled</span>
              <span className="text-sm font-extrabold text-green-700">{formatMoney(totalPayments, curr)}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 gap-2 text-left px-1">
        {acc.note && (
          <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-100 text-xs mb-1">
            <span className="font-bold text-gray-400 block uppercase text-[9px] tracking-wider mb-0.5">Account Note</span>
            <p className="text-gray-600 font-medium italic">{acc.note}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-green-50 p-3 rounded-xl">
            <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider block mb-1">Total Cash Inflow</span>
            <span className="text-sm font-extrabold text-green-700">{formatMoney(acc.totalInflow, curr)}</span>
          </div>
          <div className="bg-red-50 p-3 rounded-xl">
            <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider block mb-1">Total Cash Outflow</span>
            <span className="text-sm font-extrabold text-red-700">{formatMoney(acc.totalOutflow, curr)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen relative">
      <div className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400 block mb-1">USD Assets</span>
            <div className="text-2xl font-black text-green-600">
              {hideBalances ? "$ ••••••" : formatMoney(totalAssetsUSD, "USD")}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400 block mb-1">KHR Assets</span>
            <div className="text-2xl font-black text-emerald-600">
              {hideBalances ? "••••••" : formatMoney(totalAssetsKHR, "KHR")}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400 block mb-1">Total Liabilities</span>
            <div className="text-2xl font-black text-red-500">
              {hideBalances ? "$ ••••••" : formatMoney(totalLiabilitiesUSD, "USD")}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 bg-gradient-to-br from-blue-50/20 to-indigo-50/10">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-600 block mb-1">USD Net Worth</span>
            <div className={`text-2xl font-black ${netWorthUSD >= 0 ? "text-blue-600" : "text-red-500"}`}>
              {hideBalances ? "$ ••••••" : formatMoney(netWorthUSD, "USD")}
            </div>
          </div>
        </div>

        {enhancedAccounts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic text-sm bg-white rounded-xl border border-gray-100">
            No accounts active yet. Click the '+' button below to initialize your first wallet!
          </div>
        ) : (
          enhancedAccounts.map((acc) => {
            const currentBalance = acc.computedBalance;
            const accountCurrency = acc.currency || "USD";

            const availableCredit = acc.account_type === "Credit Card"
              ? parseFloat(acc.credit_limit || 0) + currentBalance
              : 0;

            const isExpanded = expandedAccountId === acc.id;

            const showsDueWarning = acc.payment_due_day &&
                                    (parseInt(acc.payment_due_day, 10) - currentDayOfMonth >= 0) &&
                                    (parseInt(acc.payment_due_day, 10) - currentDayOfMonth <= 7);

            return (
              <div
                key={acc.id}
                onClick={() => setExpandedAccountId(isExpanded ? null : acc.id)}
                className={`bg-white p-5 rounded-xl shadow-sm border transition-all duration-200 cursor-pointer relative ${
                  isExpanded ? "border-blue-400 ring-2 ring-blue-50/50 shadow-md" : "border-gray-100 hover:border-gray-300"
                }`}
              >
                {showsDueWarning && (
                  <div className="absolute top-0 left-6 transform -translate-y-1/2 bg-amber-500 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-sm z-10">
                    <FaCalendarAlt size={8} /> Due in {parseInt(acc.payment_due_day, 10) - currentDayOfMonth} Days
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-lg capitalize">{acc.account_name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        acc.account_type === "Credit Card" ? "bg-amber-100 text-amber-700" :
                        acc.account_type === "Loan" ? "bg-red-100 text-red-700" :
                        acc.account_type === "Savings" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {acc.account_type || "Normal"}
                      </span>

                      <span className="text-[10px] bg-gray-100 text-gray-700 font-extrabold px-2 py-0.5 rounded-full border border-gray-200 uppercase">
                        {accountCurrency}
                      </span>

                      {acc.payment_due_day && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FaCalendarAlt size={8} /> Due Day {acc.payment_due_day}
                        </span>
                      )}
                    </div>

                    {acc.account_type === "Credit Card" && (
                      <p className="text-xs text-gray-400 font-semibold tracking-wide">
                        Available Credit: <span className="text-gray-700 font-bold">{formatMoney(availableCredit, accountCurrency)}</span> / {formatMoney(parseFloat(acc.credit_limit), accountCurrency)}
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-5 bg-green-500 rounded-full relative">
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">Active Ledger</span>
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                        {acc.account_type === "Savings" ? "Accumulated Wealth Vault" : acc.account_type === "Normal" ? "Available Balance" : acc.account_type === "Loan" ? "Outstanding Balance" : "Current Owed Debt"}
                      </span>
                      <div className={`font-black text-lg tracking-tight ${
                        ["Normal", "Savings"].includes(acc.account_type)
                          ? (currentBalance >= 0 ? "text-green-600" : "text-red-500")
                          : "text-red-500"
                      }`}>
                        {hideBalances ? "••••••" : formatMoney(Math.abs(currentBalance), accountCurrency)}
                      </div>
                    </div>

                    <div className="flex gap-4 text-gray-400 justify-end items-center relative" onClick={(e) => e.stopPropagation()}>
                      <FaSyncAlt
                        onClick={() => fetchAccounts()}
                        className={`cursor-pointer hover:text-blue-500 transition-all ${isRefreshing ? "animate-spin text-blue-500" : ""}`}
                        size={14}
                      />
                      <div onClick={() => setHideBalances(!hideBalances)} className="cursor-pointer hover:text-blue-500">
                        {hideBalances ? <FaEye size={14} /> : <FaEyeSlash size={14} />}
                      </div>

                      <div
                        onClick={() => setActiveMenuId(activeMenuId === acc.id ? null : acc.id)}
                        className="cursor-pointer hover:text-blue-500 p-1 rounded-lg hover:bg-gray-50"
                      >
                        <FaEllipsisV size={14} />
                      </div>

                      {activeMenuId === acc.id && (
                        <div className="absolute right-0 top-6 w-36 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-30 text-left overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(e, acc)}
                            className="w-full px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-b border-gray-50"
                          >
                            <FaPen size={10} />
                            Edit Wallet
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteAccount(e, acc.id)}
                            className="w-full px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                          >
                            <FaTrashAlt size={10} />
                            Delete Wallet
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && renderLedgerAnalyticsBreakdown(acc)}
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={handleOpenCreateModal}
        className="fixed bottom-10 right-10 w-16 h-16 bg-[#66BB6A] text-white rounded-full flex items-center justify-center text-3xl shadow-xl hover:scale-110 active:scale-95 transition-all z-10 cursor-pointer"
      >
        <FaPlus />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl my-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-extrabold text-center text-black uppercase tracking-wide">
                {editingAccountId ? "Edit Account Details" : "Create New Account"}
              </h2>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-sm flex-1 custom-scrollbar">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  placeholder="e.g., Cash, ABA Bank, Emergency Fund"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 font-semibold"
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Account Type</label>
                  <select
                    value={formData.account_type}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none font-semibold cursor-pointer"
                    onChange={(e) => setFormData({...formData, account_type: e.target.value})}
                  >
                    <option value="Normal">Cash / Bank Account</option>
                    <option value="Savings">Savings / Wealth Vault</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Loan">Loan / Personal Debt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none font-semibold cursor-pointer"
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KHR">KHR (៛)</option>
                  </select>
                </div>
              </div>

              {formData.account_type === "Credit Card" && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-amber-700 font-bold mb-1">Credit Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.credit_limit}
                    className="w-full border border-amber-300 bg-amber-50/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 font-bold text-amber-900"
                    onChange={(e) => setFormData({...formData, credit_limit: e.target.value})}
                  />
                </div>
              )}

              {!["Normal", "Savings"].includes(formData.account_type) && (
                <div className="animate-in fade-in duration-150 relative" ref={dayDropdownRef}>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {formData.account_type === "Credit Card" ? "Statement Due Day of Month" : "Monthly Repayment Day"}
                  </label>

                  <div
                    onClick={(e) => { e.stopPropagation(); setIsDayDropdownOpen(!isDayDropdownOpen); }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white font-semibold cursor-pointer flex justify-between items-center text-gray-800 hover:border-gray-400 transition-colors"
                  >
                    <span>
                      {formData.payment_due_day ? `Day ${formData.payment_due_day}` : "-- Select Day (Optional) --"}
                    </span>
                    <FaChevronDown className={`text-gray-400 transition-transform duration-200 ${isDayDropdownOpen ? "rotate-180" : ""}`} size={12} />
                  </div>

                  {isDayDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[200] max-h-48 overflow-y-auto custom-scrollbar py-1">
                      <div
                        onClick={() => { setFormData({...formData, payment_due_day: ""}); setIsDayDropdownOpen(false); }}
                        className="px-4 py-2 hover:bg-gray-50 text-gray-500 cursor-pointer font-medium"
                      >
                        -- Select Day (Optional) --
                      </div>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <div
                          key={day}
                          onClick={() => { setFormData({...formData, payment_due_day: String(day)}); setIsDayDropdownOpen(false); }}
                          className={`px-4 py-2 hover:bg-blue-50 cursor-pointer font-semibold transition-colors ${
                            String(formData.payment_due_day) === String(day) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                          }`}
                        >
                          Day {day}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {["Normal", "Savings"].includes(formData.account_type)
                    ? (editingAccountId ? "Current Balance" : "Initial Starting Balance")
                    : (editingAccountId ? "Current Outstanding Owed Debt" : "Starting Debt Amount Balance")
                  }
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.initialAmount}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none font-semibold"
                  onChange={(e) => setFormData({...formData, initialAmount: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Note</label>
                <textarea
                  value={formData.note}
                  placeholder="Optional details regarding this account"
                  rows="2"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none resize-none"
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                />
              </div>

              <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAccountId(null); }}
                  className="text-gray-500 font-bold hover:text-gray-700 cursor-pointer text-base px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#3D5AFE] text-white px-6 py-2.5 rounded-xl font-bold text-base shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  );
};

export default AccountPage;