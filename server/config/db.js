// server/config/db.js
import { MongoClient } from "mongodb";
import { createAdapter } from "@socket.io/mongo-adapter";
import { scheduleExistingMessagesDeletion } from "../utils/messageTimer.js";

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "chatdb";
export const MESSAGES_COLLECTION = "messages";
export const ROOMS_COLLECTION = "rooms";
export const SOCKET_COLLECTION = "socket.io-adapter";

async function connectToDatabase(io) {
  try {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("Debug: MongoDB connected");

    const db = client.db(DB_NAME);
    const messagesCollection = db.collection(MESSAGES_COLLECTION);
    const roomsCollection = db.collection(ROOMS_COLLECTION);
    const socketCollection = db.collection(SOCKET_COLLECTION);

    // Create required indexes
    await messagesCollection.createIndex({ timestamp: 1 });
    await messagesCollection.createIndex(
      { client_offset: 1 },
      { unique: true }
    );
    await roomsCollection.createIndex({ name: 1 }, { unique: true });

    // Set up message deletion timers for existing messages
    const existingMessages = await messagesCollection.find().toArray();
    scheduleExistingMessagesDeletion(existingMessages, messagesCollection);

    // Create the MongoDB adapter
    const mongoAdapter = createAdapter(socketCollection);
    io.adapter(mongoAdapter);

    // Create a default room if none exists
    await createDefaultRoom(roomsCollection);

    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

async function createDefaultRoom(roomsCollection) {
  const roomCount = await roomsCollection.countDocuments();
  if (roomCount === 0) {
    await roomsCollection.insertOne({
      name: "General",
      createdAt: new Date(),
      userCount: 0,
    });
    console.log("Debug: Created default 'General' room");
  }
}

export { connectToDatabase };
