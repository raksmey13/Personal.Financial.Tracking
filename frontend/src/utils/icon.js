
import creditPayment from '../assets/creditpayment.png';
import creditCard from '../assets/credit-card-.jpg';
import loan from '../assets/loan.jpg';
import loanRepaymentIcon from '../assets/loan-repayment.jpg';

export const getCategoryIconSource = (category) => {
  if (!category) return null;

  const catName = category.name || "";
  const dbIcon = category.icon || "";

  // 2. Loose matching with .includes() to handle " (Main)" or " (Sub)" dynamically
  if (catName.includes("Credit Card Expense")) return creditCard;
  if (catName.includes("Credit Card Payment")) return creditPayment;
  if (catName.includes("Loan Principal Top-Up")) return loan;
  if (catName.includes("Loan Repayment")) return loanRepaymentIcon;

  // 3. Fallback to standard base64 string from the database if it exists
  if (dbIcon && dbIcon.startsWith("data:image")) {
    return dbIcon;
  }

  return null;
};