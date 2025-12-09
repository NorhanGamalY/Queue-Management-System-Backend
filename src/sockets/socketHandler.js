/**
 * Socket.IO Handler for Real-time Queue Updates
 * 
 * Events documented in project documentation:
 * Client → joinClinic (join room by clinicId/businessId)
 * Server → ticketCreated
 * Server → ticketUpdated
 * Client → callNext (staff action)
 */

const socketHandler = (io) => {
  // Store connected users
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // =========================================
    // JOIN BUSINESS/CLINIC ROOM
    // Client → joinClinic (join room by businessId)
    // =========================================
    socket.on("joinBusiness", (data) => {
      // Handle case where data might be undefined or just a string
      if (!data) {
        socket.emit("error", { message: "Invalid data format" });
        return;
      }

      // If data is a string, treat it as businessId
      let businessId = typeof data === 'string' ? data : data.businessId;
      const userId = typeof data === 'object' ? data.userId : null;
      const role = typeof data === 'object' ? data.role : null;
      
      if (!businessId) {
        socket.emit("error", { message: "businessId is required" });
        return;
      }

      // Ensure businessId is a string
      businessId = businessId.toString();
      const room = `business_${businessId}`;
      
      // Join the business room
      socket.join(room);
      
      // Track connected user
      connectedUsers.set(socket.id, {
        businessId,
        userId,
        role,
        joinedAt: new Date(),
      });

      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      console.log(`👤 User ${userId || socket.id} joined business room: ${room} (Room size: ${roomSize})`);

      // Notify room about new connection
      socket.to(room).emit("userJoined", {
        userId,
        role,
        timestamp: new Date(),
      });

      // Confirm join to client
      socket.emit("joinedBusiness", {
        success: true,
        businessId,
        room,
        roomSize,
        message: `Successfully joined business ${businessId}`,
      });
    });

    // Alias for documentation compatibility
    socket.on("joinClinic", (data) => {
      socket.emit("joinBusiness", { ...data, businessId: data.clinicId || data.businessId });
    });

    // =========================================
    // LEAVE BUSINESS ROOM
    // =========================================
    socket.on("leaveBusiness", (data) => {
      const { businessId } = data;
      
      socket.leave(`business_${businessId}`);
      connectedUsers.delete(socket.id);

      console.log(`👋 Client ${socket.id} left business: ${businessId}`);
    });

    // =========================================
    // CALL NEXT TICKET (Staff Action)
    // Client → callNext
    // =========================================
    socket.on("callNext", async (data) => {
      const { businessId, queueId, staffId } = data;

      if (!businessId) {
        socket.emit("error", { message: "businessId is required" });
        return;
      }

      // Emit to the business room that next ticket is being called
      io.to(`business_${businessId}`).emit("ticketCalling", {
        queueId,
        staffId,
        timestamp: new Date(),
      });

      console.log(`📢 Staff ${staffId} calling next ticket for business ${businessId}`);
    });

    // =========================================
    // CALL SPECIFIC TICKET
    // Client → callTicket
    // =========================================
    socket.on("callTicket", async (data) => {
      try {
        const { ticketId, businessId } = data;

        if (!ticketId || !businessId) {
          socket.emit("error", { message: "ticketId and businessId are required" });
          return;
        }

        // Import ticket controller
        const Ticket = require("../models/ticketSchema");
        
        const ticket = await Ticket.findById(ticketId).populate("userId");
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        if (ticket.status !== "waiting") {
          socket.emit("error", { message: "Only waiting tickets can be called" });
          return;
        }

        ticket.status = "called";
        ticket.calledAt = new Date();
        await ticket.save();

        // Emit to business room
        io.to(`business_${businessId}`).emit("ticketCalled", {
          ticket,
          timestamp: new Date(),
        });

        // Emit to user if connected
        if (ticket.userId?._id) {
          io.to(`user_${ticket.userId._id}`).emit("yourTicketCalled", {
            ticket,
            message: "Your ticket has been called! Please proceed to the counter.",
            timestamp: new Date(),
          });
        }

        socket.emit("ticketActionSuccess", {
          action: "called",
          ticket,
          message: "Ticket called successfully",
        });

        console.log(`📢 Ticket ${ticketId} called for business ${businessId}`);
      } catch (error) {
        console.error("callTicket error:", error);
        socket.emit("error", { message: "Failed to call ticket", error: error.message });
      }
    });

    // =========================================
    // SKIP TICKET (Mark as No-Show)
    // Client → skipTicket
    // =========================================
    socket.on("skipTicket", async (data) => {
      try {
        const { ticketId, businessId } = data;

        if (!ticketId || !businessId) {
          socket.emit("error", { message: "ticketId and businessId are required" });
          return;
        }

        const Ticket = require("../models/ticketSchema");
        const Queue = require("../models/queueSchema");

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        if (ticket.status !== "waiting") {
          socket.emit("error", { message: "Only waiting tickets can be skipped" });
          return;
        }

        ticket.status = "missed";
        await ticket.save();

        // Update queue count
        if (ticket.queueId) {
          await Queue.findByIdAndUpdate(ticket.queueId, {
            $inc: { currentCount: -1 },
          });
        }

        // Emit to business room
        io.to(`business_${businessId}`).emit("ticketSkipped", {
          ticket,
          timestamp: new Date(),
        });

        socket.emit("ticketActionSuccess", {
          action: "skipped",
          ticket,
          message: "Ticket marked as no-show",
        });

        console.log(`⏭️ Ticket ${ticketId} skipped for business ${businessId}`);
      } catch (error) {
        console.error("skipTicket error:", error);
        socket.emit("error", { message: "Failed to skip ticket", error: error.message });
      }
    });

    // =========================================
    // CANCEL TICKET
    // Client → cancelTicket
    // =========================================
    socket.on("cancelTicket", async (data) => {
      try {
        const { ticketId, businessId, reason } = data;

        if (!ticketId || !businessId) {
          socket.emit("error", { message: "ticketId and businessId are required" });
          return;
        }

        const Ticket = require("../models/ticketSchema");
        const Queue = require("../models/queueSchema");

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        if (["done", "cancelled", "missed"].includes(ticket.status)) {
          socket.emit("error", { message: `Cannot cancel a ${ticket.status} ticket` });
          return;
        }

        const wasWaiting = ticket.status === "waiting";

        ticket.status = "cancelled";
        ticket.cancelReason = reason || null;
        await ticket.save();

        // Update queue count if was waiting
        if (wasWaiting && ticket.queueId) {
          await Queue.findByIdAndUpdate(ticket.queueId, {
            $inc: { currentCount: -1 },
          });
        }

        // Emit to business room
        io.to(`business_${businessId}`).emit("ticketCancelled", {
          ticket,
          timestamp: new Date(),
        });

        socket.emit("ticketActionSuccess", {
          action: "cancelled",
          ticket,
          message: "Ticket cancelled successfully",
        });

        console.log(`✕ Ticket ${ticketId} cancelled for business ${businessId}`);
      } catch (error) {
        console.error("cancelTicket error:", error);
        socket.emit("error", { message: "Failed to cancel ticket", error: error.message });
      }
    });

    // =========================================
    // COMPLETE TICKET
    // Client → completeTicket
    // =========================================
    socket.on("completeTicket", async (data) => {
      try {
        const { ticketId, businessId } = data;

        if (!ticketId || !businessId) {
          socket.emit("error", { message: "ticketId and businessId are required" });
          return;
        }

        const Ticket = require("../models/ticketSchema");

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          socket.emit("error", { message: "Ticket not found" });
          return;
        }

        if (ticket.status === "done") {
          socket.emit("error", { message: "Ticket already completed" });
          return;
        }

        ticket.status = "done";
        ticket.completedAt = new Date();
        await ticket.save();

        // Emit to business room
        io.to(`business_${businessId}`).emit("ticketCompleted", {
          ticket,
          timestamp: new Date(),
        });

        socket.emit("ticketActionSuccess", {
          action: "completed",
          ticket,
          message: "Ticket completed successfully",
        });

        console.log(`✓ Ticket ${ticketId} completed for business ${businessId}`);
      } catch (error) {
        console.error("completeTicket error:", error);
        socket.emit("error", { message: "Failed to complete ticket", error: error.message });
      }
    });


    // =========================================
    // JOIN USER'S PERSONAL ROOM (for notifications)
    // =========================================
    socket.on("joinUserRoom", (data) => {
      // Handle case where data might be a string (userId) or an object
      const userId = typeof data === 'string' ? data : (data?.userId || data);
      
      if (!userId) {
        socket.emit("error", { message: "userId is required" });
        return;
      }

      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined personal notification room`);
    });

    // =========================================
    // REQUEST QUEUE STATUS
    // =========================================
    socket.on("getQueueStatus", (data) => {
      const { businessId, queueId } = data;
      
      // This would typically fetch from database
      // For now, emit request to be handled by server
      socket.emit("queueStatusRequested", { businessId, queueId });
    });

    // =========================================
    // DISCONNECT
    // =========================================
    socket.on("disconnect", () => {
      const userData = connectedUsers.get(socket.id);
      
      if (userData) {
        console.log(`❌ User ${userData.userId || socket.id} disconnected from business ${userData.businessId}`);
        
        // Notify business room
        socket.to(`business_${userData.businessId}`).emit("userLeft", {
          userId: userData.userId,
          timestamp: new Date(),
        });
      }

      connectedUsers.delete(socket.id);
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });

    // =========================================
    // PING/PONG for connection health
    // =========================================
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date() });
    });
  });

  // =========================================
  // HELPER FUNCTIONS TO EMIT FROM CONTROLLERS
  // =========================================
  
  return {
    // Server → ticketCreated
    emitTicketCreated: (businessId, ticket) => {
      const businessIdStr = businessId.toString();
      const room = `business_${businessIdStr}`;
      
      io.to(room).emit("ticketCreated", {
        ticket,
        timestamp: new Date(),
      });
      
      console.log(`📤 Emitted ticketCreated to room ${room}`, {
        businessId: businessIdStr,
        ticketId: ticket?._id,
        ticketNumber: ticket?.ticketNumber,
        roomSize: io.sockets.adapter.rooms.get(room)?.size || 0
      });
    },

    // Server → ticketUpdated
    emitTicketUpdated: (businessId, ticket) => {
      io.to(`business_${businessId}`).emit("ticketUpdated", {
        ticket,
        timestamp: new Date(),
      });
      console.log(`📤 Emitted ticketUpdated to business ${businessId}`);
    },

    // Emit ticket called (when staff calls next)
    emitTicketCalled: (businessId, ticket, userId) => {
      // Emit to business room
      io.to(`business_${businessId}`).emit("ticketCalled", {
        ticket,
        timestamp: new Date(),
      });

      // Also emit directly to user if they're connected
      if (userId) {
        io.to(`user_${userId}`).emit("yourTicketCalled", {
          ticket,
          message: "Your ticket has been called! Please proceed to the counter.",
          timestamp: new Date(),
        });
      }
      console.log(`📤 Emitted ticketCalled to business ${businessId}`);
    },

    // Emit ticket skipped
    emitTicketSkipped: (businessId, ticket) => {
      io.to(`business_${businessId}`).emit("ticketSkipped", {
        ticket,
        timestamp: new Date(),
      });
      console.log(`📤 Emitted ticketSkipped to business ${businessId}`);
    },

    // Emit ticket cancelled
    emitTicketCancelled: (businessId, ticket) => {
      io.to(`business_${businessId}`).emit("ticketCancelled", {
        ticket,
        timestamp: new Date(),
      });
      console.log(`📤 Emitted ticketCancelled to business ${businessId}`);
    },

    // Emit ticket completed
    emitTicketCompleted: (businessId, ticket) => {
      io.to(`business_${businessId}`).emit("ticketCompleted", {
        ticket,
        timestamp: new Date(),
      });
      console.log(`📤 Emitted ticketCompleted to business ${businessId}`);
    },

    // Emit queue status update
    emitQueueUpdate: (businessId, queueData) => {
      const businessIdStr = businessId.toString();
      const room = `business_${businessIdStr}`;
      
      io.to(room).emit("queueUpdated", {
        businessId: businessIdStr,
        queue: queueData,
        timestamp: new Date(),
      });
      
      console.log(`📤 Emitted queueUpdated to room ${room}`, {
        businessId: businessIdStr,
        queueData,
        roomSize: io.sockets.adapter.rooms.get(room)?.size || 0
      });
    },

    // Emit notification to specific user
    emitToUser: (userId, event, data) => {
      io.to(`user_${userId}`).emit(event, {
        ...data,
        timestamp: new Date(),
      });
      console.log(`📤 Emitted ${event} to user ${userId}`);
    },

    // Get connected users count for a business
    getBusinessConnectionsCount: (businessId) => {
      const room = io.sockets.adapter.rooms.get(`business_${businessId}`);
      return room ? room.size : 0;
    },

    // Get all connected users
    getConnectedUsers: () => connectedUsers,
  };
};

module.exports = socketHandler;
