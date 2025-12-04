const Notification = require("../models/notificationSchema");
const NotificationDto = require("../dtos/notification.dto");
const formatResponse = require("../utils/response");
const getOwnerId = require("../utils/getOwnerId");

// =========================== GET NOTIFICATIONS ===========================
exports.getNotifications = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner)
      return res
        .status(400)
        .json(formatResponse(null, "Owner not detected", "fail"));

    const { isRead, type, page = 1, limit = 10 } = req.query;
    const query = { [owner.key]: owner.value };
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (type) query.type = type;

    const skip = (page - 1) * limit;
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Notification.countDocuments(query);

    const dtoList = notifications.map((n) => new NotificationDto(n));
    res
      .status(200)
      .json(
        formatResponse(
          dtoList,
          "Notifications retrieved successfully",
          "success",
          { total, page: Number(page), limit: Number(limit) },
        ),
      );
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};

// =========================== SEND NOTIFICATION ===========================
/**
 * ADMIN or BUSINESS can send notification to:
 * - a USER
 * - or a BUSINESS
 *
 * Body required:
 * {
 *   "recipientId": "...",
 *   "recipientType": "user" | "business",
 *   "message": "text",
 *   "type": "payment" | "ticket" | "queue" | "system"
 * }
 */
exports.sendToUser = async (req, res) => {
  try {
    const { recipientId, recipientType, message, type } = req.body;

    // --------------------------- VALIDATION ---------------------------
    if (!recipientId || !recipientType || !message) {
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "recipientId, recipientType, and message are required",
            "fail",
          ),
        );
    }

    if (!["user", "business"].includes(recipientType)) {
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "recipientType must be 'user' or 'business'",
            "fail",
          ),
        );
    }

    const allowedTypes = ["payment", "ticket", "queue", "system"];
    if (type && !allowedTypes.includes(type)) {
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            `type must be one of ${allowedTypes.join(", ")}`,
            "fail",
          ),
        );
    }

    // --------------------------- BUILD NOTIFICATION ---------------------------
    const data = {
      message,
      isRead: false,
      type: type || "system",
    };

    if (recipientType === "user") {
      data.userId = recipientId;
    } else {
      data.businessId = recipientId;
    }

    // --------------------------- SAVE NOTIFICATION ---------------------------
    const notification = await Notification.create(data);

    const dto = new NotificationDto(notification);

    // --------------------------- SOCKET EMIT ---------------------------
    // Optional: if you have socket.io instance
    // const io = req.app.get("socket");
    // io.to(recipientId.toString()).emit("newNotification", dto);

    // --------------------------- RESPONSE ---------------------------
    res
      .status(201)
      .json(formatResponse(dto, "Notification sent successfully", "success"));
  } catch (error) {
    console.error("Send Notification Error:", error);
    res
      .status(500)
      .json(formatResponse(null, "Internal Server Error ❌", "error"));
  }
};

// =========================== DELETE ONE NOTIFICATION ===========================
exports.deleteNotification = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner)
      return res
        .status(400)
        .json(formatResponse(null, "Owner not detected", "fail"));

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      [owner.key]: owner.value,
    });
    if (!deleted)
      return res
        .status(404)
        .json(formatResponse(null, "Notification not found", "fail"));

    res
      .status(200)
      .json(formatResponse(null, "Notification deleted successfully"));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};

// =========================== DELETE ALL NOTIFICATIONS ===========================
exports.deleteAllNotifications = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner)
      return res
        .status(400)
        .json(formatResponse(null, "Owner not detected", "fail"));

    await Notification.deleteMany({ [owner.key]: owner.value });
    res
      .status(200)
      .json(formatResponse(null, "All notifications deleted successfully"));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Internal Server Error ❌" });
  }
};
