const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendResponse = require("../utils/response");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendResponse(res, 401, false, "unauthorized: token missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return sendResponse(res, 401, false, "unauthorized: user not found");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendResponse(res, 401, false, "unauthorized: token expired");
    }

    if (error.name === "JsonWebTokenError") {
      return sendResponse(res, 401, false, "unauthorized: invalid token");
    }

    next(error);
  }
};

module.exports = {
  protect
};
