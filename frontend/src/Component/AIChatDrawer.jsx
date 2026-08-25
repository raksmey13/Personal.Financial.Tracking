import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  FaRobot,
  FaTimes,
  FaPaperPlane,
  FaUserCircle,
  FaPaperclip,
  FaTrash
} from "react-icons/fa";

const API_BASE_URL = "https://personal-financial-tracking.onrender.com";

const DEFAULT_WELCOME = {
  sender: "ai",
  text: "Hello! I'm your PFTrack Assistant. You can log expenses naturally (e.g., 'Spent $5 on coffee using ABA'), upload receipts, or ask financial questions.",
};

const AIChatDrawer = () => {
  // ==============================================================================
  // 1. STATE MANAGEMENT & PERSISTENCE
  // ==============================================================================
  const [isOpen, setIsOpen] = useState(false);

  // Load chat history from localStorage or fallback to initial welcome message
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("surveyor_pro_chat_history");
      return saved ? JSON.parse(saved) : [DEFAULT_WELCOME];
    } catch (e) {
      return [DEFAULT_WELCOME];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync messages to localStorage on state update
  useEffect(() => {
    try {
      localStorage.setItem("surveyor_pro_chat_history", JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history to localStorage", e);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auth Header Helper
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // Clear Chat History Handler
  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME]);
    localStorage.removeItem("surveyor_pro_chat_history");
  };

  // ==============================================================================
  // 2. TEXT CHAT HANDLER
  // ==============================================================================
  const handleSend = async (e) => {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/ai/chat`,
        { message: userMessage },
        getAuthHeaders()
      );

      setMessages((prev) => [...prev, { sender: "ai", text: response.data.reply }]);
    } catch (error) {
      console.error("AI Chat Assistant Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "My apologies, I am currently unable to process your request. Please ensure you are logged in or try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================================================
  // 3. RECEIPT IMAGE UPLOAD HANDLER
  // ==============================================================================
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || loading) return;

    // Reset file input
    e.target.value = null;

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: `📷 Uploaded receipt: ${file.name}` },
    ]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/ai/scan-receipt`,
        formData,
        {
          headers: {
            ...getAuthHeaders().headers,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const parsed = response.data;
      const formattedReply = `✅ **Receipt Parsed:**\n• **Merchant:** ${parsed.clean_merchant}\n• **Amount:** ${parsed.currency === "KHR" ? "៛" : "$"}${parsed.amount}\n• **Category:** ${parsed.suggested_category_name}\n• **Date:** ${parsed.transaction_date}`;

      setMessages((prev) => [...prev, { sender: "ai", text: formattedReply }]);
    } catch (error) {
      console.error("Receipt Scanning Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Failed to extract receipt data. Please check image clarity or try another receipt.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================================================
  // 4. UI RENDER LOOP
  // ==============================================================================
  return (
    // 🟢 Draggable Framer Motion Wrapper
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={{
        left: 0,
        right: typeof window !== "undefined" ? window.innerWidth - 100 : 800,
        top: 0,
        bottom: typeof window !== "undefined" ? window.innerHeight - 100 : 800,
      }}
      className="fixed bottom-8 left-8 z-[200] font-sans cursor-grab active:cursor-grabbing"
    >
      {/* 🔴 A. Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant (Drag to move)"
          className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl shadow-2xl hover:scale-110 hover:bg-blue-700 active:scale-95 transition-all duration-150 cursor-pointer border-4 border-white"
        >
          <FaRobot />
        </button>
      )}

      {/* 🔴 B. Main Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] bg-white border border-gray-100 rounded-3xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header Bar */}
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <FaRobot className="text-lg" />
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight">PFTrack Assistant</span>
                <span className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">
                  Surveyor Pro
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Clear History Button */}
              <button
                onClick={handleClearChat}
                title="Clear Chat History"
                className="text-blue-200 hover:text-white transition-colors cursor-pointer text-xs"
              >
                <FaTrash />
              </button>
              {/* Close Drawer Button */}
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="text-white hover:text-red-200 transition-colors cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#F8F9FD]">
            {messages.map((message, index) => {
              const isAi = message.sender === "ai";
              return (
                <div key={index} className={`flex gap-2.5 ${isAi ? "" : "justify-end"}`}>
                  {isAi && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0 mt-1">
                      <FaRobot size={12} />
                    </div>
                  )}
                  {!isAi && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 mt-1 order-last">
                      <FaUserCircle size={14} />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] p-3.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs whitespace-pre-wrap ${
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

            {loading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <FaRobot size={12} />
                </div>
                <div className="text-xs text-gray-400 italic font-medium animate-pulse">
                  Assistant is processing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form with Receipt Upload Support */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 shadow-inner"
          >
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Paperclip Button for Receipt Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload Receipt Image"
              className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <FaPaperclip size={14} />
            </button>

            {/* Message Textbox */}
            <input
              type="text"
              placeholder="Message or log expense..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-2.5 text-xs font-semibold border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-gray-300"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FaPaperPlane size={14} />
            </button>
          </form>
        </div>
      )}
    </motion.div>
  );
};

export default AIChatDrawer;