const User = require("../models/userSchema");

// DTO to return only safe fields
class UserDto {
  constructor(user) {
    this.id = user._id;
    this.name = user.name;
    this.email = user.email;
    this.phone = user.phone;
    this.profileImage = user.profileImage;
    this.type = user.type;
    this.businessIds = user.businessIds || [];
  }
}

// ==================== Get Current User ====================
const getUserInfo = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user._id).populate("businessIds");
    if (!user) {
      return res.status(404).json({ message: "User Not Found..! ❌" });
    }

    res.status(200).json(new UserDto(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
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
      {
        new: true,
      },
    ).populate("businessIds");

    if (!updatedUser) {
      return res.status(404).json({ message: "User Not Found..! ❌" });
    }

    res.status(200).json(new UserDto(updatedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
  }
};

// ==================== Delete User ====================
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User Not Found..! ❌" });
    }

    res.status(200).json({ message: "Your profile has been deleted ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
  }
};

// ==================== Upload Profile Photo ====================
const uploadProfilePhoto = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        status: "fail",
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;
    const profileImageUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user with new profile image
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage: profileImageUrl },
      { new: true }
    ).select("-password").populate("businessIds");

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Profile photo uploaded successfully",
      data: {
        profileImage: profileImageUrl,
        user: new UserDto(user),
      },
    });
  } catch (err) {
    console.error("Upload profile photo error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

module.exports = {
  getUserInfo,
  updateUserInfo,
  deleteUser,
  uploadProfilePhoto,
};
