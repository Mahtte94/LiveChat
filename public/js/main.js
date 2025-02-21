// main.js - Entry point for the chat application

import { initSocket } from "./config/socketConfig.js";
import { setupSocketListeners } from "./services/socketService.js";
import { loadRooms, setupRoomEventListeners } from "./services/roomService.js";
import { setupMessageEventListeners } from "./services/messageService.js";
import { validateElements } from "./ui/elements.js";

// Initialize the application
function initApp() {
  console.log("Initializing chat application...");

  // Verify DOM elements exist
  try {
    validateElements();
  } catch (error) {
    console.error("Element validation failed:", error.message);
    return;
  }

  // Initialize socket but don't connect yet
  const socket = initSocket();

  // Set up all event listeners
  setupSocketListeners(socket);
  setupRoomEventListeners(socket);
  setupMessageEventListeners(socket);

  // Load initial room list
  loadRooms();

  console.log("Chat application initialized successfully");
}

// Start the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initApp);

// Make specific functions available globally for HTML event handlers
window.loadRooms = loadRooms;
