const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const passport = require("passport");

const {
  registerValidation,
  registerBusinessValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updatePasswordValidation,
} = require("../validations/authValidation");

router.post("/register", registerValidation, authController.registerUser);
router.post("/register-business", registerBusinessValidation, authController.registerBusiness); 
router.post("/login", loginValidation, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

router.post(
  "/forgot-password",
  forgotPasswordValidation,
  authController.forgotPassword,
);
router.post(
  "/reset-password/:otp",
  resetPasswordValidation,
  authController.resetPassword,
);
// Google OAuth routes (Documentation: GET /api/auth/google)
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  authController.googleCallback,
);

// Protected routes
router.patch(
  "/update-password",
  protect,
  updatePasswordValidation,
  authController.updatePassword,
);

// Get current user profile
router.get("/me", protect, authController.getMe);

module.exports = router;
