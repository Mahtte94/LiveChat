import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";
import "dotenv/config";
import adminRouter from "./../routes/admin.js";

const app = express();
const server = createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

// First create the Socket.IO server instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    transports: ["websocket", "polling"],
  },
});

// Make io available to routes
app.locals.io = io;

// Serve static files
app.use(express.static(join(__dirname, "../public")));

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "chatdb";
const COLLECTION = "messages";
const SOCKET_COLLECTION = "socket.io-adapter";
const MESSAGE_TIMER = 2 * 60 * 60 * 1000;

let mongoClient;
const messageTimers = new Map();

async function deleteMessage(messageId, collection) {
  try {
    const timerId = messageTimers.get(messageId.toString());

    if (timerId) {
      clearTimeout(timerId);
      messageTimers.delete(messageId.toString());
    }

    await collection.deleteOne({ _id: messageId });

    io.emit("message deleted", messageId.toString());
    console.log(`Message ${messageId} deleted after expiration`);
  } catch (error) {
    console.error("Error deleting message: ", error);
  }
}

function scheduleMessageDeletion(messageId, collection, expirationTime) {
  const now = Date.now();
  const timeDuration = expirationTime - now;

  if (timeDuration <= 0) {
    deleteMessage(messageId, collection);
    return;
  }

  const timer = setTimeout(() => {
    deleteMessage(messageId, collection);
  }, timeDuration);

  messageTimers.set(messageId.toString(), timer);
}

async function initMongoDB() {
  try {
    mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log("Debug: MongoDB connected");

    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    await collection.createIndex({ timestamp: 1 });

    const existingMessages = await collection.find().toArray();
    existingMessages.forEach((msg) => {
      const expirationTime = msg.timestamp.getTime() + MESSAGE_TIMER;
      scheduleMessageDeletion(msg._id, collection, expirationTime);
    });

    // Make mongoClient available to routes
    app.locals.mongoClient = mongoClient;

    return mongoClient;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

async function main() {
  console.log("Debug: Starting server...");

  try {
    // Initialize MongoDB first
    const client = await initMongoDB();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const socketCollection = db.collection(SOCKET_COLLECTION);

    // Create required indexes
    await collection.createIndex({ client_offset: 1 }, { unique: true });

    // Create the MongoDB adapter
    const mongoAdapter = createAdapter(socketCollection);
    io.adapter(mongoAdapter);

    // Mount routes AFTER MongoDB is initialized
    app.get("/", (req, res) => {
      res.sendFile(join(__dirname, "../public/index.html"));
    });

    // Mount the admin router and serve admin page
    app.use("/admin", adminRouter);
    app.get("/admin", (req, res) => {
      res.sendFile(join(__dirname, "../public/admin.html"));
    });

    io.on("connection", async (socket) => {
      console.log(`Debug: Client connected with ID: ${socket.id}`);

      try {
        const messages = await collection
          .find()
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();

        console.log(
          `Debug: Sending ${messages.length} recent messages to ${socket.id}`
        );
        messages.reverse().forEach((msg) => {
          socket.emit("chat message", msg);
        });
      } catch (e) {
        console.error("Debug: Error loading messages:", e);
      }

      socket.on("chat message", async (msg, clientOffset, callback) => {
        try {
          console.log(`Debug: New message from ${socket.id}:`, msg);

          const messageData = {
            content: msg,
            client_offset: clientOffset || `${socket.id}-${Date.now()}`,
            timestamp: new Date(),
            sender: socket.id,
          };

          // Insert the message and get the inserted document
          const result = await collection.insertOne(messageData);

          // Add the _id to the messageData
          messageData._id = result.insertedId;

          scheduleMessageDeletion(
            messageData._id,
            collection,
            messageData.timestamp.getTime() + MESSAGE_TIMER
          );

          // Broadcast to all clients with the _id included
          io.emit("chat message", messageData);

          if (callback) callback();
        } catch (error) {
          console.error("Error handling message:", error);
          if (callback) callback(error);
        }
      });

      socket.on("disconnect", () => {
        console.log(`Debug: Client disconnected: ${socket.id}`);
      });
    });

    // Start server only after everything is initialized
    const port = process.env.PORT || 8080;
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize application:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  try {

    for (const timer of messageTimers.values()) {
      clearTimeout(timer);
    }
    messageTimers.clear();

    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed.");
    }
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

main().catch(console.error);

export default app;
