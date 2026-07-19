import React from 'react';
import { FaRegEye } from 'react-icons/fa';

const ExportImport = ({ mode }) => {
  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-3xl border border-gray-200">

        {/* --- EXPORT PDF MODE --- */}
        {mode === 'pdf' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center mb-8 uppercase tracking-widest">Create File - PDF</h2>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-3 text-sm">Type</label>
              <select className="col-span-9 p-2 border rounded bg-white"><option>Transaction</option></select>

              <label className="col-span-3 text-sm">Period</label>
              <select className="col-span-9 p-2 border rounded bg-white"><option>2025</option></select>

              <label className="col-span-3 text-sm">Account</label>
              <select className="col-span-9 p-2 border rounded bg-white"><option>Account</option></select>

              <div className="col-span-3 text-sm pt-4">Include Transaction</div>
              <div className="col-span-9 space-y-2 pt-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Income</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Expenses</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Transfer and Payment</label>
              </div>
            </div>
            <div className="flex justify-between items-center mt-10">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-6 bg-blue-500 rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
                 <span className="text-xs">Divide the page into 2 columns</span>
               </div>
               <button className="bg-blue-600 text-white px-6 py-2 rounded text-sm uppercase">Export PDF File</button>
            </div>
          </div>
        )}

        {/* --- EXPORT CSV MODE --- */}
        {mode === 'csv' && (
          <div className="space-y-6 text-gray-700">
            <div className="flex items-center gap-6 mb-8">
              <span className="font-bold text-sm">Show all Category of:</span>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="cat" defaultChecked /> Expenses</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="cat" /> Income</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="cat" /> Both</label>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold mb-2">From</label>
                <input type="text" placeholder="07/01/2026" className="w-full p-2 border rounded shadow-inner bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">To</label>
                <input type="text" placeholder="01/12/2026" className="w-full p-2 border rounded shadow-inner bg-gray-50" />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-4 mt-4">
              <span className="col-span-3 text-sm">Account</span>
              <select className="col-span-6 p-2 border rounded bg-white shadow-sm"><option>Account</option></select>
            </div>
            <div className="grid grid-cols-12 gap-4 mt-6">
              <span className="col-span-3 text-sm pt-1">Include Transition:</span>
              <div className="col-span-9 space-y-3">
                <div className="flex items-center gap-3"><div className="w-5 h-5 bg-gray-200 rounded"></div><span className="text-sm">Income</span></div>
                <div className="flex items-center gap-3"><div className="w-5 h-5 bg-gray-200 rounded"></div><span className="text-sm">Expenses</span></div>
                <div className="flex items-center gap-3"><div className="w-5 h-5 bg-gray-200 rounded"></div><span className="text-sm">Transfer and Payment</span></div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-10">
               <div className="flex items-center gap-2 text-gray-600"><FaRegEye /> <span className="text-xs uppercase">Other</span></div>
               <button className="bg-blue-600 text-white px-6 py-2 rounded text-sm uppercase">Export CSV File</button>
            </div>
          </div>
        )}

        {/* --- IMPORT MODE --- */}
        {mode === 'import' && (
          <div className="space-y-8 text-center">
            <h2 className="text-2xl font-medium text-gray-600 uppercase tracking-wide">Import CSV/XSL File</h2>
            <div className="flex items-center justify-center gap-4 bg-gray-50 p-2 border rounded">
              <button className="bg-gray-200 px-4 py-1 text-sm border">Choose File</button>
              <span className="text-sm text-gray-500">No file Chosen</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm">Date format:</span>
              <select className="border p-2 rounded bg-white w-48 text-sm"><option>2026/02/10</option></select>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <span className="text-sm">Header row preset</span>
            </div>
            <div className="text-blue-500 text-sm cursor-pointer hover:underline">Frequently asked questions</div>
            <div className="flex flex-col items-end gap-3 mt-10">
              <button className="bg-[#5C6BC0] text-white px-8 py-2 rounded text-sm shadow-md">Download template</button>
              <button className="bg-[#5C6BC0] text-white px-8 py-2 rounded text-sm shadow-md">Import CSV/XSL File</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ExportImport;