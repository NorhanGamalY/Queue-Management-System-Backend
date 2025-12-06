// routes/reviewRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const Review = require("../models/reviewSchema");
const Business = require("../models/businessSchema");
const Ticket = require("../models/ticketSchema");
const { protect } = require("../middlewares/authMiddleware"); // should populate req.user { id, role, ... }

const router = express.Router();

/**
 * POST /api/v1/reviews
 * Create review for business
 * Body: businessId, ticketId, rating, comment
 * Headers: Authorization token
 */
router.post("/reviews", protect, async (req, res) => {
  try {
    const { businessId, ticketId, rating, comment } = req.body;
    if (!businessId || !ticketId || rating == null || !comment) {
      return res.status(400).json({
        message: "businessId, ticketId, rating and comment are required",
      });
    }

    const business = await Business.findById(businessId);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // ensure the ticket belongs to the current user
    if (String(ticket.userId) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to review this ticket" });
    }

    // prevent duplicate review for same ticket
    const existing = await Review.findOne({ ticketId });
    if (existing)
      return res
        .status(400)
        .json({ message: "This ticket already has a review" });

    const review = await Review.create({
      businessId,
      ticketId,
      userId: req.user.id,
      rating,
      comment,
    });

    return res.status(201).json(review);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/v1/reviews/:id
 * Get review by ID
 */
router.get("/reviews/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("userId", "name email")
      .populate("businessId", "name")
      .populate("ticketId");
    if (!review) return res.status(404).json({ message: "Review not found" });
    return res.json(review);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/v1/reviews
 * Query: businessId, userId, rating, page, limit
 */
router.get("/reviews", async (req, res) => {
  try {
    const { businessId, userId, rating, page = 1, limit = 10 } = req.query;
    const query = {};
    if (businessId) query.businessId = businessId;
    if (userId) query.userId = userId;
    if (rating) query.rating = Number(rating);

    const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      Review.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Review.countDocuments(query),
    ]);

    return res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      reviews,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/v1/businesses/:businessId/reviews
 * Query: rating, sort, page, limit
 * Returns: array of reviews, average rating
 */
router.get("/businesses/:businessId/reviews", async (req, res) => {
  try {
    const { rating, sort = "-createdAt", page = 1, limit = 10 } = req.query;
    const { businessId } = req.params;

    // validate business exists (optional but helpful)
    const business = await Business.findById(businessId);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    const match = { businessId: new mongoose.Types.ObjectId(businessId) };
    if (rating) match.rating = Number(rating);

    const skip = (Math.max(Number(page), 1) - 1) * Number(limit);

    const reviews = await Review.find(match)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "name");

    // average rating aggregation
    const agg = await Review.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRating = agg[0]?.avgRating ?? 0;
    const count = agg[0]?.count ?? 0;

    return res.json({
      reviews,
      avgRating,
      count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/v1/users/me/reviews
 * Get user's reviews
 * Headers: Authorization token
 */
router.get("/users/me/reviews", protect, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/v1/reviews/:id
 * Update review (owner only)
 * Body: rating, comment
 * Headers: Authorization token
 */
router.put("/reviews/:id", protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (String(review.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.body.rating != null) review.rating = req.body.rating;
    if (req.body.comment != null) review.comment = req.body.comment;

    await review.save();
    return res.json(review);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/v1/reviews/:id
 * Delete review (owner/admin only)
 * Headers: Authorization token
 */
router.delete("/reviews/:id", protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    // allow owner or admin
    if (
      String(review.userId) !== String(req.user.id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await review.deleteOne();
    return res.json({ message: "Review deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
