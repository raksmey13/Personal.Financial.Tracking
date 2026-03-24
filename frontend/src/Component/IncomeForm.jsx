import React, { useState, useEffect } from "react"; // CHANGE: Added useEffect
import {
  FaWallet, FaCalendarAlt, FaStar, FaRegCommentDots,
  FaEdit, FaRegTrashAlt, FaBriefcase, FaMoneyBillWave, FaSyncAlt
} from "react-icons/fa";

const IncomeForm = () => {
  // CHANGE: New states to hold database data for Categories and Accounts
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [incomes, setIncomes] = useState([]);

  // CHANGE: Updated formData to use IDs (matching your SQLModel backend)
  const [formData, setFormData] = useState({
    category_id: "",
    amount: "",
    account_id: "",
    transaction_date: "2026-03-16",
    description: "",
    type: "income"
  });

  // CHANGE: Added useEffect to load data from FastAPI on page load
  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, accRes, txRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/categories/"),
          fetch("http://127.0.0.1:8000/accounts/"),
          fetch("http://127.0.0.1:8000/transactions/")
        ]);
        setCategories(await catRes.json());
        setAccounts(await accRes.json());
        const allTx = await txRes.json();
        setIncomes(allTx.filter(t => t.type === "income"));
      } catch (err) {
        console.error("Backend not connected", err);
      }
    };
    loadData();
  }, []);

  // CHANGE: Added handleSubmit function to POST data to FastAPI
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      amount: parseFloat(formData.amount),
      category_id: parseInt(formData.category_id),
      account_id: parseInt(formData.account_id),
    };

    const response = await fetch("http://127.0.0.1:8000/transactions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const newTx = await response.json();
      setIncomes([...incomes, newTx]); // Update table
      setFormData({ ...formData, amount: "", description: "" }); // Reset form
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-10">
      <div className="flex flex-row items-start justify-between w-full gap-8">

        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center space-x-6 mb-2 text-gray-400">
            <FaRegCommentDots className="cursor-pointer hover:text-blue-500" />
            <FaStar className="cursor-pointer hover:text-yellow-500" />
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 tracking-widest uppercase">Income</h2>

          {/* CHANGE: Added onSubmit handler */}
          <form onSubmit={handleSubmit} className="space-y-6 text-gray-600">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Category</label>
                <div className="flex items-center space-x-3 border-b border-gray-200 pb-2">
                  {/* CHANGE: Changed input to select with dynamic database categories */}
                  <select
                    required
                    className="w-full outline-none bg-transparent"
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Amount</label>
                <div className="flex items-center border-b border-gray-200 pb-2">
                  {/* CHANGE: Added value and onChange to amount */}
                  <input
                    required
                    type="number"
                    placeholder="0.00"
                    className="w-full outline-none text-right text-lg font-medium"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
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
                  {/* CHANGE: Dynamic accounts from database */}
                  <select
                    required
                    className="w-full outline-none bg-transparent appearance-none"
                    value={formData.account_id}
                    onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                  >
                    <option value="">Select Account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">Date</label>
                <div className="flex items-center space-x-3 border-b border-gray-200 pb-2">
                  <FaCalendarAlt className="text-gray-400" />
                  {/* CHANGE: Controlled date input */}
                  <input
                    type="date"
                    className="w-full outline-none"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
                  />
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
              {/* CHANGE: Added value and onChange to description */}
              <textarea
                className="w-full border border-gray-200 rounded-xl p-4 outline-none h-28 resize-none shadow-inner bg-gray-50/30"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              ></textarea>
            </div>

            <div className="flex justify-end space-x-8 pt-4">
              <button type="button" className="text-green-500 font-bold hover:text-green-600 transition">Cancel</button>
              <button type="submit" className="bg-[#56a55a] text-white px-10 py-2.5 rounded-xl font-bold hover:bg-green-700 transition shadow-md">
                Save
              </button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-6 w-full max-w-xs">
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-50">
            <h3 className="text-lg font-bold text-gray-600 mb-4">Income Balance</h3>
            {/* CHANGE: Calculate balance dynamically from incomes state */}
            <p className="text-3xl font-extrabold text-gray-800">
              $ {incomes.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            </p>
            <p className="text-gray-400 text-sm mt-2">Total tracked income</p>
          </div>

          <SummaryCard icon={<FaSyncAlt/>} label="SALARY" amount="1,3000.00" />
          <SummaryCard icon={<FaBriefcase/>} label="SIDE JOB" amount="1,0000.00" />
          <SummaryCard icon={<FaMoneyBillWave/>} label="CASH" amount="1,5000.00" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mt-10">
        <table className="w-full text-left">
          <thead className="bg-white border-b border-gray-100">
            <tr className="text-gray-800 text-xs font-black uppercase tracking-wider">
              <th className="p-5">Id</th>
              <th className="p-5">Category</th>
              <th className="p-5">Amount</th>
              <th className="p-5">Account</th>
              <th className="p-5">Date</th>
              <th className="p-5">Description</th>
              <th className="p-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-500 text-sm font-medium">
            {/* CHANGE: Mapping through real incomes from backend */}
            {incomes.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-5">{item.id}</td>
                {/* CHANGE: Look up category name by ID */}
                <td className="p-5">{categories.find(c => c.id === item.category_id)?.name || "N/A"}</td>
                <td className="p-5 font-bold text-green-600">+${item.amount}</td>
                {/* CHANGE: Look up account name by ID */}
                <td className="p-5">{accounts.find(a => a.id === item.account_id)?.name || "N/A"}</td>
                <td className="p-5">{item.transaction_date}</td>
                <td className="p-5 text-gray-400">{item.description}</td>
                <td className="p-5 flex justify-center space-x-2">
                  <button className="p-2 border rounded-lg hover:bg-white"><FaEdit /></button>
                  <button className="p-2 border rounded-lg hover:bg-white text-red-500"><FaRegTrashAlt /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon, label, amount }) => (
  <div className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 flex items-center justify-between hover:translate-x-2 transition-transform cursor-pointer group">
    <div className="text-2xl text-green-500 group-hover:scale-110 transition-transform">{icon}</div>
    <div className="text-right">
      <h4 className="text-[10px] font-black tracking-[0.15em] text-green-600">{label}</h4>
      <p className="text-xl font-bold text-gray-800">$ {amount}</p>
    </div>
  </div>
);

export default IncomeForm;