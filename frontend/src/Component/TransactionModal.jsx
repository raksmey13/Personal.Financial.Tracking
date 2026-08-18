import React, { useState, useEffect, useMemo } from 'react';
import { FaCalendarAlt, FaWallet, FaPen, FaPlus, FaMinus, FaTag } from 'react-icons/fa';
import { transactionAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';

const TransactionModal = ({
  closeModal,
  categories = [],
  accounts = [],
  fetchInitialData,
  onTransactionSuccess,
  type = "expense",
  editData = null
}) => {
  const resolvedType = typeof type === 'string' && type ? type.toLowerCase() : 'expense';

  const [targetSavingsAmount, setTargetSavingsAmount] = useState("");

  useEffect(() => {
    const fetchBudgetTarget = async () => {
      try {
        setTargetSavingsAmount("130.00");
      } catch (error) {
        console.error("Failed to fetch budget guidelines:", error);
      }
    };

    if (resolvedType === "income" && !editData) {
      fetchBudgetTarget();
    }
  }, [resolvedType, editData]);

  const activeCategories = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    const seenNames = new Set();
    return categories.filter(cat => {
      if (cat.is_active === false) return false;
      const cleanName = cat.name.trim().toLowerCase();
      if (seenNames.has(cleanName)) return false;
      seenNames.add(cleanName);
      return true;
    });
  }, [categories]);

  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const filteredAccountsForDropdown = useMemo(() => {
    return safeAccounts;
  }, [safeAccounts]);

  const [transactions, setTransactions] = useState([
    {
      amount: editData ? String(editData.amount) : "",
      category_id: editData ? String(editData.category_id) : "",
      account_id: editData ? String(editData.account_id) : (filteredAccountsForDropdown[0]?.id ? String(filteredAccountsForDropdown[0].id) : ""),
      from_account_id: "",
      interest_amount: "",
      transaction_date: editData ? editData.transaction_date : new Date().toISOString().split('T')[0],
      transaction_time: editData && editData.transaction_time ? editData.transaction_time : new Date().toTimeString().split(' ')[0].substring(0, 5),
      description: editData ? editData.description : ""
    }
  ]);

  const selectedAccount = safeAccounts.find(acc => String(acc.id) === String(transactions[0]?.account_id));

  // 🟢 ROBUST ACCOUNT DETECTION (Checks both Name and Type)
  const accountTypeStr = (selectedAccount?.account_type || "Normal").toLowerCase();
  const accountNameStr = (selectedAccount?.account_name || "").toLowerCase();

  const isLoanAccount = accountTypeStr.includes("loan") || accountNameStr.includes("loan");
  const isCreditCard = accountTypeStr.includes("credit") || accountTypeStr.includes("card") || accountNameStr.includes("credit") || accountNameStr.includes("card");
  const isDebtAccount = isLoanAccount || isCreditCard;

  const currentCurrency = selectedAccount?.currency || "USD";
  const currencySymbol = currentCurrency === "KHR" ? "៛" : "$";

  // 🟢 STRICT CATEGORY FILTERING RULES
  const displayCategories = useMemo(() => {
    return activeCategories.filter(cat => {
      const currentCatType = String(cat.type).toLowerCase().trim();
      const cleanCatName = cat.name.toLowerCase().trim();

      if (cleanCatName === "opening balance") return false;

      if (resolvedType === "income" && selectedAccount?.is_savings_target) {
        return cleanCatName === "sweep saving";
      }

      if (cleanCatName === "sweep saving") return false;

      const isLoanPayment = cleanCatName.includes("loan") && (cleanCatName.includes("pay") || cleanCatName.includes("repay") || cleanCatName.includes("settle"));
      const isLoanTopup = (cleanCatName.includes("loan") || cleanCatName.includes("top-up") || cleanCatName.includes("top up") || cleanCatName.includes("borrow")) && !isLoanPayment;
      const isCardPayment = (cleanCatName.includes("card") || cleanCatName.includes("credit")) && (cleanCatName.includes("pay") || cleanCatName.includes("repay") || cleanCatName.includes("settle"));

      // 1. LOAN ACCOUNT LOGIC
      if (isLoanAccount) {
        if (resolvedType === "income") {
          return isLoanPayment;
        } else {
          return isLoanTopup;
        }
      }

      // 2. CREDIT CARD ACCOUNT LOGIC
      if (isCreditCard) {
        if (resolvedType === "income") {
          return isCardPayment;
        } else {
          return currentCatType === "expense" && !isLoanPayment && !isLoanTopup && !isCardPayment;
        }
      }

      // 3. NORMAL ACCOUNTS LOGIC
      if (resolvedType === "income") {
        if (currentCatType !== "income" && currentCatType !== "transfer") return false;
      } else {
        if (currentCatType !== resolvedType) return false;
      }

      return !isLoanPayment && !isLoanTopup && !isCardPayment;
    });
  }, [activeCategories, resolvedType, isLoanAccount, isCreditCard, selectedAccount]);

  useEffect(() => {
    if (!editData && selectedAccount?.is_savings_target && resolvedType === "income") {
      const targetSweepCat = displayCategories.find(c => c.name.toLowerCase() === "sweep saving");
      if (targetSweepCat) {
        setTransactions(prev => prev.map((tx, idx) =>
          idx === 0 ? {
            ...tx,
            category_id: String(targetSweepCat.id),
            amount: targetSavingsAmount
          } : tx
        ));
      }
    } else if (!editData && displayCategories.length > 0) {
      setTransactions(prev => {
        const currentCatId = prev[0]?.category_id;
        const currentCatIsValid = displayCategories.some(c => String(c.id) === String(currentCatId));

        if (currentCatId !== "" && !currentCatIsValid) {
          return prev.map((tx, idx) => idx === 0 ? { ...tx, category_id: "", amount: "" } : tx);
        }
        return prev;
      });
    }
  }, [resolvedType, editData, displayCategories, selectedAccount, targetSavingsAmount]);

  useEffect(() => {
    if (!editData && filteredAccountsForDropdown.length > 0) {
      const isCurrentAccountValid = filteredAccountsForDropdown.some(acc => String(acc.id) === String(transactions[0]?.account_id));
      if (!isCurrentAccountValid) {
        setTransactions(prev => prev.map((tx, idx) => idx === 0 ? { ...tx, account_id: String(filteredAccountsForDropdown[0].id) } : tx));
      }
    }
  }, [filteredAccountsForDropdown, editData]);

  const accountInfoLabel = useMemo(() => {
    if (!selectedAccount) return null;

    if (!isCreditCard && !isLoanAccount) return null;

    const rawDebt = Math.abs(parseFloat(selectedAccount.balance || 0));
    const limit = parseFloat(selectedAccount.credit_limit || 0);
    const dueDay = selectedAccount.payment_due_day;

    let dueString = "";
    if (dueDay) {
      const today = new Date();
      let dueMonth = today.getMonth() + 1;
      let dueYear = today.getFullYear();
      if (today.getDate() > dueDay) {
        dueMonth += 1;
        if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
      }
      dueString = ` | Due: ${String(dueMonth).padStart(2, '0')}/${String(dueDay).padStart(2, '0')}/${dueYear}`;
    }

    if (isCreditCard) {
      const spendRoom = Math.max(0, limit - rawDebt);
      return `Limit: ${currencySymbol}${limit.toFixed(2)} | Owed: ${currencySymbol}${rawDebt.toFixed(2)} | Avail Spend: ${currencySymbol}${spendRoom.toFixed(2)}${dueString}`;
    }

    if (isLoanAccount) {
      return `Outstanding Balance to Clear: ${currencySymbol}${rawDebt.toFixed(2)}${dueString}`;
    }

    return null;
  }, [selectedAccount, isLoanAccount, isCreditCard, currencySymbol]);

  const renderCategoryIcon = (tx) => {
    const matchedCategory = activeCategories.find(cat => String(cat.id) === String(tx.category_id));
    if (!matchedCategory) return <div className="text-gray-400 text-sm"><FaTag /></div>;
    const finalIconSrc = getCategoryIconSource(matchedCategory) || matchedCategory.icon || "";
    if (finalIconSrc && typeof finalIconSrc === 'string') {
      return <img src={finalIconSrc} alt={matchedCategory.name} className="w-full h-full object-cover" />;
    }
    return <div className="text-gray-400 text-sm"><FaTag /></div>;
  };

  let balanceLabel = "Balance:";
  let balanceValue = "0.00";
  let availableCreditNum = 0;

  if (selectedAccount) {
    const rawBalance = parseFloat(selectedAccount.balance || 0);
    const creditLimit = parseFloat(selectedAccount.credit_limit || 0);
    if (isCreditCard) {
      balanceLabel = "Available Credit:";
      availableCreditNum = creditLimit - Math.abs(rawBalance);
      balanceValue = availableCreditNum.toFixed(2);
    } else if (isLoanAccount) {
      balanceLabel = "Outstanding Debt:";
      balanceValue = Math.abs(rawBalance).toFixed(2);
    } else {
      balanceLabel = "Balance:";
      balanceValue = rawBalance.toFixed(2);
    }
  }

  const totalEnteredAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
  const isOverCreditLimit = resolvedType === "expense" && isCreditCard && totalEnteredAmount > availableCreditNum;

  let dynamicHeaderTitle = resolvedType === "expense" ? "Add Expense" : "Add Income";
  let dynamicSaveButtonText = "Save";

  if (selectedAccount && isDebtAccount) {
    if (resolvedType === "income") {
      dynamicHeaderTitle = isLoanAccount ? "Make Loan Payment" : "Pay Credit Card Bill";
      dynamicSaveButtonText = isLoanAccount ? "Record Debt Payment" : "Record Card Payment";
    } else if (resolvedType === "expense") {
      dynamicHeaderTitle = isLoanAccount ? "Add Debt Charge" : "New Card Expense";
      dynamicSaveButtonText = "Save Expense";
    }
  }

  if (selectedAccount?.is_savings_target && resolvedType === "income") {
    dynamicHeaderTitle = "Allocate Budget to Savings";
    dynamicSaveButtonText = "Log Savings Balance";
  }

  const addNewItemRow = (e) => {
    if (e) e.preventDefault();
    if (editData) return;
    setTransactions([
      ...transactions,
      {
        amount: "",
        category_id: "",
        account_id: transactions[0]?.account_id || (filteredAccountsForDropdown[0]?.id ? String(filteredAccountsForDropdown[0].id) : ""),
        from_account_id: "",
        interest_amount: "",
        transaction_date: transactions[0]?.transaction_date || new Date().toISOString().split('T')[0],
        transaction_time: transactions[0]?.transaction_time || new Date().toTimeString().split(' ')[0].substring(0, 5),
        description: transactions[0]?.description || ""
      }
    ]);
  };

  const removeItemRow = (e, indexToRemove) => {
    if (e) e.preventDefault();
    if (transactions.length === 1) return;
    setTransactions(transactions.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...transactions];
    updated[index][field] = value;
    setTransactions(updated);
  };

  const handleGlobalFieldChange = (field, value) => {
    setTransactions(prev => prev.map(tx => ({ ...tx, [field]: value })));
  };

  const handleSubmitAll = async (e) => {
    if (e) e.preventDefault();
    if (isOverCreditLimit) return;

    if (transactions.some(tx => !tx.category_id || !tx.account_id || !tx.amount)) {
      alert("Please select a Category and specify an Amount before saving.");
      return;
    }

    const enteredAmount = parseFloat(transactions[0].amount || 0);
    const enteredInterest = parseFloat(transactions[0].interest_amount || 0);

    if (enteredInterest > enteredAmount) {
      alert("Interest portion cannot exceed the total amount paid.");
      return;
    }

    try {
      const chosenCategory = activeCategories.find(c => String(c.id) === String(transactions[0].category_id));
      const cleanCatName = chosenCategory ? chosenCategory.name.toLowerCase().trim() : "";

      let finalType = resolvedType === "income" ? "income" : (chosenCategory ? chosenCategory.type : resolvedType);

      if (cleanCatName === "sweep saving") {
        finalType = "transfer";
      }

      const isDebtSettlement = resolvedType === "income" && isDebtAccount;

      // 🟢 SCENARIO A PAYLOAD STRUCTURE
      const payload = {
        amount: enteredAmount, // Total Cash Deducted from Bank
        category_id: parseInt(transactions[0].category_id, 10),
        account_id: isDebtSettlement ? parseInt(transactions[0].from_account_id, 10) : parseInt(transactions[0].account_id, 10),
        to_account_id: isDebtSettlement ? parseInt(transactions[0].account_id, 10) : null,
        interest_amount: enteredInterest, // Interest portion included in total amount
        description: transactions[0].description.trim() || `Transaction: ${chosenCategory?.name}`,
        transaction_date: transactions[0].transaction_date,
        type: isDebtSettlement ? "transfer" : finalType.toLowerCase()
      };

      let response;
      if (editData && editData.id) {
        response = await transactionAPI.update(editData.id, payload);
      } else {
        response = await transactionAPI.create(payload);
      }

      if (response.status === 200 || response.status === 201) {
        if (fetchInitialData) fetchInitialData();
        if (onTransactionSuccess) onTransactionSuccess();
        closeModal();
      }
    } catch (error) {
      console.error("Transaction save tracking failure:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] p-8 max-w-xl w-full shadow-2xl relative max-h-[95vh] overflow-y-auto">
        <h2 className="text-xl font-black text-center text-gray-800 tracking-wider uppercase mb-8">
          {editData ? `Edit ${dynamicHeaderTitle}` : dynamicHeaderTitle}
        </h2>

        <form onSubmit={handleSubmitAll} className="space-y-6">

          <div className="flex items-center gap-4 bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
            <div className="w-12 h-12 flex items-center justify-center text-blue-600 text-xl"><FaWallet /></div>
            <div className="flex-1 grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Target Account</label>
                <select
                  value={String(transactions[0]?.account_id || "")}
                  onChange={(e) => handleGlobalFieldChange('account_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:border-blue-400 font-medium capitalize"
                  required
                >
                  <option value="" disabled>Select Account</option>
                  {filteredAccountsForDropdown.map(acc => (
                    <option key={acc.id} value={String(acc.id)} className="text-gray-900 bg-white">
                      {acc.account_name} ({acc.currency || "USD"}) {acc.account_type !== 'Normal' ? `[${acc.account_type}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2">
                <p className="text-xs text-gray-500 font-semibold whitespace-nowrap">
                  {balanceLabel} <span className="text-gray-800 text-sm font-bold ml-1">{currencySymbol}{balanceValue}</span>
                </p>
                {accountInfoLabel && (
                  <p className="text-[10px] text-blue-600 font-bold mt-1 leading-tight">
                    ℹ️ {accountInfoLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 🟢 SOURCE ACCOUNT & INTEREST PORTION INPUTS */}
          {resolvedType === "income" && isDebtAccount && (
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-4 animate-in fade-in">
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Pay From Account (Source Cash/Bank)</label>
                <select
                  value={transactions[0]?.from_account_id || ""}
                  onChange={(e) => handleGlobalFieldChange('from_account_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none font-medium"
                  required
                >
                  <option value="" disabled>Select Source Bank Account</option>
                  {safeAccounts
                    .filter(acc => {
                      const t = (acc.account_type || "").toLowerCase();
                      const n = (acc.account_name || "").toLowerCase();
                      const accIsLoan = t.includes("loan") || n.includes("loan");
                      const accIsCard = t.includes("credit") || t.includes("card") || n.includes("credit") || n.includes("card");
                      const accIsDebt = accIsLoan || accIsCard;

                      return !accIsDebt && String(acc.id) !== String(transactions[0]?.account_id);
                    })
                    .map(acc => (
                      <option key={acc.id} value={String(acc.id)}>
                        {acc.account_name} ({acc.currency || "USD"})
                      </option>
                    ))}
                </select>
              </div>

              {isLoanAccount && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-gray-700 text-xs font-semibold">Interest / Fee Included in Total (Optional)</label>
                    <span className="text-[10px] text-amber-700 font-medium">Scenario A: Deducted from Total Amount</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      value={transactions[0]?.interest_amount || ""}
                      onChange={(e) => handleGlobalFieldChange('interest_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-xl pl-3 pr-8 py-2 text-sm bg-white font-semibold focus:outline-none"
                    />
                    <span className="absolute right-3 text-gray-500 font-medium text-sm">{currencySymbol}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {transactions.map((tx, index) => (
              <div key={index} className="flex items-start gap-4 relative group">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200/60 shadow-sm">
                  {renderCategoryIcon(tx)}
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-xs font-semibold mb-1">Category</label>
                    <select
                      value={tx.category_id}
                      onChange={(e) => handleFieldChange(index, 'category_id', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium capitalize appearance-none bg-white cursor-pointer"
                      required
                    >
                      <option value="">Select Category</option>
                      {displayCategories
                        .filter(cat => !cat.parent_id)
                        .map(mainCat => {
                          const subCats = displayCategories.filter(sub => String(sub.parent_id) === String(mainCat.id));
                          return (
                            <optgroup key={mainCat.id} label={mainCat.name.toUpperCase()} className="font-bold text-xs text-gray-400 bg-gray-50">
                              <option value={String(mainCat.id)} className="font-semibold text-gray-800 bg-white pl-2">
                                {mainCat.name} (Main)
                              </option>
                              {subCats.map(subCat => (
                                <option key={subCat.id} value={String(subCat.id)} className="text-gray-600 bg-white pl-6">
                                    ↳ {subCat.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-xs font-semibold mb-1">Total Amount Paid ({currentCurrency})</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        value={tx.amount}
                        onChange={(e) => handleFieldChange(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-xl pl-3 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-blue-400"
                        required
                      />
                      <span className="absolute right-3 text-gray-500 font-medium text-sm">{currencySymbol}</span>
                    </div>
                  </div>
                </div>

                {!editData && !selectedAccount?.is_savings_target && (
                  <div className="pt-7 flex items-center justify-center">
                    {index === 0 ? (
                      <button
                        type="button"
                        onClick={addNewItemRow}
                        className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm cursor-pointer"
                      >
                        <FaPlus size={12} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => removeItemRow(e, index)}
                        className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all cursor-pointer"
                      >
                        <FaMinus size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOverCreditLimit && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-3 rounded-xl mt-2 flex items-center gap-2">
              ❌ Transaction amount exceeds your current available credit limit. Settle your statement balance first.
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center text-gray-600 text-xl"><FaCalendarAlt /></div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={transactions[0]?.transaction_date || ""}
                  onChange={(e) => handleGlobalFieldChange('transaction_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Time</label>
                <input
                  type="time"
                  value={transactions[0]?.transaction_time || ""}
                  onChange={(e) => handleGlobalFieldChange('transaction_time', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 pt-1 flex items-center justify-center text-gray-600 text-xl"><FaPen /></div>
            <div className="flex-1">
              <label className="block text-gray-700 text-xs font-semibold mb-1">Description</label>
              <textarea
                rows="3"
                value={transactions[0]?.description || ""}
                onChange={(e) => handleGlobalFieldChange('description', e.target.value)}
                placeholder="Write a note..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end items-center gap-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              className="text-gray-500 font-bold text-sm hover:text-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOverCreditLimit}
              className={`px-8 py-2.5 rounded-xl font-bold shadow-md transition-all text-sm ${
                isOverCreditLimit ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-[#4caf50] text-white hover:bg-green-600 cursor-pointer'
              }`}
            >
              {dynamicSaveButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;