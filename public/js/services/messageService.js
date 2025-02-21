// messageService.js - Message handling and operations

import {
  getState,
  setState,
  hasMessage,
  cacheMessage,
  removeMessage,
  clearMessageCache,
} from "../store/appState.js";
import { getElements } from "../ui/elements.js";
import {
  addMessageToDisplay,
  removeMessageFromDisplay,
  clearMessagesDisplay,
  showNoMessagesState,
  scrollToBottom,
} from "../ui/messageUI.js";
import { emitEvent } from "./socketService.js";
import { getSocket } from "../config/socketConfig.js";

/**
 * Handle new chat message event
 * @param {Object} message - The message object from the server
 */
export function handleChatMessage(message) {
  const state = getState();

  // Skip if not for current room
  if (!message || message.roomId !== state.currentRoom) {
    return;
  }

  // Add the message to the display
  addMessageToDisplay(message);
  scrollToBottom();
}

/**
 * Handle chat history event
 * @param {Array} messages - The array of message objects from the server
 */
export function handleChatHistory(messages) {
  const state = getState();
  const elements = getElements();

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    showNoMessagesState();
    return;
  }

  // Filter messages for current room
  const roomMessages = messages.filter(
    (msg) => msg && msg.roomId === state.currentRoom
  );

  if (roomMessages.length === 0) {
    showNoMessagesState();
    return;
  }

  // Clear messages container
  clearMessagesDisplay();

  // Display messages
  roomMessages.forEach((msg) => {
    addMessageToDisplay(msg);
  });

  // Scroll to bottom
  scrollToBottom();
}

/**
 * Handle message deleted event
 * @param {string} messageId - The ID of the deleted message
 */
export function handleMessageDeleted(messageId) {
  // Remove from cache
  removeMessage(messageId);

  // Remove from display
  removeMessageFromDisplay(messageId);
}

/**
 * Handle messages cleared event
 */
export function handleMessageCleared() {
  clearMessageCache();
  showNoMessagesState();
}

/**
 * Send a new chat message
 * @param {string} content - The message content
 */
export function sendMessage(content) {
  if (!content) return;

  const socket = getSocket();
  const state = getState();
  const clientOffset = `${socket.id}-${Date.now()}`;

  const messageData = {
    content: content,
    roomId: state.currentRoom,
    username: state.username,
    clientOffset: clientOffset,
  };

  emitEvent(socket, "chat message", messageData, (error) => {
    if (error) {
      console.error("Error sending message:", error);
    }
  });
}

/**
 * Set up message-related event listeners
 */
export function setupMessageEventListeners() {
  const elements = getElements();

  // Message form submission
  elements.messageForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const content = elements.messageInput.value;
    if (content) {
      sendMessage(content);
      elements.messageInput.value = ""; // Clear input after sending
    }
  });
}
