import React, { useState, useEffect } from 'react';
import { FaPlus, FaChevronLeft, FaChevronRight, FaRegTrashAlt, FaFolderOpen, FaHistory, FaCheckSquare, FaSquare, FaDollarSign, FaInfoCircle, FaTags, FaChartPie, FaRegCalendarCheck, FaPercentage, FaWallet } from 'react-icons/fa';
import API, { budgetAPI, categoryAPI } from "../API/index";

const BudgetPage = ({ categories: propCategories = [] }) => {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // 🟢 Helper Function for Multi-Currency Formatting
  const formatMoney = (val, currency = "USD") => {
    const isKHR = String(currency).toUpperCase().trim() === "KHR";
    const symbol = isKHR ? "៛" : "$";
    const num = Math.abs(val || 0);
    const formatted = isKHR
      ? num.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `${val < 0 ? '-' : ''}${symbol}${formatted}`;
  };

  // 🟢 DYNAMIC BUCKET STATE INITIATED WITH RELATIONAL CATEGORY ARRAYS
  const [formData, setFormData] = useState({
    name: "",
    strategy_type: "spending_cap",
    is_group_budget: false,
    selected_category_ids: [],
    limit_amount: "",
    currency: "USD",
    is_rollover: false,
    buckets: [
      { bucket_name: "Needs", percentage: 50, category_ids: [] },
      { bucket_name: "Wants", percentage: 30, category_ids: [] },
      { bucket_name: "Savings", percentage: 20, category_ids: [] }
    ]
  });

  const totalStrategyPercentage = formData.buckets.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);

  // --- CRUD: READ BUDGET METRICS ---
  const fetchBudgetData = async () => {
    try {
      const response = await budgetAPI.getCalculated();
      if (response && response.data) {
        setBudgets(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Axios engine budget retrieval failure:", error);
      setBudgets([]);
    }
  };

  const fetchCategoriesNatively = async () => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
      return;
    }
    try {
      const response = await categoryAPI.getAll();
      if (response && response.data) {
        setCategories(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Native self-contained budget categories download crash:", error);
      setCategories([]);
    }
  };

  const propCategoriesLength = propCategories?.length;
  useEffect(() => {
    fetchBudgetData();
    fetchCategoriesNatively();
  }, [propCategoriesLength]);

  // --- CRUD: DELETE (Soft Deactivate) ---
  const handleDeleteBudget = async (id, isStrategy = false) => {
    if (window.confirm("Are you sure you want to deactivate this rule?")) {
      try {
        if (isStrategy) {
          const response = await API.delete('/budgets/strategy/');
          if (response.status === 200 || response.status === 204) {
            fetchBudgetData();
          }
          return;
        }

        const response = await budgetAPI.delete(id);
        if (response.status === 200 || response.status === 204) {
          fetchBudgetData();
        }
      } catch (error) {
        console.error("Axios execution erasure crash:", error);
        alert("Failed to delete. Please check your connection.");
      }
    }
  };

  // --- DYNAMIC BUCKET HANDLERS ---
  const handleBucketChange = (index, field, value) => {
    const updatedBuckets = [...formData.buckets];
    if (field === 'percentage') {
      updatedBuckets[index][field] = value === '' ? '' : Number(value);
    } else {
      updatedBuckets[index][field] = value;
    }
    setFormData({ ...formData, buckets: updatedBuckets });
  };

  const handleAddBucket = () => {
    setFormData({
      ...formData,
      buckets: [...formData.buckets, { bucket_name: "New Bucket", percentage: "", category_ids: [] }]
    });
  };

  const handleRemoveBucket = (index) => {
    const updatedBuckets = formData.buckets.filter((_, i) => i !== index);
    setFormData({ ...formData, buckets: updatedBuckets });
  };

  // Handles category selection for specific master allocation buckets
  const handleBucketCategoryToggle = (bucketIndex, categoryId) => {
    const numericId = Number(categoryId);
    const updatedBuckets = [...formData.buckets];
    const currentCats = updatedBuckets[bucketIndex].category_ids || [];

    if (currentCats.includes(numericId)) {
      updatedBuckets[bucketIndex].category_ids = currentCats.filter(id => id !== numericId);
    } else {
      updatedBuckets[bucketIndex].category_ids = [...currentCats, numericId];
    }
    setFormData({ ...formData, buckets: updatedBuckets });
  };

  // --- CRUD: CREATE ---
  const handleSubmitBudget = async (e) => {
    if (e) e.preventDefault();

    // 🟢 ROUTE A: MASTER ALLOCATION STRATEGY
    if (formData.strategy_type === "master_allocation") {
      if (totalStrategyPercentage !== 100) {
        alert(`Allocation error: Total percentages must add up to exactly 100%. Current total is ${totalStrategyPercentage}%.`);
        return;
      }

      const payload = {
        name: formData.name.trim() || `Master Allocation Strategy (${formData.buckets.length} Buckets)`,
        items: formData.buckets.map(b => ({
          bucket_name: b.bucket_name,
          percentage: Number(b.percentage) || 0,
          category_ids: (b.category_ids || []).map(id => parseInt(id, 10))
        }))
      };

      try {
        const response = await API.put('/budgets/strategy/', payload);
        if (response.status === 200 || response.status === 201) {
          handleCloseModal();
          fetchBudgetData();
        }
      } catch (error) {
        console.error("Failed to inject tracking rule configuration:", error);
        alert("Failed to save strategy. Please check backend connection.");
      }
      return;
    }

    // 🟢 ROUTE B: STANDARD SPENDING CAP / FIXED LIMIT
    if (!formData.limit_amount || parseFloat(formData.limit_amount) <= 0) {
      alert("Please enter an amount greater than 0.");
      return;
    }
    if (formData.selected_category_ids.length === 0) {
      alert("Please select at least one category to track.");
      return;
    }

    try {
      let finalName = formData.name.trim();
      if (formData.strategy_type === "fixed_allocation" || !formData.is_group_budget) {
        const singleMatchedCat = categories.find(c => String(c.id) === String(formData.selected_category_ids[0]));
        finalName = singleMatchedCat ? singleMatchedCat.name : "Single Budget";
      }

      const payload = {
        name: finalName,
        limit_amount: parseFloat(formData.limit_amount),
        currency: formData.currency || "USD",
        category_ids: formData.selected_category_ids.map(id => parseInt(id, 10)),
        is_group_budget: formData.strategy_type === "spending_cap" ? formData.is_group_budget : true,
        is_rollover: formData.strategy_type === "spending_cap" ? formData.is_rollover : false,
        strategy_type: formData.strategy_type
      };

      const response = await budgetAPI.create(payload);
      if (response.status === 200 || response.status === 201) {
        handleCloseModal();
        fetchBudgetData();
      }
    } catch (error) {
      console.error("Failed to inject tracking rule configuration:", error);
    }
  };

  const handleCategoryToggle = (id) => {
    const stringId = String(id);
    const safeCategories = Array.isArray(categories) ? categories : [];
    const clickedCategory = safeCategories.find(c => String(c.id) === stringId);
    if (!clickedCategory) return;

    const childCategories = safeCategories.filter(c => String(c.parent_id) === stringId);
    const childIds = childCategories.map(c => String(c.id));

    setFormData(prev => {
      if (prev.strategy_type === "fixed_allocation" || !prev.is_group_budget) {
        return { ...prev, selected_category_ids: [stringId] };
      }

      const isParent = childIds.length > 0;
      const isAlreadySelected = prev.selected_category_ids.includes(stringId);
      let updatedSelections = [...prev.selected_category_ids];

      if (isParent) {
        if (isAlreadySelected) {
          updatedSelections = updatedSelections.filter(x => x !== stringId && !childIds.includes(x));
        } else {
          const collectionSet = new Set([...updatedSelections, stringId, ...childIds]);
          updatedSelections = Array.from(collectionSet);
        }
      } else {
        if (isAlreadySelected) {
          updatedSelections = updatedSelections.filter(x => x !== stringId);
          if (clickedCategory.parent_id) {
            updatedSelections = updatedSelections.filter(x => x !== String(clickedCategory.parent_id));
          }
        } else {
          updatedSelections.push(stringId);
          if (clickedCategory.parent_id) {
            const parentIdStr = String(clickedCategory.parent_id);
            const siblingNodes = safeCategories.filter(c => String(c.parent_id) === parentIdStr);
            const allSiblingsSelected = siblingNodes.every(sib => updatedSelections.includes(String(sib.id)));
            if (allSiblingsSelected && !updatedSelections.includes(parentIdStr)) {
              updatedSelections.push(parentIdStr);
            }
          }
        }
      }
      return { ...prev, selected_category_ids: updatedSelections };
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      name: "",
      strategy_type: "spending_cap",
      is_group_budget: false,
      selected_category_ids: [],
      limit_amount: "",
      currency: "USD",
      is_rollover: false,
      buckets: [
        { bucket_name: "Needs", percentage: 50, category_ids: [] },
        { bucket_name: "Wants", percentage: 30, category_ids: [] },
        { bucket_name: "Savings", percentage: 20, category_ids: [] }
      ]
    });
  };

  const safeBudgets = Array.isArray(budgets) ? budgets : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const getBoundCategoryNames = (item) => {
    const targetIds = item.category_ids ? item.category_ids.map(id => String(id)) : [];
    if (targetIds.length === 0) return "Global Strategy Rules";
    return safeCategories
      .filter(c => targetIds.includes(String(c.id)))
      .map(c => c.name)
      .join(", ");
  };

  const poolColors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500'];
  const poolTextColors = ['text-blue-700', 'text-purple-700', 'text-emerald-700', 'text-amber-700', 'text-indigo-700', 'text-rose-700'];

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-8 relative">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
          <button type="button" className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
            <FaChevronLeft className="text-gray-600 text-xs" />
          </button>
          <h2 className="font-black text-sm tracking-widest text-gray-700 uppercase">Active Budgets & Allocations</h2>
          <button type="button" className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
            <FaChevronRight className="text-gray-600 text-xs" />
          </button>
        </div>

        {/* Budget List Display */}
        <div className="space-y-6">
          {safeBudgets.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold text-sm tracking-wide">
              No active allocations found. Click the green button below to create one!
            </div>
          ) : safeBudgets.map((item) => {

            // 🟢 RENDER UNIFIED MULTI-CURRENCY MASTER STRATEGY BUCKETS
            if (item.strategy_type === "master_allocation") {
              const incomePoolUSD = parseFloat(item.income_pool || 0);
              const incomePoolKHR = parseFloat(item.income_pool_khr || 0);

              return (
                <div key={item.id} className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4 border-l-8 border-l-blue-500 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-gray-800 text-lg font-black tracking-wide capitalize">{item.name}</h3>
                        <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                          <FaPercentage size={8} /> Pro Allocation
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-bold mt-1 flex items-center gap-1 flex-wrap">
                        <FaWallet size={10} className="text-gray-300" />
                        TOTAL COMBINED MONTHLY INCOME POOL:
                        <span className="text-emerald-600 font-black tracking-wider ml-1">
                          {formatMoney(incomePoolUSD, "USD")} <span className="text-gray-400">({formatMoney(incomePoolKHR, "KHR")})</span>
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-4 text-gray-400 text-base">
                      <FaRegTrashAlt onClick={() => handleDeleteBudget(item.id, true)} className="cursor-pointer hover:text-red-600 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    {item.buckets && item.buckets.map((bucket, idx) => {
                      const pct = parseFloat(bucket.percentage).toFixed(1);
                      const spentUSD = Math.abs(parseFloat(bucket.spent_usd ?? bucket.spent_amount ?? 0));
                      const capUSD = parseFloat(bucket.allowed_usd ?? bucket.allowed_amount ?? 0);
                      const capKHR = parseFloat(bucket.allowed_khr ?? (capUSD * 4000));

                      const progress = capUSD > 0 ? Math.min((spentUSD / capUSD) * 100, 100) : 0;

                      const barColor = poolColors[idx % poolColors.length];
                      const textColor = poolTextColors[idx % poolTextColors.length];

                      return (
                        <div key={idx} className="space-y-1.5 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100">
                          <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                            <span className={`flex items-center gap-1 font-extrabold ${textColor}`}>
                              <FaChartPie size={10} /> {bucket.bucket_name} ({pct}%)
                            </span>
                            <span className="text-gray-500 font-mono text-[11px]">
                              Spent: <strong className="text-gray-800">{formatMoney(spentUSD, "USD")}</strong> / Cap: {formatMoney(capUSD, "USD")} <span className="text-gray-400">({formatMoney(capKHR, "KHR")})</span>
                            </span>
                          </div>

                          <div className="h-3 bg-gray-200/60 rounded-full overflow-hidden border border-gray-200/40 relative">
                            <div
                              style={{ width: `${Math.max(0, progress)}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                progress >= 100 ? 'bg-red-500 animate-pulse' : progress >= 80 ? 'bg-amber-500' : barColor
                              }`}
                            />
                          </div>

                          {bucket.category_ids && bucket.category_ids.length > 0 && (
                            <div className="text-[9px] text-gray-400 font-medium mt-1 truncate">
                              Includes: {safeCategories.filter(c => bucket.category_ids.includes(c.id)).map(c => c.name).join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 🟢 RENDER STANDARD CATEGORY BUDGETS
            const bCurrency = item.currency || "USD";
            const rawSpent = Math.abs(parseFloat(item.spent || 0));
            const rawTotal = parseFloat(item.total || 0);
            const rawProgress = rawTotal > 0 ? Math.round((rawSpent / rawTotal) * 100) : 0;
            const remainingBuffer = rawTotal - rawSpent;

            let primaryBarColor = "bg-[#4caf50]";
            if (item.status === "red" || rawProgress >= 100) {
              primaryBarColor = "bg-red-500 animate-pulse";
            } else if (item.status === "amber" || rawProgress >= 80) {
              primaryBarColor = "bg-amber-500";
            }

            return (
              <div key={item.id} className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4 hover:shadow-lg transition-shadow">
                {item.alert_message && (
                  <div className={`p-3.5 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                    item.status === "red" ? "bg-red-50 border-red-200 text-red-700" :
                    item.status === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" :
                    "bg-green-50 border-green-200 text-green-700"
                  }`}>
                    {item.alert_message}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-gray-800 text-lg font-black tracking-wide capitalize">{item.name}</h3>
                      {item.is_group_budget && <span className="bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1"><FaFolderOpen /> Group Envelope</span>}
                      {item.is_rollover && <span className="bg-purple-50 text-purple-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1"><FaHistory /> Rollover</span>}
                      <span className="text-[10px] bg-gray-100 text-gray-700 font-extrabold px-2 py-0.5 rounded-full border border-gray-200 uppercase">
                        {bCurrency}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
                      <FaTags size={10} className="text-gray-300" />
                      TRACKING: <span className="text-gray-600 font-medium capitalize bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100/60">{getBoundCategoryNames(item)}</span>
                    </p>
                  </div>
                  <div className="flex gap-4 text-gray-400 text-base">
                    <FaRegTrashAlt onClick={() => handleDeleteBudget(item.id)} className="cursor-pointer hover:text-red-600 transition-colors" />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <img src={item.img} alt="Identicon" className="w-14 h-14 rounded-full bg-gray-50 border-2 border-gray-100 object-cover flex-shrink-0" />

                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[11px] font-bold text-gray-400 px-0.5 tracking-wider">
                      <span>START: {item.start || "—"}</span>
                      <span className={`${rawProgress >= 100 ? 'text-red-500 font-black' : 'text-gray-700 font-extrabold'}`}>{rawProgress}% CONSUMED</span>
                      <span>DUE DATE: {item.end || "—"}</span>
                    </div>

                    <div className="h-4 bg-gray-100 rounded-full flex overflow-hidden relative border border-gray-200/40 shadow-inner">
                      <div style={{ width: `${Math.max(0, Math.min(rawProgress, 100))}%` }} className={`${primaryBarColor} h-full transition-all duration-500 rounded-full`}></div>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-gray-500 pt-1">
                      <span>Spent: <span className="text-gray-800 font-black">{formatMoney(rawSpent, bCurrency)}</span></span>
                      <span>{item.strategy_type === "fixed_allocation" ? "Committed Target:" : "Budget Limit:"} <span className="text-gray-800 font-black">{formatMoney(rawTotal, bCurrency)}</span></span>
                    </div>

                    <div className="text-xs text-gray-400 font-semibold pt-1">
                      Remaining Buffer: <span className={`font-black font-mono ml-1 text-sm ${remainingBuffer < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatMoney(remainingBuffer, bCurrency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-10 right-10 w-16 h-16 bg-[#4caf50] text-white rounded-full flex items-center justify-center text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 cursor-pointer"
      >
        <FaPlus />
      </button>

      {/* --- STRATEGY CONFIGURATION MODAL FORM --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">

            <form onSubmit={handleSubmitBudget} className="flex flex-col h-full overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto">

                <div className="text-center border-b border-gray-100 pb-3">
                  <h2 className="text-lg font-black tracking-wide text-gray-800 uppercase">
                    Setup Capital Strategy
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Choose between flexible spending limits or global allocation percentages</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">A. Select Strategy Mode Type</label>
                    <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, strategy_type: "spending_cap", is_group_budget: false, selected_category_ids: [], name: "" })}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all flex flex-col items-center justify-center gap-1 ${formData.strategy_type === "spending_cap" ? "bg-[#3D5AFE] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <FaChartPie /> Cap
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, strategy_type: "fixed_allocation", is_group_budget: false, selected_category_ids: [], name: "" })}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all flex flex-col items-center justify-center gap-1 ${formData.strategy_type === "fixed_allocation" ? "bg-[#3D5AFE] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <FaRegCalendarCheck /> Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, strategy_type: "master_allocation", is_group_budget: true, selected_category_ids: [], name: "Master Allocation Strategy" })}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all flex flex-col items-center justify-center gap-1 ${formData.strategy_type === "master_allocation" ? "bg-[#3D5AFE] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <FaPercentage /> Global Alloc.
                      </button>
                    </div>
                  </div>

                  {/* DYNAMIC BUCKET BUILDER INTERFACE */}
                  {formData.strategy_type === "master_allocation" && (
                    <div className="space-y-3 bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100/70 animate-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-blue-900 uppercase tracking-wider">Custom Allocation Buckets</label>
                        <button
                          type="button"
                          onClick={handleAddBucket}
                          className="bg-white border border-blue-200 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-md hover:bg-blue-50 transition-colors shadow-sm"
                        >
                          + Add Bucket
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {formData.buckets.map((bucket, index) => (
                          <div key={index} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={bucket.bucket_name}
                                onChange={(e) => handleBucketChange(index, 'bucket_name', e.target.value)}
                                placeholder="e.g. Needs, Debt"
                                className="flex-1 w-full bg-gray-50 border border-gray-100 p-2 text-xs font-bold rounded-lg outline-none focus:border-blue-400"
                                required
                              />
                              <div className="relative w-24 flex-shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={bucket.percentage}
                                  onChange={(e) => handleBucketChange(index, 'percentage', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-100 p-2 text-xs font-black text-right pr-6 rounded-lg outline-none focus:border-blue-400"
                                  required
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-gray-400 font-black">%</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveBucket(index)}
                                disabled={formData.buckets.length <= 1}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <FaRegTrashAlt size={14} />
                              </button>
                            </div>

                            {/* Category Selection Pills for this bucket */}
                            <div className="pt-1 border-t border-gray-100 mt-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase mb-1.5 block">
                                Assigned Categories
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {safeCategories
                                  .filter(cat => cat.type === "expense" || cat.type === "transfer")
                                  .map((cat) => {
                                    const catIdNum = Number(cat.id);
                                    const isSelected = (bucket.category_ids || []).includes(catIdNum);

                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleBucketCategoryToggle(index, cat.id)}
                                        className={`text-[9px] px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                                          isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                      >
                                        {cat.name}
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-blue-100/60 mt-2 px-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Total Allocation</span>
                        <span className={`text-sm font-black ${totalStrategyPercentage === 100 ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
                          {totalStrategyPercentage}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* STANDARD CONFIGURATIONS */}
                  {formData.strategy_type === "spending_cap" && (
                    <div className="space-y-1.5 animate-in fade-in duration-100">
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">1. Budget Scope Strategy</label>
                      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_group_budget: false, selected_category_ids: [], name: "" })}
                          className={`py-2 text-xs font-bold rounded-lg transition-all ${!formData.is_group_budget ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Single Category
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_group_budget: true, selected_category_ids: [] })}
                          className={`py-2 text-xs font-bold rounded-lg transition-all ${formData.is_group_budget ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Group Umbrella
                        </button>
                      </div>
                    </div>
                  )}

                  {formData.is_group_budget && formData.strategy_type === "spending_cap" && (
                    <div className="animate-in slide-in-from-top-2 duration-150">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Group Collection Name</label>
                      <input
                        type="text"
                        placeholder="e.g., All Food & Dining"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-2.5 text-sm border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-green-400 font-semibold transition-colors"
                        required={formData.strategy_type !== "master_allocation"}
                      />
                    </div>
                  )}

                  {formData.strategy_type !== "master_allocation" && (
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                        {formData.strategy_type === "fixed_allocation" ? "2. Choose Fixed Commitment Target" : formData.is_group_budget ? "2. Choose Categories for Group" : "2. Choose Category to Track"}
                      </label>

                      <div className="border border-gray-200 rounded-2xl p-3 max-h-[140px] overflow-y-auto space-y-1.5 bg-gray-50/50 shadow-inner">
                        {safeCategories.length === 0 ? (
                          <div className="text-xs text-gray-400 italic py-4 text-center flex flex-col items-center gap-1 bg-white rounded-xl border border-gray-100">
                            <FaInfoCircle size={14} /> Fetching network categories...
                          </div>
                        ) : (
                          (() => {
                            const expenseCategories = safeCategories.filter(cat => {
                              const nameLower = cat.name.toLowerCase();
                              const isSystemCat = nameLower.includes("opening balance") || nameLower.includes("payment") || nameLower.includes("top-up");
                              return cat.type === "expense" && !isSystemCat;
                            });

                            const mainCategories = expenseCategories.filter(cat => !cat.parent_id);
                            const subCategories = expenseCategories.filter(cat => cat.parent_id);

                            const orderedCategories = [];
                            mainCategories.forEach(main => {
                              orderedCategories.push({ ...main, isSub: false });
                              const children = subCategories.filter(sub => String(sub.parent_id) === String(main.id));
                              children.forEach(child => {
                                orderedCategories.push({ ...child, isSub: true });
                              });
                            });

                            return orderedCategories.map(cat => {
                              const isChecked = formData.selected_category_ids.includes(String(cat.id));
                              return (
                                <div key={cat.id}
                                     onClick={() => handleCategoryToggle(cat.id)}
                                     className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${
                                       cat.isSub ? 'ml-6 border-dashed scale-95 origin-left' : ''
                                     } ${
                                       isChecked
                                         ? 'bg-white border-green-200 text-green-700 shadow-sm font-bold'
                                         : 'border-transparent bg-white/40 text-gray-600 hover:bg-white hover:shadow-sm'
                                     }`}
                                >
                                  {(formData.is_group_budget && formData.strategy_type === "spending_cap") ? (
                                    isChecked ? <FaCheckSquare className="text-green-500 text-sm flex-shrink-0" /> : <FaSquare className="text-gray-300 text-sm flex-shrink-0" />
                                  ) : (
                                    isChecked ? (
                                      <div className="w-3.5 h-3.5 rounded-full border-4 border-green-500 bg-white flex items-center justify-center flex-shrink-0"></div>
                                    ) : (
                                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 bg-white flex-shrink-0"></div>
                                    )
                                  )}

                                  <span className={`text-xs capitalize ${cat.isSub ? 'text-gray-500 font-medium' : 'font-bold text-gray-800'}`}>
                                    {cat.isSub && <span className="text-gray-300 mr-1.5 font-mono">↳</span>}
                                    {cat.name}
                                  </span>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  )}

                  {formData.strategy_type !== "master_allocation" && (
                    <div className="space-y-1 animate-in fade-in duration-100">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                        {formData.strategy_type === "fixed_allocation" ? "3. Committed Allocation Amount" : "3. Spending Cap Limit Amount"}
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="p-3 text-xs border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white font-black"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="KHR">KHR (៛)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                        <div className="relative flex-1 flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.limit_amount}
                            onChange={(e) => setFormData({...formData, limit_amount: e.target.value})}
                            className="w-full p-3 text-sm border border-gray-200 bg-gray-50 rounded-xl pl-8 outline-none focus:bg-white focus:border-green-400 font-black transition-colors"
                            required={formData.strategy_type !== "master_allocation"}
                          />
                          <span className="absolute left-3 text-gray-400 font-bold text-sm"><FaDollarSign size={12} /></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.strategy_type === "spending_cap" && (
                    <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-2xl border border-purple-100/60 cursor-pointer select-none animate-in fade-in duration-100"
                         onClick={() => setFormData({ ...formData, is_rollover: !formData.is_rollover })}
                    >
                      <div className="flex items-start gap-2.5">
                        <FaHistory className="text-purple-500 mt-0.5" size={14} />
                        <div>
                          <label className="block text-xs font-bold text-purple-900">Carryover Leftover Savings</label>
                          <p className="text-[10px] text-purple-600/70 max-w-[240px]">Unspent money rolls forward into next month's pocket pool.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.is_rollover}
                        onChange={(e) => setFormData({...formData, is_rollover: e.target.checked})}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-purple-600 rounded border-purple-200 focus:ring-purple-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 p-5 bg-gray-50 border-t border-gray-100 font-bold text-xs mt-auto">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-all p-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formData.strategy_type === "master_allocation" && totalStrategyPercentage !== 100}
                  className="bg-[#4caf50] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl hover:bg-green-600 transition-all shadow-md cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPage;