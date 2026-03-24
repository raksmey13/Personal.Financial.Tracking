import React, { useState } from 'react';
import { FaTag, FaWallet, FaCalendarAlt, FaClock, FaUser, FaPen, FaStar, FaRegCommentDots } from "react-icons/fa";


const CategoryForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    accounts: '',
    fromTo: '',
    type: 'Expenses',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f3f4ff] p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-700 text-center mb-6">Add Category</h2>

        <form className="space-y-4">
          {/* Category Name */}
          <div>
            <label className="block text-gray-500 text-sm mb-1">Category name</label>
            <input
              type="text"
              name="name"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
              placeholder="Enter category name"
            />
          </div>

          {/* Accounts */}
          <div>
            <label className="block text-gray-500 text-sm mb-1">Accounts</label>
            <input
              type="text"
              name="accounts"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
              placeholder="All accounts"
            />
          </div>

          {/* From / to */}
          <div>
            <label className="block text-gray-500 text-sm mb-1">From / to (Optional)</label>
            <input
              type="text"
              name="fromTo"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
            />
          </div>

          {/* Icon & Color Section */}
          <div className="flex items-center justify-between py-2">
            <button
              type="button"
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1 rounded-md text-sm border border-gray-300 shadow-sm transition"
            >
              Choose Icon
            </button>
            <div className="w-12 h-12 rounded-full bg-[#c9e4e4] border-4 border-white shadow-sm"></div>
          </div>

          {/* Type Checkboxes */}
          <div className="space-y-2">
            <p className="text-gray-500 text-sm">Type</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" />
                <span className="text-gray-600 text-sm">Expenses</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" />
                <span className="text-gray-600 text-sm">Income</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end items-center space-x-4 pt-4">
            <button
              type="button"
              className="text-red-500 font-medium hover:text-red-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#4caf50] hover:bg-[#43a047] text-white px-8 py-2 rounded-lg font-medium shadow-md transition"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryForm;