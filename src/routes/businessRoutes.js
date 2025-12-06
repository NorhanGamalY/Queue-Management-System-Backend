const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const {
  protect,
  restrictToOwnerOrAdmin,
} = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

// Upload profile photo
router.post(
  "/upload-profile-photo",
  protect,
  upload.single("profileImage"),
  businessController.uploadProfilePhoto
);

// Update current business profile
router.put(
  "/:id",
  protect,
  businessController.updateBusinessById
);

// Create a new business (open to anyone or you can restrict to admin)
router.post("/business", businessController.createBusiness);

// Get all businesses
router.get("/business", businessController.getAllBusinesses);

// Get business by ID
router.get("/business/:id", businessController.getBusinessById);

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
