const express = require("express");
const userController = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/me", protect, userController.getUserInfo);
router.put("/me", protect, userController.updateUserInfo);
router.delete("/me", protect, userController.deleteUser);

module.exports = router;
