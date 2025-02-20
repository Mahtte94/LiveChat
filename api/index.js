import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import { MongoClient, ObjectId } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";
import "dotenv/config";
import adminRouter from "./../routes/admin.js";

const app = express();
const server = createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Enable JSON parsing for API routes
app.use(express.json());

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
const MESSAGES_COLLECTION = "messages";
const ROOMS_COLLECTION = "rooms";
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
    const collection = db.collection(MESSAGES_COLLECTION);

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

// Track active users per room
const roomUsers = new Map();

function getRoomUserCount(roomId) {
  return roomUsers.has(roomId) ? roomUsers.get(roomId).size : 0;
}

async function main() {
  console.log("Debug: Starting server...");

  try {
    // Initialize MongoDB first
    const client = await initMongoDB();
    const db = client.db(DB_NAME);
    const messagesCollection = db.collection(MESSAGES_COLLECTION);
    const roomsCollection = db.collection(ROOMS_COLLECTION);
    const socketCollection = db.collection(SOCKET_COLLECTION);

    // Create required indexes
    await messagesCollection.createIndex(
      { client_offset: 1 },
      { unique: true }
    );
    await roomsCollection.createIndex({ name: 1 }, { unique: true });

    // Create the MongoDB adapter
    const mongoAdapter = createAdapter(socketCollection);
    io.adapter(mongoAdapter);

    // Create a default room if none exists
    const roomCount = await roomsCollection.countDocuments();
    if (roomCount === 0) {
      await roomsCollection.insertOne({
        name: "General",
        createdAt: new Date(),
        userCount: 0,
      });
      console.log("Debug: Created default 'General' room");
    }

    // API routes for rooms
    app.get("/rooms", async (req, res) => {
      try {
        const rooms = await roomsCollection.find().toArray();

        // Enhance rooms with active user counts
        const enhancedRooms = rooms.map((room) => ({
          ...room,
          userCount: getRoomUserCount(room._id.toString()),
        }));

        res.json(enhancedRooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        res.status(500).json({ error: "Failed to fetch rooms" });
      }
    });

    app.post("/rooms", async (req, res) => {
      try {
        const { name } = req.body;

        if (!name || name.trim() === "") {
          return res.status(400).json({
            success: false,
            error: "Room name is required",
          });
        }

        const result = await roomsCollection.insertOne({
          name: name.trim(),
          createdAt: new Date(),
          userCount: 0,
        });

        res.status(201).json({
          success: true,
          roomId: result.insertedId.toString(),
        });
      } catch (error) {
        console.error("Error creating room:", error);

        // Handle duplicate room name error
        if (error.code === 11000) {
          return res.status(409).json({
            success: false,
            error: "A room with this name already exists",
          });
        }

        res.status(500).json({
          success: false,
          error: "Failed to create room",
        });
      }
    });

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
      let currentRoom = null;
      let username = null;

      // Handle room joining
      socket.on(
        "join room",
        async ({ roomId, username: requestedUsername }, callback) => {
          try {
            // Store username
            username =
              requestedUsername || `Guest_${socket.id.substring(0, 6)}`;

            // If already in a room, leave it first
            if (currentRoom) {
              socket.leave(currentRoom);

              // Remove from room users tracking
              if (roomUsers.has(currentRoom)) {
                roomUsers.get(currentRoom).delete(socket.id);

                // Notify room about user count update
                io.to(currentRoom).emit("room users update", {
                  roomId: currentRoom,
                  userCount: getRoomUserCount(currentRoom),
                });
              }
            }

            // Validate room exists
            const room = await roomsCollection.findOne({
              _id: new ObjectId(roomId),
            });
            if (!room) {
              return callback({
                success: false,
                error: "Room not found",
              });
            }

            // Join new room
            currentRoom = roomId;
            socket.join(currentRoom);

            // Track user in room
            if (!roomUsers.has(currentRoom)) {
              roomUsers.set(currentRoom, new Set());
            }
            roomUsers.get(currentRoom).add(socket.id);

            // Load recent messages for this room
            const messages = await messagesCollection
              .find({ roomId: currentRoom })
              .sort({ timestamp: -1 })
              .limit(50)
              .toArray();

            console.log(
              `Debug: Sending ${messages.length} recent messages from room ${currentRoom} to ${socket.id}`
            );

            // Send messages as one array instead of individual emits
            if (messages.length > 0) {
              // Reverse to get chronological order
              socket.emit("chat history", messages.reverse());
            } else {
              console.log(`No messages to send for room ${currentRoom}`);
            }

            // Notify room about user count update
            io.to(currentRoom).emit("room users update", {
              roomId: currentRoom,
              userCount: getRoomUserCount(currentRoom),
            });

            callback({
              success: true,
              roomName: room.name,
              userCount: getRoomUserCount(currentRoom),
            });
          } catch (error) {
            console.error("Error joining room:", error);
            callback({
              success: false,
              error: "Error joining room: " + error.message,
            });
          }
        }
      );

      socket.on("leave room", (roomId) => {
        if (roomId && roomUsers.has(roomId)) {
          socket.leave(roomId);
          roomUsers.get(roomId).delete(socket.id);

          // Notify room about user count update
          io.to(roomId).emit("room users update", {
            roomId: roomId,
            userCount: getRoomUserCount(roomId),
          });

          if (roomId === currentRoom) {
            currentRoom = null;
          }
        }
      });

      socket.on("chat message", async (msg, callback) => {
        try {
          // Validate message has required fields
          if (!msg.content || !msg.roomId) {
            return callback && callback("Invalid message format");
          }

          console.log(
            `Debug: New message from ${socket.id} in room ${msg.roomId}:`,
            msg.content
          );

          const messageData = {
            content: msg.content,
            roomId: msg.roomId,
            username: msg.username || username,
            client_offset: msg.clientOffset || `${socket.id}-${Date.now()}`,
            timestamp: new Date(),
            sender: socket.id,
          };

          // Insert the message and get the inserted document
          const result = await messagesCollection.insertOne(messageData);

          // Add the _id to the messageData
          messageData._id = result.insertedId;

          scheduleMessageDeletion(
            messageData._id,
            messagesCollection,
            messageData.timestamp.getTime() + MESSAGE_TIMER
          );

          // Broadcast to room clients with the _id included
          io.to(msg.roomId).emit("chat message", messageData);

          if (callback) callback();
        } catch (error) {
          console.error("Error handling message:", error);
          if (callback) callback(error.message);
        }
      });

      socket.on("disconnect", () => {
        console.log(`Debug: Client disconnected: ${socket.id}`);

        // Clean up user from all rooms they're in
        if (currentRoom && roomUsers.has(currentRoom)) {
          roomUsers.get(currentRoom).delete(socket.id);

          // Notify room about user count update
          io.to(currentRoom).emit("room users update", {
            roomId: currentRoom,
            userCount: getRoomUserCount(currentRoom),
          });
        }
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
