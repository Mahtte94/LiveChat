// socketService.js - Socket.IO event handling

import { getState } from "../store/appState.js";
import {
  handleChatMessage,
  handleChatHistory,
  handleMessageDeleted,
  handleMessageCleared,
} from "./messageService.js";
import { handleRoomUsersUpdate } from "./roomService.js";

/**
 * Set up all Socket.IO event listeners
 * @param {Object} socket - The Socket.IO instance
 */
export function setupSocketListeners(socket) {
  // Connection events

  socket.on("connect_error", (error) => {
    console.log("Connection error:", error);
  });

  // Chat message events
  socket.on("chat message", (msg) => {
    handleChatMessage(msg);
  });

  socket.on("chat history", (messages) => {
    handleChatHistory(messages);
  });

  socket.on("message deleted", (messageId) => {
    handleMessageDeleted(messageId);
  });

  socket.on("messages cleared", () => {
    handleMessageCleared();
  });

  // Room events
  socket.on("room users update", (data) => {
    handleRoomUsersUpdate(data);
  });
}

/**
 * Emit a socket event with optional acknowledgment callback
 * @param {Object} socket - The Socket.IO instance
 * @param {string} eventName - Event name to emit
 * @param {any} data - Data to send with the event
 * @param {Function} [callback] - Optional callback for acknowledgment
 */
export function emitEvent(socket, eventName, data, callback) {
  if (socket && socket.connected) {
    socket.emit(eventName, data, callback);
  } else {
    console.error(`Cannot emit "${eventName}": Socket not connected`);
  }
}
