// server/controllers/socketController.js
import {
  addUserToRoom,
  removeUserFromRoom,
  getRoomUserCount,
  getRoomById,
} from "../services/roomService.js";
import { getRoomMessages, saveMessage } from "../services/messageService.js";
import { initMessageTimer } from "../utils/messageTimer.js";

export function setupSocketHandlers(io, db) {
  // Initialize message timer with io reference
  initMessageTimer(io);

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
          username = requestedUsername || `Guest_${socket.id.substring(0, 6)}`;

          // If already in a room, leave it first
          if (currentRoom) {
            await handleLeaveRoom(socket, currentRoom, io);
          }

          // Validate room exists
          const room = await getRoomById(db, roomId);
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
          const userCount = addUserToRoom(currentRoom, socket.id);

          // Load recent messages for this room
          const messages = await getRoomMessages(db, currentRoom);

          console.log(
            `Debug: Sending ${messages.length} recent messages from room ${currentRoom} to ${socket.id}`
          );

          // Send messages as one array instead of individual emits
          if (messages.length > 0) {
            socket.emit("chat history", messages);
          } else {
            console.log(`No messages to send for room ${currentRoom}`);
          }

          // Notify room about user count update
          io.to(currentRoom).emit("room users update", {
            roomId: currentRoom,
            userCount: userCount,
          });

          callback({
            success: true,
            roomName: room.name,
            userCount: userCount,
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
      handleLeaveRoom(socket, roomId, io);
      if (roomId === currentRoom) {
        currentRoom = null;
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

        // Save message and get it with assigned ID
        const savedMessage = await saveMessage(db, messageData);

        // Broadcast to room clients with the _id included
        io.to(msg.roomId).emit("chat message", savedMessage);

        if (callback) callback();
      } catch (error) {
        console.error("Error handling message:", error);
        if (callback) callback(error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Debug: Client disconnected: ${socket.id}`);

      // Clean up user from their current room
      if (currentRoom) {
        handleLeaveRoom(socket, currentRoom, io);
      }
    });

    // Debug: log all socket events
    socket.onAny((eventName, ...args) => {
      console.log("Received event:", eventName, "with args:", args);
    });
  });
}

async function handleLeaveRoom(socket, roomId, io) {
  socket.leave(roomId);
  const userCount = removeUserFromRoom(roomId, socket.id);

  // Notify room about user count update
  io.to(roomId).emit("room users update", {
    roomId: roomId,
    userCount: userCount,
  });
}
