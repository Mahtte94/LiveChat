// index.js
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";
import "dotenv/config";

const app = express();
const server = createServer(app);

// Configure Socket.IO with explicit CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        transports: ["websocket", "polling"]
    }
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

    await collection.createIndex({ client_offset: 1 }, { unique: true });
    
    io.on("connection", async (socket) => {
        console.log(`Debug: Client connected with ID: ${socket.id}`);

        // Load existing messages for new client
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

        // Handle new messages
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
                
                // Broadcast to ALL clients including sender
                console.log("Debug: Broadcasting message to all clients");
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

if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
} else {
    const port = process.env.PORT || 8080;
    server.listen(port, "0.0.0.0", () => {
        console.log(`Server running on port ${port}`);
    });
}

main().catch(console.error);

export default app;