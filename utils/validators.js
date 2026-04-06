const VALID_ROLES = ["viewer", "analyst", "admin"];
const VALID_FINANCE_TYPES = ["income", "expense"];

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateRegisterInput = ({ name, email, password, role }) => {
  if (!name || !email || !password) {
    return "name, email, and password are required";
  }

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    return "name, email, and password must be strings";
  }

  if (!isValidEmail(email)) {
    return "invalid email format";
  }

  if (password.length < 6) {
    return "password must be at least 6 characters";
  }

  if (role && !VALID_ROLES.includes(role)) {
    return "invalid role value";
  }

  return null;
};

const validateLoginInput = ({ email, password }) => {
  if (!email || !password) {
    return "email and password are required";
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return "email and password must be strings";
  }

  if (!isValidEmail(email)) {
    return "invalid email format";
  }

  return null;
};

const validateFinanceInput = ({ title, amount, type, category, date }) => {
  if (!title || amount === undefined || !type || !category || !date) {
    return "title, amount, type, category, and date are required";
  }

  if (typeof title !== "string" || typeof category !== "string") {
    return "title and category must be strings";
  }

  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "amount must be a number";
  }

  if (amount <= 0) {
    return "amount must be positive";
  }

  if (!VALID_FINANCE_TYPES.includes(type)) {
    return "invalid finance type";
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "invalid date";
  }

  return null;
};

module.exports = {
  VALID_ROLES,
  VALID_FINANCE_TYPES,
  validateRegisterInput,
  validateLoginInput,
  validateFinanceInput
};
