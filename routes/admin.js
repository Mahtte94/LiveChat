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

    // Notify all clients about the deletion
    req.app.locals.io.emit("message deleted", messageId);
    console.log("Delete notification emitted to all clients");

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
  const mongoClient = req.app.locals.mongoClient;
  if (!mongoClient) {
    console.error("MongoDB client is not available");
    return res.status(500).json({ error: "Database connection not available" });
  }

  const collection = mongoClient.db("chatdb").collection("messages");

  try {
    const result = await collection.deleteMany({});
    console.log("Clear all messages result:", result);

    // Notify all clients about the clear operation
    req.app.locals.io.emit("messages cleared");
    console.log("Clear all notification emitted to all clients");

    res.status(200).json({
      message: "All messages deleted successfully",
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
  const mongoClient = req.app.locals.mongoClient;
  const collection = mongoClient.db("chatdb").collection("messages");

  try {
    // Get total count first
    const total = await collection.countDocuments();
    console.log("Total messages:", total); // Debug log

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(total / limit));
    console.log("Calculated total pages:", totalPages); // Debug log

    // Get messages for current page
    const messages = await collection
      .find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    console.log(
      `Returning ${messages.length} messages for page ${page} of ${totalPages}`
    ); // Debug log

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
