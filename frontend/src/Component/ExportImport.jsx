import React, { useState, useEffect, useRef } from 'react';
import { FaRegEye, FaFileExcel, FaFileCsv } from 'react-icons/fa';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { accountAPI, exportImportAPI } from '../API';
import { useTranslation } from 'react-i18next';

// 🟢 Define your live Render API URL
const RENDER_BACKEND_URL = 'https://personal-financial-tracking.onrender.com';

const ExportImport = ({ mode }) => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const reportRef = useRef(null);

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

  // 🟢 CLIENT-SIDE PDF EXPORT HANDLER (html2pdf.js)
  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const element = reportRef.current;
      const options = {
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `transaction_summary_${pdfPeriod}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: pdfTwoColumn ? 'landscape' : 'portrait' }
      };

      await html2pdf().set(options).from(element).save();
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert(t("export_import.alert_pdf_failed"));
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
      alert(t("export_import.alert_csv_failed"));
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
      alert(t("export_import.alert_choose_file"));
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    setImportStatusMessage(t("export_import.parsing_message"));

    try {
      const response = await exportImportAPI.importCSV(formData);
      if (response.data.status === 200) {
        setImportStatusMessage(`${t("export_import.success_prefix")}: ${response.data.message}`);
        setSelectedFile(null);
      }
    } catch (err) {
      setImportStatusMessage(`${t("export_import.error_prefix")}: ${err.response?.data?.detail || t("export_import.import_failed")}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0F17] flex items-center justify-center p-6 transition-colors">
      <div ref={reportRef} className="bg-white dark:bg-[#151D2A] p-10 rounded-lg shadow-md w-full max-w-3xl border border-gray-200 dark:border-gray-800 transition-colors">

        {/* --- EXPORT PDF MODE --- */}
        {mode === 'pdf' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center mb-8 uppercase tracking-widest text-gray-800 dark:text-gray-100">{t("export_import.title_pdf")}</h2>
            <div className="grid grid-cols-12 items-center gap-4 text-gray-700 dark:text-gray-200">
              <label className="col-span-3 text-sm font-semibold">{t("export_import.label_type")}</label>
              <select className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium">
                <option value="Transaction">{t("export_import.type_transaction_summary")}</option>
              </select>

              <label className="col-span-3 text-sm font-semibold">{t("export_import.label_period")}</label>
              <select
                className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium"
                value={pdfPeriod}
                onChange={(e) => setPdfPeriod(e.target.value)}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>

              <label className="col-span-3 text-sm font-semibold">{t("export_import.label_account")}</label>
              <select
                className="col-span-9 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none font-medium"
                value={pdfAccountId}
                onChange={(e) => setPdfAccountId(e.target.value)}
              >
                <option value="">{t("export_import.all_accounts")}</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>

              <div className="col-span-3 text-sm font-semibold pt-4">{t("export_import.include_transaction")}</div>
              <div className="col-span-9 space-y-2 pt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pdfIncludeIncome}
                    onChange={(e) => setPdfIncludeIncome(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  /> {t("transactions.income")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pdfIncludeExpense}
                    onChange={(e) => setPdfIncludeExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  /> {t("transactions.expense")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pdfIncludeTransfer}
                    onChange={(e) => setPdfIncludeTransfer(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  /> {t("export_import.transfer_and_payment")}
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
                 <span className="text-xs text-gray-600 dark:text-gray-400 select-none">{t("export_import.two_column_label")}</span>
               </div>

               <button
                 onClick={handleExportPDF}
                 disabled={isExportingPdf}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase font-semibold transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-700 cursor-pointer"
               >
                 {isExportingPdf ? t("export_import.exporting") : t("export_import.btn_export_pdf")}
               </button>
            </div>
          </div>
        )}

        {/* --- EXPORT CSV MODE --- */}
        {mode === 'csv' && (
          <div className="space-y-6 text-gray-700 dark:text-gray-200">
            <div className="flex items-center gap-6 mb-8">
              <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{t("export_import.show_all_category_of")}</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'expense'}
                  onChange={() => setCsvCategoryType('expense')}
                  className="text-blue-600 focus:ring-blue-500"
                /> {t("transactions.expense")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'income'}
                  onChange={() => setCsvCategoryType('income')}
                  className="text-blue-600 focus:ring-blue-500"
                /> {t("transactions.income")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="cat"
                  checked={csvCategoryType === 'both'}
                  onChange={() => setCsvCategoryType('both')}
                  className="text-blue-600 focus:ring-blue-500"
                /> {t("export_import.both")}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">{t("export_import.from")}</label>
                <input
                  type="date"
                  value={csvFromDate}
                  onChange={(e) => setCsvFromDate(e.target.value)}
                  className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded shadow-inner bg-gray-50 dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">{t("export_import.to")}</label>
                <input
                  type="date"
                  value={csvToDate}
                  onChange={(e) => setCsvToDate(e.target.value)}
                  className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded shadow-inner bg-gray-50 dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-4 mt-4">
              <span className="col-span-3 text-sm font-semibold">{t("export_import.label_account")}</span>
              <select
                value={csvAccountId}
                onChange={(e) => setCsvAccountId(e.target.value)}
                className="col-span-6 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-100 shadow-sm focus:outline-none"
              >
                <option value="">{t("export_import.all_accounts")}</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-12 gap-4 mt-6">
              <span className="col-span-3 text-sm pt-1 font-semibold">{t("export_import.include_transaction")}</span>
              <div className="col-span-9 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={csvIncludeIncome}
                    onChange={(e) => setCsvIncludeIncome(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{t("transactions.income")}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={csvIncludeExpense}
                    onChange={(e) => setCsvIncludeExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{t("transactions.expense")}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={csvIncludeTransfer}
                    onChange={(e) => setCsvIncludeTransfer(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{t("export_import.transfer_and_payment")}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center mt-10 pt-4 border-t border-gray-100 dark:border-gray-800">
               <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                 <FaRegEye /> <span className="text-xs uppercase font-bold tracking-wider">{t("export_import.options_active")}</span>
               </div>
               <button
                 onClick={handleExportCSV}
                 disabled={isExportingCsv}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm uppercase transition-colors font-semibold disabled:bg-gray-400 dark:disabled:bg-gray-700 cursor-pointer"
               >
                 {isExportingCsv ? t("export_import.exporting") : t("export_import.btn_export_csv")}
               </button>
            </div>
          </div>
        )}

        {/* --- IMPORT MODE --- */}
        {mode === 'import' && (
          <div className="space-y-8 text-center">
            <h2 className="text-2xl font-medium text-gray-600 dark:text-gray-200 uppercase tracking-wide">{t("export_import.title_import")}</h2>

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
                {t("export_import.choose_file")}
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {selectedFile ? selectedFile.name : t("export_import.no_file_chosen")}
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
                  <FaFileExcel /> {t("export_import.excel_template")}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="flex items-center gap-1.5 bg-[#5C6BC0] hover:bg-[#4C5BA0] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  <FaFileCsv /> {t("export_import.csv_template")}
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
                {isUploading ? t("export_import.uploading") : t("export_import.btn_import_data")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ExportImport;