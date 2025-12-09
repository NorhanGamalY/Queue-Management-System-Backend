const Business = require("../models/businessSchema");
const Queue = require("../models/queueSchema");
const Ticket = require("../models/ticketSchema");
const { generateBusinessEmbeddings } = require("../utils/embeddingService");

// -------------------------
// POST /api/v1/businesses
// -------------------------
exports.createBusiness = async (req, res) => {
  try {
    const businessData = req.body;

    const newBusiness = await Business.create(businessData);

    // Generate embeddings asynchronously (don't block response)
    generateBusinessEmbeddings(newBusiness)
      .then(async (embeddings) => {
        if (embeddings && Object.keys(embeddings).length > 0) {
          await Business.findByIdAndUpdate(newBusiness._id, embeddings);
          console.log(`Embeddings generated for business: ${newBusiness.name}`);
        }
      })
      .catch((err) => {
        console.error('Error generating embeddings:', err);
      });

    const safeBusiness = await Business.findById(newBusiness._id).select(
      "-password",
    );

    res.status(201).json({
      status: "success",
      message: "Business created successfully",
      data: safeBusiness,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
// -------------------------
// GET /api/v1/businesses
// -------------------------
exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find().select("-password");

    res.status(200).json({
      status: "success",
      results: businesses.length,
      businesses,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// GET /api/v1/businesses/:id
// -------------------------
exports.getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await Business.findById(id).select("-password");

    if (!business) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    res.status(200).json({
      status: "success",
      business,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
// -------------------------
// PATCH /api/v1/businesses/:id
// -------------------------
exports.updateBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedBusiness = await Business.findByIdAndUpdate(id, req.body, {
      new: true,
    }).select("-password");

    if (!updatedBusiness) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    // Regenerate embeddings if relevant fields changed
    const relevantFields = ['name', 'specialization', 'service'];
    const hasRelevantChanges = relevantFields.some(field => req.body[field]);
    
    if (hasRelevantChanges) {
      generateBusinessEmbeddings(updatedBusiness)
        .then(async (embeddings) => {
          if (embeddings && Object.keys(embeddings).length > 0) {
            await Business.findByIdAndUpdate(id, embeddings);
            console.log(`Embeddings updated for business: ${updatedBusiness.name}`);
          }
        })
        .catch((err) => {
          console.error('Error updating embeddings:', err);
        });
    }

    res.status(200).json({
      status: "success",
      message: "Business updated successfully",
      business: updatedBusiness,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// DELETE /api/v1/businesses/:id
// -------------------------
exports.deleteBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Business.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Business deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// GET /api/v1/businesses/me
// -------------------------
exports.getBusinessInfo = async (req, res) => {
  try {
    const businessId = req.user._id;
    const business = await Business.findById(businessId).select("-password -refreshTokens -passwordResetToken -passwordResetExpires");

    if (!business) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    res.status(200).json({
      status: "success",
      business,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// PUT /api/v1/businesses/me
// -------------------------
exports.updateBusinessInfo = async (req, res) => {
  try {
    const businessId = req.user._id;

    // Allowed fields for update
    const allowedFields = [
      "name",
      "mobilePhone",
      "landlinePhone",
      "address",
      "specialization",
      "workingHours",
      "service",
      "queueSettings",
      "paymentMethod",
      "profileImage",
      "businessImages",
    ];

    const updateData = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedBusiness = await Business.findByIdAndUpdate(
      businessId,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!updatedBusiness) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    // Regenerate embeddings if relevant fields changed
    const relevantFields = ["name", "specialization", "service"];
    const hasRelevantChanges = relevantFields.some(
      (field) => req.body[field] !== undefined,
    );

    if (hasRelevantChanges) {
      generateBusinessEmbeddings(updatedBusiness)
        .then(async (embeddings) => {
          if (embeddings && Object.keys(embeddings).length > 0) {
            await Business.findByIdAndUpdate(businessId, embeddings);
            console.log(
              `Embeddings updated for business: ${updatedBusiness.name}`,
            );
          }
        })
        .catch((err) => {
          console.error("Error updating embeddings:", err);
        });
    }

    res.status(200).json({
      status: "success",
      message: "Business updated successfully",
      business: updatedBusiness,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// DELETE /api/v1/businesses/me
// -------------------------
exports.deleteBusiness = async (req, res) => {
  try {
    const businessId = req.user._id;

    // 1. Delete Business
    const deletedBusiness = await Business.findByIdAndDelete(businessId);

    if (!deletedBusiness) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    // 2. Delete related Queues
    await Queue.deleteMany({ businessId });

    // 3. Delete/Cancel Waiting & Called Tickets (active tickets)
    await Ticket.deleteMany({
      businessId,
      status: { $in: ["waiting", "called", "in-progress"] },
    });

    res.status(200).json({
      status: "success",
      message: "Business and related data deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
