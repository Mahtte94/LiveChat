// server/index.js
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import "dotenv/config";
import adminRouter from "./routes/admin.js";
import { connectToDatabase } from "./config/db.js";
import { setupSocketHandlers } from "./controllers/socketController.js";
import { roomRoutes } from "./controllers/roomController.js";
import { cleanupMessageTimers } from "./utils/messageTimer.js";

// Server setup
const app = express();
const server = createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Enable JSON parsing for API routes
app.use(express.json());

// Create Socket.IO server instance
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

async function main() {
  console.log("Debug: Starting server...");

  try {
    // Initialize MongoDB and get client
    const { client, db } = await connectToDatabase(io);
    app.locals.mongoClient = client;

    // Setup routes
    app.get("/", (req, res) => {
      res.sendFile(join(__dirname, "../public/index.html"));
    });

    // Mount the room routes
    app.use("/rooms", roomRoutes(db));

    // Mount the admin router and serve admin page
    app.use("/admin", adminRouter);
    app.get("/admin", (req, res) => {
      res.sendFile(join(__dirname, "../public/admin.html"));
    });

    // Setup socket handlers
    setupSocketHandlers(io, db);

    // Start server
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
    // Clean up message timers
    cleanupMessageTimers();

    // Close MongoDB connection
    if (app.locals.mongoClient) {
      await app.locals.mongoClient.close();
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
