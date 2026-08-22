import React, { useState, useEffect } from 'react';
import { FaRegEye, FaFileExcel, FaFileCsv } from 'react-icons/fa';
import axios from 'axios';
import { accountAPI, exportImportAPI } from '../API';

// 🟢 Define your live Render API URL
const RENDER_BACKEND_URL = 'https://personal-financial-tracking.onrender.com';

const ExportImport = ({ mode }) => {
  const [accounts, setAccounts] = useState([]);

  // --- PDF EXPORT STATE ---
  const [pdfPeriod, setPdfPeriod] = useState('2026');
  const [pdfAccountId, setPdfAccountId] = useState('');
  const [pdfIncludeIncome, setPdfIncludeIncome] = useState(true);
  const [pdfIncludeExpense, setPdfIncludeExpense] = useState(true);
  const [pdfIncludeTransfer, setPdfIncludeTransfer] = useState(true);
  const [pdfTwoColumn, setPdfTwoColumn] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // --- CSV EXPORT STATE ---
  const [csvCategoryType, setCsvCategoryType] = useState('both');
  const [csvFromDate, setCsvFromDate] = useState('');
  const [csvToDate, setCsvToDate] = useState('');
  const [csvAccountId, setCsvAccountId] = useState('');
  const [csvIncludeIncome, setCsvIncludeIncome] = useState(true);
  const [csvIncludeExpense, setCsvIncludeExpense] = useState(true);
  const [csvIncludeTransfer, setCsvIncludeTransfer] = useState(true);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

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

  // 🟢 FIXED PDF EXPORT HANDLER (Explicit Render URL + Auth Header)
  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        period: pdfPeriod,
        include_income: pdfIncludeIncome,
        include_expense: pdfIncludeExpense,
        include_transfer: pdfIncludeTransfer,
        two_column: pdfTwoColumn,
      };
      if (pdfAccountId) params.account_id = pdfAccountId;

      const response = await axios.get(`${RENDER_BACKEND_URL}/export-import/pdf`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `transaction_summary_${pdfPeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert("Failed to generate PDF. Please check your login session.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 🟢 FIXED CSV EXPORT HANDLER (Explicit Render URL + Auth Header)
  const handleExportCSV = async () => {
    setIsExportingCsv(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        category_type: csvCategoryType,
        include_income: csvIncludeIncome,
        include_expense: csvIncludeExpense,
        include_transfer: csvIncludeTransfer,
      };
      if (csvFromDate) params.start_date = csvFromDate;
      if (csvToDate) params.end_date = csvToDate;
      if (csvAccountId) params.account_id = csvAccountId;

      const response = await axios.get(`${RENDER_BACKEND_URL}/export-import/csv`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      alert("Failed to export CSV file.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleDownloadExcelTemplate = () => {
    window.location.href = `${exportImportAPI.getTemplateUrl()}/excel`;
  };

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
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0F17] flex items-center justify-center p-6 transition-colors">
  <div className="bg-white dark:bg-[#151D2A] p-10 rounded-lg shadow-md w-full max-w-3xl border border-gray-200 dark:border-gray-800 transition-colors">

    {/* --- EXPORT PDF MODE --- */}
    {mode === 'pdf' && (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center mb-8 uppercase tracking-widest text-gray-800 dark:text-gray-100">Create File - PDF</h2>
        <div className="grid grid-cols-12 items-center gap-4 text-gray-700 dark:text-gray-200">
          <label className="col-span-3 text-sm font-semibold">Type</label>
          <select className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium">
            <option value="Transaction">Transaction Summary</option>
          </select>

          <label className="col-span-3 text-sm font-semibold">Period</label>
          <select
            className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium"
            value={pdfPeriod}
            onChange={(e) => setPdfPeriod(e.target.value)}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <label className="col-span-3 text-sm font-semibold">Account</label>
          <select
            className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium"
            value={pdfAccountId}
            onChange={(e) => setPdfAccountId(e.target.value)}
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.account_name}</option>
            ))}
          </select>

          <div className="col-span-3 text-sm font-semibold pt-4">Include Transaction</div>
          <div className="col-span-9 space-y-2 pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pdfIncludeIncome}
                onChange={(e) => setPdfIncludeIncome(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              /> Income
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pdfIncludeExpense}
                onChange={(e) => setPdfIncludeExpense(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              /> Expenses
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pdfIncludeTransfer}
                onChange={(e) => setPdfIncludeTransfer(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              /> Transfer and Payment
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center mt-10 pt-4 border-t border-gray-100 dark:border-gray-800">
           <div
             className="flex items-center gap-3 cursor-pointer"
             onClick={() => setPdfTwoColumn(!pdfTwoColumn)}
           >
             <div className={`w-12 h-6 rounded-full relative transition-colors ${pdfTwoColumn ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
               <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pdfTwoColumn ? 'right-1' : 'left-1'}`}></div>
             </div>
             <span className="text-xs text-gray-600 dark:text-gray-400 select-none">Divide the page into 2 columns</span>
           </div>

           <button
             onClick={handleExportPDF}
             disabled={isExportingPdf}
             className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase font-semibold transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-700 cursor-pointer"
           >
             {isExportingPdf ? 'Exporting...' : 'Export PDF File'}
           </button>
        </div>
      </div>
    )}

    {/* --- EXPORT CSV MODE --- */}
    {mode === 'csv' && (
      <div className="space-y-6 text-gray-700 dark:text-gray-200">
        <div className="flex items-center gap-6 mb-8">
          <span className="font-bold text-sm text-gray-800 dark:text-gray-100">Show all Category of:</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="radio"
              name="cat"
              checked={csvCategoryType === 'expense'}
              onChange={() => setCsvCategoryType('expense')}
              className="text-blue-600 focus:ring-blue-500"
            /> Expenses
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="radio"
              name="cat"
              checked={csvCategoryType === 'income'}
              onChange={() => setCsvCategoryType('income')}
              className="text-blue-600 focus:ring-blue-500"
            /> Income
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="radio"
              name="cat"
              checked={csvCategoryType === 'both'}
              onChange={() => setCsvCategoryType('both')}
              className="text-blue-600 focus:ring-blue-500"
            /> Both
          </label>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">From</label>
            <input
              type="date"
              value={csvFromDate}
              onChange={(e) => setCsvFromDate(e.target.value)}
              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded shadow-inner bg-gray-50 dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">To</label>
            <input
              type="date"
              value={csvToDate}
              onChange={(e) => setCsvToDate(e.target.value)}
              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded shadow-inner bg-gray-50 dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 items-center gap-4 mt-4">
          <span className="col-span-3 text-sm font-semibold">Account</span>
          <select
            value={csvAccountId}
            onChange={(e) => setCsvAccountId(e.target.value)}
            className="col-span-6 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 shadow-sm focus:outline-none"
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.account_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-12 gap-4 mt-6">
          <span className="col-span-3 text-sm pt-1 font-semibold">Include Transaction:</span>
          <div className="col-span-9 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={csvIncludeIncome}
                onChange={(e) => setCsvIncludeIncome(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Income</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={csvIncludeExpense}
                onChange={(e) => setCsvIncludeExpense(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Expenses</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={csvIncludeTransfer}
                onChange={(e) => setCsvIncludeTransfer(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Transfer and Payment</span>
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center mt-10 pt-4 border-t border-gray-100 dark:border-gray-800">
           <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
             <FaRegEye /> <span className="text-xs uppercase font-bold tracking-wider">Options Active</span>
           </div>
           <button
             onClick={handleExportCSV}
             disabled={isExportingCsv}
             className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase transition-colors font-semibold disabled:bg-gray-400 dark:disabled:bg-gray-700 cursor-pointer"
           >
             {isExportingCsv ? 'Exporting...' : 'Export CSV File'}
           </button>
        </div>
      </div>
    )}

    {/* --- IMPORT MODE --- */}
    {mode === 'import' && (
      <div className="space-y-8 text-center">
        <h2 className="text-2xl font-medium text-gray-600 dark:text-gray-200 uppercase tracking-wide">Import CSV or Excel File</h2>

        <div className="flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-[#1E293B]/50 p-6 border rounded-2xl border-dashed border-gray-300 dark:border-gray-700 transition-colors">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            id="file-upload"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files[0] || null)}
          />
          <label
            htmlFor="file-upload"
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer transition-colors font-semibold"
          >
            Choose File
          </label>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {selectedFile ? selectedFile.name : "No file Chosen (.csv, .xlsx)"}
          </span>
        </div>

        {importStatusMessage && (
          <div className={`text-sm p-3 rounded-xl border ${importStatusMessage.startsWith('Success') ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'}`}>
            {importStatusMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-10 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="flex items-center gap-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              <FaFileExcel /> Excel Template
            </button>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="flex items-center gap-1.5 bg-[#5C6BC0] hover:bg-[#4C5BA0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              <FaFileCsv /> CSV Template
            </button>
          </div>

          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={isUploading || !selectedFile}
            className={`text-white px-8 py-2 rounded-xl text-sm font-bold shadow-md transition-colors cursor-pointer ${
              isUploading || !selectedFile ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed' : 'bg-[#3D5AFE] hover:bg-blue-700'
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