const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

//Get admin dashboard overview
router.get(
  "/admin/dashboard",
  protect,
  restrictTo("admin"),
  adminController.dashboard,
);

//Get all users (admin panel)
router.get(
  "/admin/users",
  protect,
  restrictTo("admin"),
  adminController.getAllUsers,
);

//Get all businesses (admin panel)
router.get(
  "/admin/businesses",
  protect,
  restrictTo("admin"),
  adminController.getAllBusinesses,
);

//Get user by ID (admin only)
router.get(
  "/admin/users/:id",
  protect,
  restrictTo("admin"),
  adminController.getUserById,
);

//Update user by ID (admin only)
router.put(
  "/admin/users/:id",
  protect,
  restrictTo("admin"),
  adminController.updateUserById,
);

//Delete user by ID (admin only)
router.delete(
  "/admin/users/:id",
  protect,
  restrictTo("admin"),
  adminController.deleteUserById,
);

module.exports = router;
