import React, { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight, FaRegCalendarAlt, FaClock, FaDollarSign, FaCreditCard, FaTag } from 'react-icons/fa';
import { analyticsAPI } from "../API/index";

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1));
  const [events, setEvents] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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

  // 💡 HELPER: Maps the event properties directly to your financial system logic
  const getEventCategoryType = (ev) => {
    const titleLower = ev.title?.toLowerCase() || "";
    const typeLower = ev.type?.toLowerCase() || "";

    if (typeLower === "transfer" || titleLower.includes("sweep saving")) return "TRANSFER";
    if (typeLower === "income" || titleLower.includes("salary") || titleLower.includes("side job") || titleLower.includes("+")) return "INCOME";
    return "EXPENSE"; // Default fallback for bills, statements, fuel, etc.
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F6FC] p-6 md:p-10 font-sans text-gray-700 grid grid-cols-12 gap-6 max-w-6xl mx-auto">

      {/* 1. MAIN CALENDAR GRID COMPONENT */}
      <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">

        {/* HEADER CONTROLS ROW */}
        <div className="flex items-center justify-between border-b border-gray-50 pb-5 mb-4">
          <div className="space-y-0.5">
            <h1 className="text-lg font-black text-gray-800 uppercase tracking-wide">{monthNames[month]} {year}</h1>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Financial Schedule Matrix</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all cursor-pointer">
              <FaChevronLeft size={10} className="text-gray-600" />
            </button>
            <button onClick={handleNextMonth} className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all cursor-pointer">
              <FaChevronRight size={10} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* WEEKDAYS LABELS PANEL */}
        <div className="grid grid-cols-7 text-center font-black text-[10px] text-gray-400 uppercase tracking-widest mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="py-1">{d}</div>)}
        </div>

        {/* DAY CELLS GRID FRAME */}
        <div className="grid grid-cols-7 gap-2 flex-1">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="bg-gray-50/40 rounded-xl border border-gray-100/20" />;

            const dayKey = formatDayKey(day);
            const dayEvents = events[dayKey] || [];
            const isSelected = selectedDay === day;

            return (
              <div
                key={`day-${day}`}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[75px] p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-white border-gray-100 text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-gray-400'}`}>{day}</span>

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
                            : financialType === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/30'
                            : financialType === 'TRANSFER' ? 'bg-amber-50 text-amber-700 border border-amber-200/30'
                            : 'bg-red-50 text-red-700 border border-red-200/30' // EXPENSE
                        }`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className={`text-[7px] text-center font-extrabold ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                      + {dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SIDE EVENTS PREVIEW DETAIL FEED */}
      <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FaRegCalendarAlt /> Day Target Specifics
          </h3>
          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
            {selectedDay ? `Commitments for ${monthNames[month]} ${selectedDay}, ${year}` : "Select a day node card cell to audit schedules"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px]">
          {!selectedDay ? (
            <div className="text-center py-20 text-xs text-gray-400 italic font-semibold border border-dashed border-gray-100 rounded-2xl bg-gray-50/50 p-4">
              👈 Tap any calendar day element cell grid block to overview upcoming commitments.
            </div>
          ) : activeDayEvents.length === 0 ? (
            <div className="text-center py-20 text-xs text-gray-400 font-bold bg-gray-50/40 rounded-2xl p-4 border border-gray-100">
              🎉 Schedule Clear: No obligations or deadlines fall on this date node.
            </div>
          ) : (
            activeDayEvents.map(ev => {
              const financialType = getEventCategoryType(ev);

              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 shadow-xs transition-all ${
                    financialType === 'INCOME' ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-900' :
                    financialType === 'TRANSFER' ? 'bg-amber-50/70 border-amber-200/60 text-amber-900' :
                    'bg-red-50/70 border-red-200/60 text-red-900' // EXPENSE
                  }`}
                >
                  <div className="mt-0.5 text-base">
                    {financialType === "INCOME" ? "💰" : financialType === "TRANSFER" ? "🔄" : "💸"}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wide leading-tight">{ev.title}</h4>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                      <FaClock size={9} /> {ev.type.replace("_", " ")}
                    </p>
                    <div className="text-sm font-black font-mono pt-1 flex items-center">
                      <FaDollarSign size={10} className="opacity-50" />
                      {ev.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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