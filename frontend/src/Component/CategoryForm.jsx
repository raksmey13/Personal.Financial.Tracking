import React, { useState, useEffect, useRef } from 'react';
import { FaTag, FaRegTrashAlt, FaPlus, FaMinus, FaHome, FaShoppingCart, FaCar, FaHeart, FaEdit, FaChevronDown, FaChevronUp } from "react-icons/fa";
import TransactionModal from "./TransactionModal";
import { categoryAPI, accountAPI, transactionAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';

const CategoryForm = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showIncomeExpenseModal, setShowIncomeExpenseModal] = useState(null); // "income" | "expense" | null
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  // 🚀 PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 🚀 ACCORDION STATE: Keeps track of which main category IDs are expanded
  const [expandedCategoryIds, setExpandedCategoryIds] = useState([]);

  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    icon: 'tag',
    type: 'expense',
    parent_id: ''
  });

  const iconList = [
    { name: 'tag', icon: <FaTag /> },
    { name: 'home', icon: <FaHome /> },
    { name: 'cart', icon: <FaShoppingCart /> },
    { name: 'car', icon: <FaCar /> },
    { name: 'heart', icon: <FaHeart /> }
  ];

  const fetchInitialData = async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        categoryAPI.getAll(),
        accountAPI.getAll()
      ]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
    } catch (error) {
      console.error("Axios sync breakdown in categories layout:", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 🛠️ FIXED: Filters out system transfer rows so they never clutter your dropdown list
  const validParentCategories = categories.filter(cat => {
    const isMainCategory = cat.parent_id === null || cat.parent_id === undefined;
    const isNotSelf = cat.id !== editingCategoryId;
    const isNotTransfer = cat.type !== 'transfer'; // Hides system transfer rows

    const catNameLower = cat.name.toLowerCase();
    const isNotSystemRow =
      !catNameLower.includes("top-up") &&
      !catNameLower.includes("principal") &&
      !catNameLower.includes("opening balance");

    return isMainCategory && isNotSelf && isNotTransfer && isNotSystemRow;
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setFormData(prev => ({ ...prev, icon: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderCategoryIcon = (iconValue, categoryObj = null) => {
    let finalSrc = iconValue;
    if (categoryObj) {
      const systemSrc = getCategoryIconSource(categoryObj);
      if (systemSrc) {
        finalSrc = systemSrc;
      }
    }

    if (!finalSrc) return <FaTag />;

    if (typeof finalSrc === 'string' && (finalSrc.startsWith('data:image') || finalSrc.includes('/') || finalSrc.includes('.'))) {
      return <img src={finalSrc} alt="category-icon" className="w-full h-full object-cover rounded-full" />;
    }

    const found = iconList.find(i => i.name === finalSrc);
    return found ? found.icon : <FaTag />;
  };

  const closeModal = () => setShowIncomeExpenseModal(null);

  const openTransactionModal = (type) => {
    setShowIncomeExpenseModal(type);
  };

  const handleSaveCategory = async (e) => {
    if (e) e.preventDefault();

    const payload = {
      name: formData.name.trim(),
      icon: formData.icon,
      type: formData.type,
      parent_id: formData.parent_id ? parseInt(formData.parent_id) : null
    };

    try {
      let response;
      if (editingCategoryId) {
        response = await categoryAPI.update(editingCategoryId, payload);
      } else {
        response = await categoryAPI.create(payload);
      }

      if (response.status === 200 || response.status === 201) {
          if (editingCategoryId) {
          alert("Category updated successfully!");
        } else {
          alert("Category created successfully!");
        }
        setFormData({ name: '', icon: 'tag', type: 'expense', parent_id: '' });
        setEditingCategoryId(null);
        fetchInitialData();
      }
    } catch (error) {
      console.error("Axios save error on category object:", error);
      alert(error.response?.data?.detail || "An error occurred while saving category.");
    }
  };

  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setFormData({
      name: cat.name,
      icon: cat.icon || 'tag',
      type: cat.type,
      parent_id: cat.parent_id ? String(cat.parent_id) : ''
    });
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Are you sure you want to delete this category? If it's a main category, its subcategories will be detached.")) {
      try {
        const response = await categoryAPI.delete(id);
        if (response.status === 200) {
          alert("Category deleted successfully!");
          fetchInitialData();
          const totalMain = categories.filter((cat) => cat.parent_id === null).length - 1;
          const maxPage = Math.ceil(totalMain / itemsPerPage) || 1;
          if (currentPage > maxPage) {
            setCurrentPage(maxPage);
          }
        }
      } catch (error) {
        console.error("Error deleting category:", error);
        alert("Failed to delete category. It might be linked to existing transactions.");
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setFormData({ name: '', icon: 'tag', type: 'expense', parent_id: '' });
  };

  const toggleCategoryExpand = (catId, hasSubCats) => {
    if (!hasSubCats) return;
    if (expandedCategoryIds.includes(catId)) {
      setExpandedCategoryIds(expandedCategoryIds.filter(id => id !== catId));
    } else {
      setExpandedCategoryIds([...expandedCategoryIds, catId]);
    }
  };

  const mainCategories = categories.filter((cat) => cat.parent_id === null);
  const totalPages = Math.ceil(mainCategories.length / itemsPerPage) || 1;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMainCategories = mainCategories.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="max-w-full mx-auto min-h-screen bg-[#f8f9fd] p-6 lg:p-8 relative">
      <div className="flex flex-col lg:flex-row items-start justify-start gap-10 w-full">

        {/* LEFT SIDE: ADD / EDIT CATEGORY */}
        <div className="w-full lg:w-[320px] bg-white rounded-3xl shadow-xl p-8 flex-shrink-0 border border-gray-100">
          <h2 className="text-xl font-bold text-center text-[#212529] mb-8">
            {editingCategoryId ? "Edit Category" : "Add Category"}
          </h2>

          <form onSubmit={handleSaveCategory} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase mb-1">Category name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-300 font-semibold"
                placeholder="e.g., Food, Salary"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase mb-1">Parent Category (Optional)</label>
              <div className="relative">
                <select
                  value={formData.parent_id}
                  onChange={(e) => {
                    const selectedParentId = e.target.value;
                    let autoInheritedType = formData.type;

                    if (selectedParentId) {
                      const parentCat = categories.find(c => String(c.id) === String(selectedParentId));
                      if (parentCat) {
                        autoInheritedType = parentCat.type;
                      }
                    }

                    setFormData({
                      ...formData,
                      parent_id: selectedParentId,
                      type: autoInheritedType
                    });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:border-blue-300 font-semibold appearance-none cursor-pointer text-gray-700"
                >
                  <option value="">-- None (Set as Main Category) --</option>
                  {validParentCategories.map((pCat) => (
                    <option key={pCat.id} value={pCat.id}>{pCat.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <FaChevronDown size={12} />
                </div>
              </div>
            </div>

            {/* CUSTOM IMAGE PICKER */}
            <div className="flex items-center justify-between py-2">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button type="button" onClick={() => fileInputRef.current.click()} className="bg-gray-50 text-gray-500 px-4 py-1 rounded-lg text-[10px] font-bold border border-gray-200 hover:bg-gray-100">
                Choose Icon
              </button>
              <div className="w-12 h-12 rounded-full bg-[#c9e4e4] border-4 border-white shadow-sm flex items-center justify-center overflow-hidden text-gray-700">
                 {renderCategoryIcon(formData.icon, categories.find(c => c.name.toLowerCase() === formData.name.toLowerCase().trim()))}
              </div>
            </div>

            {/* SYSTEM ALLOCATION TYPE (Auto-inherits and disables if parent category is selected) */}
            <div className={`space-y-3 pt-2 ${formData.parent_id ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-gray-400 text-[10px] font-bold uppercase">
                System Allocation Type {formData.parent_id && <span className="text-blue-500 lowercase ml-1">(Inherited from parent)</span>}
              </p>
              <div className="flex items-center gap-6 font-semibold text-gray-700">
                <label className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryType"
                    checked={formData.type === 'income'}
                    onChange={() => setFormData({...formData, type: 'income'})}
                    className="w-4 h-4 text-blue-500"
                    disabled={!!formData.parent_id}
                  />
                  Income
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryType"
                    checked={formData.type === 'expense'}
                    onChange={() => setFormData({...formData, type: 'expense'})}
                    className="w-4 h-4 text-blue-500"
                    disabled={!!formData.parent_id}
                  />
                  Expense
                </label>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4 pt-6">
              <button type="button" onClick={handleCancelEdit} className="text-red-400 font-bold text-sm uppercase hover:text-red-600">
                Cancel
              </button>
              <button type="submit" className="bg-[#4caf50] text-white px-8 py-2 rounded-xl font-bold shadow-lg hover:bg-green-600">
                {editingCategoryId ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: TABLE CATEGORY WITH VISUAL HIERARCHY TREE */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 min-h-[500px] flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold text-center text-gray-500 mb-10 tracking-tight">System Categories</h2>
            <div className="space-y-2">
              {currentMainCategories.length === 0 ? (
                <div className="text-center text-gray-400 italic py-10 text-sm">No main categories found.</div>
              ) : (
                currentMainCategories.map((mainCat) => {
                  const subCats = categories.filter((sub) => sub.parent_id === mainCat.id);
                  const hasSubCats = subCats.length > 0;
                  const isExpanded = expandedCategoryIds.includes(mainCat.id);

                  return (
                    <div key={mainCat.id} className="space-y-1 mb-4">
                      {/* Main Category Row */}
                      <div
                        onClick={() => toggleCategoryExpand(mainCat.id, hasSubCats)}
                        className={`flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl border-b border-gray-50 group transition-all bg-white ${hasSubCats ? 'cursor-pointer select-none' : ''}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-xl text-blue-600 overflow-hidden">
                            {renderCategoryIcon(mainCat.icon, mainCat)}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-700 text-base capitalize">{mainCat.name}</h3>
                              {hasSubCats && (
                                <FaChevronDown
                                  size={10}
                                  className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}
                                />
                              )}
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 font-extrabold uppercase rounded ${mainCat.type === 'income' ? 'bg-green-100 text-green-700' : mainCat.type === 'transfer' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {mainCat.type}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => startEditCategory(mainCat)} className="text-gray-300 hover:text-blue-500 transition-colors">
                            <FaEdit size={18} />
                          </button>
                          <button onClick={() => handleDeleteCategory(mainCat.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <FaRegTrashAlt size={18} />
                          </button>
                          <div className={`w-1.5 h-10 rounded-full ${mainCat.type === 'income' ? 'bg-green-400' : mainCat.type === 'transfer' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                        </div>
                      </div>

                      {/* CONDITIONAL REVEAL ACCORDION BLOCK FOR SUBCATEGORIES */}
                      {hasSubCats && isExpanded && (
                        <div className="space-y-1 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          {subCats.map((subCat) => (
                            <div key={subCat.id} className="flex items-center justify-between p-3 ml-12 bg-gray-50/60 hover:bg-gray-50 rounded-xl border border-dashed border-gray-200 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-md text-gray-500 overflow-hidden shadow-sm">
                                  {renderCategoryIcon(subCat.icon, subCat)}
                                </div>

                                <div>
                                  <h4 className="font-bold text-gray-600 text-sm capitalize">{subCat.name}</h4>
                                  <span className="text-[8px] text-gray-400 tracking-wider uppercase font-semibold">Subcategory</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 pr-2">
                                <button onClick={() => startEditCategory(subCat)} className="text-gray-300 hover:text-blue-500 transition-colors">
                                  <FaEdit size={16} />
                                </button>
                                <button onClick={() => handleDeleteCategory(subCat.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                  <FaRegTrashAlt size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PAGINATION FOOTER CONTROLS ROW */}
          {mainCategories.length > itemsPerPage && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl bg-[#3D5AFE] text-white hover:bg-blue-700 shadow-md transition-colors disabled:opacity-40 disabled:hover:bg-[#3D5AFE] cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-6 right-3 flex flex-col gap-3 z-50">
        <button
          onClick={() => openTransactionModal('income')}
          title="Add Income"
          className="w-12 h-12 rounded-full bg-[#4caf50] text-white flex items-center justify-center text-lg shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaPlus />
        </button>
        <button
          onClick={() => openTransactionModal('expense')}
          title="Add Expense"
          className="w-12 h-12 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-lg shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaMinus />
        </button>
      </div>

      {showIncomeExpenseModal && (
        <TransactionModal
          type={showIncomeExpenseModal}
          closeModal={closeModal}
          categories={categories}
          accounts={accounts}
          fetchInitialData={fetchInitialData}
        />
      )}
    </div>
  );
};

export default CategoryForm;