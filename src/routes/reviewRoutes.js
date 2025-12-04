// routes/reviewRoutes.js
const express = require("express");
const {
  protect,
  restrictToOwnerOrAdmin,
  restrictTo,
} = require("../middlewares/authMiddleware");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

// CREATE REVIEW
router.post("/", protect, reviewController.createReview);

// GET REVIEW BY ID
router.get(
  "/:id",
  protect,
  restrictTo("admin"),
  reviewController.getReviewById,
);

// GET ALL REVIEWS WITH FILTERS
router.get("/", restrictTo("admin"), reviewController.getReviews);

// GET REVIEWS FOR BUSINESS
router.get("/businesses/:businessId", reviewController.getReviewsForBusiness);

// GET USER'S REVIEWS
router.get("/me", protect, reviewController.getMyReviews);

// UPDATE REVIEW
router.put(
  "/:id",
  protect,
  restrictToOwnerOrAdmin,
  reviewController.updateReview,
);

// DELETE REVIEW
router.delete(
  "/:id",
  protect,
  restrictToOwnerOrAdmin,
  reviewController.deleteReview,
);
module.exports = router;
