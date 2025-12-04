// utils/response.js
module.exports = function formatResponse(data, message = "success") {
  return {
    status: "success",
    message,
    data,
  };
};
