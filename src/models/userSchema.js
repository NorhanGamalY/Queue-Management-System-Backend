const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: function () {
        return !this.googleId;
      }, // optional for OAuth
      trim: true,
      minlength: 8,
      select: false,
    },

    phone: { type: String, unique: true, required: true, minlength: 11, maxlength: 11 },
    profileImage: { type: String },

    // OAuth
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },

    // Roles
    role: {
      type: String,
      enum: ["user", "staff", "owner", "admin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: String,

    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordChangedAt: Date,

    // Refresh tokens
    refreshTokens: [
      {
        token: String, // hashed token
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
      },
    ],

    lastLogin: Date,

    // Business associations (for staff)
    businessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],

    // Locale preference
    locale: { type: String, enum: ["en", "ar"], default: "en" },
  },
  { timestamps: true },
);

// -------------------- Hooks & Methods --------------------

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000; // ensure JWT issued after this
  next();
});

// Compare passwords
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min
  return resetToken; // send raw token to user
};

const User = mongoose.model("User", userSchema);
module.exports = User;
