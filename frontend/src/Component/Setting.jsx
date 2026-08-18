import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n'; // Adjust relative path if needed

const Settings = () => {
  const { t } = useTranslation();

  // State for all setting fields
  const [language, setLanguage] = useState('en');
  const [firstDayOfMonth, setFirstDayOfMonth] = useState(1);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('Monday');
  const [toggles, setToggles] = useState({
    transition: true,
    bankStatement: true,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // State for Telegram Integration
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState('');
  const [telegramError, setTelegramError] = useState('');

  // Helper function to fetch the stored token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  // 1. Fetch saved settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/settings/', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.language) setLanguage(data.language);
          if (data.first_day_of_month) setFirstDayOfMonth(data.first_day_of_month);
          if (data.first_day_of_week) setFirstDayOfWeek(data.first_day_of_week);
        }
      } catch (err) {
        console.error('Failed to load user settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 2. Save settings & update i18n
  const handleSaveLanguage = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('http://127.0.0.1:8000/settings/', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          language,
          first_day_of_month: parseInt(firstDayOfMonth, 10),
          first_day_of_week: firstDayOfWeek,
        }),
      });

      if (response.ok) {
        await i18n.changeLanguage(language);
        setMessage('Settings saved successfully!');
      } else {
        setMessage('Failed to save settings.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setMessage('Error connecting to backend.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Telegram Connection
  const handleConnectTelegram = async () => {
    setTelegramLoading(true);
    setTelegramError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/settings/telegram/generate-link', {
        method: 'POST',
        headers: getAuthHeaders(), // 🟢 Pass Bearer token here
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error('Failed to generate connection link.');
      }

      const data = await response.json();
      setTelegramUrl(data.telegram_url);

      // Automatically open Telegram in a new browser tab
      window.open(data.telegram_url, '_blank');
    } catch (err) {
      console.error('Error connecting Telegram:', err);
      setTelegramError(err.message || 'Could not connect to Telegram. Please try again.');
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-start justify-center p-10">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl p-10 font-sans text-gray-700">

        {/* Feedback & Support Section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-2">{t('settings.feedback_support', 'Feedback & Support')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            If you have any question, contact our customer service at support.web@pftrack.it
          </p>

          <div className="border-t border-gray-100 pt-6 flex items-center justify-between">
            <span className="text-sm font-medium">{t('settings.language', 'Language')}:</span>
            <div className="flex items-center gap-4 flex-1 max-w-md ml-auto">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400"
              >
                <option value="en">English</option>
                <option value="km">Khmer (ភាសាខ្មែរ)</option>
              </select>
              <button
                onClick={handleSaveLanguage}
                disabled={loading}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : t('settings.save', 'Save')}
              </button>
            </div>
          </div>
          {message && <p className="text-xs mt-2 text-right text-blue-600 font-semibold">{message}</p>}
        </section>

        {/* General Settings Section */}
        <section className="border-t border-gray-100 pt-8 space-y-8">
          <h2 className="text-xl font-bold mb-4">{t('settings.title', 'General settings')}</h2>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('settings.first_day_of_month', 'First day of month')}:</span>
            <select
              value={firstDayOfMonth}
              onChange={(e) => setFirstDayOfMonth(e.target.value)}
              className="w-full max-w-md p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400"
            >
              <option value={1}>1</option>
              <option value={15}>15</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('settings.first_day_of_week', 'First day of week')}:</span>
            <select
              value={firstDayOfWeek}
              onChange={(e) => setFirstDayOfWeek(e.target.value)}
              className="w-full max-w-md p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400"
            >
              <option value="Monday">Monday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>

          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleToggle('transition')}
                className={`w-12 h-6 rounded-full relative transition-colors ${toggles.transition ? 'bg-[#5C72D3]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${toggles.transition ? 'left-7' : 'left-1'}`} />
              </button>
              <span className="text-sm">{t('settings.transition_set_transaction', 'Transition set the of the transaction')}</span>
            </div>

            <div className="flex items-start gap-4">
              <button
                onClick={() => handleToggle('bankStatement')}
                className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${toggles.bankStatement ? 'bg-[#5C72D3]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${toggles.bankStatement ? 'left-7' : 'left-1'}`} />
              </button>
              <span className="text-sm leading-relaxed">
                {t('settings.display_bank_check', 'Display a small icon to remember you to check transactions with your bank statement.')}
              </span>
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section className="border-t border-gray-100 pt-8 mt-8">
          <h2 className="text-xl font-bold mb-4">{t('settings.integrations', 'Integrations')}</h2>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div>
              <h3 className="font-semibold text-gray-800">Telegram Bot</h3>
              <p className="text-sm text-gray-500 mt-1">
                Link your Telegram account to instantly log KHQR expenses via receipt screenshots.
              </p>
              {telegramError && (
                <p className="text-xs text-red-500 mt-2 font-medium">{telegramError}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={handleConnectTelegram}
                disabled={telegramLoading}
                className="px-4 py-2 bg-[#5C72D3] hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium text-sm rounded-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>🤖</span>
                {telegramLoading ? 'Connecting...' : 'Connect Telegram'}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Settings;