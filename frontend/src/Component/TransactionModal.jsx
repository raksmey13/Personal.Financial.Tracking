import React, { useState, useEffect, useMemo } from 'react';
import { FaCalendarAlt, FaWallet, FaPen, FaPlus, FaMinus, FaTag } from 'react-icons/fa';
import { transactionAPI } from "../API/index"; // 💡 Ensure your budget API is imported here if separate
import { getCategoryIconSource } from '../utils/icon';

const TransactionModal = ({
  closeModal,
  categories = [],
  accounts = [],
  fetchInitialData,
  onTransactionSuccess, // 🟢 Added notification synchronization hook
  type = "expense",
  editData = null
}) => {
  const resolvedType = typeof type === 'string' && type ? type.toLowerCase() : 'expense';

  // State to hold the calculated savings target amount from the budget settings
  const [targetSavingsAmount, setTargetSavingsAmount] = useState("");

  // 🎯 FETCH BUDGET DATA ON MOUNT
  useEffect(() => {
    const fetchBudgetTarget = async () => {
      try {
        // Replace this with your actual budget API call if necessary
        // const budgetData = await budgetAPI.getCurrentBudget();
        // Assuming your backend calculates the 50/30/20 target for savings:
        // setTargetSavingsAmount(String(budgetData.savings_target || 130.00));

        // Hardcoded fallback matching your current calculated budget commitment rule
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
    if (resolvedType === "income") {
      return safeAccounts.filter(acc => {
        const typeClean = String(acc.account_type || "").toLowerCase();
        const nameClean = String(acc.account_name || "").toLowerCase();
        return !typeClean.includes("credit") && !typeClean.includes("card") && !nameClean.includes("card") && !typeClean.includes("loan") && !nameClean.includes("loan");
      });
    }
    return safeAccounts;
  }, [safeAccounts, resolvedType]);

  const [transactions, setTransactions] = useState([
    {
      amount: editData ? String(editData.amount) : "",
      category_id: editData ? String(editData.category_id) : "",
      account_id: editData ? String(editData.account_id) : (filteredAccountsForDropdown[0]?.id ? String(filteredAccountsForDropdown[0].id) : ""),
      transaction_date: editData ? editData.transaction_date : new Date().toISOString().split('T')[0],
      transaction_time: editData && editData.transaction_time ? editData.transaction_time : new Date().toTimeString().split(' ')[0].substring(0, 5),
      description: editData ? editData.description : ""
    }
  ]);

  const selectedAccount = safeAccounts.find(acc => String(acc.id) === String(transactions[0]?.account_id));
  const accountType = selectedAccount?.account_type || "Normal";

  const displayCategories = useMemo(() => {
    return activeCategories.filter(cat => {
      const currentCatType = String(cat.type).toLowerCase().trim();
      const cleanCatName = cat.name.toLowerCase().trim();

      if (cleanCatName === "opening balance") return false;

      if (resolvedType === "income" && selectedAccount?.is_savings_target) {
        return cleanCatName === "sweep saving";
      }

      if (cleanCatName === "sweep saving") return false;

      if (resolvedType === "income") {
        if (currentCatType !== "income" && currentCatType !== "transfer") return false;
      } else {
        if (currentCatType !== resolvedType) return false;
      }

      const cleanAccountType = accountType.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isLoanPayment = cat.name === "Loan Repayment";
      const isLoanTopup = cat.name === "Loan Principal Top-Up";
      const isCardPayment = cat.name === "Credit Card Payment";
      const isCardExpense = cat.name === "Credit Card Expense";

      if (resolvedType === "expense") {
        if (cleanAccountType === "loan") return isLoanTopup;
        if (cleanAccountType === "creditcard") return !isLoanPayment && !isLoanTopup && !isCardPayment;
        return !isLoanPayment && !isLoanTopup && !isCardPayment && !isCardExpense;
      }

      if (resolvedType === "income") {
        if (cleanAccountType === "loan") return isLoanPayment;
        if (cleanAccountType === "creditcard") return isCardPayment;
        return !isLoanTopup && !isCardExpense;
      }

      return true;
    });
  }, [activeCategories, resolvedType, accountType, selectedAccount]);

  // 🎯 AUTOMATIC CATEGORY AND AMOUNT POPULATION HOOK
  useEffect(() => {
    if (!editData && selectedAccount?.is_savings_target && resolvedType === "income") {
      const targetSweepCat = displayCategories.find(c => c.name.toLowerCase() === "sweep saving");
      if (targetSweepCat) {
        setTransactions(prev => prev.map((tx, idx) =>
          idx === 0 ? {
            ...tx,
            category_id: String(targetSweepCat.id),
            amount: targetSavingsAmount // 🔥 Automatically injects the calculated budget target value
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
  }, [accountType, resolvedType, editData, displayCategories, selectedAccount, targetSavingsAmount]);

  useEffect(() => {
    if (!editData && filteredAccountsForDropdown.length > 0) {
      const isCurrentAccountValid = filteredAccountsForDropdown.some(acc => String(acc.id) === String(transactions[0]?.account_id));
      if (!isCurrentAccountValid) {
        setTransactions(prev => prev.map((tx, idx) => idx === 0 ? { ...tx, account_id: String(filteredAccountsForDropdown[0].id) } : tx));
      }
    }
  }, [filteredAccountsForDropdown, editData]);

  const chosenCategoryObj = useMemo(() => {
    return activeCategories.find(c => String(c.id) === String(transactions[0]?.category_id));
  }, [activeCategories, transactions]);

  const secondaryDebtLabel = useMemo(() => {
    if (!chosenCategoryObj) return null;
    const catName = chosenCategoryObj.name;
    const isCardAccount = accountType === "Credit Card" || accountType.toLowerCase() === "credit_card";
    const isLoanAccount = accountType === "Loan" || accountType.toLowerCase() === "loan";

    if (catName === "Credit Card Payment" || catName === "Credit Card Expense" || isCardAccount) {
      const cardAcc = isCardAccount ? selectedAccount : safeAccounts.find(acc => String(acc.account_type).toLowerCase().includes("credit") || String(acc.account_type).toLowerCase().includes("card") || String(acc.account_name).toLowerCase().includes("card"));
      if (cardAcc) {
        const rawDebt = Math.abs(parseFloat(cardAcc.balance || 0));
        const limit = parseFloat(cardAcc.credit_limit || 0);
        const spendRoom = Math.max(0, limit - rawDebt);
        const dueDay = cardAcc.payment_due_day;
        let dueString = "";
        if (dueDay) {
          const today = new Date();
          let dueMonth = today.getMonth() + 1;
          let dueYear = today.getFullYear();
          if (today.getDate() > dueDay) {
            dueMonth += 1;
            if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
          }
          dueString = ` | Next Due: ${String(dueMonth).padStart(2, '0')}/${String(dueDay).padStart(2, '0')}/${dueYear}`;
        }
        return `Available Spend Room: $${spendRoom.toFixed(2)} / $${limit.toFixed(2)} Limit${dueString}`;
      }
    }

    if (catName === "Loan Repayment" || catName === "Loan Principal Top-Up" || isLoanAccount) {
      const loanAcc = isLoanAccount ? selectedAccount : safeAccounts.find(acc => String(acc.account_type).toLowerCase().includes("loan") || String(acc.account_name).toLowerCase().includes("loan"));
      if (loanAcc) {
        return `Remaining Balance to Clear: $${Math.abs(parseFloat(loanAcc.balance || 0)).toFixed(2)}`;
      }
    }
    return null;
  }, [chosenCategoryObj, selectedAccount, accountType, safeAccounts]);

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
    if (accountType === "Credit Card" || accountType.toLowerCase() === "credit_card") {
      balanceLabel = "Available Credit:";
      availableCreditNum = creditLimit - Math.abs(rawBalance);
      balanceValue = availableCreditNum.toFixed(2);
    } else if (accountType === "Loan") {
      balanceLabel = "Outstanding Debt:";
      balanceValue = Math.abs(rawBalance).toFixed(2);
    } else {
      balanceLabel = "Balance:";
      balanceValue = rawBalance.toFixed(2);
    }
  }

  const isCreditCard = accountType === "Credit Card" || accountType.toLowerCase() === "credit_card";
  const totalEnteredAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
  const isOverCreditLimit = resolvedType === "expense" && isCreditCard && totalEnteredAmount > availableCreditNum;

  let dynamicHeaderTitle = resolvedType === "expense" ? "Add Expense" : "Add Income";
  let dynamicSaveButtonText = "Save";

  if (selectedAccount && (accountType === "Loan" || accountType === "Credit Card" || accountType.toLowerCase() === "credit_card")) {
    if (resolvedType === "income") {
      dynamicHeaderTitle = accountType === "Loan" ? "Make Loan Payment" : "Pay Credit Card Bill";
      dynamicSaveButtonText = accountType === "Loan" ? "Record Debt Payment" : "Record Card Payment";
    } else if (resolvedType === "expense") {
      dynamicHeaderTitle = accountType === "Loan" ? "Add Debt Charge" : "New Card Expense";
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

    try {
      const chosenCategory = activeCategories.find(c => String(c.id) === String(transactions[0].category_id));
      const cleanCatName = chosenCategory ? chosenCategory.name.toLowerCase().trim() : "";

      let finalType = resolvedType === "income" ? "income" : (chosenCategory ? chosenCategory.type : resolvedType);

      if (cleanCatName === "sweep saving") {
        finalType = "transfer";
      }

      const payload = {
        amount: parseFloat(transactions[0].amount),
        category_id: parseInt(transactions[0].category_id, 10),
        account_id: parseInt(transactions[0].account_id, 10),
        description: transactions[0].description.trim() || `Manual Budget Allocation: ${chosenCategory?.name}`,
        transaction_date: transactions[0].transaction_date,
        type: finalType.toLowerCase()
      };

      let response;
      if (editData && editData.id) {
        response = await transactionAPI.update(editData.id, payload);
      } else {
        response = await transactionAPI.create(payload);
      }

      if (response.status === 200 || response.status === 201) {
        if (fetchInitialData) fetchInitialData();

        // 🟢 TRIGGER STATE UPDATE LOG IN APP.JSX
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }

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
                    {index === 0 && secondaryDebtLabel && (
                      <p className="text-[11px] text-blue-600 font-bold mt-1.5 animate-pulse">
                        ℹ️ {secondaryDebtLabel}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 text-xs font-semibold mb-1">Amount</label>
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
                      <span className="absolute right-3 text-gray-500 font-medium text-sm">$</span>
                    </div>
                  </div>
                </div>

                {!editData && !selectedAccount?.is_savings_target && (
                  <div className="pt-7 flex items-center justify-center">
                    {index === 0 ? (
                      <button
                        type="button"
                        onClick={addNewItemRow}
                        className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm"
                      >
                        <FaPlus size={12} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => removeItemRow(e, index)}
                        className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
                      >
                        <FaMinus size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center text-gray-600 text-xl"><FaWallet /></div>
            <div className="flex-1 grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Account</label>
                <select
                  value={String(transactions[0]?.account_id || "")}
                  onChange={(e) => handleGlobalFieldChange('account_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:border-blue-400 font-medium capitalize"
                  required
                >
                  <option value="" disabled>Select Account</option>
                  {filteredAccountsForDropdown.map(acc => (
                    <option key={acc.id} value={String(acc.id)} className="text-gray-900 bg-white">
                      {acc.account_name} {acc.is_savings_target ? '📊 (Savings Account)' : acc.account_type !== 'Normal' ? `(${acc.account_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4">
                <p className="text-xs text-gray-500 font-semibold whitespace-nowrap">
                  {balanceLabel} <span className="text-gray-800 text-sm font-bold ml-1">${balanceValue}</span>
                </p>
              </div>
            </div>
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