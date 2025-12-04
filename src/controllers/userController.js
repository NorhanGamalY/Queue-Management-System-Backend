const User = require("../models/userSchema");
const UserDto = require("../dtos/user.dto");
const formatResponse = require("../utils/response");

// ==================== Get Current User ====================
const getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("businessIds");
    if (!user)
      return res
        .status(404)
        .json(formatResponse(null, "User not found", "fail"));

    const dto = new UserDto(user);
    res.status(200).json(formatResponse(dto));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};

// ==================== Update User ====================
const updateUserInfo = async (req, res) => {
  try {
    const allowedFields = ["name", "email", "phone", "profileImage", "type"];
    const updateFields = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateFields[field] = req.body[field];
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true },
    ).populate("businessIds");
    if (!updatedUser)
      return res
        .status(404)
        .json(formatResponse(null, "User not found", "fail"));

    const dto = new UserDto(updatedUser);
    res.status(200).json(formatResponse(dto, "User updated successfully"));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};

// ==================== Delete User ====================
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user)
      return res
        .status(404)
        .json(formatResponse(null, "User not found", "fail"));

    res
      .status(200)
      .json(formatResponse(null, "Your profile has been deleted ✅"));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};

module.exports = {
  getUserInfo,
  updateUserInfo,
  deleteUser,
};
