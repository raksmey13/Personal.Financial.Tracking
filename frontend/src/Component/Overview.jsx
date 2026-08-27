import React, { useState, useEffect } from 'react';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import TransactionModal from "./TransactionModal";
import { categoryAPI, accountAPI, analyticsAPI, budgetAPI, transactionAPI } from "../API/index";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { FaPlus, FaMinus, FaWallet } from 'react-icons/fa';
import { useTranslation } from "react-i18next";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const formatAxisNumber = (value) => {
  if (value >= 1000000 || value <= -1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000 || value <= -1000) return (value / 1000).toFixed(1) + 'k';
  return value.toLocaleString();
};

const getAccountTypeLabel = (acc) => {
  const type = String(acc.account_type || '').toLowerCase();
  if (type.includes('credit')) return "Credit Card";
  if (type.includes('savings')) return "Savings Account";
  if (type.includes('checking')) return "Checking Account";
  if (type.includes('loan')) return "Loan Account";
  return "Standard Account";
};

export default function Overview() {
  const { t } = useTranslation();

  const [showForm, setShowForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Local Chart Currency Toggle State ("USD" or "KHR")
  const [chartCurrency, setChartCurrency] = useState("USD");

  // Multi-Currency Dashboard Metrics
  const [dashboardMetrics, setDashboardMetrics] = useState({
    liquidUSD: 0, liquidKHR: 0,
    debtUSD: 0, debtKHR: 0,
    creditCardDebtUSD: 0,
    cashFlowUSD: 0, cashFlowKHR: 0,
    netWorthUSD: 0, netWorthKHR: 0
  });

  // Monthly Breakdown State
  const [monthlyBreakdown, setMonthlyBreakdown] = useState({
    incomeUSD: 0, spentUSD: 0,
    incomeKHR: 0, spentKHR: 0,
    lastIncomeUSD: 0, lastSpentUSD: 0,
    lastIncomeKHR: 0, lastSpentKHR: 0,
    progressUSD: 0, progressKHR: 0
  });

  const [weeklySpending, setWeeklySpending] = useState([]);
  const [trendHistory, setTrendHistory] = useState([]);

  const fetchInitialData = async () => {
    try {
      const [catRes, accRes, analyticsRes, budgetRes, txRes] = await Promise.all([
        categoryAPI.getAll(),
        accountAPI.getAll(),
        analyticsAPI.getSummary(),
        budgetAPI.getCalculated(),
        transactionAPI.getAll()
      ]);

      const loadedAccounts = Array.isArray(accRes.data) ? accRes.data : [];
      const loadedTransactions = Array.isArray(txRes.data) ? txRes.data : [];

      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts(loadedAccounts);
      setBudgets(Array.isArray(budgetRes.data) ? budgetRes.data : []);
      setTransactions(loadedTransactions);

      if (analyticsRes && analyticsRes.data) {
        const data = analyticsRes.data;
        const metrics = data.metrics || {};
        const summary = data.summary || {};
        const perf = data.monthly_performance || {};
        const lastPerf = data.last_month_performance || {};

        const incUSD = Number(summary.total_income_usd ?? perf.current_month_income ?? 0);
        const expUSD = Number(summary.total_expenses_usd ?? perf.current_month_spent ?? 0);
        const incKHR = Number(summary.total_income_khr ?? perf.current_month_income_khr ?? 0);
        const expKHR = Number(summary.total_expenses_khr ?? perf.current_month_spent_khr ?? 0);

        // Fallback calculation for last month if backend returns 0
        let lastIncUSD = Number(lastPerf.last_month_income_usd ?? 0);
        let lastExpUSD = Number(lastPerf.last_month_spent_usd ?? 0);
        let lastIncKHR = Number(lastPerf.last_month_income_khr ?? 0);
        let lastExpKHR = Number(lastPerf.last_month_spent_khr ?? 0);

        if (lastIncUSD === 0 && lastExpUSD === 0 && loadedTransactions.length > 0) {
          const now = new Date();
          const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

          loadedTransactions.forEach(tx => {
            const txDate = new Date(tx.transaction_date);
            if (txDate >= firstDayLastMonth && txDate <= lastDayLastMonth) {
              const amt = Math.abs(Number(tx.amount || 0));
              const isKHR = String(tx.currency || '').toUpperCase().trim() === 'KHR';
              const isInc = String(tx.type || '').toLowerCase().includes('income');

              if (isKHR) {
                if (isInc) lastIncKHR += amt; else lastExpKHR += amt;
              } else {
                if (isInc) lastIncUSD += amt; else lastExpUSD += amt;
              }
            }
          });
        }

        setDashboardMetrics({
          liquidUSD: Number(metrics.balance_usd ?? 0),
          liquidKHR: Number(metrics.balance_khr ?? 0),
          debtUSD: Number(metrics.totalDebt_usd ?? 0),
          debtKHR: Number(metrics.totalDebt_khr ?? 0),
          creditCardDebtUSD: Number(metrics.creditCards_usd ?? 0),
          cashFlowUSD: incUSD - expUSD,
          cashFlowKHR: incKHR - expKHR,
          netWorthUSD: Number(metrics.netWorth_usd ?? 0),
          netWorthKHR: Number(metrics.netWorth_khr ?? 0)
        });

        setMonthlyBreakdown({
          incomeUSD: incUSD,
          spentUSD: expUSD,
          incomeKHR: incKHR,
          spentKHR: expKHR,
          lastIncomeUSD: lastIncUSD,
          lastSpentUSD: lastExpUSD,
          lastIncomeKHR: lastIncKHR,
          lastSpentKHR: lastExpKHR,
          progressUSD: Number(perf.current_progress_percentage ?? 0),
          progressKHR: Number(perf.current_progress_percentage_khr ?? 0)
        });

        setWeeklySpending(Array.isArray(data.weekly_spending) ? data.weekly_spending : []);
        setTrendHistory(Array.isArray(data.trend_history) ? data.trend_history : []);
      }
    } catch (error) {
      console.error("Dashboard sync failure:", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [chartCurrency]);

  const closeModal = () => setShowForm(null);

  const formatNativeMoney = (val, currencyCode) => {
    const isKHR = String(currencyCode).toUpperCase().trim() === "KHR";
    const symbol = isKHR ? "៛" : "$";
    const num = Math.abs(val || 0);
    const formatted = isKHR
      ? num.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `${val < 0 ? '-' : ''}${symbol}${formatted}`;
  };

  const formatMoney = (val, currency = "USD", forceNegative = false) => {
    const isKHR = String(currency).toUpperCase().trim() === "KHR";
    const symbol = isKHR ? "៛" : "$";
    const num = Math.abs(val || 0);
    const isNeg = forceNegative || val < 0;
    const formatted = isKHR
      ? num.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `${isNeg && num !== 0 ? '-' : ''}${symbol}${formatted}`;
  };

  const monthChartData = (progress) => {
    const safeProgress = Math.min(Math.max(progress, 5), 95);
    return {
      labels: ['Expense', 'Remaining'],
      datasets: [{
        data: [safeProgress, 100 - safeProgress],
        backgroundColor: ['#E50914', '#009A00'],
        borderWidth: 2,
        borderColor: '#ffffff',
        cutout: '62%',
      }],
    };
  };

  const monthChartOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    maintainAspectRatio: false,
    responsive: true,
  };

  const trendLineData = {
    labels: trendHistory.length > 0 ? trendHistory.map(t => t.label) : ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
    datasets: [{
      label: 'Net Worth Trajectory',
      data: trendHistory.length > 0
        ? trendHistory.map(t => chartCurrency === "KHR" ? t.net_worth_khr : t.net_worth_usd)
        : [2200, 2300, 2400, 2500, 2600, 2902.64],
      fill: true,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: '#3B82F6',
      tension: 0,
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: '#3B82F6',
    }],
  };

  const trendLineOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: {
        ticks: {
          callback: (value) => `${chartCurrency === "KHR" ? "៛" : "$"}${formatAxisNumber(value)}`,
          font: { size: 10, weight: '600' },
          color: '#4B5563'
        },
        grid: { color: '#E5E7EB', borderDash: [4, 4], drawBorder: false }
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { maxRotation: 0, font: { size: 10, weight: '600' }, color: '#4B5563' }
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const weeklyBarData = {
    labels: weeklySpending.length > 0 ? weeklySpending.map(w => w.label) : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets: [{
      label: 'Expenses',
      data: weeklySpending.length > 0
        ? weeklySpending.map(w => Math.abs(chartCurrency === "KHR" ? w.amount_khr : w.amount_usd))
        : [0, 5, 0, 0, 3, 0, 0],
      backgroundColor: '#E50914',
      borderRadius: 0,
      barThickness: 16,
    }],
  };

  const weeklyBarOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${chartCurrency === "KHR" ? "៛" : "$"}${formatAxisNumber(value)}`,
          font: { size: 9 },
          color: '#4B5563'
        },
        grid: { color: '#D1D5DB', borderDash: [3, 3], drawBorder: false }
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { maxRotation: 0, font: { size: 9 }, color: '#4B5563' }
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  // Dynamic Credit Limit Calculation across active credit accounts
  const totalCreditLimitUSD = accounts
    .filter(a => a.is_active !== false && String(a.account_type || '').toLowerCase().includes('credit'))
    .reduce((sum, acc) => sum + Number(acc.credit_limit || acc.limit || 0), 0) || Math.max(dashboardMetrics.creditCardDebtUSD, 150);

  const cashFlowUSD = dashboardMetrics.cashFlowUSD;
  const cashFlowKHR = dashboardMetrics.cashFlowKHR;

  return (
    <div className="bg-[#E9ECEF] dark:bg-[#0B0F17] p-4 lg:p-6 pb-24 min-h-screen font-sans w-full transition-colors">

      <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-5">

        {/* ================= LEFT COLUMN ================= */}
        <div className="col-span-12 lg:col-span-4 space-y-5">

          {/* 1. Summary Card */}
          <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 mb-3">{t("summary.title")}</h2>
            <div className="space-y-3">

              {/* Liquid Assets */}
              <div>
                <span className="text-gray-600 dark:text-gray-400 font-medium text-[13px] block mb-1">{t("summary.liquid_assets")}</span>
                <div className="flex justify-between items-center text-[13px] font-bold text-[#009A00] dark:text-green-400">
                  <span>{formatNativeMoney(dashboardMetrics.liquidUSD, "USD")}</span>
                  <span>{formatNativeMoney(dashboardMetrics.liquidKHR, "KHR")}</span>
                </div>
              </div>

              {/* Total Debt */}
              <div>
                <span className="text-gray-600 dark:text-gray-400 font-medium text-[13px] block mb-1">{t("summary.total_debt")}</span>
                <div className="flex justify-between items-center text-[13px] font-bold text-[#E50914] dark:text-red-400">
                  <span>{formatNativeMoney(-Math.abs(dashboardMetrics.debtUSD), "USD")}</span>
                  <span>{formatNativeMoney(-Math.abs(dashboardMetrics.debtKHR), "KHR")}</span>
                </div>
              </div>

              {/* Total Cash Flow */}
              <div className="pb-3 border-b border-gray-300 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 font-medium text-[13px] block mb-1">{t("summary.total_cash_flow")}</span>
                <div className="flex justify-between items-center text-[13px] font-bold">
                  <span className={cashFlowUSD >= 0 ? "text-[#009A00] dark:text-green-400" : "text-[#E50914] dark:text-red-400"}>
                    {formatNativeMoney(cashFlowUSD, "USD")}
                  </span>
                  <span className={cashFlowKHR >= 0 ? "text-[#009A00] dark:text-green-400" : "text-[#E50914] dark:text-red-400"}>
                    {formatNativeMoney(cashFlowKHR, "KHR")}
                  </span>
                </div>
              </div>

              {/* Net Worth (Dual Currency Display) */}
              <div className="pt-1">
                <span className="text-gray-900 dark:text-gray-100 font-bold text-sm block mb-1">{t("summary.net_worth")}</span>
                <div className="flex justify-between items-center text-[13px] font-bold text-[#009A00] dark:text-green-400">
                  <span>{formatNativeMoney(dashboardMetrics.netWorthUSD, "USD")}</span>
                  <span>{formatNativeMoney(dashboardMetrics.netWorthKHR, "KHR")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Accounts Card (Shows ALL Accounts) */}
          <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-4 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{t("dashboard.accounts")}</h2>
              <span className="text-gray-400 dark:text-gray-500 font-black cursor-pointer text-lg leading-none">⋮</span>
            </div>

            {accounts.filter(a => a.is_active !== false).length === 0 ? (
              <div className="text-xs text-gray-400 italic py-2">No linked accounts.</div>
            ) : (
              accounts
                .filter(a => a.is_active !== false)
                .slice(0, 5)
                .map((acc, idx) => {
                  const rawBal = Number(acc.balance) || 0;
                  const accCurrency = String(acc.currency || "USD").toUpperCase().trim();
                  const typeStr = String(acc.account_type || '').toLowerCase();
                  const isDebt = typeStr.includes("loan") || typeStr.includes("credit") || typeStr.includes("mortgage") || rawBal < 0;

                  return (
                    <div key={acc.id} className={`flex justify-between items-start ${idx !== 0 ? 'pt-3' : ''} border-b border-gray-100 dark:border-gray-800 last:border-0 pb-3`}>
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-[13px] capitalize">{acc.account_name || acc.name}</span>
                      <div className="text-right leading-tight">
                        <span className={`font-bold text-[13px] block ${isDebt ? 'text-[#E50914] dark:text-red-400' : 'text-[#009A00] dark:text-green-400'}`}>
                          {formatMoney(Math.abs(rawBal), accCurrency, isDebt)}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium capitalize block">
                          {getAccountTypeLabel(acc)} ({accCurrency})
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* 3. Credit Card Utilization Card */}
          <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3 transition-colors">
            <div className="flex justify-between items-start">
              <div className="leading-tight">
                <span className="font-bold text-gray-900 dark:text-gray-100 text-[13px] block">{t("dashboard.credit_card_utilization")}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {formatMoney(dashboardMetrics.creditCardDebtUSD, "USD")} / {formatMoney(totalCreditLimitUSD, "USD")} Limit
                </span>
              </div>
              <span className="font-bold text-[#E50914] dark:text-red-400 text-[13px]">{formatMoney(dashboardMetrics.creditCardDebtUSD, "USD")}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full">
                <div
                  style={{ width: `${Math.min((dashboardMetrics.creditCardDebtUSD / totalCreditLimitUSD) * 100, 100)}%` }}
                  className="h-full bg-[#E50914]"
                />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {Math.round((dashboardMetrics.creditCardDebtUSD / totalCreditLimitUSD) * 100)}%
              </span>
            </div>
          </div>

          {/* 4. Weekly Bar Chart Card */}
          <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-2 transition-colors">
            <h2 className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{t("dashboard.weekly_spending")}</h2>
            <div className="h-56 w-full pt-2">
              <Bar data={weeklyBarData} options={weeklyBarOptions} />
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="col-span-12 lg:col-span-8 space-y-5">

          {/* 1. Top Row Doughnuts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* This Month Card */}
            <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
              <div className="w-24 h-24 relative flex items-center justify-center">
                <Doughnut data={monthChartData(monthlyBreakdown.progressUSD)} options={monthChartOptions} />
              </div>
              <div className="flex-1 text-right pl-4 space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{t("summary.this_month")}</span>
                  <div className="flex flex-col text-[8px] text-[#009A00] font-bold">
                    <span>▲</span>
                    <span className="text-[#E50914]">▼</span>
                  </div>
                </div>

                {/* USD Section */}
                <div className="text-[10px] font-bold text-gray-400 uppercase">USD Track</div>
                <div className="font-bold text-[#009A00] dark:text-green-400 text-[12px]">{formatNativeMoney(monthlyBreakdown.incomeUSD, "USD")}</div>
                <div className="font-bold text-[#E50914] dark:text-red-400 text-[12px] pb-1 border-b border-gray-100 dark:border-gray-800">
                  {formatNativeMoney(-Math.abs(monthlyBreakdown.spentUSD), "USD")}
                </div>

                {/* KHR Section */}
                <div className="text-[10px] font-bold text-gray-400 uppercase pt-1">KHR Track</div>
                <div className="font-bold text-[#009A00] dark:text-green-400 text-[12px]">{formatNativeMoney(monthlyBreakdown.incomeKHR, "KHR")}</div>
                <div className="font-bold text-[#E50914] dark:text-red-400 text-[12px]">
                  {formatNativeMoney(-Math.abs(monthlyBreakdown.spentKHR), "KHR")}
                </div>
              </div>
            </div>

            {/* Last Month Card */}
            <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
              <div className="w-24 h-24 relative flex items-center justify-center">
                <Doughnut data={monthChartData(0)} options={monthChartOptions} />
              </div>
              <div className="flex-1 text-right pl-4 space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{t("summary.last_month")}</span>
                </div>

                {/* USD Section */}
                <div className="text-[10px] font-bold text-gray-400 uppercase">USD Track</div>
                <div className="font-bold text-[#009A00] dark:text-green-400 text-[12px]">{formatNativeMoney(monthlyBreakdown.lastIncomeUSD, "USD")}</div>
                <div className="font-bold text-[#E50914] dark:text-red-400 text-[12px] pb-1 border-b border-gray-100 dark:border-gray-800">
                  {formatNativeMoney(-Math.abs(monthlyBreakdown.lastSpentUSD), "USD")}
                </div>

                {/* KHR Section */}
                <div className="text-[10px] font-bold text-gray-400 uppercase pt-1">KHR Track</div>
                <div className="font-bold text-[#009A00] dark:text-green-400 text-[12px]">{formatNativeMoney(monthlyBreakdown.lastIncomeKHR, "KHR")}</div>
                <div className="font-bold text-[#E50914] dark:text-red-400 text-[12px]">
                  {formatNativeMoney(-Math.abs(monthlyBreakdown.lastSpentKHR), "KHR")}
                </div>
              </div>
            </div>

          </div>

          {/* 2. Middle Row Line Chart with Embedded Currency Switcher */}
          <div className="bg-white dark:bg-[#151D2A] p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-2 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[12px] font-bold text-gray-800 dark:text-gray-200">{t("summary.net_worth_trajectory")}</h3>
              {/* Embedded Currency Switcher */}
              <div className="bg-gray-100 dark:bg-[#1E293B] p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 flex">
                <button
                  onClick={() => setChartCurrency("USD")}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${chartCurrency === "USD" ? 'bg-white dark:bg-[#151D2A] text-blue-600 shadow-xs' : 'text-gray-400'}`}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setChartCurrency("KHR")}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${chartCurrency === "KHR" ? 'bg-white dark:bg-[#151D2A] text-blue-600 shadow-xs' : 'text-gray-400'}`}
                >
                  KHR (៛)
                </button>
              </div>
            </div>
            <div className="h-56 w-full">
              <Line data={trendLineData} options={trendLineOptions} />
            </div>
          </div>

          {/* 3. Bottom Row Budgets Card */}
          <div className="bg-white dark:bg-[#151D2A] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-5 transition-colors">
            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{t("dashboard.active_budgets")}</h3>
            <div className="space-y-5">
              {budgets.length === 0 ? (
                <div className="text-xs text-gray-400 italic text-center py-2">No active budgets configured.</div>
              ) : (
                budgets.slice(0, 5).map((item, idx) => {
                  const spentVal = Number(item.spent ?? item.spent_amount ?? 0);
                  const capVal = Number(item.total ?? item.budget_limit ?? item.cap ?? 0);
                  const isExpired = item.end && new Date(item.end) < new Date();
                  const pct = item.progress || (capVal > 0 ? Math.round((spentVal / capVal) * 100) : 0);

                  return (
                    <div key={item.id || idx} className="flex items-center gap-4 text-xs">
                      <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        <FaWallet />
                      </div>
                      <div className="flex-1 space-y-1.5">

                        <div className="flex justify-between items-end">
                          <div className="leading-tight flex items-center gap-2">
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-[12px] block">{item.name || item.category_name || "Budget Strategy"}</span>
                            {isExpired && (
                              <span className="bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-[8px] font-bold px-1.5 py-0.5 rounded">Expired</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-600 dark:text-gray-400 font-bold block">{pct}%</span>
                          </div>
                        </div>

                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center rounded-full">
                          <div
                            style={{ width: `${Math.min(pct, 100)}%` }}
                            className={`h-full ${pct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                          <span>{t("dashboard.spent")}: <strong className="text-gray-800 dark:text-gray-200">{formatMoney(spentVal, "USD")}</strong></span>
                          <span>{t("dashboard.cap")}: <strong className="text-gray-800 dark:text-gray-200">{formatMoney(capVal, "USD")}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100]">
        <button
          type="button"
          onClick={() => setShowForm("income")}
          className="w-10 h-10 bg-[#009A00] text-white rounded-full flex items-center justify-center text-sm shadow-md hover:scale-105 transition-all cursor-pointer"
        >
          <FaPlus />
        </button>
        <button
          type="button"
          onClick={() => setShowForm("expense")}
          className="w-10 h-10 bg-[#E50914] text-white rounded-full flex items-center justify-center text-sm shadow-md hover:scale-105 transition-all cursor-pointer"
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
}