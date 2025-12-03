// controllers/authController.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");
const Business = require("../models/businessSchema");
const { signJwt, signRefreshToken, hashToken } = require("../utils/token");
const { sendOTPEmail } = require("../utils/emailService");
const bcrypt = require("bcryptjs");

// Utility to convert durations like "7d" or "15m" to ms
function parseDuration(str) {
  // supports formats like "15m", "7d", "1h"
  const m = str.match(/^(\d+)(d|h|m|s)$/);
  if (!m) return 0;
  const val = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case "d":
      return val * 24 * 60 * 60 * 1000;
    case "h":
      return val * 60 * 60 * 1000;
    case "m":
      return val * 60 * 1000;
    case "s":
      return val * 1000;
    default:
      return 0;
  }
}

// Helper to create and send tokens
const createSendTokens = async ({ entity, res, payload }) => {
  try {
    const accessToken = signJwt(payload);
    const refreshTokenRaw = signRefreshToken(payload);

    // store hashed refresh token in DB (with expiry)
    const hashed = hashToken(refreshTokenRaw);
    const expiresAt = new Date(
      Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
    );

    // push to entity.refreshTokens
    entity.refreshTokens = entity.refreshTokens || [];
    entity.refreshTokens.push({
      token: hashed,
      createdAt: Date.now(),
      expiresAt,
    });

    await entity.save({ validateBeforeSave: false });

    // Set httpOnly cookies for both refresh and access tokens
    res.cookie("refreshToken", refreshTokenRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: parseDuration(process.env.JWT_EXPIRES_IN || "15m"),
    });

    // Remove sensitive fields before sending response
    const entityResponse = entity.toObject ? entity.toObject() : entity;
    delete entityResponse.password;
    delete entityResponse.refreshTokens;
    delete entityResponse.passwordResetToken;
    delete entityResponse.passwordResetExpires;

    // send access token in body
    res.status(200).json({
      status: "success",
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      user: entityResponse,
    });
  } catch (error) {
    throw new Error(`Failed to create tokens: ${error.message}`);
  }
};

// ----------------- Register User -----------------
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    console.log('Registration request body:', req.body);
    console.log('Phone value:', phone, 'Type:', typeof phone);


    // Check if user already exists
    const existing = await User.findOne({ email });
    const existingPhone = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        status: "fail",
        message: "Email already in use",
      });
    }
    if (existingPhone) {
      return res.status(400).json({
        status: "fail",
        message: "Phone already in use",
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: "user",
    });

    // Create token payload
    const payload = {
      id: user._id.toString(),
      role: user.role,
    };

    await createSendTokens({ entity: user, res, payload });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Register Business -----------------
exports.registerBusiness = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password,
      mobilePhone,
      landlinePhone,
      address,
      paymentMethod,
      specialization,
      profileImage,
      businessImages,
      workingHours,
      service,
      queueSettings
    } = req.body;

    console.log('Backend received:', req.body);
    console.log('Extracted values:', { mobilePhone, landlinePhone, address, paymentMethod });

    // Check if business already exists
    const existing = await Business.findOne({ email });
    if (existing) {
      return res.status(400).json({
        status: "fail",
        message: "Business email already in use",
      });
    }

    // Prepare business data
    const businessData = {
      name,
      email,
      password,
      mobilePhone,
      landlinePhone,
      address,
      paymentMethod,
      role: "business",
    };

    // Add optional fields if provided
    if (specialization) businessData.specialization = specialization;
    if (profileImage) businessData.profileImage = profileImage;
    if (businessImages && businessImages.length > 0) businessData.businessImages = businessImages;
    if (workingHours) businessData.workingHours = workingHours;
    if (service) businessData.service = service;
    if (queueSettings) businessData.queueSettings = queueSettings;

    // Create new business
    const business = await Business.create(businessData);

    const payload = {
      id: business._id.toString(),
      role: business.role,
    };

    await createSendTokens({ entity: business, res, payload });
  } catch (err) {
    console.error("Register business error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Google OAuth Callback -----------------
exports.googleCallback = async (req, res) => {
  try {
    // req.user is set by passport.authenticate
    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "Google authentication failed",
      });
    }

    // Create tokens for the user
    const payload = {
      id: req.user._id.toString(),
      role: req.user.role || "user",
    };

    // Send tokens back
    await createSendTokens({ entity: req.user, res, payload });
  } catch (err) {
    console.error("Google callback error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Login (User or Business) -----------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Provide email and password",
      });
    }

    // Try user first
    let user = await User.findOne({ email }).select("+password +refreshTokens");
    let entityType = "user";

    // If not user, try business
    if (!user) {
      user = await Business.findOne({ email }).select(
        "+password +refreshTokens",
      );
      entityType = "business";
    }

    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Check password - try correctPassword method first, fallback to bcrypt
    let correct;
    if (typeof user.correctPassword === "function") {
      correct = await user.correctPassword(password, user.password);
    } else {
      correct = await bcrypt.compare(password, user.password);
    }

    if (!correct) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials",
      });
    }

    // Create token payload
    const payload = {
      id: user._id.toString(),
      role: user.role || (entityType === "business" ? "business" : "user"),
    };

    // Send tokens
    await createSendTokens({ entity: user, res, payload });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Refresh Token -----------------
