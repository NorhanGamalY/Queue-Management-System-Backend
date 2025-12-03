// utils/token.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const signJwt = (payload, expiresIn = process.env.JWT_EXPIRES_IN || "15m") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const signRefreshToken = (
  payload,
  expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d",
) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "-refresh",
    { expiresIn },
  );
};

// Hash a token (to store in DB)
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = { signJwt, signRefreshToken, hashToken };
