import React, { useState } from 'react';

const Settings = () => {
  const [toggles, setToggles] = useState({
    transition: true,
    bankStatement: true,
  });

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-start justify-center p-10">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl p-10 font-sans text-gray-700">

        {/* Feedback & Support Section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-2">Feedback & Support</h2>
          <p className="text-sm text-gray-500 mb-6">
            If you have any question, contact our customer service at support.web@pftrack.it
          </p>

          <div className="border-t border-gray-100 pt-6 flex items-center justify-between">
            <span className="text-sm font-medium">Language:</span>
            <div className="flex items-center gap-4 flex-1 max-w-md ml-auto">
              <select className="w-full p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400">
                <option>English</option>
                <option>Khmer</option>
              </select>
              <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">Save</button>
            </div>
          </div>
        </section>

        {/* General Settings Section */}
        <section className="border-t border-gray-100 pt-8 space-y-8">
          <h2 className="text-xl font-bold mb-4">General settings</h2>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">First day of month:</span>
            <select className="w-full max-w-md p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400">
              <option>1</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">First day of week:</span>
            <select className="w-full max-w-md p-2 border border-gray-300 rounded-md outline-none bg-white text-sm focus:ring-1 focus:ring-blue-400">
              <option>Monday</option>
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
              <span className="text-sm">Transition set the of the transaction</span>
            </div>

            <div className="flex items-start gap-4">
              <button
                onClick={() => handleToggle('bankStatement')}
                className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${toggles.bankStatement ? 'bg-[#5C72D3]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${toggles.bankStatement ? 'left-7' : 'left-1'}`} />
              </button>
              <span className="text-sm leading-relaxed">
                Display a small icon to remember you to check transactions with your bank statement.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;