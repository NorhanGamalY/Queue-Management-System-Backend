// dtos/queue.dto.js
class QueueDto {
  constructor(queue) {
    this.id = queue._id;

    // IDs only
    this.businessId = queue.businessId;
    this.userId = queue.userId;

    this.queueNumber = queue.queueNumber;
    this.status = queue.status; // waiting/serving/done/cancelled

    this.eta = queue.eta;
    this.position = queue.position;

    this.createdAt = queue.createdAt;
    this.updatedAt = queue.updatedAt;
  }
}

module.exports = QueueDto;
