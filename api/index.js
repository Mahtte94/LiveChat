import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";
import "dotenv/config";

const app = express();
const server = createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.VERCEL_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
});

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "chatdb";
const COLLECTION = "messages";

async function main() {
  console.log("Debug: Starting server...");

  const mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();
  console.log("Debug: MongoDB connected");

  const db = mongoClient.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  // Create index
  await collection.createIndex({ client_offset: 1 }, { unique: true });
  console.log("Debug: MongoDB index created");

  // Set up Socket.IO adapter
  io.adapter(createAdapter(collection));

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "../public/index.html"));
  });

  io.on("connection", async (socket) => {
    console.log("Debug: Client connected");

    socket.on("chat message", async (msg, clientOffset, callback) => {
      console.log("Debug: Received chat message:", msg);

      try {
        const messageDoc = {
          content: msg,
          client_offset: clientOffset,
          timestamp: new Date(),
        };

        await collection.insertOne(messageDoc);
        console.log("Debug: Message saved to DB");

        io.emit("chat message", messageDoc);
        console.log("Debug: Message broadcast to clients");

        if (callback) callback();
      } catch (e) {
        console.error("Debug: Error handling message:", e);
        if (e.code === 11000) {
          // Duplicate key error
          if (callback) callback();
        }
      }
    });

    // Load recent messages
    try {
      const messages = await collection
        .find()
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      console.log(`Debug: Sending ${messages.length} recent messages`);
      messages.reverse().forEach((msg) => {
        socket.emit("chat message", msg);
      });
    } catch (e) {
      console.error("Debug: Error loading messages:", e);
    }
  });
}

// Start server for local development
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

main().catch(console.error);

// Export for Vercel
export default app;
