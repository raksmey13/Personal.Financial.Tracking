import React, { useState, useEffect } from 'react';
import { FaRegEye, FaFileExcel, FaFileCsv } from 'react-icons/fa';
// Import central API client helpers
import { accountAPI, exportImportAPI } from '../api'; // Adjust path if needed

const ExportImport = ({ mode }) => {
  const [accounts, setAccounts] = useState([]);

  // --- PDF EXPORT STATE ---
  const [pdfPeriod, setPdfPeriod] = useState('2026');
  const [pdfAccountId, setPdfAccountId] = useState('');
  const [pdfIncludeIncome, setPdfIncludeIncome] = useState(true);
  const [pdfIncludeExpense, setPdfIncludeExpense] = useState(true);
  const [pdfIncludeTransfer, setPdfIncludeTransfer] = useState(true);
  const [pdfTwoColumn, setPdfTwoColumn] = useState(false);

  // --- CSV EXPORT STATE ---
  const [csvCategoryType, setCsvCategoryType] = useState('both');
  const [csvFromDate, setCsvFromDate] = useState('');
  const [csvToDate, setCsvToDate] = useState('');
  const [csvAccountId, setCsvAccountId] = useState('');
  const [csvIncludeIncome, setCsvIncludeIncome] = useState(true);
  const [csvIncludeExpense, setCsvIncludeExpense] = useState(true);
  const [csvIncludeTransfer, setCsvIncludeTransfer] = useState(true);

  // --- IMPORT STATE ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [importStatusMessage, setImportStatusMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Load Active Accounts on Mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await accountAPI.getAll();
        const activeAccs = (response.data || []).filter(acc => acc.is_active !== false);
        setAccounts(activeAccs);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  // --- HANDLERS ---
  const handleExportPDF = () => {
    const params = {
      period: pdfPeriod,
      include_income: pdfIncludeIncome,
      include_expense: pdfIncludeExpense,
      include_transfer: pdfIncludeTransfer,
      two_column: pdfTwoColumn,
    };
    if (pdfAccountId) params.account_id = pdfAccountId;

    window.location.href = exportImportAPI.exportPDF(params);
  };

  const handleExportCSV = () => {
    const params = {
      category_type: csvCategoryType,
      include_income: csvIncludeIncome,
      include_expense: csvIncludeExpense,
      include_transfer: csvIncludeTransfer,
    };
    if (csvFromDate) params.start_date = csvFromDate;
    if (csvToDate) params.end_date = csvToDate;
    if (csvAccountId) params.account_id = csvAccountId;

    window.location.href = exportImportAPI.exportCSV(params);
  };

  // 🟢 Download Excel Template (.xlsx)
  const handleDownloadExcelTemplate = () => {
    window.location.href = `${exportImportAPI.getTemplateUrl()}/excel`;
  };

  // 🟢 Download Standard CSV Template
  const handleDownloadCsvTemplate = () => {
    window.location.href = exportImportAPI.getTemplateUrl();
  };

  const handleImportSubmit = async () => {
    if (!selectedFile) {
      alert("Please choose a .csv or .xlsx file to import.");
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    setImportStatusMessage('Parsing and uploading transactions...');

    try {
      const response = await exportImportAPI.importCSV(formData);
      if (response.data.status === 200) {
        setImportStatusMessage(`Success: ${response.data.message}`);
        setSelectedFile(null);
      }
    } catch (err) {
      setImportStatusMessage(`Error: ${err.response?.data?.detail || "Failed to process import."}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-3xl border border-gray-200">

        {/* ========================================== */}
        {/* --- EXPORT PDF MODE --- */}
        {/* ========================================== */}
        {mode === 'pdf' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center mb-8 uppercase tracking-widest">Create File - PDF</h2>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-3 text-sm">Type</label>
              <select className="col-span-9 p-2 border rounded bg-white">
                <option value="Transaction">Transaction Summary</option>
              </select>

              <label className="col-span-3 text-sm">Period</label>
              <select
                className="col-span-9 p-2 border rounded bg-white"
                value={pdfPeriod}
                onChange={(e) => setPdfPeriod(e.target.value)}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>

              <label className="col-span-3 text-sm">Account</label>
              <select
                className="col-span-9 p-2 border rounded bg-white"
                value={pdfAccountId}
                onChange={(e) => setPdfAccountId(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>

              <div className="col-span-3 text-sm pt-4">Include Transaction</div>
              <div className="col-span-9 space-y-2 pt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfIncludeIncome}
                    onChange={(e) => setPdfIncludeIncome(e.target.checked)}
                  /> Income
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfIncludeExpense}
                    onChange={(e) => setPdfIncludeExpense(e.target.checked)}
                  /> Expenses
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfIncludeTransfer}
                    onChange={(e) => setPdfIncludeTransfer(e.target.checked)}
                  /> Transfer and Payment
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center mt-10">
               <div
                 className="flex items-center gap-3 cursor-pointer"
                 onClick={() => setPdfTwoColumn(!pdfTwoColumn)}
               >
                 <div className={`w-12 h-6 rounded-full relative transition-colors ${pdfTwoColumn ? 'bg-blue-600' : 'bg-gray-300'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pdfTwoColumn ? 'right-1' : 'left-1'}`}></div>
                 </div>
                 <span className="text-xs text-gray-600 select-none">Divide the page into 2 columns</span>
               </div>

               <button
                 onClick={handleExportPDF}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase font-semibold transition-colors"
               >
                 Export PDF File
               </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* --- EXPORT CSV MODE --- */}
        {/* ========================================== */}
        {mode === 'csv' && (
          <div className="space-y-6 text-gray-700">
            <div className="flex items-center gap-6 mb-8">
              <span className="font-bold text-sm">Show all Category of:</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'expense'}
                  onChange={() => setCsvCategoryType('expense')}
                /> Expenses
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'income'}
                  onChange={() => setCsvCategoryType('income')}
                /> Income
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'both'}
                  onChange={() => setCsvCategoryType('both')}
                /> Both
              </label>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold mb-2">From</label>
                <input
                  type="date"
                  value={csvFromDate}
                  onChange={(e) => setCsvFromDate(e.target.value)}
                  className="w-full p-2 border rounded shadow-inner bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">To</label>
                <input
                  type="date"
                  value={csvToDate}
                  onChange={(e) => setCsvToDate(e.target.value)}
                  className="w-full p-2 border rounded shadow-inner bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-4 mt-4">
              <span className="col-span-3 text-sm">Account</span>
              <select
                value={csvAccountId}
                onChange={(e) => setCsvAccountId(e.target.value)}
                className="col-span-6 p-2 border rounded bg-white shadow-sm"
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-12 gap-4 mt-6">
              <span className="col-span-3 text-sm pt-1">Include Transaction:</span>
              <div className="col-span-9 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvIncludeIncome}
                    onChange={(e) => setCsvIncludeIncome(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Income</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvIncludeExpense}
                    onChange={(e) => setCsvIncludeExpense(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Expenses</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvIncludeTransfer}
                    onChange={(e) => setCsvIncludeTransfer(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Transfer and Payment</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center mt-10">
               <div className="flex items-center gap-2 text-gray-600">
                 <FaRegEye /> <span className="text-xs uppercase">Options Active</span>
               </div>
               <button
                 onClick={handleExportCSV}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase transition-colors font-semibold"
               >
                 Export CSV File
               </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* --- IMPORT MODE (CSV & EXCEL SUPPORTED) --- */}
        {/* ========================================== */}
        {mode === 'import' && (
          <div className="space-y-8 text-center">
            <h2 className="text-2xl font-medium text-gray-600 uppercase tracking-wide">Import CSV or Excel File</h2>

            {/* 🟢 Updated File Selector (Accepts both .csv and .xlsx) */}
            <div className="flex flex-col items-center justify-center gap-4 bg-gray-50 p-6 border rounded border-dashed">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                id="file-upload"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              />
              <label
                htmlFor="file-upload"
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 text-sm border rounded cursor-pointer transition-colors"
              >
                Choose File
              </label>
              <span className="text-sm text-gray-500 font-medium">
                {selectedFile ? selectedFile.name : "No file Chosen (.csv, .xlsx)"}
              </span>
            </div>

            {importStatusMessage && (
              <div className={`text-sm p-3 rounded ${importStatusMessage.startsWith('Success') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {importStatusMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-10">
              {/* 🟢 Dual Template Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="flex items-center gap-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-4 py-2 rounded text-xs shadow-md transition-colors"
                >
                  <FaFileExcel /> Excel Template
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="flex items-center gap-1.5 bg-[#5C6BC0] hover:bg-[#4C5BA0] text-white px-4 py-2 rounded text-xs shadow-md transition-colors"
                >
                  <FaFileCsv /> CSV Template
                </button>
              </div>

              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={isUploading || !selectedFile}
                className={`text-white px-8 py-2 rounded text-sm shadow-md transition-colors ${
                  isUploading || !selectedFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#3D5AFE] hover:bg-blue-700'
                }`}
              >
                {isUploading ? 'Uploading...' : 'Import Data File'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ExportImport;