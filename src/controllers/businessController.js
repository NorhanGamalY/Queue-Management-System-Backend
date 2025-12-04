const Business = require("../models/businessSchema");
const BusinessDto = require("../dtos/business.dto");
const formatResponse = require("../utils/response");

// -------------------------
// POST /api/v1/businesses
// -------------------------
exports.createBusiness = async (req, res) => {
  try {
    const businessData = req.body;

    const newBusiness = await Business.create(businessData);

    const dto = new BusinessDto(newBusiness);

    res.status(201).json(formatResponse(dto, "Business created successfully"));
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
    const businesses = await Business.find();

    const dtoList = businesses.map((b) => new BusinessDto(b));

    res
      .status(200)
      .json(formatResponse(dtoList, "Businesses retrieved successfully"));
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
    const business = await Business.findById(id);

    if (!business) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    const dto = new BusinessDto(business);

    res.status(200).json(formatResponse(dto));
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
    });

    if (!updatedBusiness) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
      });
    }

    const dto = new BusinessDto(updatedBusiness);

    res.status(200).json(formatResponse(dto, "Business updated successfully"));
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

    res.status(200).json(formatResponse(null, "Business deleted successfully"));
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
