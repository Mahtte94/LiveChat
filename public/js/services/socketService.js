// socketService.js - Socket.IO event handling

import { getState } from "../store/appState.js";
import {
  handleChatMessage,
  handleChatHistory,
  handleMessageDeleted,
  handleMessageCleared,
} from "./messageService.js";
import { handleRoomUsersUpdate } from "./roomService.js";


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


export function emitEvent(socket, eventName, data, callback) {
  if (socket && socket.connected) {
    socket.emit(eventName, data, callback);
  } else {
    console.error(`Cannot emit "${eventName}": Socket not connected`);
  }
}
