import React, { useState, useEffect, useMemo } from 'react';
import { FaCalendarAlt, FaWallet, FaPen, FaTag } from 'react-icons/fa';
import { transactionAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';
import { useTranslation } from "react-i18next";

const TransactionModal = ({
  closeModal,
  categories = [],
  accounts = [],
  fetchInitialData,
  onTransactionSuccess,
  type = "expense",
  editData = null
}) => {
  const { t } = useTranslation();
  const resolvedType = typeof type === 'string' && type ? type.toLowerCase() : 'expense';

  const [targetSavingsAmount, setTargetSavingsAmount] = useState("");
  const [saveAndAddAnother, setSaveAndAddAnother] = useState(false);

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
      dueString = ` | ${t("transactions.due")}: ${String(dueMonth).padStart(2, '0')}/${String(dueDay).padStart(2, '0')}/${dueYear}`;
    }

    if (isCreditCard) {
      const spendRoom = Math.max(0, limit - rawDebt);
      return `${t("transactions.limit")}: ${currencySymbol}${limit.toFixed(2)} | ${t("transactions.owed")}: ${currencySymbol}${rawDebt.toFixed(2)} | ${t("transactions.avail_spend")}: ${currencySymbol}${spendRoom.toFixed(2)}${dueString}`;
    }

    if (isLoanAccount) {
      return `${t("transactions.outstanding_balance_to_clear")}: ${currencySymbol}${rawDebt.toFixed(2)}${dueString}`;
    }

    return null;
  }, [selectedAccount, isLoanAccount, isCreditCard, currencySymbol, t]);

  const renderCategoryIcon = (tx) => {
    const matchedCategory = activeCategories.find(cat => String(cat.id) === String(tx.category_id));
    if (!matchedCategory) return <div className="text-gray-400 text-sm"><FaTag /></div>;
    const finalIconSrc = getCategoryIconSource(matchedCategory) || matchedCategory.icon || "";
    if (finalIconSrc && typeof finalIconSrc === 'string') {
      return <img src={finalIconSrc} alt={matchedCategory.name} className="w-full h-full object-cover" />;
    }
    return <div className="text-gray-400 text-sm"><FaTag /></div>;
  };

  let balanceLabel = t("transactions.balance");
  let balanceValue = "0.00";
  let availableCreditNum = 0;

  if (selectedAccount) {
    const rawBalance = parseFloat(selectedAccount.balance || 0);
    const creditLimit = parseFloat(selectedAccount.credit_limit || 0);
    if (isCreditCard) {
      balanceLabel = t("accounts.available_credit");
      availableCreditNum = creditLimit - Math.abs(rawBalance);
      balanceValue = availableCreditNum.toFixed(2);
    } else if (isLoanAccount) {
      balanceLabel = t("accounts.outstanding_balance");
      balanceValue = Math.abs(rawBalance).toFixed(2);
    } else {
      balanceLabel = t("transactions.balance");
      balanceValue = rawBalance.toFixed(2);
    }
  }

  const totalEnteredAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
  const isOverCreditLimit = resolvedType === "expense" && isCreditCard && totalEnteredAmount > availableCreditNum;

  let dynamicHeaderTitle = resolvedType === "expense" ? t("transactions.add_expense") : t("transactions.add_income");
  let dynamicSaveButtonText = t("common.save");

  if (selectedAccount && isDebtAccount) {
    if (resolvedType === "income") {
      dynamicHeaderTitle = isLoanAccount ? t("transactions.make_loan_payment") : t("transactions.pay_credit_card_bill");
      dynamicSaveButtonText = isLoanAccount ? t("transactions.record_debt_payment") : t("transactions.record_card_payment");
    } else if (resolvedType === "expense") {
      dynamicHeaderTitle = isLoanAccount ? t("transactions.add_debt_charge") : t("transactions.new_card_expense");
      dynamicSaveButtonText = t("transactions.save_expense");
    }
  }

  if (selectedAccount?.is_savings_target && resolvedType === "income") {
    dynamicHeaderTitle = t("transactions.allocate_budget_to_savings");
    dynamicSaveButtonText = t("transactions.log_savings_balance");
  }

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
      alert(t("transactions.alert_select_category_amount"));
      return;
    }

    const enteredAmount = parseFloat(transactions[0].amount || 0);
    const enteredInterest = parseFloat(transactions[0].interest_amount || 0);

    if (enteredInterest > enteredAmount) {
      alert(t("transactions.alert_interest_exceed"));
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

        if (saveAndAddAnother && !editData) {
          // Reset form fields for another transaction while keeping account and date/time
          setTransactions(prev => [
            {
              ...prev[0],
              amount: "",
              category_id: "",
              interest_amount: "",
              description: ""
            }
          ]);
          setSaveAndAddAnother(false);
        } else {
          closeModal();
        }
      }
    } catch (error) {
      console.error("Transaction save tracking failure:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-colors">
      <div className="bg-white dark:bg-[#151D2A] border border-gray-100 dark:border-gray-800 rounded-[32px] p-8 max-w-xl w-full shadow-2xl relative max-h-[95vh] overflow-y-auto transition-colors custom-scrollbar">
        <h2 className="text-xl font-black text-center text-gray-800 dark:text-gray-100 tracking-wider uppercase mb-8">
          {editData ? `${t("common.edit")} ${dynamicHeaderTitle}` : dynamicHeaderTitle}
        </h2>

        <form onSubmit={handleSubmitAll} className="space-y-6">

          <div className="flex items-center gap-4 bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 transition-colors">
            <div className="w-12 h-12 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl"><FaWallet /></div>
            <div className="flex-1 grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.target_account")}</label>
                <select
                  value={String(transactions[0]?.account_id || "")}
                  onChange={(e) => handleGlobalFieldChange('account_id', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-400 font-medium capitalize cursor-pointer"
                  required
                >
                  <option value="" disabled>{t("transactions.select_account")}</option>
                  {filteredAccountsForDropdown.map(acc => (
                    <option key={acc.id} value={String(acc.id)} className="text-gray-900 dark:text-gray-100 bg-white dark:bg-[#1E293B]">
                      {acc.account_name} ({acc.currency || "USD"}) {acc.account_type !== 'Normal' ? `[${acc.account_type}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">
                  {balanceLabel} <span className="text-gray-800 dark:text-gray-100 text-sm font-bold ml-1">{currencySymbol}{balanceValue}</span>
                </p>
                {accountInfoLabel && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 leading-tight">
                    ℹ️ {accountInfoLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SOURCE ACCOUNT & INTEREST PORTION INPUTS */}
          {resolvedType === "income" && isDebtAccount && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-4 animate-in fade-in transition-colors">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.pay_from_account")}</label>
                <select
                  value={transactions[0]?.from_account_id || ""}
                  onChange={(e) => handleGlobalFieldChange('from_account_id', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium cursor-pointer"
                  required
                >
                  <option value="" disabled>{t("transactions.select_source_bank")}</option>
                  {safeAccounts
                    .filter(acc => {
                      const tType = (acc.account_type || "").toLowerCase();
                      const n = (acc.account_name || "").toLowerCase();
                      const accIsLoan = tType.includes("loan") || n.includes("loan");
                      const accIsCard = tType.includes("credit") || tType.includes("card") || n.includes("credit") || n.includes("card");
                      const accIsDebt = accIsLoan || accIsCard;

                      return !accIsDebt && String(acc.id) !== String(transactions[0]?.account_id);
                    })
                    .map(acc => (
                      <option key={acc.id} value={String(acc.id)} className="text-gray-900 dark:text-gray-100 bg-white dark:bg-[#1E293B]">
                        {acc.account_name} ({acc.currency || "USD"})
                      </option>
                    ))}
                </select>
              </div>

              {isLoanAccount && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold">{t("transactions.interest_fee_included")}</label>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{t("transactions.scenario_a_note")}</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      value={transactions[0]?.interest_amount || ""}
                      onChange={(e) => handleGlobalFieldChange('interest_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl pl-3 pr-8 py-2 text-sm bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 font-semibold focus:outline-none"
                    />
                    <span className="absolute right-3 text-gray-500 dark:text-gray-400 font-medium text-sm">{currencySymbol}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {transactions.map((tx, index) => (
              <div key={index} className="flex items-start gap-4 relative group">
                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-[#1E293B] flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200/60 dark:border-gray-700/60 shadow-sm transition-colors">
                  {renderCategoryIcon(tx)}
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.category")}</label>
                    <select
                      value={tx.category_id}
                      onChange={(e) => handleFieldChange(index, 'category_id', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium capitalize appearance-none bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 cursor-pointer"
                      required
                    >
                      <option value="">{t("transactions.select_category")}</option>
                      {displayCategories
                        .filter(cat => !cat.parent_id)
                        .map(mainCat => {
                          const subCats = displayCategories.filter(sub => String(sub.parent_id) === String(mainCat.id));
                          return (
                            <optgroup key={mainCat.id} label={mainCat.name.toUpperCase()} className="font-bold text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#151D2A]">
                              <option value={String(mainCat.id)} className="font-semibold text-gray-800 dark:text-gray-100 bg-white dark:bg-[#1E293B] pl-2">
                                {mainCat.name} ({t("transactions.main")})
                              </option>
                              {subCats.map(subCat => (
                                <option key={subCat.id} value={String(subCat.id)} className="text-gray-600 dark:text-gray-300 bg-white dark:bg-[#1E293B] pl-6">
                                    ↳ {subCat.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.total_amount_paid")} ({currentCurrency})</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        value={tx.amount}
                        onChange={(e) => handleFieldChange(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 rounded-xl pl-3 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-blue-400"
                        required
                      />
                      <span className="absolute right-3 text-gray-500 dark:text-gray-400 font-medium text-sm">{currencySymbol}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isOverCreditLimit && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold px-4 py-3 rounded-xl mt-2 flex items-center gap-2">
              ❌ {t("transactions.credit_limit_exceeded_error")}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xl"><FaCalendarAlt /></div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.date")}</label>
                <input
                  type="date"
                  value={transactions[0]?.transaction_date || ""}
                  onChange={(e) => handleGlobalFieldChange('transaction_date', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("transactions.time")}</label>
                <input
                  type="time"
                  value={transactions[0]?.transaction_time || ""}
                  onChange={(e) => handleGlobalFieldChange('transaction_time', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 pt-1 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xl"><FaPen /></div>
            <div className="flex-1">
              <label className="block text-gray-700 dark:text-gray-300 text-xs font-semibold mb-1">{t("accounts.note")}</label>
              <textarea
                rows="3"
                value={transactions[0]?.description || ""}
                onChange={(e) => handleGlobalFieldChange('description', e.target.value)}
                placeholder={t("transactions.write_a_note")}
                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={closeModal}
              className="text-gray-500 dark:text-gray-400 font-bold text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>

            {!editData && (
              <button
                type="submit"
                disabled={isOverCreditLimit}
                onClick={() => setSaveAndAddAnother(true)}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm border ${
                  isOverCreditLimit
                    ? 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600 cursor-not-allowed'
                    : 'border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer'
                }`}
              >
                {t("common.save_and_add_another", "Save & Add Another")}
              </button>
            )}

            <button
              type="submit"
              disabled={isOverCreditLimit}
              onClick={() => setSaveAndAddAnother(false)}
              className={`px-8 py-2.5 rounded-xl font-bold shadow-md transition-all text-sm ${
                isOverCreditLimit ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none' : 'bg-[#4caf50] text-white hover:bg-green-600 cursor-pointer'
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