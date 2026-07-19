import React, { useState, useEffect } from 'react';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import TransactionModal from "./TransactionModal";
import { Link } from 'react-router-dom';
import { categoryAPI, accountAPI, analyticsAPI, budgetAPI, transactionAPI } from "../API/index";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { FaPlus, FaMinus, FaArrowUp, FaArrowDown, FaBell, FaTag } from 'react-icons/fa';
// 🚀 PRODUCTION ACCESS: Imports your unified category element icon helper resource
import { getCategoryIconSource } from '../utils/icon';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const avatarUrl = "https://api.dicebear.com/7.x/identicon/svg?seed=dashboard";

const Overview = () => {
  const [showForm, setShowForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);

  // Core Operational Metrics States
  const [dashboardMetrics, setDashboardMetrics] = useState({ balance: 0.00, creditCards: 0.00, netWorth: 0.00 });
  const [performance, setPerformance] = useState({ current_month_spent: 0, last_month_spent: 0, current_progress: 0, last_progress: 0 });
  const [weeklySpending, setWeeklySpending] = useState([]);
  const [trendHistory, setTrendHistory] = useState([]);

  // --- CRUD: READ SYNC ---
  const fetchInitialData = async () => {
    try {
      const [catRes, accRes, analyticsRes, budgetRes, txRes] = await Promise.all([
        categoryAPI.getAll(),
        accountAPI.getAll(),
        analyticsAPI.getSummary(),
        budgetAPI.getCalculated(),
        transactionAPI.getAll()
      ]);

      const rawCategories = Array.isArray(catRes.data) ? catRes.data : [];
      const rawAccounts = Array.isArray(accRes.data) ? accRes.data : [];
      const rawBudgets = Array.isArray(budgetRes.data) ? budgetRes.data : [];

      setCategories(rawCategories);
      setAccounts(rawAccounts);
      setBudgets(rawBudgets);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);

      // Intercept active warnings sent down from backend calculations
      const compiledAlerts = [];
      rawBudgets.forEach(b => {
        if (b.alert_message && b.status !== 'green') {
          compiledAlerts.push({
            id: b.id,
            name: b.name,
            msg: b.alert_message,
            status: b.status,
            type: b.strategy_type
          });
        }
      });
      setCriticalAlerts(compiledAlerts);

      let calculatedBalance = 0;
      let calculatedCredit = 0;

      rawAccounts.forEach(acc => {
        const balanceVal = parseFloat(acc.balance) || 0;
        const typeStr = acc.account_type ? String(acc.account_type).toLowerCase().trim() : "";

        if (typeStr.includes("credit") || typeStr.includes("card") || typeStr.includes("loan")) {
          calculatedCredit += balanceVal;
        } else {
          calculatedBalance += balanceVal;
        }
      });

      setDashboardMetrics({
        balance: calculatedBalance,
        creditCards: calculatedCredit,
        netWorth: calculatedBalance + calculatedCredit
      });

      if (analyticsRes && analyticsRes.data) {
        const data = analyticsRes.data;
        setPerformance({
          current_month_spent: data.monthly_performance?.current_month_spent || 0,
          last_month_spent: data.monthly_performance?.last_month_spent || 0,
          current_progress: data.monthly_performance?.current_progress_percentage || 0,
          last_progress: data.monthly_performance?.last_progress_percentage || 0
        });
        setWeeklySpending(Array.isArray(data.weekly_spending) ? data.weekly_spending : []);
        setTrendHistory(Array.isArray(data.trend_history) ? data.trend_history : []);
      }
    } catch (error) {
      console.error("Axios dashboard calculation engine sync crash:", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const closeModal = () => setShowForm(null);

  const safeWeekly = Array.isArray(weeklySpending) ? weeklySpending : [];
  const safeTrend = Array.isArray(trendHistory) ? trendHistory : [];
  const safeBudgets = Array.isArray(budgets) ? budgets : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  // --- Chart Configurations ---
  const monthChartData = (progress) => ({
    labels: ['Spent', 'Available Liquidity'],
    datasets: [{
      data: [progress, Math.max(100 - progress, 0)],
      backgroundColor: ['#DC2626', '#16A34A'],
      borderWidth: 0,
      cutout: '75%',
    }],
  });

  const monthChartOptions = {
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    responsive: true,
  };

  const trendLineData = {
    labels: safeTrend.length > 0 ? safeTrend.map(t => t.label) : ["...", "...", "...", "...", "...", "..."],
    datasets: [{
      label: 'Net Worth Trajectory',
      data: safeTrend.length > 0 ? safeTrend.map(t => t.net_worth) : [0, 0, 0, 0, 0, 0],
      fill: true,
      backgroundColor: 'rgba(37, 99, 235, 0.06)',
      borderColor: '#2563EB',
      tension: 0.4,
      pointRadius: safeTrend.length > 0 ? 4 : 0,
      pointBackgroundColor: '#2563EB',
    }],
  };

  const trendLineOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: (value) => `$${value}` }, grid: { borderDash: [2, 2] } },
      x: { grid: { display: false } },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const weeklyBarData = {
    labels: safeWeekly.length > 0 ? safeWeekly.map(w => w.label) : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      label: 'Expenses ($)',
      data: safeWeekly.length > 0 ? safeWeekly.map(w => w.amount) : [0, 0, 0, 0, 0, 0, 0],
      backgroundColor: '#DC2626',
      borderRadius: 6,
      barThickness: 14,
    }],
  };

  const weeklyBarOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: (value) => `$${value}` }, grid: { borderDash: [2, 2] } },
      x: { grid: { display: false } },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const BudgetRow = ({ progress, label, date, amount, total, strategyType }) => (
    <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0 group">
      <img src={avatarUrl} alt={label} className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="font-semibold text-gray-800 text-xs flex items-center gap-1.5">
            {label}
            {strategyType === "fixed_allocation" && <span className="bg-amber-50 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.2 rounded border border-amber-200/40">Fixed Bill</span>}
          </span>
          <span className="text-gray-400 text-[10px]">{date}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full relative overflow-hidden shadow-inner">
          <div style={{ width: `${Math.min(progress, 100)}%` }} className={`absolute inset-0 rounded-full ${progress >= 100 ? 'bg-red-500 animate-pulse' : progress >= 75 ? 'bg-amber-400' : 'bg-green-500'}`}></div>
        </div>
        <div className="flex justify-between items-baseline text-[10px] font-medium">
          <span className="text-gray-500">Spent: <b>${amount.toFixed(2)}</b></span>
          <span className="text-gray-400">Cap: <b>${total.toFixed(2)}</b></span>
        </div>
      </div>
      <span className="text-[10px] font-black text-gray-500">{progress}%</span>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-5 min-h-screen bg-[#F8F9FD] p-10 font-sans relative w-full">

      {/* 1. Left Column Panel */}
      <div className="col-span-12 lg:col-span-3 space-y-5">

        {/* 🚀 FIXED: Polished look with perfect vertical layout blocks */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Summary</h2>

          <div className="flex flex-col gap-1 border-b border-gray-50 pb-3">
            <span className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Available Capital</span>
            <span className="font-black text-green-600 text-2xl">$ {dashboardMetrics.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>

          <div className="flex flex-col gap-1 border-b border-gray-50 pb-3">
            <span className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Credit Liabilities</span>
            <span className="font-black text-red-500 text-lg">$ {Math.abs(dashboardMetrics.creditCards).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">True Net Worth</span>
            <span className={`text-2xl font-black tracking-tight ${dashboardMetrics.netWorth >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              $ {dashboardMetrics.netWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span>
          </div>
        </div>

        {/* Live Accounts Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative">
          <h2 className="text-xs font-black text-gray-400 mb-5 uppercase tracking-widest">Accounts Balance</h2>
          <div className="space-y-4">
            {safeAccounts.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-2">No linked accounts setup.</div>
            ) : (
              safeAccounts.map(acc => (
                <div key={acc.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <span className="font-bold text-gray-700 capitalize text-sm">{acc.account_name || acc.name}</span>
                  <div className="text-right">
                    <span className={`font-black text-sm ${parseFloat(acc.balance) >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                      $ {parseFloat(acc.balance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rolling Weekly Spend Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-widest">Weekly Spend Timeline</h2>
          <div className="w-full h-48 relative">
            <Bar data={weeklyBarData} options={weeklyBarOptions} />
          </div>
        </div>
      </div>

      {/* 2. Graphical Performance Center Dashboard */}
      <div className="col-span-12 lg:col-span-9 space-y-5">

        {/* Real-time System Strategic Exception Warnings Banner Block */}
        {criticalAlerts.length > 0 && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-3 animate-in fade-in duration-150">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <FaBell className="text-amber-500 animate-bounce" /> Strategic Exceptions Engine
            </h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {criticalAlerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-3 shadow-xs ${
                  alert.status === 'red' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'
                }`}>
                  <span>⚠️</span>
                  <p className="flex-1 leading-relaxed">
                    <span className="uppercase font-black mr-1 bg-white/60 px-1 py-0.5 rounded border border-black/5">{alert.name}:</span>
                    {alert.msg}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Current Month Doughnut */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Spent This Month</h3>
              <div className="text-2xl font-black text-red-500">$ {performance.current_month_spent.toFixed(2)}</div>
            </div>
            <div className="w-20 h-20 relative">
              <Doughnut data={monthChartData(performance.current_progress)} options={monthChartOptions} />
            </div>
          </div>

          {/* Last Month Doughnut */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Spent Last Month</h3>
              <div className="text-2xl font-black text-gray-700">$ {performance.last_month_spent.toFixed(2)}</div>
            </div>
            <div className="w-20 h-20 relative">
              <Doughnut data={monthChartData(performance.last_progress)} options={monthChartOptions} />
            </div>
          </div>
        </div>

        {/* Timeline Asset Trajectory Line Graph */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-64">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Net Worth Capital Trend</h3>
          <div className="w-full h-52">
            <Line data={trendLineData} options={trendLineOptions} />
          </div>
        </div>

        {/* RECENT TRANSACTIONS LEDGER SNIP-FEED */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-50">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Activity Ledger</h3>
              <p className="text-[10px] text-gray-400 font-medium">Real-time chronologically sorted income and expense ledger audit</p>
            </div>
            <Link
              to="/transaction"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              View Full Ledger →
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {transactions.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-4 text-center">
                No systemic records found inside PostgreSQL database history ledger logs.
              </div>
            ) : (
              transactions
                // 🚀 FIXED: Filters out "Opening Balance Baseline" rows dynamically from list views
                .filter(tx => String(tx.description).trim() !== "Opening Balance Baseline")
                .slice(0, 5)
                .map((tx) => {
                  const isExpense = String(tx.type || "").toLowerCase().trim() === 'expense';
                  const amountVal = parseFloat(tx.amount || 0);

                  // 🚀 FIXED: Resolves actual object structures or matches category fallback options natively
                  const matchedCategory = tx.category || categories.find(c => c.id === tx.category_id);
                  const displayHeader = matchedCategory ? matchedCategory.name : (isExpense ? "Direct Expense" : "Treasury Income");
                  const iconSrc = matchedCategory ? getCategoryIconSource(matchedCategory) : null;

                  return (
                    <div key={tx.id} className="flex items-center justify-between py-3.5 hover:bg-gray-50/50 px-2 rounded-xl transition-all duration-150">
                      <div className="flex items-center gap-3 truncate max-w-[70%]">

                        {/* 🚀 FIXED: Real-time icon reader container matching analytics panel views */}
                        <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-xs overflow-hidden">
                          {iconSrc ? (
                            <img src={iconSrc} alt="Icon" className="w-full h-full object-cover" />
                          ) : (
                            <div className={isExpense ? 'text-red-500' : 'text-green-500'}><FaTag size={10} /></div>
                          )}
                        </div>

                        <div className="truncate">
                          {/* 🚀 FIXED: Displays the Category Name here as the bold line header */}
                          <h4 className="text-xs font-black text-gray-800 capitalize truncate">
                            {displayHeader}
                          </h4>
                          {/* Places account metadata and description string underneath as subtext */}
                          <span className="text-[10px] font-bold text-gray-400 tracking-wide block truncate">
                            {tx.account_name || "Ledger Account"} {tx.description ? `• ${tx.description}` : ""}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-black tracking-wide ${
                        isExpense ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {isExpense ? '-' : '+'}${amountVal.toFixed(2)}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* LIVE BUDGET ROWS SYNCED LOOP */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Active Budgets Threshold</h2>
          <div className="divide-y divide-gray-50">
            {safeBudgets.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-6 text-center">
                No active budget boundaries set up. Click the budgets tab to assign a threshold rule pool!
              </div>
            ) : (
              safeBudgets.map((item) => (
                <BudgetRow
                  key={item.id}
                  progress={item.progress || 0}
                  label={item.name}
                  date={`${item.start || "—"} - ${item.end || "—"}`}
                  amount={item.spent || item.current || 0}
                  total={item.total || 0}
                  strategyType={item.strategy_type}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fast Action Launcher Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-[100]">
        <button
          type="button"
          onClick={() => setShowForm("income")}
          className="w-14 h-14 bg-[#2ECC71] text-white rounded-full flex items-center justify-center text-xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaPlus />
        </button>
        <button
          type="button"
          onClick={() => setShowForm("expense")}
          className="w-14 h-14 bg-[#FF0000] text-white rounded-full flex items-center justify-center text-xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <FaMinus />
        </button>
      </div>

      {showForm && (
        <TransactionModal
          type={showForm}
          closeModal={closeModal}
          categories={categories}
          accounts={accounts}
          fetchInitialData={fetchInitialData}
        />
      )}
    </div>
  );
};

export default Overview;