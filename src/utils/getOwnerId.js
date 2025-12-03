module.exports = function getOwnerId(req) {
  if (req.user) return { key: "userId", value: req.user._id };
  if (req.business)
    return { key: "businessId", value: req.business.businessId };
  if (req.queue) return { key: "queueId", value: req.queue.queueId };
  if (req.ticket) return { key: "ticketId", value: req.ticket.ticketId };
  if (req.payment) return { key: "paymentId", value: req.payment.paymentId };

  return null;
};
