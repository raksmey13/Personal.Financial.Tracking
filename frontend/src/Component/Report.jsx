import React, { useState, useEffect } from 'react';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { FaEllipsisV, FaArrowUp, FaArrowDown, FaTag } from 'react-icons/fa';
import { categoryAPI, accountAPI, analyticsAPI } from "../API/index";
import { getCategoryIconSource } from '../utils/icon';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const AnalyticsReport = () => {
  // --- Tab State ---
  const [activeTab, setActiveTab] = useState('category');

  // --- Live Dynamic Database Arrays ---
  const [accountsList, setAccountsList] = useState([]);
  const [categoriesReport, setCategoriesReport] = useState([]);
  const [transactionsList, setTransactionsList] = useState([]);

  // TIME & FUTURE MATRIX ARRAYS
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [futureProjections, setFutureProjections] = useState([]);

  // --- Form Filter States ---
  const [filterType, setFilterType] = useState('expenses');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeDropdown, setDateRangeDropdown] = useState('This Month');
  const [selectedAccount, setSelectedAccount] = useState('all');

  // Tab 1 Specific
  const [includeTransactions, setIncludeTransactions] = useState(false);
  const [chartType, setChartType] = useState('Pie Chart');
  const [categoryDepth, setCategoryDepth] = useState('Main Category');

  // Tab 2 Specific
  const [creditCardToggle, setCreditCardToggle] = useState(false);

  // Tab 3 Specific
  const [futurePeriod, setFuturePeriod] = useState('Month');
  const [includePredictiveFixed, setIncludePredictiveFixed] = useState(false); // 🚀 FIXED: Added core tracking state binding hook

  // Report Render Triggers
  const [showReport, setShowReport] = useState(false);

  // --- TIME BOUNDARY ENGINE MATRIX INITIALIZATION ---
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const lastDayStr = String(new Date(currentYear, today.getMonth() + 1, 0).getDate()).padStart(2, '0');

    setFromDate(`${currentYear}-${currentMonth}-01`);
    setToDate(`${currentYear}-${currentMonth}-${lastDayStr}`);

    accountAPI.getAll()
      .then(res => setAccountsList(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error("Account metadata hydration failure:", err));
  }, []);

  // Sync date fields automatically when presets change
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    if (dateRangeDropdown === 'This Month') {
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
      const lastDayStr = String(new Date(currentYear, today.getMonth() + 1, 0).getDate()).padStart(2, '0');
      setFromDate(`${currentYear}-${currentMonth}-01`);
      setToDate(`${currentYear}-${currentMonth}-${lastDayStr}`);
    } else if (dateRangeDropdown === 'Last 30 Days') {
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 30);
      setFromDate(pastDate.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    }
  }, [dateRangeDropdown]);

  // --- HIT REPORT AGGREGATION SERVER REQUEST ---
  const handleCompileReport = async () => {
    try {
      const queryParams = {
        tab: activeTab,
        view_type: filterType, // 🚀 FIXED: Standardized dictionary parameter keys to match python endpoints smoothly
        from_date: fromDate,
        to_date: toDate,
        account_target: selectedAccount,
        include_debts: activeTab === 'future' ? includePredictiveFixed : includeTransactions, // 🚀 FIXED: Route parameter states cleanly
        grouping: categoryDepth === 'Main Category' ? 'main' : 'sub',
        credit_card_rule: creditCardToggle ? 'creation' : 'payment',
        forecast_unit: futurePeriod.toLowerCase(),
        include_predictive_fixed: includePredictiveFixed
      };

      const response = await analyticsAPI.getCustomReport(queryParams);

      if (response && response.data) {
        setCategoriesReport(Array.isArray(response.data.categories) ? response.data.categories : []);
        setTransactionsList(Array.isArray(response.data.transactions) ? response.data.transactions : []);
        setTimeSeriesData(Array.isArray(response.data.time_series) ? response.data.time_series : []);
        setCashFlowData(Array.isArray(response.data.cash_flow) ? response.data.cash_flow : []);
        setFutureProjections(Array.isArray(response.data.future_projections) ? response.data.future_projections : []);
      }
      setShowReport(true);
    } catch (error) {
      console.error("Analytical engine reporting calculation exception:", error);
    }
  };

  const doughnutData = {
    labels: categoriesReport.map(c => `${c.name} $${parseFloat(c.amount).toFixed(2)}`),
    datasets: [{
      data: categoriesReport.map(c => parseFloat(c.amount || 0)),
      backgroundColor: categoriesReport.map((c, i) => c.color || `hsl(${(i * 50) % 360}, 70%, 60%)`),
      borderWidth: 1,
      cutout: '60%'
    }]
  };

  return (
    <div className="w-full min-h-screen bg-[#DFE3E8] p-4 md:p-10 font-sans text-gray-700 flex flex-col items-center gap-6">

      {/* --- FILTER CONTROL BOARD CARD --- */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm overflow-hidden pb-6">
        <h1 className="text-2xl font-normal text-center py-5 border-b border-gray-100 tracking-wide text-gray-800 uppercase">Analytic Engine Center</h1>

        {/* Tab Selection Headers */}
        <div className="bg-[#B0B5B9] grid grid-cols-3 p-1.5 gap-1 text-center font-medium text-sm text-gray-700">
          {['category', 'time', 'future'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setShowReport(false); }}
              className={`py-2 rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-white shadow-xs text-black' : 'hover:bg-white/30'}`}
            >
              {tab === 'future' ? 'Time (Future)' : tab}
            </button>
          ))}
        </div>

        {/* Filter Input Control Wrapper */}
        <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto text-sm">

          {/* Type Sorting Controls Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="font-semibold text-gray-600 w-44">
              {activeTab === 'future' ? 'Forecast Interval Unit:' : 'Show All Categories Of:'}
            </span>
            <div className="flex items-center gap-6">
              {activeTab !== 'future' ? (
                ['expenses', 'income', 'both'].map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer capitalize font-bold text-gray-700">
                    <input
                      type="radio"
                      name="filterType"
                      checked={filterType === type}
                      onChange={() => setFilterType(type)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    {type}
                  </label>
                ))
              ) : (
                ['Month', 'Days'].map((period) => (
                  <label key={period} className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                    <input
                      type="radio"
                      name="futurePeriod"
                      checked={futurePeriod === period}
                      onChange={() => setFuturePeriod(period)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    {period}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Date Picker Range Inputs Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block font-semibold text-gray-600 mb-2">{activeTab === 'future' ? 'Number of Periods:' : 'From:'}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-medium outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-600 mb-2">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-medium outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <select
                value={dateRangeDropdown}
                onChange={(e) => setDateRangeDropdown(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl shadow-sm font-semibold text-gray-600 outline-none"
              >
                <option>Other</option>
                <option>This Month</option>
                <option>Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Account Ledger Filtering Dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="font-semibold text-gray-600 w-36">Target Account</span>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full sm:w-64 p-2.5 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 outline-none"
            >
              <option value="all">All Combined Master Ledgers</option>
              {accountsList.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.account_name}</option>
              ))}
            </select>
          </div>

          {/* Tab Specific Toggles */}
          {activeTab === 'category' && (
            <div className="space-y-4 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-600 w-36">Include Transactions:</span>
                <label className="flex items-center gap-2 text-gray-600 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTransactions}
                    onChange={(e) => setIncludeTransactions(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  Debts / Credit Items
                </label>
              </div>

              <div className="flex items-start gap-4">
                <span className="font-semibold text-gray-600 w-36 pt-1">Chart Representation:</span>
                <div className="flex flex-col gap-2 font-bold text-gray-700">
                  {['Pie Chart', 'Bar Chart'].map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chartType"
                        checked={chartType === type}
                        onChange={() => setChartType(type)}
                        className="w-4 h-4 text-blue-600"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="font-semibold text-gray-600 w-36 pt-1">Grouping Aggregation:</span>
                <div className="flex flex-col gap-2 font-bold text-gray-700">
                  {['Main Category', 'Sub Category'].map(depth => (
                    <label key={depth} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="categoryDepth"
                        checked={categoryDepth === depth}
                        onChange={() => setCategoryDepth(depth)}
                        className="w-4 h-4 text-blue-600"
                      />
                      {depth}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'time' && (
            <div className="flex items-start gap-4 pt-4 border-t border-gray-50 text-xs text-gray-500 font-medium">
              <button
                type="button"
                onClick={() => setCreditCardToggle(!creditCardToggle)}
                className={`w-12 h-6 rounded-full relative flex-shrink-0 transition-colors ${creditCardToggle ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${creditCardToggle ? 'left-7' : 'left-1'}`} />
              </button>
              <p className="leading-tight pt-0.5 text-gray-500">
                Credit card entries are grouped at execution timestamp records instead of waiting for full monthly cyclical billing balances settlement execution adjustments.
              </p>
            </div>
          )}

          {activeTab === 'future' && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-600 w-36">Include Transactions:</span>
                <label className="flex items-center gap-2 text-gray-600 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePredictiveFixed}
                    onChange={(e) => setIncludePredictiveFixed(e.target.checked)} // 🚀 FIXED: State tracking synchronization wire-up
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  Predictive Debts / Credit Contracts
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleCompileReport}
              className="bg-[#3B82F6] hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl shadow transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
            >
              Show Dynamic Report
            </button>
          </div>
        </div>
      </div>

      {/* --- RENDERED REPORTS SECTION CARDS --- */}
      {showReport && (
        <div className="w-full max-w-5xl space-y-6">

          {/* TAB VIEW 1: CATEGORY DISCLOSURE PANELS */}
          {activeTab === 'category' && (
            <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 items-center gap-6">
                <div className="md:col-span-7 flex justify-center h-72">
                  {chartType === 'Pie Chart' ? (
                    <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
                  ) : (
                    <Bar
                      data={{
                        labels: categoriesReport.map(c => c.name),
                        datasets: [{ data: categoriesReport.map(c => c.amount), backgroundColor: '#3B82F6', borderRadius: 4 }]
                      }}
                      options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }}
                    />
                  )}
                </div>
                <div className="md:col-span-5 space-y-2.5 max-h-64 overflow-y-auto pr-2">
                  {categoriesReport.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between font-bold text-xs text-gray-700">
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#3B82F6' }} />
                        {cat.name.includes("➔") ? (
                          <div className="flex items-center gap-1 truncate text-[11px]">
                            <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide truncate max-w-[75px]">
                              {cat.name.split("➔")[0].trim()}
                            </span>
                            <span className="text-gray-300 font-normal">/</span>
                            <span className="capitalize text-gray-800 font-extrabold truncate">
                              {cat.name.split("➔")[1].trim()}
                            </span>
                          </div>
                        ) : (
                          <span className="capitalize truncate">{cat.name}</span>
                        )}
                      </div>
                      <span className="text-gray-900 flex-shrink-0">${parseFloat(cat.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 divide-y divide-gray-50">
                {transactionsList.length === 0 ? (
                  <div className="text-xs text-gray-400 italic py-6 text-center">No structural transaction data entries captured for this parameter window.</div>
                ) : (
                  transactionsList.map((tx) => {
                    const isExpense = String(tx.type || "").toLowerCase().trim() === 'expense';
                    const matchedCategory = tx.category;
                    const finalIconSrc = matchedCategory ? (getCategoryIconSource(matchedCategory) || matchedCategory.icon || "") : "";
                    const displayHeader = (matchedCategory && matchedCategory.name) ? matchedCategory.name : "Uncategorized";
                    const fallbackDesc = tx.description ? tx.description : "";

                    return (
                      <div key={tx.id} className="flex items-center justify-between py-3.5 px-2 text-xs font-bold text-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-xs relative flex-shrink-0">
                            {finalIconSrc && typeof finalIconSrc === 'string' ? (
                              <img src={finalIconSrc} alt="Icon" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-gray-400 text-xs"><FaTag /></div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[7px] ${isExpense ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                              {isExpense ? <FaArrowDown size={6} /> : <FaArrowUp size={6} />}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800 text-sm capitalize">{displayHeader}</h4>
                            <p className="text-gray-400 text-[10px] font-semibold uppercase">
                              {tx.account_name || "Account"} {fallbackDesc ? `• ${fallbackDesc}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className={`font-black ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                              {isExpense ? '-' : '+'}${parseFloat(tx.amount || 0).toFixed(2)}
                            </p>
                            <p className="text-gray-400 text-[10px] font-medium">{tx.transaction_date}</p>
                          </div>
                          <button type="button" className="text-gray-300 hover:text-gray-500"><FaEllipsisV /></button>
                          <div className={`w-1 h-8 rounded-full ${isExpense ? 'bg-red-500' : 'bg-green-500'}`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* TAB VIEW 2: TIME SERIES HISTOGRAMS & LIVE CASH FLOW */}
          {activeTab === 'time' && (
            <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-center font-bold text-gray-800 text-xs uppercase tracking-wider">Historical Account Transactions Volumes</h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: timeSeriesData.map(t => t.date),
                      datasets: [{
                        label: 'Net Balance Delta',
                        data: timeSeriesData.map(t => t.amount),
                        backgroundColor: timeSeriesData.map(t => t.amount >= 0 ? '#22C55E' : '#EF4444'),
                        borderRadius: 4
                      }]
                    }}
                    options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-center font-bold text-gray-800 text-xs uppercase tracking-wider">Cumulative Balance Over Selected Time Frame</h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: cashFlowData.map(c => c.date),
                      datasets: [{
                        data: cashFlowData.map(c => c.balance),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        fill: true,
                        tension: 0.1,
                        pointRadius: 3
                      }]
                    }}
                    options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB VIEW 3: PREDICTIVE FUTURE RUNWAY TRACKING FORECASTS */}
          {activeTab === 'future' && (
            <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-center font-bold text-gray-800 text-xs uppercase tracking-wider">Forecasted Periodic Balance Deficits/Surpluses</h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: futureProjections.map(f => f.period),
                      datasets: [{
                        data: futureProjections.map(f => f.expected_change),
                        backgroundColor: futureProjections.map(f => f.expected_change >= 0 ? '#10B981' : '#F59E0B'),
                        borderRadius: 4
                      }]
                    }}
                    options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-center font-bold text-gray-800 text-xs uppercase tracking-wider">Predictive Total Liquidity Runway Forecast Curve</h3>
                <div className="h-72">
                  <Line
                    data={{
                      labels: futureProjections.map(f => f.period),
                      datasets: [{
                        data: futureProjections.map(f => f.projected_total),
                        borderColor: '#2563EB',
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                        fill: true,
                        tension: 0.15,
                        pointRadius: 4
                      }]
                    }}
                    options={{
                      plugins: { legend: { display: false } },
                      scales: { y: { ticks: { callback: (v) => `$${v.toLocaleString()}` } } },
                      maintainAspectRatio: false
                    }}
                  />
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};

export default AnalyticsReport;