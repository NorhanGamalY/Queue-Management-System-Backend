const Notification = require("../models/notificationSchema");
const getOwnerId = require("../utils/getOwnerId");

// --------------------------------------------
// GET ALL NOTIFICATIONS for ANY OWNER
// --------------------------------------------
exports.getNotifications = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner) return res.status(400).json({ message: "Owner not detected" });

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

    res.status(200).json({
      status: "success",
      results: notifications.length,
      total,
      notifications,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
  }
};

// --------------------------------------------
// DELETE ONE NOTIFICATION (any owner)
// --------------------------------------------
exports.deleteNotification = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner) return res.status(400).json({ message: "Owner not detected" });

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      [owner.key]: owner.value,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res
      .status(200)
      .json({ status: "success", message: "Notification deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
  }
};

// --------------------------------------------
// DELETE ALL NOTIFICATIONS (any owner)
// --------------------------------------------
exports.deleteAllNotifications = async (req, res) => {
  try {
    const owner = getOwnerId(req);
    if (!owner) return res.status(400).json({ message: "Owner not detected" });

    await Notification.deleteMany({ [owner.key]: owner.value });

    res.status(200).json({
      status: "success",
      message: "All notifications deleted",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error ❌" });
  }
};
