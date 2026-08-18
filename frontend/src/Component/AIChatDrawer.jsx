import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { FaRobot, FaTimes, FaPaperPlane, FaUserCircle } from "react-icons/fa";

const AIChatDrawer = () => {
  // ==============================================================================
  // 1. STATE MANAGEMENT
  // ==============================================================================
  const [isOpen, setIsOpen] = useState(false); // Controls chat window visibility
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I'm your PFTrack Assistant. You can log expenses naturally (e.g., 'Spent $5 on coffee using ABA') or ask me financial questions.",
    },
  ]);
  const [input, setInput] = useState(""); // Current text input value
  const [loading, setLoading] = useState(false); // Show typing indicator
  const messagesEndRef = useRef(null); // Ref for auto-scrolling

  // ==============================================================================
  // 2. HELPER FUNCTIONS & EFFECTS
  // ==============================================================================

  // Auto-scroll to the bottom of the chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch authentication headers from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token"); // Assuming your token is stored as 'token'
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // ==============================================================================
  // 3. EVENT HANDLERS (API Interaction)
  // ==============================================================================
  const handleSend = async (e) => {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    // A. Clear input and add User message to local feed
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);
    setLoading(true);

    try {
      // B. CALL FastAPI BACKEND: POST /ai/chat
      const response = await axios.post(
        "https://personal-financial-tracking.onrender.com/ai/chat", // Update port if your API is different
        { message: userMessage },
        getAuthHeaders()
      );

      // C. Add AI reply to local feed
      setMessages((prev) => [...prev, { sender: "ai", text: response.data.reply }]);
    } catch (error) {
      console.error("AI Chat Assistant Error:", error);

      // D. Error Handling: Add polite error message to local feed
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "My apologies, but I am currently unable to process your request. Please ensure you are logged in or try again shortly.",
        },
      ]);
    } finally {
      // E. Clear loading state
      setLoading(false);
    }
  };

  // ==============================================================================
  // 4. UI RENDER LOOP
  // ==============================================================================
  return (
    // Fixed container in the bottom-left corner with high z-index
    <div className="fixed bottom-8 left-8 z-[200] font-sans">

      {/* 🔴 A. Floating Action Button (FAB) - Visible when chat is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
          className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl shadow-2xl hover:scale-110 hover:bg-blue-700 active:scale-95 transition-all duration-150 cursor-pointer border-4 border-white"
        >
          <FaRobot />
        </button>
      )}

      {/* 🔴 B. Main Chat Window (Drawer) - Visible when toggled open */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] bg-white border border-gray-100 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">

          {/* Header Bar (Blue) */}
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <FaRobot className="text-lg" />
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight">PFTrack Assistant</span>
                <span className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">Surveyor Pro</span>
              </div>
            </div>
            {/* Close Icon Button */}
            <button
              onClick={() => setIsOpen(false)}
              title="Close Assistant"
              className="text-white hover:text-red-200 transition-colors cursor-pointer"
            >
              <FaTimes />
            </button>
          </div>

          {/* Messages Feed Area (Scrollable) */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#F8F9FD]">
            {messages.map((message, index) => {
              const isAi = message.sender === "ai";
              return (
                <div key={index} className={`flex gap-2.5 ${isAi ? "" : "justify-end"}`}>
                  {/* AI Avatar Icon */}
                  {isAi && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0 mt-1">
                      <FaRobot size={12} />
                    </div>
                  )}
                  {/* User Avatar Placeholder */}
                  {!isAi && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 mt-1 order-last">
                      <FaUserCircle size={14} />
                    </div>
                  )}
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[75%] p-3.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs ${
                      isAi
                        ? "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                        : "bg-blue-600 text-white rounded-br-none"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              );
            })}
            {/* Typing Indicator */}
            {loading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <FaRobot size={12} />
                </div>
                <div className="text-xs text-gray-400 italic font-medium animate-pulse">Assistant is thinking...</div>
              </div>
            )}
            {/* Auto-scroll anchor point */}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Form (Bottom) */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex items-center gap-3 shadow-inner">
            <input
              type="text"
              placeholder="Type message or log expense... (e.g. Spent $5 on coffee...)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs font-semibold border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-gray-300"
            />
            {/* Send Button */}
            <button
              type="submit"
              disabled={loading}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <FaPaperPlane size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIChatDrawer;