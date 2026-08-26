import React, { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight, FaRegCalendarAlt, FaClock } from 'react-icons/fa';
import { analyticsAPI } from "../API/index";
import { useTranslation } from "react-i18next";

const CalendarPage = () => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december")
  ];

  const weekDayNames = [
    t("calendar.weekdays.sun"),
    t("calendar.weekdays.mon"),
    t("calendar.weekdays.tue"),
    t("calendar.weekdays.wed"),
    t("calendar.weekdays.thu"),
    t("calendar.weekdays.fri"),
    t("calendar.weekdays.sat")
  ];

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getCalendarEvents({ year, month: month + 1 });
      if (response && response.data) {
        setEvents(response.data);
      }
    } catch (error) {
      console.error("Failed to hydrate calendar matrix timeline blocks:", error);
      setEvents({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
    setSelectedDay(null);
  }, [currentDate]);

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(day);
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatDayKey = (day) => {
    if (!day) return "";
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const selectedDateKey = selectedDay ? formatDayKey(selectedDay) : null;
  const activeDayEvents = selectedDateKey ? (events[selectedDateKey] || []) : [];

  const getEventCategoryType = (ev) => {
    const titleLower = ev.title?.toLowerCase() || "";
    const typeLower = ev.type?.toLowerCase() || "";

    if (typeLower === "transfer" || titleLower.includes("sweep saving")) return "TRANSFER";
    if (typeLower === "income" || titleLower.includes("salary") || titleLower.includes("side job") || titleLower.includes("+")) return "INCOME";
    return "EXPENSE";
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const isKhr = String(currency).toUpperCase() === 'KHR';
    const absVal = Math.abs(Number(amount) || 0);

    if (isKhr) {
      return `${absVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}៛`;
    }
    return `$${absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDailyNetBalances = (dayEvents) => {
    let netUsd = 0;
    let netKhr = 0;

    dayEvents.forEach(ev => {
      const type = getEventCategoryType(ev);
      const amt = Number(ev.amount || 0);
      const isKhr = String(ev.currency).toUpperCase() === 'KHR';

      if (type === 'INCOME') {
        if (isKhr) netKhr += amt;
        else netUsd += amt;
      } else if (type === 'EXPENSE') {
        if (isKhr) netKhr -= amt;
        else netUsd -= amt;
      }
    });

    return { netUsd, netKhr };
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F6FC] dark:bg-[#0B0F17] p-6 md:p-10 font-sans text-gray-700 dark:text-gray-200 grid grid-cols-12 gap-6 max-w-6xl mx-auto transition-colors">

      {/* 1. MAIN CALENDAR GRID COMPONENT */}
      <div className="col-span-12 lg:col-span-8 bg-white dark:bg-[#151D2A] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between transition-colors">

        {/* HEADER CONTROLS ROW */}
        <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800/80 pb-5 mb-4">
          <div className="space-y-0.5">
            <h1 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide">{monthNames[month]} {year}</h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{t("calendar.schedule_matrix_subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-2.5 bg-gray-50 dark:bg-[#1E293B] hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer">
              <FaChevronLeft size={10} className="text-gray-600 dark:text-gray-300" />
            </button>
            <button onClick={handleNextMonth} className="p-2.5 bg-gray-50 dark:bg-[#1E293B] hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer">
              <FaChevronRight size={10} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* WEEKDAYS LABELS PANEL */}
        <div className="grid grid-cols-7 text-center font-black text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
          {weekDayNames.map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>

        {/* DAY CELLS GRID FRAME */}
        <div className="grid grid-cols-7 gap-2 flex-1">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="bg-gray-50/40 dark:bg-[#1E293B]/20 rounded-xl border border-gray-100/20 dark:border-gray-800/30" />;

            const dayKey = formatDayKey(day);
            const dayEvents = events[dayKey] || [];
            const isSelected = selectedDay === day;
            const { netUsd, netKhr } = getDailyNetBalances(dayEvents);

            return (
              <div
                key={`day-${day}`}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[75px] p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                    : 'bg-white dark:bg-[#1E293B]/60 border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#1E293B]'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>{day}</span>

                  {/* DUAL CURRENCY PIP INDICATORS */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-col items-end gap-0.5">
                      {netUsd !== 0 && (
                        <span className={`text-[7px] font-black px-1 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : netUsd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                        }`}>
                          {netUsd > 0 ? `+${formatCurrency(netUsd, 'USD')}` : `-${formatCurrency(netUsd, 'USD')}`}
                        </span>
                      )}
                      {netKhr !== 0 && (
                        <span className={`text-[7px] font-black px-1 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : netKhr > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                        }`}>
                          {netKhr > 0 ? `+${formatCurrency(netKhr, 'KHR')}` : `-${formatCurrency(netKhr, 'KHR')}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Event Bubble Pips */}
                <div className="space-y-1 mt-1">
                  {dayEvents.slice(0, 2).map(ev => {
                    const financialType = getEventCategoryType(ev);

                    return (
                      <div
                        key={ev.id}
                        className={`text-[8px] px-1 py-0.5 rounded font-black truncate max-w-full ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : financialType === 'INCOME' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/30 dark:border-emerald-800/40'
                            : financialType === 'TRANSFER' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/30 dark:border-amber-800/40'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/30 dark:border-red-800/40'
                        }`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className={`text-[7px] text-center font-extrabold ${isSelected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                      + {dayEvents.length - 2} {t("calendar.more")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SIDE EVENTS PREVIEW DETAIL FEED */}
      <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#151D2A] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4 transition-colors">
        <div>
          <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <FaRegCalendarAlt /> {t("calendar.day_target_specifics")}
          </h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold mt-0.5">
            {selectedDay ? `${t("calendar.commitments_for")} ${monthNames[month]} ${selectedDay}, ${year}` : t("calendar.select_day_instruction")}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px] custom-scrollbar">
          {!selectedDay ? (
            <div className="text-center py-20 text-xs text-gray-400 dark:text-gray-500 italic font-semibold border border-dashed border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-[#1E293B]/40 p-4">
              {t("calendar.tap_day_instruction")}
            </div>
          ) : activeDayEvents.length === 0 ? (
            <div className="text-center py-20 text-xs text-gray-400 dark:text-gray-500 font-bold bg-gray-50/40 dark:bg-[#1E293B]/40 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              {t("calendar.schedule_clear")}
            </div>
          ) : (
            activeDayEvents.map(ev => {
              const financialType = getEventCategoryType(ev);
              const isExpense = financialType === 'EXPENSE';

              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 shadow-xs transition-all ${
                    financialType === 'INCOME' ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200' :
                    financialType === 'TRANSFER' ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/50 text-amber-900 dark:text-amber-200' :
                    'bg-red-50/70 dark:bg-red-950/40 border-red-200/60 dark:border-red-900/50 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="mt-0.5 text-base">
                    {financialType === "INCOME" ? "💰" : financialType === "TRANSFER" ? "🔄" : "💸"}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wide leading-tight">
                      {ev.title.replace(/^[^:]+:\s*[-+]+/, ev.title.split(':')[0] + ': ')}
                    </h4>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                      <FaClock size={9} /> {ev.type.replace("_", " ")}
                    </p>

                    <div className="text-sm font-black font-mono pt-1">
                      {isExpense ? '-' : '+'}{formatCurrency(ev.amount, ev.currency)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

export default CalendarPage;