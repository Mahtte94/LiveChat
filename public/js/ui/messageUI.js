// messageUI.js - Message display and UI operations

import { getElements } from "./elements.js";
import { getState, hasMessage, cacheMessage } from "../store/appState.js";
import { getSocket } from "../config/socketConfig.js";

/**
 * Add a message to the display
 * @param {Object} msg - The message object to display
 */
export function addMessageToDisplay(msg) {
  const elements = getElements();
  const socket = getSocket();

  // Skip invalid messages
  if (!msg || !msg.content) {
    console.error("Invalid message format", msg);
    return;
  }

  // Skip duplicates (using message ID)
  if (msg._id && hasMessage(msg._id)) {
    console.log("Skipping duplicate message:", msg._id);
    return;
  }

  // Remove empty state if it exists
  const emptyState =
    elements.messagesContainer.querySelector(".empty-messages");
  if (emptyState) {
    elements.messagesContainer.innerHTML = "";
  }

  // Remove loading state if it exists
  const loadingState =
    elements.messagesContainer.querySelector("#loading-messages");
  if (loadingState) {
    elements.messagesContainer.innerHTML = "";
  }

  // Create message element
  const item = document.createElement("li");

  // Store message ID as data attribute and in cache
  if (msg._id) {
    item.dataset.messageId = msg._id.toString();
    cacheMessage(msg._id);
  }

  // Add username prefix if available
  const usernameDisplay = msg.username ? `${msg.username}: ` : "";
  item.textContent = `${usernameDisplay}${msg.content}`;

  // Style based on sender
  if (msg.sender === socket.id) {
    item.classList.add("own-message");
  } else {
    item.classList.add("other-message");
  }

  // Add timestamp if available
  if (msg.timestamp) {
    try {
      const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const timeElement = document.createElement("small");
      timeElement.classList.add("message-time");
      timeElement.textContent = time;
      item.appendChild(document.createElement("br"));
      item.appendChild(timeElement);
    } catch (e) {
      console.error("Failed to format timestamp:", e);
    }
  }

  // Add message to container
  elements.messagesContainer.appendChild(item);
}

/**
 * Remove a message from the display
 * @param {string} messageId - The ID of the message to remove
 */
export function removeMessageFromDisplay(messageId) {
  const elements = getElements();

  // Find and remove the message element
  const messageElements = elements.messagesContainer.getElementsByTagName("li");
  for (let element of messageElements) {
    if (element.dataset.messageId === messageId) {
      element.remove();
      break;
    }
  }

  // Show empty state if no messages left
  if (elements.messagesContainer.getElementsByTagName("li").length === 0) {
    showNoMessagesState();
  }
}

/**
 * Clear all messages from the display
 */
export function clearMessagesDisplay() {
  const elements = getElements();
  elements.messagesContainer.innerHTML = "";
}

/**
 * Show loading state in the messages container
 */
export function showLoadingState() {
  const elements = getElements();

  elements.messagesContainer.innerHTML = "";
  const loadingItem = document.createElement("div");
  loadingItem.id = "loading-messages";
  loadingItem.className = "loading-message";
  loadingItem.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading message history...</div>
  `;
  elements.messagesContainer.appendChild(loadingItem);
}

/**
 * Show empty state when no messages are available
 */
export function showNoMessagesState() {
  const elements = getElements();

  elements.messagesContainer.innerHTML = "";
  const emptyState = document.createElement("div");
  emptyState.className = "empty-messages";
  emptyState.textContent = "No messages yet. Be the first to say hello!";
  elements.messagesContainer.appendChild(emptyState);
}

/**
 * Scroll to the bottom of the messages container
 */
export function scrollToBottom() {
  const elements = getElements();

  elements.messagesContainer.scrollTop =
    elements.messagesContainer.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}
