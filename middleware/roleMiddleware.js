const sendResponse = require("../utils/response");

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return sendResponse(res, 401, false, "unauthorized: user context missing");
  }

  if (!allowedRoles.includes(req.user.role)) {
    return sendResponse(res, 403, false, "forbidden: insufficient permissions");
  }

  next();
};

module.exports = {
  authorize
};