exports.refreshToken = async (req, res) => {
  try {
    // Try cookie first, then body
    const refreshTokenRaw = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshTokenRaw) {
      return res.status(401).json({
        status: "fail",
        message: "No refresh token provided",
      });
    }

    // Verify signature using refresh secret
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "-refresh";
    const decoded = jwt.verify(refreshTokenRaw, refreshSecret);

    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid token payload",
      });
    }

    // Find user in Users or Businesses
    let entity = await User.findById(userId).select("+refreshTokens");
    if (!entity) {
      entity = await Business.findById(userId).select("+refreshTokens");
    }

    if (!entity) {
      return res.status(401).json({
        status: "fail",
        message: "User no longer exists",
      });
    }

    // Check hashed token existence and expiry
    const hashed = hashToken(refreshTokenRaw);
    const found = (entity.refreshTokens || []).find(
      (rt) => rt.token === hashed && new Date(rt.expiresAt) > Date.now(),
    );

    if (!found) {
      return res.status(401).json({
        status: "fail",
        message: "Refresh token invalid or expired",
      });
    }

    // Issue new access token
    const payload = {
      id: entity._id.toString(),
      role: entity.role,
    };
    const accessToken = signJwt(payload);

    res.status(200).json({
      status: "success",
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(401).json({
      status: "fail",
      message: "Refresh token invalid or expired",
    });
  }
};

// ----------------- Logout -----------------
exports.logout = async (req, res) => {
  try {
    const refreshTokenRaw = req.cookies?.refreshToken || req.body.refreshToken;

    if (refreshTokenRaw) {
      const hashed = hashToken(refreshTokenRaw);

      // Remove hashed refresh token from users and businesses
      await User.updateMany(
        {},
        { $pull: { refreshTokens: { token: hashed } } },
      );
      await Business.updateMany(
        {},
        { $pull: { refreshTokens: { token: hashed } } },
      );
    }

    // Clear cookies
    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Forgot Password -----------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user or business
    let user = await User.findOne({ email });
    let model = "User";

    if (!user) {
      user = await Business.findOne({ email });
      model = "Business";
    }

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "No account with that email",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP and expiry (10 minutes)
    user.passwordResetToken = otp;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Send OTP via email
    try {
      await sendOTPEmail({
        email: user.email,
        otp,
        name: user.name,
      });

      res.status(200).json({
        status: "success",
        message: `Password reset OTP has been sent to ${email}`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      
      // If email fails, still return success but log OTP for development
      if (process.env.NODE_ENV === "development") {
        console.log("📧 Development OTP:", otp);
        return res.status(200).json({
          status: "success",
          message: `Email service unavailable. OTP logged to console.`,
          otp, // Only in development when email fails
        });
      }
      
      // In production, clear the OTP if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        status: "error",
        message: "Failed to send password reset email. Please try again later.",
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Reset Password -----------------
exports.resetPassword = async (req, res) => {
  try {
    const otp = req.params.otp; // OTP from URL parameter
    const { password } = req.body;

    // Find user/business with valid OTP
    let user = await User.findOne({
      passwordResetToken: otp,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      user = await Business.findOne({
        passwordResetToken: otp,
        passwordResetExpires: { $gt: Date.now() },
      }).select("+password");
    }

    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "OTP is invalid or has expired",
      });
    }

    // Update password and clear reset fields
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();

    await user.save();

    // Log the user in (issue new tokens)
    const payload = {
      id: user._id.toString(),
      role: user.role,
    };

    await createSendTokens({ entity: user, res, payload });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Get Current User -----------------
exports.getMe = async (req, res) => {
  try {
    // User should already be attached by the 'protect' middleware
    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "Not authenticated",
      });
    }

    // Return user data (already sanitized by protect middleware)
    res.status(200).json({
      status: "success",
      data: req.user,
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ----------------- Update Password -----------------
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "Not authenticated",
      });
    }

    // Find full user/business document with password
    let entity = await User.findById(req.user.id).select(
      "+password +refreshTokens",
    );
    if (!entity) {
      entity = await Business.findById(req.user.id).select(
        "+password +refreshTokens",
      );
    }

    if (!entity) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Verify current password
    let correct;
    if (typeof entity.correctPassword === "function") {
      correct = await entity.correctPassword(currentPassword, entity.password);
    } else {
      correct = await bcrypt.compare(currentPassword, entity.password);
    }

    if (!correct) {
      return res.status(401).json({
        status: "fail",
        message: "Your current password is incorrect",
      });
    }

    // Update password
    entity.password = newPassword;
    entity.passwordChangedAt = Date.now();

    // Optional: Clear all refresh tokens to force logout everywhere
    entity.refreshTokens = [];

    await entity.save();

    // Issue new tokens
    const payload = {
      id: entity._id.toString(),
      role: entity.role,
    };

    await createSendTokens({ entity, res, payload });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    user.verificationToken = crypto.randomBytes(32).toString("hex");
    await user.save();

    // TODO: Send verification email
    // await sendEmail({ to: user.email, subject: 'Verify Email', token: user.verificationToken });

    res.status(200).json({
      success: true,
      message: "Verification email sent",
      // For development only
      verificationToken:
        process.env.NODE_ENV === "development"
          ? user.verificationToken
          : undefined,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending verification",
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying email",
    });
  }
};
