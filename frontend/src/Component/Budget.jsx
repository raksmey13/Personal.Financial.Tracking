import React, { useState, useEffect } from 'react';
import { FaPlus, FaChevronLeft, FaChevronRight, FaRegTrashAlt, FaFolderOpen, FaHistory, FaCheckSquare, FaSquare, FaDollarSign, FaInfoCircle, FaTags, FaChartPie, FaRegCalendarCheck, FaPercentage, FaWallet, FaShieldAlt, FaPiggyBank } from 'react-icons/fa';
import { budgetAPI, categoryAPI } from "../API/index";

const BudgetPage = ({ categories: propCategories = [] }) => {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [dateMode, setDateMode] = useState("current_month");

  const getMonthBoundaries = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { firstDay, lastDay };
  };

  const { firstDay: initialFirst, lastDay: initialLast } = getMonthBoundaries();

  // Form Field Management States
  const [formData, setFormData] = useState({
    name: "",
    strategy_type: "spending_cap", // "spending_cap" | "fixed_allocation" | "50_30_20"
    is_group_budget: false,
    selected_category_ids: [],
    limit_amount: "",
    is_rollover: false,
    start_date: initialFirst,
    end_date: initialLast,
    needs_percentage: 50,
    wants_percentage: 30,
    savings_percentage: 20
  });

  useEffect(() => {
    if (dateMode === "current_month") {
      const { firstDay, lastDay } = getMonthBoundaries();
      setFormData(prev => {
        if (prev.start_date === firstDay && prev.end_date === lastDay) return prev;
        return { ...prev, start_date: firstDay, end_date: lastDay };
      });
    }
  }, [dateMode]);

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

  // --- NATIVE SYSTEM DATA LOADER ---
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

  // --- CRUD: DELETE ---
  const handleDeleteBudget = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this strategy?")) {
      try {
        const response = await budgetAPI.delete(id);
        if (response.status === 200 || response.status === 204) {
          fetchBudgetData();
        }
      } catch (error) {
        console.error("Axios execution erasure crash:", error);
      }
    }
  };

  // --- CRUD: CREATE ---
  const handleSubmitBudget = async (e) => {
    if (e) e.preventDefault();

    if (formData.strategy_type === "50_30_20") {
      const totalPct = Number(formData.needs_percentage) + Number(formData.wants_percentage) + Number(formData.savings_percentage);
      if (totalPct !== 100) {
        alert(`Allocation error: Total percentages must add up to exactly 100%. Current total is ${totalPct}%.`);
        return;
      }
      if (formData.selected_category_ids.length === 0) {
        alert("Please select at least one category to map out as a lifestyle 'Want'.");
        return;
      }
    } else {
      if (!formData.limit_amount || parseFloat(formData.limit_amount) <= 0) {
        alert("Please enter an amount greater than 0.");
        return;
      }
      if (formData.selected_category_ids.length === 0) {
        alert("Please select at least one category to track.");
        return;
      }
    }

    try {
      let finalName = formData.name.trim();
      if (formData.strategy_type === "50_30_20") {
        finalName = finalName || `Pro Allocation Plan (${formData.needs_percentage}/${formData.wants_percentage}/${formData.savings_percentage})`;
      } else if (formData.strategy_type === "fixed_allocation" || !formData.is_group_budget) {
        const singleMatchedCat = categories.find(c => String(c.id) === String(formData.selected_category_ids[0]));
        finalName = singleMatchedCat ? singleMatchedCat.name : "Single Budget";
      }

      const payload = {
        name: finalName,
        limit_amount: formData.strategy_type === "50_30_20" ? 0.0 : parseFloat(formData.limit_amount),
        category_ids: formData.selected_category_ids.map(id => parseInt(id, 10)),
        is_group_budget: formData.strategy_type === "spending_cap" ? formData.is_group_budget : true,
        is_rollover: formData.strategy_type === "spending_cap" ? formData.is_rollover : false,
        start_date: formData.start_date,
        end_date: formData.end_date,
        strategy_type: formData.strategy_type,
        needs_percentage: formData.strategy_type === "50_30_20" ? parseInt(formData.needs_percentage, 10) : 50,
        wants_percentage: formData.strategy_type === "50_30_20" ? parseInt(formData.wants_percentage, 10) : 30,
        savings_percentage: formData.strategy_type === "50_30_20" ? parseInt(formData.savings_percentage, 10) : 20
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

  // 🟢 CASCADING SELECTION HANDLER MIGRATED NATIVELY
  const handleCategoryToggle = (id) => {
    const stringId = String(id);
    const safeCategories = Array.isArray(categories) ? categories : [];

    const clickedCategory = safeCategories.find(c => String(c.id) === stringId);
    if (!clickedCategory) return;

    // Discover if the toggled node is a main category with structural child subcategories
    const childCategories = safeCategories.filter(c => String(c.parent_id) === stringId);
    const childIds = childCategories.map(c => String(c.id));

    setFormData(prev => {
      // Static enforcement restriction mode fallback for isolated fixed target constraints
      if (prev.strategy_type === "fixed_allocation" || !prev.is_group_budget) {
        return { ...prev, selected_category_ids: [stringId] };
      }

      const isParent = childIds.length > 0;
      const isAlreadySelected = prev.selected_category_ids.includes(stringId);
      let updatedSelections = [...prev.selected_category_ids];

      if (isParent) {
        if (isAlreadySelected) {
          // Cascade Downward Deletion: Remove parent node AND all corresponding active subcategory IDs
          updatedSelections = updatedSelections.filter(x => x !== stringId && !childIds.includes(x));
        } else {
          // Cascade Downward Addition: Stack parent node AND all constituent child category sub-IDs
          const collectionSet = new Set([...updatedSelections, stringId, ...childIds]);
          updatedSelections = Array.from(collectionSet);
        }
      } else {
        if (isAlreadySelected) {
          // Individual toggle removal mapping
          updatedSelections = updatedSelections.filter(x => x !== stringId);

          // Adaptive Inverse Cleanup: Automatically pop main parent badge out if any of its subnodes are custom deselected
          if (clickedCategory.parent_id) {
            updatedSelections = updatedSelections.filter(x => x !== String(clickedCategory.parent_id));
          }
        } else {
          updatedSelections.push(stringId);

          // Adaptive Upward Fill: If a user checks off ALL children of a specific root category, light up parent node too
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
    setDateMode("current_month");
    const { firstDay, lastDay } = getMonthBoundaries();
    setFormData({
      name: "",
      strategy_type: "spending_cap",
      is_group_budget: false,
      selected_category_ids: [],
      limit_amount: "",
      is_rollover: false,
      start_date: firstDay,
      end_date: lastDay,
      needs_percentage: 50,
      wants_percentage: 30,
      savings_percentage: 20
    });
  };

  const safeBudgets = Array.isArray(budgets) ? budgets : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const getBoundCategoryNames = (item) => {
    const targetIds = [];
    if (item.category_ids_csv) {
      item.category_ids_csv.split(",").forEach(x => {
        if (x.trim()) targetIds.push(String(x.trim()));
      });
    } else if (item.category_id) {
      targetIds.push(String(item.category_id));
    }

    if (targetIds.length === 0) return "No Categories Bound";
    return safeCategories
      .filter(c => targetIds.includes(String(c.id)))
      .map(c => c.name)
      .join(", ");
  };

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
            if (item.strategy_type === "50_30_20") {
              const needs = item.needs_allocation || { pct: 50, allowed: 0, spent: 0 };
              const wants = item.wants_allocation || { pct: 30, allowed: 0, spent: 0 };
              const savings = item.savings_allocation || { pct: 20, target_goal: 0 };

              const needsProgress = round((needs.spent / needs.allowed) * 100) || 0;
              const wantsProgress = item.progress || 0;

              return (
                <div key={item.id} className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4 border-l-8 border-l-blue-500 animate-in fade-in duration-200">
                  {item.alert_message && (
                    <div className={`p-3.5 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                      item.status === "red" ? "bg-red-50 border-red-200 text-red-700" :
                      item.status === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" :
                      "bg-blue-50 border-blue-200 text-blue-700"
                    }`}>
                      {item.alert_message}
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-gray-800 text-lg font-black tracking-wide capitalize">{item.name}</h3>
                        <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                          <FaPercentage size={8} /> Pro Allocation
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-bold mt-1 flex items-center gap-1 flex-wrap">
                        <FaTags size={10} className="text-gray-300" />
                        LIFESTYLE WANTS MATCHES:
                        <span className="text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-100">{getBoundCategoryNames(item)}</span>
                      </p>
                    </div>
                    <FaRegTrashAlt onClick={() => handleDeleteBudget(item.id)} className="cursor-pointer text-gray-400 hover:text-red-600 transition-colors mt-1 text-base" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 rounded-lg text-blue-500"><FaWallet size={16} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">Combined Income Pool</span>
                        <span className="text-sm font-black text-gray-800">${parseFloat(item.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-500"><FaPiggyBank size={16} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">Committed Savings ({savings.pct}%)</span>
                        <span className="text-sm font-black text-emerald-600">${parseFloat(savings.target_goal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-500"><FaHistory size={16} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">Retained Surplus Leftovers</span>
                        <span className="text-sm font-black text-indigo-600">${parseFloat(item.retained_leftovers || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-500">
                        <span className="flex items-center gap-1 font-extrabold text-gray-700"><FaShieldAlt className="text-blue-400" size={10} /> Needs Pool ({needs.pct}%)</span>
                        <span className="text-gray-400 font-mono">Spent: ${needs.spent.toFixed(2)} / Limit: ${needs.allowed.toFixed(2)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200/40 relative">
                        <div style={{ width: `${Math.min(needsProgress, 100)}%` }} className={`h-full rounded-full transition-all duration-500 ${needsProgress >= 100 ? 'bg-red-500 animate-pulse' : needsProgress >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-500">
                        <span className="flex items-center gap-1 font-extrabold text-gray-700"><FaChartPie className="text-purple-400" size={10} /> Lifestyle Wants ({wants.pct}%)</span>
                        <span className="text-gray-400 font-mono">Spent: ${wants.spent.toFixed(2)} / Cap: ${wants.allowed.toFixed(2)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200/40 relative">
                        <div style={{ width: `${Math.min(wantsProgress, 100)}%` }} className={`h-full rounded-full transition-all duration-500 ${wantsProgress >= 100 ? 'bg-red-500 animate-pulse' : wantsProgress >= 80 ? 'bg-amber-500' : 'bg-purple-500'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const rawProgress = item.progress || 0;
            let primaryBarColor = "bg-[#4caf50]";
            if (item.status === "red") {
              primaryBarColor = "bg-red-500 animate-pulse";
            } else if (item.status === "amber") {
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
                      <span className={`${item.status === "red" ? 'text-red-500 font-black' : 'text-gray-700 font-extrabold'}`}>{rawProgress}% CONSUMED</span>
                      <span>DUE DATE: {item.end || "—"}</span>
                    </div>

                    <div className="h-4 bg-gray-100 rounded-full flex overflow-hidden relative border border-gray-200/40 shadow-inner">
                      <div style={{ width: `${Math.min(rawProgress, 100)}%` }} className={`${primaryBarColor} h-full transition-all duration-500 rounded-full`}></div>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-gray-500 pt-1">
                      <span>Spent: <span className="text-gray-800 font-black">${parseFloat(item.spent || 0).toFixed(2)}</span></span>
                      <span>{item.strategy_type === "fixed_allocation" ? "Committed Target:" : "Budget Limit:"} <span className="text-gray-800 font-black">${parseFloat(item.total || 0).toFixed(2)}</span></span>
                    </div>

                    <div className="text-xs text-gray-400 font-semibold pt-1">
                      Remaining Buffer: <span className={`font-black font-mono ml-1 text-sm ${item.residual < 0 ? 'text-red-500' : 'text-green-600'}`}>${parseFloat(item.residual || 0).toFixed(2)}</span>
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
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <form onSubmit={handleSubmitBudget} className="p-6 space-y-5">

              <div className="text-center border-b border-gray-100 pb-3">
                <h2 className="text-lg font-black tracking-wide text-gray-800 uppercase">
                  Setup Capital Strategy
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Choose between flexible spending limits or fixed commitment tracks</p>
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
                      onClick={() => setFormData({ ...formData, strategy_type: "50_30_20", is_group_budget: true, selected_category_ids: [], name: "Pro Allocation Master Strategy" })}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all flex flex-col items-center justify-center gap-1 ${formData.strategy_type === "50_30_20" ? "bg-[#3D5AFE] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <FaPercentage /> 50/30/20
                    </button>
                  </div>
                </div>

                {formData.strategy_type === "50_30_20" && (
                  <div className="space-y-3 bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100/70 animate-in slide-in-from-top-2 duration-150">
                    <label className="block text-xs font-black text-blue-900 uppercase tracking-wider">Configure Target Splits</label>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold bg-white p-2 rounded-xl border border-gray-100 mb-2">
                      <div className="text-gray-600">Needs: <span className="text-blue-600 text-xs font-black block">{formData.needs_percentage}%</span></div>
                      <div className="text-gray-600">Wants: <span className="text-purple-600 text-xs font-black block">{formData.wants_percentage}%</span></div>
                      <div className="text-gray-600">Savings: <span className="text-emerald-600 text-xs font-black block">{formData.savings_percentage}%</span></div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-0.5"><span>Needs Target</span><span>{formData.needs_percentage}%</span></div>
                        <input type="range" min="10" max="80" step="5" value={formData.needs_percentage} onChange={(e) => setFormData({...formData, needs_percentage: e.target.value})} className="w-full accent-blue-600 h-1 bg-gray-200 rounded-lg cursor-pointer" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-0.5"><span>Wants Target</span><span>{formData.wants_percentage}%</span></div>
                        <input type="range" min="10" max="60" step="5" value={formData.wants_percentage} onChange={(e) => setFormData({...formData, wants_percentage: e.target.value})} className="w-full accent-purple-600 h-1 bg-gray-200 rounded-lg cursor-pointer" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-0.5"><span>Savings Target</span><span>{formData.savings_percentage}%</span></div>
                        <input type="range" min="5" max="50" step="5" value={formData.savings_percentage} onChange={(e) => setFormData({...formData, savings_percentage: e.target.value})} className="w-full accent-emerald-600 h-1 bg-gray-200 rounded-lg cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}

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
                      placeholder="e.g., All Food & Dining, Total Household Utilities"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full p-2.5 text-sm border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-green-400 font-semibold transition-colors"
                      required
                    />
                  </div>
                )}

                {/* HIERARCHICAL SELECTION MATRIX VIEW WITH CASCADING HOOKS */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                    {formData.strategy_type === "fixed_allocation" ? "2. Choose Fixed Commitment Bill Target" : formData.strategy_type === "50_30_20" ? "2. Select Lifestyle 'Want' Categories" : formData.is_group_budget ? "2. Choose Categories for this Group" : "2. Choose Category to Track"}
                  </label>

                  <div className="border border-gray-200 rounded-2xl p-3 max-h-[180px] overflow-y-auto space-y-1.5 bg-gray-50/50 shadow-inner">
                    {safeCategories.length === 0 ? (
                      <div className="text-xs text-gray-400 italic py-4 text-center flex flex-col items-center gap-1 bg-white rounded-xl border border-gray-100">
                        <FaInfoCircle size={14} /> Fetching structural categories from network...
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
                              {(formData.is_group_budget && formData.strategy_type === "spending_cap") || formData.strategy_type === "50_30_20" ? (
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
                  {formData.strategy_type === "50_30_20" && (
                    <p className="text-[10px] text-blue-500/80 font-semibold px-1 mt-1 leading-snug">
                      💡 Unselected categories are automatically calculated as baseline mandatory "Needs" (e.g., Rent, Insurance, Utilities).
                    </p>
                  )}
                </div>

                {formData.strategy_type !== "50_30_20" && (
                  <div className="space-y-1 animate-in fade-in duration-100">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">
                      {formData.strategy_type === "fixed_allocation" ? "3. Committed Allocation Pool Amount" : "3. Spending Cap Limit Amount"}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.limit_amount}
                        onChange={(e) => setFormData({...formData, limit_amount: e.target.value})}
                        className="w-full p-3 text-sm border border-gray-200 bg-gray-50 rounded-xl pl-8 outline-none focus:bg-white focus:border-green-400 font-black transition-colors"
                        required={formData.strategy_type !== "50_30_20"}
                      />
                      <span className="absolute left-3 text-gray-400 font-bold text-sm"><FaDollarSign size={12} /></span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">4. Time-Frame Interval Window</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDateMode("current_month")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${dateMode === "current_month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      This Current Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("custom")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${dateMode === "custom" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Custom Dates
                    </button>
                  </div>

                  {dateMode === "custom" && (
                    <div className="grid grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-2 duration-150">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          className="w-full p-2 text-xs border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-green-400 font-bold text-gray-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                          {formData.strategy_type === "fixed_allocation" ? "Bill Due Deadline" : "End Date"}
                        </label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          className="w-full p-2 text-xs border border-gray-200 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-green-400 font-bold text-gray-600"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

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

              <div className="flex justify-end gap-4 pt-3 border-t border-gray-100 font-bold text-xs">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-all p-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4caf50] text-white px-5 py-2 rounded-xl hover:bg-green-600 transition-all shadow-md cursor-pointer"
                >
                  Save Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const round = (num) => Math.round(num);

export default BudgetPage;