const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendResponse = require("../utils/response");
const { validateRegisterInput, validateLoginInput } = require("../utils/validators");

const generateToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  );

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const validationError = validateRegisterInput({ name, email, password, role });
    if (validationError) {
      return sendResponse(res, 400, false, validationError);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendResponse(res, 400, false, "email already registered");
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    return sendResponse(res, 201, true, "user registered successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const validationError = validateLoginInput({ email, password });
    if (validationError) {
      return sendResponse(res, 400, false, validationError);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return sendResponse(res, 401, false, "invalid credentials");
    }

    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return sendResponse(res, 401, false, "invalid credentials");
    }

    const token = generateToken(user);

    return sendResponse(res, 200, true, "login successful", {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};
