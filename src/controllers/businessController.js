const Business = require("../models/businessSchema");
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
