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

// Serve static files
app.use(express.static(join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "../public/index.html"));
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        transports: ["websocket", "polling"]
    },
    adapter: {
        // MongoDB adapter options
        connectTimeoutMS: 5000,
        pingTimeoutMS: 5000,
        pingInterval: 2000
    }
});

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "chatdb";
const COLLECTION = "messages";
const SOCKET_COLLECTION = "socket.io-adapter";

async function main() {
    console.log("Debug: Starting server...");

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log("Debug: MongoDB connected");

    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const socketCollection = db.collection(SOCKET_COLLECTION);

    // Create required indexes
    await collection.createIndex({ client_offset: 1 }, { unique: true });
    await socketCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

    // Setup Socket.IO MongoDB adapter
    io.adapter(createAdapter(socketCollection));

    io.on("connection", async (socket) => {
        console.log(`Debug: Client connected with ID: ${socket.id}`);

        try {
            const messages = await collection
                .find()
                .sort({ timestamp: -1 })
                .limit(50)
                .toArray();

            console.log(`Debug: Sending ${messages.length} recent messages to ${socket.id}`);
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
                    sender: socket.id
                };

                await collection.insertOne(messageData);
                
                // Broadcast to all clients using the MongoDB adapter
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
}

const port = process.env.PORT || 8080;
server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});

main().catch(console.error);

export default app;