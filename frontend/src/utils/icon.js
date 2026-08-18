import creditPayment from '../assets/creditpayment.png';
import creditCard from '../assets/credit-card-.jpg';
import loan from '../assets/loan.jpg';
import loanRepaymentIcon from '../assets/loan-repayment.jpg';
import openingBalanceImg from '../assets/opening_balance.png';
import sweepSavingImg from '../assets/sweeps-saving.png';
import generalExpenseImg from '../assets/general_expense.png';
import billsImg from '../assets/Bills&Utilities.png';
import entertainmentImg from '../assets/Entertainment.png';
import foodImg from '../assets/food&dining.png';
import shoppingImg from '../assets/Shopping.png';
import salaryImg from '../assets/salary.png';
import transportImg from '../assets/Transportation.png';

// Helper to safely extract string path if Vite exports an object
const resolveImagePath = (imgImport) => {
  if (!imgImport) return null;
  return typeof imgImport === 'string' ? imgImport : imgImport.default || null;
};

export const getCategoryIconSource = (category) => {
  if (!category) return null;

  const catName = category.name || "";
  const dbIcon = category.icon || "";

  if (catName.includes("Credit Card Expense")) return resolveImagePath(creditCard);
  if (catName.includes("Credit Card Payment")) return resolveImagePath(creditPayment);
  if (catName.includes("Loan Principal Top-Up")) return resolveImagePath(loan);
  if (catName.includes("Loan Repayment")) return resolveImagePath(loanRepaymentIcon);
  if (catName.includes("Sweep Saving")) return resolveImagePath(sweepSavingImg);
  if (catName.includes("General Expense")) return resolveImagePath(generalExpenseImg);
  if (catName.includes("Opening Balance") || catName.includes("Starting Balance")) {
    return resolveImagePath(openingBalanceImg);
  }
  if (catName.includes("Bills & Utilities")) return resolveImagePath(billsImg);
  if (catName.includes("Entertainment")) return resolveImagePath(entertainmentImg);
  if (catName.includes("Food & Dining")) return resolveImagePath(foodImg);
  if (catName.includes("Shopping")) return resolveImagePath(shoppingImg);
  if (catName.includes("Transport")) return resolveImagePath(transportImg);
  if (catName.includes("Salary")) return resolveImagePath(salaryImg);

  if (dbIcon && dbIcon.startsWith("data:image")) {
    return dbIcon;
  }

  return null;
};