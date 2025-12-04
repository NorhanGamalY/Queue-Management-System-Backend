// dtos/notification.dto.js
class NotificationDto {
  constructor(notification) {
    this.id = notification._id;

    this.userId = notification.userId;
    this.businessId = notification.businessId;

    this.message = notification.message;
    this.type = notification.type; // optional

    this.read = notification.read;
    this.createdAt = notification.createdAt;
  }
}

module.exports = NotificationDto;
