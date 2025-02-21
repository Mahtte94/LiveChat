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

  // Remove empty state if it exists
  const elements = getElements();
  const emptyState =
    elements.messagesContainer.querySelector(".empty-messages");
  if (emptyState) {
    clearMessagesDisplay();
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

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    console.log("No messages in history, showing empty state");
    showNoMessagesState();
    return;
  }

  // Filter messages for current room
  const roomMessages = messages.filter(
    (msg) => msg && msg.roomId === state.currentRoom
  );

  if (roomMessages.length === 0) {
    console.log("No messages for current room, showing empty state");
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
 * Set a timeout to show empty state if no messages arrive
 * This handles the case where the server doesn't send any history
 */
export function setupEmptyStateTimeout() {
  const elements = getElements();

  // Check if we already have a loading indicator
  const loadingElement =
    elements.messagesContainer.querySelector("#loading-messages");

  if (loadingElement) {
    // Set a timeout to show "no messages" if we don't get any history within 3 seconds
    setTimeout(() => {
      const stillLoading =
        elements.messagesContainer.querySelector("#loading-messages");
      if (stillLoading) {
        console.log("No messages received after timeout, showing empty state");
        showNoMessagesState();
      }
    }, 3000);
  }
}

/**
 * Handle message deleted event
 * @param {string} messageId - The ID of the deleted message
 */
export function handleMessageDeleted(messageId) {
  console.log("Message deleted event received:", messageId);

  // Remove from cache
  removeMessage(messageId);

  // Remove from display
  removeMessageFromDisplay(messageId);

  // Check if this was the last message
  const elements = getElements();
  if (elements.messagesContainer.querySelectorAll("li").length === 0) {
    showNoMessagesState();
  }
}

/**
 * Handle messages cleared event
 */
export function handleMessageCleared() {
  console.log("All messages cleared");
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
