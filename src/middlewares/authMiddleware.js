// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");
const Business = require("../models/businessSchema");
const Admin = require("../models/adminSchema"); // OPTIONAL — remove if you don’t use it
const Queue = require("../models/queueSchema");

/**
 * Protect Middleware
 * Works for User + Business (+ Admin if enabled)
 */
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for access token in cookies first (HTTP-only cookie)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    // Fall back to Authorization header (Bearer token)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized: No token provided",
      });
    }

    // Decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token: Missing user ID",
      });
    }

    // Attempt to load entity from all types
    let entity =
      (await User.findById(userId).select(
        "-password -refreshTokens -passwordResetToken -passwordResetExpires",
      )) ||
      (await Business.findById(userId).select(
        "-password -refreshTokens -passwordResetToken -passwordResetExpires",
      )) ||
      (await Admin.findById(userId).select(
        "-password -refreshTokens -passwordResetToken -passwordResetExpires",
      ));

    if (!entity) {
      return res.status(401).json({
        success: false,
        message: "Account no longer ex2ists",
      });
    }

    // Check password changed after token was issued
    if (
      entity.changedPasswordAfter &&
      entity.changedPasswordAfter(decoded.iat)
    ) {
      return res.status(401).json({
        success: false,
        message: "Password recently changed. Please login again.",
      });
    }

    // Attach entity to request
    req.user = entity;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Token invalid or expired",
      error: err.message,
    });
  }
};

/**
 * Role Authorization Middleware
 * Example: restrictTo("admin") / restrictTo("business") / restrictTo("user")
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No user context",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission",
      });
    }

    next();
  };
};
const restrictToOwnerOrAdmin = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.params.id;
    const user = req.user; // from protect middleware

    // Admins can update any business
    if (user.role === "admin") return next();

    // Only the business owner can update their business
    if (user.role === "business" && user._id.toString() === businessId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to update this business",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authorization error",
      error: err.message,
    });
  }
};

const allowQueueOwnerOrAdmin = async (req, res, next) => {
  try {
    const queueId = req.params.id;

    const queue = await Queue.findById(queueId);
    if (!queue) {
      return res.status(404).json({
        success: false,
        message: "Queue not found",
      });
    }

    const business = await Business.findById(queue.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    // Admin always allowed
    if (req.user.role === "admin") return next();

    // Business owner allowed
    if (
      req.user.role === "business" &&
      req.user._id.toString() === business._id.toString()
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to modify this queue",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authorization error",
      error: err.message,
    });
  }
};

module.exports = {
  protect,
  restrictTo,
  restrictToOwnerOrAdmin,
  allowQueueOwnerOrAdmin,
};
