// Updated reviewRoutes.js with ticketId support and aligned with schema

const express = require("express");
const Review = require("../models/reviewSchema");
const Business = require("../models/businessSchema");
const Ticket = require("../models/ticketSchema");
const auth = require("../middleware/auth");

const router = express.Router();

// ============================================
// CREATE REVIEW
// POST /api/v1/reviews
// ============================================
router.post("/", auth, async (req, res) => {
  try {
    const { businessId, ticketId, rating, comment } = req.body;

    if (!businessId || !ticketId || !rating || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const business = await Business.findById(businessId);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.userId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to review this ticket" });
    }

    const existingReview = await Review.findOne({ ticketId });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You already reviewed this ticket" });
    }

    const review = await Review.create({
      businessId,
      ticketId,
      userId: req.user.id,
      rating,
      comment,
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// GET REVIEW BY ID
// GET /api/v1/reviews/:id
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("userId", "name email")
      .populate("businessId", "name")
      .populate("ticketId");

    if (!review) return res.status(404).json({ message: "Review not found" });

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// GET ALL REVIEWS WITH FILTERS
// GET /api/v1/reviews
// ============================================
router.get("/", async (req, res) => {
  try {
    const { businessId, userId, rating, page = 1, limit = 10 } = req.query;

    const query = {};
    if (businessId) query.businessId = businessId;
    if (userId) query.userId = userId;
    if (rating) query.rating = rating;

    const reviews = await Review.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// GET REVIEWS FOR BUSINESS
// GET /api/v1/businesses/:businessId/reviews
// ============================================
router.get("/business/:businessId", async (req, res) => {
  try {
    const { rating, sort = "-createdAt", page = 1, limit = 10 } = req.query;

    const query = { businessId: req.params.businessId };
    if (rating) query.rating = rating;

    const reviews = await Review.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const avg = await Review.aggregate([
      {
        $match: {
          businessId: require("mongoose").Types.ObjectId(req.params.businessId),
        },
      },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);

    const avgRating = avg[0]?.avgRating || 0;

    res.json({ reviews, avgRating });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// GET USER'S REVIEWS
// GET /api/v1/users/me/reviews
// ============================================
router.get("/me/user", auth, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// UPDATE REVIEW
// PUT /api/v1/reviews/:id
// ============================================
router.put("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.body.rating) review.rating = req.body.rating;
    if (req.body.comment) review.comment = req.body.comment;

    await review.save();

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// DELETE REVIEW
// DELETE /api/v1/reviews/:id
// ============================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    await review.deleteOne();

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
