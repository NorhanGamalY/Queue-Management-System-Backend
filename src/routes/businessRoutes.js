const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const {
  protect,
  restrictToOwnerOrAdmin,
} = require("../middlewares/authMiddleware");

// Create a new business (open to anyone or you can restrict to admin)
router.post("/business", businessController.createBusiness);

// Get all businesses
router.get("/business", businessController.getAllBusinesses);

// Get business by ID
router.get("/business/:id", businessController.getBusinessById);

// -------------------------
// ME ROUTES (Logged-in Business)
// -------------------------
router.get("/me", protect, businessController.getBusinessInfo);
router.put("/me", protect, businessController.updateBusinessInfo);
router.delete("/me", protect, businessController.deleteBusiness);

// Update business by ID (only owner or admin)
router.put(
  "/business/:id",
  protect,
  restrictToOwnerOrAdmin,
  businessController.updateBusinessById,
);

// Delete business by ID (only owner or admin)
router.delete(
  "/business/:id",
  protect,
  restrictToOwnerOrAdmin,
  businessController.deleteBusinessById,
);

module.exports = router;
