import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import basicAuth from "express-basic-auth";

const adminRouter = express.Router();

const auth = basicAuth({
  users: { admin: process.env.ADMIN_PASSWORD },
  challenge: true,
});

adminRouter.use((req, res, next) => {
  if (req.path === "/" && req.method === "GET") {
    next();
  } else {
    auth(req, res, next);
  }
});

// Room management endpoints
adminRouter.get("/rooms", async (req, res) => {
  const mongoClient = req.app.locals.mongoClient;
  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const collection = mongoClient.db("chatdb").collection("rooms");

  try {
    const rooms = await collection.find().toArray();
    res.status(200).json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

adminRouter.post("/rooms", async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Room name is required" });
  }

  const mongoClient = req.app.locals.mongoClient;
  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const collection = mongoClient.db("chatdb").collection("rooms");

  try {
    const result = await collection.insertOne({
      name: name.trim(),
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      roomId: result.insertedId,
      message: "Room created successfully",
    });
  } catch (error) {
    console.error("Error creating room:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "A room with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create room" });
  }
});

adminRouter.delete("/rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  console.log("Attempting to delete room with ID:", roomId);

  const mongoClient = req.app.locals.mongoClient;
  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const roomsCollection = mongoClient.db("chatdb").collection("rooms");
  const messagesCollection = mongoClient.db("chatdb").collection("messages");

  try {
    // Check if room exists
    const roomToDelete = await roomsCollection.findOne({
      _id: new ObjectId(roomId),
    });

    if (!roomToDelete) {
      console.log("Room not found in database");
      return res.status(404).json({ error: "Room not found" });
    }

    const roomResult = await roomsCollection.deleteOne({
      _id: new ObjectId(roomId),
    });

    // Also delete all messages from this room
    const messagesResult = await messagesCollection.deleteMany({
      roomId: roomId,
    });

    console.log("Delete operation results:", {
      room: roomResult,
      messages: messagesResult,
    });

    if (roomResult.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: "Room not found or already deleted" });
    }

    // Notify all clients about the room deletion
    req.app.locals.io.emit("room deleted", roomId);
    console.log("Room delete notification emitted to all clients");

    res.status(200).json({
      message: "Room deleted successfully",
      deletedMessagesCount: messagesResult.deletedCount,
    });
  } catch (error) {
    console.error("Detailed error in delete room operation:", error);
    res.status(500).json({
      error: "Failed to delete room",
      details: error.message,
    });
  }
});

// Message management endpoints
adminRouter.delete("/messages/:messageId", async (req, res) => {
  const { messageId } = req.params;
  console.log("Attempting to delete message with ID:", messageId);

  const mongoClient = req.app.locals.mongoClient;
  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const collection = mongoClient.db("chatdb").collection("messages");

  try {
    // Log the message before deletion
    const messageToDelete = await collection.findOne({
      _id: new ObjectId(messageId),
    });
    console.log("Found message to delete:", messageToDelete);

    if (!messageToDelete) {
      console.log("Message not found in database");
      return res.status(404).json({ error: "Message not found" });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(messageId) });
    console.log("Delete operation result:", result);

    if (result.deletedCount === 0) {
      console.log("Delete operation reported no deleted documents");
      return res
        .status(404)
        .json({ error: "Message not found or already deleted" });
    }

    // If message belongs to a room, notify that room specifically
    if (messageToDelete.roomId) {
      req.app.locals.io
        .to(messageToDelete.roomId)
        .emit("message deleted", messageId);
      console.log(
        `Delete notification emitted to room ${messageToDelete.roomId}`
      );
    } else {
      // Fallback to global notification
      req.app.locals.io.emit("message deleted", messageId);
      console.log("Delete notification emitted to all clients");
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Detailed error in delete operation:", error);
    res.status(500).json({
      error: "Failed to delete message",
      details: error.message,
    });
  }
});

adminRouter.delete("/messages", async (req, res) => {
  const { roomId } = req.query; // Optional room filter
  const mongoClient = req.app.locals.mongoClient;

  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const collection = mongoClient.db("chatdb").collection("messages");
  let query = {};

  // If roomId provided, only clear messages from that room
  if (roomId) {
    query = { roomId: roomId };
  }

  try {
    const result = await collection.deleteMany(query);
    console.log("Clear messages result:", result);

    if (roomId) {
      // Notify specific room about cleared messages
      req.app.locals.io.to(roomId).emit("messages cleared", { roomId: roomId });
      console.log(`Clear messages notification emitted to room ${roomId}`);
    } else {
      // Notify all clients about global clear
      req.app.locals.io.emit("messages cleared");
      console.log("Clear all notification emitted to all clients");
    }

    res.status(200).json({
      message: roomId
        ? `All messages in room ${roomId} deleted successfully`
        : "All messages deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing messages:", error);
    res.status(500).json({ error: "Failed to clear messages" });
  }
});

adminRouter.get("/messages", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const roomId = req.query.roomId; // Optional room filter

  const mongoClient = req.app.locals.mongoClient;
  const collection = mongoClient.db("chatdb").collection("messages");

  let query = {};

  // If roomId provided, filter messages by room
  if (roomId) {
    query = { roomId: roomId };
  }

  try {
    // Get total count for this query
    const total = await collection.countDocuments(query);
    console.log(`Total messages${roomId ? ` in room ${roomId}` : ""}:`, total);

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(total / limit));
    console.log("Calculated total pages:", totalPages);

    // Get messages for current page
    const messages = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Optionally add room names if we're in "all rooms" view
    if (!roomId) {
      // Get all rooms
      const roomsCollection = mongoClient.db("chatdb").collection("rooms");
      const rooms = await roomsCollection.find().toArray();

      // Create a room name lookup map
      const roomMap = {};
      rooms.forEach((room) => {
        roomMap[room._id.toString()] = room.name;
      });

      // Add room names to messages
      messages.forEach((msg) => {
        if (msg.roomId && roomMap[msg.roomId]) {
          msg.roomName = roomMap[msg.roomId];
        }
      });
    }

    console.log(
      `Returning ${messages.length} messages for page ${page} of ${totalPages}`
    );

    res.status(200).json({
      messages,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default adminRouter;
