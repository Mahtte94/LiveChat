// server/controllers/roomController.js
import express from "express";
import { getAllRooms, createRoom } from "../services/roomService.js";

export function roomRoutes(db) {
  const router = express.Router();

  // GET /rooms - Get all rooms
  router.get("/", async (req, res) => {
    try {
      const rooms = await getAllRooms(db);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  // POST /rooms - Create a new room
  router.post("/", async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Room name is required",
        });
      }

      const result = await createRoom(db, name);
      res.status(201).json(result);
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

  return router;
}
