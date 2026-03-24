import React, { useState } from "react";
import {
  FaWallet, FaCalendarAlt, FaStar, FaRegCommentDots,
  FaEdit, FaRegTrashAlt, FaEllipsisV
} from "react-icons/fa";

const ExpenseForm = () => {
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    account: "Wallet",
    date: "22/04/2026",
    time: "17:50",
    description: "",
  });

  const [expenses, setExpenses] = useState([
    { id: "001", category: "Beer", amount: "10.5", account: "Bank:A", date: "01.21.2026", description: "Good" },
    { id: "002", category: "Coffee", amount: "3.5", account: "Bank:B", date: "02.11.2026", description: "Good" },
    { id: "003", category: "Eating", amount: "5.05", account: "Bank:A", date: "02.11.2026", description: "Good" },
    { id: "004", category: "Fuel", amount: "2.05", account: "Bank:B", date: "01.12.2026", description: "Good" },
    { id: "005", category: "Technology", amount: "100", account: "Bank:A", date: "01.21.2026", description: "Good" },
  ]);

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-10">

      {/* TOP SECTION: Form and Side Charts */}
      <div className="flex flex-row items-start justify-between w-full gap-8">

        {/* Left: The EXPEND Form */}
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center space-x-6 mb-2 text-gray-400">
            <FaRegCommentDots className="cursor-pointer hover:text-blue-500" />
            <FaStar className="cursor-pointer hover:text-yellow-500" />
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 tracking-widest uppercase">Expenses</h2>

          <form className="space-y-6 text-gray-600">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Category</label>
                <div className="flex items-center space-x-3 border-b border-gray-200 pb-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                  <input type="text" placeholder="Select category" className="w-full outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Amount</label>
                <div className="flex items-center border-b border-gray-200 pb-2">
                  <input type="text" placeholder="0.00" className="w-full outline-none text-right text-lg font-medium" />
                  <span className="text-gray-400 ml-2 font-serif text-xl">$</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 items-center">
              <div className="flex items-center space-x-3">
                <label className="text-xs font-bold text-gray-400 mr-2 uppercase">Checked</label>
                <div className="w-10 h-5 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 bg-white w-3 h-3 rounded-full"></div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Account</label>
                <div className="flex items-center space-x-3 border-b border-gray-200 pb-2">
                  <FaWallet className="text-gray-700" />
                  <select className="w-full outline-none bg-transparent appearance-none">
                    <option>Wallet</option>
                    <option>Bank Account</option>
                  </select>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 font-bold">Balance: $ 0.00</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Date</label>
                <div className="flex items-center space-x-3 border-b border-gray-200 pb-2">
                  <FaCalendarAlt className="text-gray-400" />
                  <input type="text" className="w-full outline-none" defaultValue="22/04/2026" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Time</label>
                <div className="flex items-center border-b border-gray-200 pb-2">
                  <input type="text" className="w-full outline-none" defaultValue="17:50" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-4 outline-none h-28 resize-none shadow-inner bg-gray-50/30"
                placeholder="Description"
              ></textarea>
            </div>

            <div className="flex justify-end space-x-8 pt-4">
              <button type="button" className="text-red-400 font-bold hover:text-red-500 transition">Cancel</button>
              <button type="submit" className="bg-[#e65a41] text-white px-10 py-2.5 rounded-xl font-bold hover:bg-red-600 transition shadow-md">
                Save
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: Top 5 Expenses & Donut Chart */}
        <div className="w-[350px] shrink-0 space-y-8">
          <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-50">
            <h3 className="text-center font-bold text-gray-700 bg-gray-100 rounded-lg py-1 mb-6 text-sm">Top 5 Expenses</h3>
            <div className="space-y-5">
              <TopExpenseItem icon="🎂" name="Entertainment" account="Bank account" price="-2.00" date="06/02/2026" color="bg-cyan-400" />
              <TopExpenseItem icon="🏠" name="Home" account="Bank account" price="-30.00" date="29/05/2026" color="bg-green-500" />
              <TopExpenseItem icon="💻" name="Technology" account="Bank account" price="-30.00" date="29/05/2026" color="bg-gray-700" />
              <TopExpenseItem icon="⚡" name="Energy bill" account="Bank account" price="-30.00" date="29/05/2026" color="bg-blue-600" />
              <TopExpenseItem icon="🚌" name="Transportation" account="Bank account" price="-30.00" date="29/05/2026" color="bg-teal-500" />
            </div>
          </div>

          {/* Simple CSS Donut Chart */}
          <div className="flex justify-center items-center py-4">
            <div className="relative w-44 h-44 rounded-full flex items-center justify-center shadow-inner"
                 style={{background: 'conic-gradient(#4ade80 0% 35%, #f87171 35% 60%, #fb923c 60% 80%, #60a5fa 80% 95%, #94a3b8 95% 100%)'}}>
              <div className="bg-gray-50 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-md">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Transaction Table */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mt-10">
        <table className="w-full text-left">
          <thead className="bg-white border-b border-gray-100">
            <tr className="text-gray-800 text-xs font-black uppercase tracking-wider">
              <th className="p-5">Id</th>
              <th className="p-5">Icon</th>
              <th className="p-5">Category</th>
              <th className="p-5">Amount</th>
              <th className="p-5">Account</th>
              <th className="p-5">Date</th>
              <th className="p-5">Description</th>
              <th className="p-5">Edit</th>
              <th className="p-5 text-center">Delete</th>
            </tr>
          </thead>
          <tbody className="text-gray-500 text-sm font-medium">
            {expenses.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-5">{item.id}</td>
                <td className="p-5">
                  <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-lg shadow-sm">🍔</div>
                </td>
                <td className="p-5">{item.category}</td>
                <td className="p-5 font-bold text-gray-700">{item.amount}$</td>
                <td className="p-5">{item.account}</td>
                <td className="p-5">{item.date}</td>
                <td className="p-5 text-gray-400 italic">{item.description}</td>
                <td className="p-5">
                  <button className="p-2 border rounded-lg hover:bg-white hover:shadow-md transition active:scale-95 flex items-center justify-center border-gray-200">
                    <FaEdit className="text-gray-500" />
                  </button>
                </td>
                <td className="p-5 text-center">
                  <button className="p-2 border rounded-lg hover:bg-white hover:shadow-md transition active:scale-95 mx-auto flex items-center justify-center border-gray-200">
                    <FaRegTrashAlt className="text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-5 flex justify-end gap-2 bg-gray-50/30">
          <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-400 flex items-center justify-center">&lt;</button>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className={`w-8 h-8 rounded-lg font-bold border transition ${n === 1 ? 'bg-purple-100 border-purple-200 text-purple-600' : 'bg-white border-gray-200 text-gray-400'}`}>
              {n}
            </button>
          ))}
          <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-400 flex items-center justify-center">&gt;</button>
        </div>
      </div>
    </div>
  );
};

// Sub-component for Top 5 items with the red indicator
const TopExpenseItem = ({ icon, name, account, price, date, color }) => (
  <div className="flex items-center justify-between relative pr-4 group cursor-pointer">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-lg shadow-sm`}>{icon}</div>
      <div>
        <h4 className="text-sm font-bold text-gray-700">{name}</h4>
        <p className="text-[10px] text-gray-400 font-medium">{account}</p>
      </div>
    </div>
    <div className="text-right flex items-center gap-3">
      <div>
        <p className="text-xs font-bold text-gray-600">{price}$</p>
        <p className="text-[9px] text-gray-400">{date}</p>
      </div>
      <FaEllipsisV className="text-gray-300 text-[10px]" />
    </div>
    {/* Red Vertical Bar */}
    <div className="absolute right-0 top-1 bottom-1 w-[3px] bg-red-400 rounded-full"></div>
  </div>
);

export default ExpenseForm;