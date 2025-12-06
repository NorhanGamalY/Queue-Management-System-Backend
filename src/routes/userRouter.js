const express = require("express");
const userController = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const router = express.Router();

// Upload profile photo
router.post(
  "/upload-profile-photo",
  protect,
  upload.single("profileImage"),
  userController.uploadProfilePhoto
);

router.get("/me", protect, userController.getUserInfo);
router.put("/me", protect, userController.updateUserInfo);
router.delete("/me", protect, userController.deleteUser);

module.exports = router;
