const Users = require("../models/userSchema");
const Business = require("../models/businessSchema");

// -------------------------
// GET /api/v1/admin/dashboard
// -------------------------
exports.dashboard = async (req, res) => {
  try {
    // Get counts
    const userCount = await Users.countDocuments();
    const businessCount = await Business.countDocuments();

    // Get all users and businesses
    const users = await Users.find().select('-password -refreshTokens -passwordResetToken');
    const businesses = await Business.find().select('-password -refreshTokens -passwordResetToken');

    res.status(200).json({
      status: "success",
      data: { 
        userCount, 
        businessCount,
        users,
        businesses
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// GET /api/v1/admin/users
// -------------------------
exports.getAllUsers = async (req, res) => {
  try {
    const users = await Users.find().select('-password -refreshTokens -passwordResetToken -passwordResetExpires');

    res.status(200).json({
      status: "success",
      results: users.length,
      users,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// GET /api/v1/admin/businesses
// -------------------------
exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find().select('-password -refreshTokens -passwordResetToken -passwordResetExpires');

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
// GET /api/v1/admin/users/:id
// -------------------------
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await Users.findById(id).select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      user,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// PATCH /api/v1/admin/users/:id
// -------------------------
exports.updateUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedUser = await Users.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// DELETE /api/v1/admin/users/:id
// -------------------------
exports.deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await Users.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "User deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// -------------------------
// GET /api/v1/admin/businesses/:id
// -------------------------
exports.getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const business = await Business.findById(id).select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
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
// PUT /api/v1/admin/businesses/:id
// -------------------------
exports.updateBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedBusiness = await Business.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedBusiness) {
      return res.status(404).json({
        status: "fail",
        message: "Business not found",
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
// DELETE /api/v1/admin/businesses/:id
// -------------------------
exports.deleteBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBusiness = await Business.findByIdAndDelete(id);

    if (!deletedBusiness) {
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

