// dtos/ticket.dto.js
class TicketDto {
  constructor(ticket) {
    this.id = ticket._id;

    // Expose only IDs to avoid populate leaks
    this.userId = ticket.userId;
    this.businessId = ticket.businessId;
    this.queueId = ticket.queueId;

    this.ticketNumber = ticket.ticketNumber;
    this.status = ticket.status; // waiting, called, missed, done, cancelled

    this.eta = ticket.eta;
    this.issuedAt = ticket.issuedAt;

    this.createdAt = ticket.createdAt;
    this.updatedAt = ticket.updatedAt;
  }
}

module.exports = TicketDto;
