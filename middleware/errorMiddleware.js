const sendResponse = require("../utils/response");

const notFound = (req, res, _next) => {
  sendResponse(res, 404, false, `route not found: ${req.originalUrl}`);
};

const errorHandler = (err, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (err.name === "ValidationError") {
    return sendResponse(res, 400, false, err.message);
  }

  if (err.code === 11000) {
    return sendResponse(res, 400, false, "duplicate field value");
  }

  sendResponse(res, err.statusCode || 500, false, err.message || "internal server error");
};

module.exports = {
  notFound,
  errorHandler
};
