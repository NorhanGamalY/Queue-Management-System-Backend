/**
 * AI-based ETA Prediction Module
 * Documentation: Optional: AI-based ETA predictions
 * 
 * This module calculates estimated wait times using:
 * 1. Historical data analysis
 * 2. Current queue length
 * 3. Time-of-day patterns
 * 4. Day-of-week patterns
 * 5. Service type duration
 */

const Ticket = require("../models/ticketSchema");
const Queue = require("../models/queueSchema");
const mongoose = require("mongoose");

/**
 * Calculate ETA for a new ticket
 * @param {String} businessId - Business ID
 * @param {String} queueId - Queue ID
 * @param {String} serviceType - Type of service
 * @returns {Object} - ETA prediction with confidence
 */
exports.calculateETA = async (businessId, queueId, serviceType = "examination") => {
  try {
    // Get queue info
    const queue = await Queue.findById(queueId);
    if (!queue) {
      return { estimatedMinutes: 15, confidence: "low", method: "default" };
    }

    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Get historical data for this business (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate historical service times
    const historicalData = await Ticket.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: "done",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $addFields: {
          hour: { $hour: "$createdAt" },
          dayOfWeek: { $dayOfWeek: "$createdAt" },
        },
      },
      {
        $group: {
          _id: null,
          overallAvg: { $avg: "$estimatedTime" },
          count: { $sum: 1 },
          hourlyData: {
            $push: {
              hour: "$hour",
              estimatedTime: "$estimatedTime",
            },
          },
        },
      },
    ]);

    // Get current hour average
    const hourlyAnalysis = await Ticket.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: "done",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $addFields: {
          hour: { $hour: "$createdAt" },
        },
      },
      {
        $match: {
          hour: { $gte: currentHour - 1, $lte: currentHour + 1 },
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

    // Calculate base service time
    let baseServiceTime = 15; // Default
    let confidence = "low";
    let method = "default";

    if (historicalData.length > 0 && historicalData[0].count >= 10) {
      baseServiceTime = historicalData[0].overallAvg;
      confidence = "medium";
      method = "historical_average";

      // Use hourly data if available (more accurate)
      if (hourlyAnalysis.length > 0 && hourlyAnalysis[0].count >= 5) {
        baseServiceTime = hourlyAnalysis[0].avgTime;
        confidence = "high";
        method = "hourly_pattern";
      }
    }

    // Service type multipliers
    const serviceMultipliers = {
      examination: 1.0,
      consultation: 1.5,
      procedure: 2.0,
      followup: 0.7,
    };

    const multiplier = serviceMultipliers[serviceType] || 1.0;

    // Peak hour adjustments
    const peakHours = [9, 10, 11, 14, 15, 16]; // Typical peak hours
    const isPeakHour = peakHours.includes(currentHour);
    const peakMultiplier = isPeakHour ? 1.2 : 1.0;

    // Weekend adjustment
    const isWeekend = currentDay === 0 || currentDay === 6;
    const weekendMultiplier = isWeekend ? 0.8 : 1.0; // Usually less busy

    // Calculate final ETA
    const adjustedServiceTime = baseServiceTime * multiplier * peakMultiplier * weekendMultiplier;
    const waitingCount = queue.currentCount || 0;
    const estimatedMinutes = Math.round(waitingCount * adjustedServiceTime);

    // Calculate expected time
    const expectedTime = new Date();
    expectedTime.setMinutes(expectedTime.getMinutes() + estimatedMinutes);

    return {
      estimatedMinutes,
      expectedTime,
      confidence,
      method,
      factors: {
        baseServiceTime: Math.round(baseServiceTime),
        serviceType,
        serviceMultiplier: multiplier,
        isPeakHour,
        peakMultiplier,
        isWeekend,
        weekendMultiplier,
        waitingCount,
      },
    };
  } catch (error) {
    console.error("ETA calculation error:", error);
    // Return default on error
    return {
      estimatedMinutes: 15,
      confidence: "low",
      method: "default_fallback",
      error: error.message,
    };
  }
};

/**
 * Update ETA for all waiting tickets in a queue
 * @param {String} queueId - Queue ID
 */
exports.updateQueueETAs = async (queueId) => {
  try {
    const queue = await Queue.findById(queueId).populate("businessId");
    if (!queue) return;

    const waitingTickets = await Ticket.find({
      queueId,
      status: "waiting",
    }).sort({ ticketNumber: 1 });

    // Calculate ETA for first ticket
    const baseETA = await exports.calculateETA(
      queue.businessId._id || queue.businessId,
      queueId
    );

    // Update each ticket with cumulative ETA
    for (let i = 0; i < waitingTickets.length; i++) {
      const ticket = waitingTickets[i];
      const positionETA = Math.round(
        (i + 1) * (baseETA.estimatedMinutes / (queue.currentCount || 1))
      );

      await Ticket.findByIdAndUpdate(ticket._id, {
        estimatedTime: positionETA,
      });
    }

    return waitingTickets.length;
  } catch (error) {
    console.error("Update queue ETAs error:", error);
  }
};

/**
 * Get estimated wait time for a specific position in queue
 * @param {String} queueId - Queue ID
 * @param {Number} position - Position in queue
 */
exports.getPositionETA = async (queueId, position) => {
  try {
    const queue = await Queue.findById(queueId);
    if (!queue) return null;

    const baseETA = await exports.calculateETA(queue.businessId, queueId);
    const estimatedMinutes = Math.round(position * (baseETA.estimatedMinutes / Math.max(queue.currentCount, 1)));

    const expectedTime = new Date();
    expectedTime.setMinutes(expectedTime.getMinutes() + estimatedMinutes);

    return {
      position,
      estimatedMinutes,
      expectedTime,
      confidence: baseETA.confidence,
    };
  } catch (error) {
    console.error("Get position ETA error:", error);
    return null;
  }
};
