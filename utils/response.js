const sendResponse = (res, statusCode, success, message, data = null) => {
  const payload = {
    success,
    message
  };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

module.exports = sendResponse;
