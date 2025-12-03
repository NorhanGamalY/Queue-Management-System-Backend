/**
 * Stats Controller
 * Documentation: GET /api/stats/clinic/:id
 * Provides analytics for business/clinic dashboard
 */

const Ticket = require("../models/ticketSchema");
const Queue = require("../models/queueSchema");
const Payment = require("../models/paymentSchema");
const Review = require("../models/reviewSchema");
const Business = require("../models/businessSchema");
const User = require("../models/userSchema");
const mongoose = require("mongoose");

// -------------------------
// GET /api/v1/stats/business/:id
// Get business/clinic statistics
// -------------------------
exports.getBusinessStats = async (req, res) => {
  try {
    const { id: businessId } = req.params;
    const { from, to, period } = req.query;

    // Validate business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    // Date range filter
    let dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter.createdAt = { $gte: thirtyDaysAgo };
    }

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Parallel queries for better performance
    const [
      totalTickets,
      todayTickets,
      ticketsByStatus,
      averageWaitTime,
      totalRevenue,
      todayRevenue,
      reviewStats,
      queueStats,
      ticketTrend,
      peakHours,
    ] = await Promise.all([
      // Total tickets
      Ticket.countDocuments({ businessId, ...dateFilter }),

      // Today's tickets
      Ticket.countDocuments({
        businessId,
        createdAt: { $gte: today, $lt: tomorrow },
      }),

      // Tickets by status
      Ticket.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId), ...dateFilter } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Average wait time (estimated time for completed tickets)
      Ticket.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            status: "done",
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: null,
            avgWaitTime: { $avg: "$estimatedTime" },
          },
        },
      ]),

      // Total revenue
      Payment.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            status: { $in: ["completed", "succeeded"] },
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),

      // Today's revenue
      Payment.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            status: { $in: ["completed", "succeeded"] },
            createdAt: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),

      // Review stats
      Review.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),

      // Queue stats
      Queue.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
        {
          $group: {
            _id: null,
            totalQueues: { $sum: 1 },
            avgCapacity: { $avg: "$maxCapacity" },
            avgCurrentCount: { $avg: "$currentCount" },
          },
        },
      ]),

      // Ticket trend (daily for last 7 days)
      Ticket.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            createdAt: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Peak hours analysis
      Ticket.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: { $hour: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Format status breakdown
    const statusBreakdown = {};
    ticketsByStatus.forEach((s) => {
      statusBreakdown[s._id] = s.count;
    });

    res.status(200).json({
      success: true,
      data: {
        businessId,
        businessName: business.name,
        period: {
          from: dateFilter.createdAt?.$gte || "all time",
          to: dateFilter.createdAt?.$lte || "now",
        },
        overview: {
          totalTickets,
          todayTickets,
          completedTickets: statusBreakdown.done || 0,
          cancelledTickets: statusBreakdown.cancelled || 0,
          noShowTickets: statusBreakdown.missed || 0,
          waitingTickets: statusBreakdown.waiting || 0,
        },
        performance: {
          averageWaitTime: averageWaitTime[0]?.avgWaitTime || 0,
          completionRate: totalTickets > 0 
            ? ((statusBreakdown.done || 0) / totalTickets * 100).toFixed(2) 
            : 0,
          noShowRate: totalTickets > 0 
            ? ((statusBreakdown.missed || 0) / totalTickets * 100).toFixed(2) 
            : 0,
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          totalTransactions: totalRevenue[0]?.count || 0,
          today: todayRevenue[0]?.total || 0,
          todayTransactions: todayRevenue[0]?.count || 0,
        },
        reviews: {
          averageRating: reviewStats[0]?.avgRating?.toFixed(1) || 0,
          totalReviews: reviewStats[0]?.totalReviews || 0,
        },
        queue: {
          totalQueues: queueStats[0]?.totalQueues || 0,
          averageCapacity: queueStats[0]?.avgCapacity || 0,
          averageCurrentCount: queueStats[0]?.avgCurrentCount || 0,
        },
        trends: {
          daily: ticketTrend,
          peakHours: peakHours.map((p) => ({
            hour: p._id,
            count: p.count,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Get business stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving statistics",
      error: error.message,
    });
  }
};

// -------------------------
// GET /api/v1/stats/admin/overview
// Admin overview statistics
// -------------------------
exports.getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalBusinesses,
      totalTickets,
      totalRevenue,
      usersByRole,
      recentSignups,
    ] = await Promise.all([
      User.countDocuments(),
      Business.countDocuments(),
      Ticket.countDocuments(),
      Payment.aggregate([
        { $match: { status: { $in: ["completed", "succeeded"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      User.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("name email type createdAt"),
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalBusinesses,
          totalTickets,
          totalRevenue: totalRevenue[0]?.total || 0,
        },
        usersByRole: usersByRole.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        recentSignups,
      },
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving admin statistics",
    });
  }
};

// -------------------------
// GET /api/v1/stats/queue/:queueId/live
// Live queue statistics
// -------------------------
exports.getLiveQueueStats = async (req, res) => {
  try {
    const { queueId } = req.params;

    const queue = await Queue.findById(queueId);
    if (!queue) {
      return res.status(404).json({
        success: false,
        message: "Queue not found",
      });
    }

    // Get current waiting tickets
    const waitingTickets = await Ticket.find({
      queueId,
      status: "waiting",
    })
      .sort({ ticketNumber: 1 })
      .select("ticketNumber userId estimatedTime createdAt");

    // Calculate average wait time from recent completed tickets
    const recentCompleted = await Ticket.aggregate([
      {
        $match: {
          queueId: new mongoose.Types.ObjectId(queueId),
          status: "done",
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$estimatedTime" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgServiceTime = recentCompleted[0]?.avgTime || 15; // Default 15 mins

    res.status(200).json({
      success: true,
      data: {
        queueId,
        status: queue.status,
        currentTicketNumber: queue.currentTicketNumber,
        currentCount: queue.currentCount,
        maxCapacity: queue.maxCapacity,
        availableSlots: queue.maxCapacity - queue.currentCount,
        waitingTickets: waitingTickets.length,
        estimatedWaitTime: waitingTickets.length * avgServiceTime,
        avgServiceTime,
        ticketList: waitingTickets,
      },
    });
  } catch (error) {
    console.error("Get live queue stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving live queue statistics",
    });
  }
};
