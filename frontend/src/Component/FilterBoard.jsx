import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';

const FilterBoard = ({ accounts, categories, onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");

  // 🚀 NEW SUB-FILTER STATES
  const [selectedCategory, setSelectedCategory] = useState("all");
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
      startDate,
      endDate,
      minAmount,
      maxAmount
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterType, selectedAccount, selectedCategory, startDate, endDate, minAmount, maxAmount]);

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">

      {/* 📊 ROW 1: Core Search & Structural Options */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* 🔍 Text Search Bar (5 Columns Wide) */}
        <div className="md:col-span-5 relative">
          <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search descriptions, tags, or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200"
          />
        </div>

        {/* 🔄 Type Selector Dropdown (3 Columns Wide) */}
        <div className="md:col-span-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-bold text-gray-600 outline-none cursor-pointer appearance-none hover:bg-gray-100/50 focus:bg-white focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">🔄 All Entry Types</option>
            <option value="income">🟢 Treasury Income</option>
            <option value="expense">🔴 Direct Expenses</option>
          </select>
        </div>

        {/* 🏦 Ledger Account Dropdown Selector (4 Columns Wide) */}
        <div className="md:col-span-4">
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-bold text-gray-600 outline-none cursor-pointer appearance-none hover:bg-gray-100/50 focus:bg-white focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">🏦 All Combined Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={String(acc.id)}>📇 {acc.account_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 🚀 ROW 2: Advanced Sub-Filters Control Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 gap-4 pt-3 border-t border-dashed border-gray-100 items-center">

        {/* 🏷️ Category/Tag Picker Selector (4 Columns Wide) */}
        <div className="md:col-span-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-bold text-gray-600 outline-none cursor-pointer appearance-none hover:bg-gray-100/50 focus:bg-white focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">🏷️ All Categories / Tags</option>
            {categories.map(cat => (
              <option key={cat.id} value={String(cat.id)}>» {cat.name}</option>
            ))}
          </select>
        </div>

        {/* 📅 Date Range Inputs (4 Columns Wide) */}
        <div className="md:col-span-4 flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50/60 border border-gray-100 rounded-2xl text-[10px] font-bold text-gray-500 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
          />
          <span className="text-gray-400 text-xs font-bold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50/60 border border-gray-100 rounded-2xl text-[10px] font-bold text-gray-500 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
          />
        </div>

        {/* 💰 Amount Value Bound Fields (4 Columns Wide) */}
        <div className="md:col-span-4 flex items-center gap-2">
          <div className="relative w-1/2">
            <span className="absolute left-3 top-2.5 text-gray-400 text-[10px] font-bold">$</span>
            <input
              type="number"
              placeholder="Min Min"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full pl-6 pr-3 py-2 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>
          <span className="text-gray-400 text-xs font-bold">-</span>
          <div className="relative w-1/2">
            <span className="absolute left-3 top-2.5 text-gray-400 text-[10px] font-bold">$</span>
            <input
              type="number"
              placeholder="Max Max"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full pl-6 pr-3 py-2 bg-gray-50/60 border border-gray-100 rounded-2xl text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-200"
            />
          </div>
        </div>

      </div>

    </div>
  );
};

export default FilterBoard;