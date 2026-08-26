import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useTranslation } from "react-i18next";

const FilterBoard = ({ accounts, categories, onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const { t } = useTranslation();
  // 🚀 SUB-FILTER STATES
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCurrency, setSelectedCurrency] = useState("all"); // 🟢 USD / KHR Filter
  const [statusFilter, setStatusFilter] = useState("all");         // 🟢 Pending / Logged Filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Automatically trigger updates to the main page whenever any filter parameter changes
  useEffect(() => {
    onFilterChange({
      searchTerm,
      filterType,
      selectedAccount,
      selectedCategory,
      selectedCurrency,
      statusFilter,
      startDate,
      endDate,
      minAmount,
      maxAmount
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    filterType,
    selectedAccount,
    selectedCategory,
    selectedCurrency,
    statusFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount
  ]);

  return (
    <div className="bg-white dark:bg-[#151D2A] p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 transition-colors">

  {/* 📊 ROW 1: Core Search, Type Selector, Account & Currency Selectors */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">

    {/* 🔍 Text Search Bar (4 Columns Wide) */}
    <div className="md:col-span-4 relative">
      <FaSearch className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500 text-xs" />
      <input
        type="text"
        placeholder={t("filter.search_placeholder")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-11 pr-4 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200"
      />
    </div>

    {/* 🔄 Type Selector: Income, Expense, Transfer (3 Columns Wide) */}
    <div className="md:col-span-3">
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      >
        <option value="all">🔄 {t("filter.all_types")}</option>
        <option value="income">🟢 {t("transactions.income")}</option>
        <option value="expense">🔴 {t("transactions.expense")}</option>
        <option value="transfer">🔵 {t("filter.transfer")}</option>
      </select>
    </div>

    {/* 🏦 Ledger Account Dropdown Selector (3 Columns Wide) */}
    <div className="md:col-span-3">
      <select
        value={selectedAccount}
        onChange={(e) => setSelectedAccount(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      >
        <option value="all">🏦 {t("filter.all_accounts")}</option>
        {accounts.map(acc => (
          <option key={acc.id} value={String(acc.id)}>📇 {acc.account_name}</option>
        ))}
      </select>
    </div>

    {/* 💱 Currency Selector: USD / KHR (2 Columns Wide) */}
    <div className="md:col-span-2">
      <select
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      >
        <option value="all">💱 {t("filter.all_currencies")}</option>
        <option value="USD">💵 USD ($)</option>
        <option value="KHR">៛ KHR (៛)</option>
      </select>
    </div>

  </div>

  {/* 🚀 ROW 2: Advanced Sub-Filters Control Deck */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 pt-3 border-t border-dashed border-gray-100 dark:border-gray-800 items-center">

    {/* 🏷️ Category/Tag Picker Selector (3 Columns Wide) */}
    <div className="md:col-span-3">
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      >
        <option value="all">🏷️ {t("filter.all_categories")}</option>
        {categories.map(cat => (
          <option key={cat.id} value={String(cat.id)}>» {cat.name}</option>
        ))}
      </select>
    </div>

    {/* 📥 Status / Pending Selector (3 Columns Wide) */}
    <div className="md:col-span-3">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      >
        <option value="all">📥 {t("filter.all_statuses")}</option>
        <option value="logged">✅ {t("filter.logged_transactions")}</option>
        <option value="pending">🟡 {t("transactions.pending_inbox")}</option>
      </select>
    </div>

    {/* 📅 Date Range Inputs (3 Columns Wide) */}
    <div className="md:col-span-3 flex items-center gap-1.5">
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full px-2 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold text-gray-500 dark:text-gray-300 outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      />
      <span className="text-gray-400 dark:text-gray-500 text-xs font-bold">{t("filter.to")}</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="w-full px-2 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold text-gray-500 dark:text-gray-300 outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
      />
    </div>

    {/* 💰 Amount Value Bound Fields (3 Columns Wide) */}
    <div className="md:col-span-3 flex items-center gap-1.5">
      <div className="relative w-1/2">
        <span className="absolute left-2.5 top-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold">$</span>
        <input
          type="number"
          placeholder={t("filter.min")}
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          className="w-full pl-5 pr-2 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
        />
      </div>
      <span className="text-gray-400 dark:text-gray-500 text-xs font-bold">-</span>
      <div className="relative w-1/2">
        <span className="absolute left-2.5 top-2 text-gray-400 dark:text-gray-500 text-[10px] font-bold">$</span>
        <input
          type="number"
          placeholder={t("filter.max")}
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          className="w-full pl-5 pr-2 py-2 bg-gray-50/60 dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:bg-white dark:focus:bg-[#151D2A] focus:border-blue-500 transition-all duration-200"
        />
      </div>
    </div>

  </div>

</div>
  );
};

export default FilterBoard;