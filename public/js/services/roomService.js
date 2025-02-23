// roomService.js - Room operations and event handlers

import { getState, setState, clearMessageCache } from "../store/appState.js";
import { getElements } from "../ui/elements.js";
import {
  renderRoomList,
  showChatUI,
  showRoomSelectionUI,
  updateRoomSwitcher,
  updateRoomInfo,
} from "../ui/roomUI.js";
import { showLoadingState, setupEmptyStateTimeout } from "../ui/messageUI.js";
import { emitEvent } from "./socketService.js";
import { getSocket, connectSocket } from "../config/socketConfig.js";

/**
 * Load available rooms from the server
 */
export function loadRooms() {
  const elements = getElements();

  // Show loading indicator
  elements.roomList.innerHTML =
    '<div class="loading-rooms">Loading rooms...</div>';

  fetch("/rooms")
    .then((response) => response.json())
    .then((rooms) => {
      renderRoomList(rooms);
      updateRoomSwitcher(rooms);
    })
    .catch((error) => {
      console.error("Error loading rooms:", error);
      elements.roomList.innerHTML =
        '<div class="error">Failed to load rooms. Please try again.</div>';
    });
}


export function joinRoom(roomId, roomName) {
  const elements = getElements();
  const state = getState();

  // Get username from input or generate a random one
  const username =
    elements.usernameInput.value.trim() ||
    `Guest_${Math.floor(Math.random() * 10000)}`;

  // First make sure we have a connected socket
  const socket = connectSocket();

  // If already in a room, leave it first
  if (state.currentRoom) {
    socket.emit("leave room", state.currentRoom);
  }

  // Update state
  setState({
    currentRoom: roomId,
    username: username,
  });
  clearMessageCache();

  // Show UI
  showChatUI();

  // Show loading state while waiting for messages
  showLoadingState();

  // Setup timeout to show empty state if no messages arrive
  setupEmptyStateTimeout();

  // Make sure socket is connected before attempting to join
  if (!socket.connected) {
    // Connect and wait for connection before joining
    socket.connect();

    socket.once("connect", () => {
      // Now that we're connected, join the room
      joinRoomAfterConnection(socket, roomId, roomName, username);
    });
  } else {
    // Already connected, join immediately
    joinRoomAfterConnection(socket, roomId, roomName, username);
  }
}

/**
 * Helper function to join a room after connection is established
 */
function joinRoomAfterConnection(socket, roomId, roomName, username) {
  // Join the room
  socket.emit("join room", { roomId, username }, (response) => {
    if (response.success) {
      // If we don't know the room name yet, set it from response
      const displayName = response.roomName || roomName;

      // Update room info
      updateRoomInfo(displayName, response.userCount || 1);
      
    } else {
      console.error("Failed to join room:", response.error);
      alert("Failed to join room: " + (response.error || "Unknown error"));
      // Go back to room selection
      showRoomSelectionUI();
    }
  });
}


export function createRoom(roomName) {
  if (!roomName) {
    alert("Please enter a room name");
    return;
  }

  fetch("/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: roomName }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        joinRoom(data.roomId, roomName);
        loadRooms(); // Refresh room list
      } else {
        alert("Failed to create room: " + (data.error || "Unknown error"));
      }
    })
    .catch((error) => {
      console.error("Error creating room:", error);
      alert("Failed to create room. Please try again.");
    });
}


export function handleRoomUsersUpdate(data) {
  const state = getState();

  // Only update if this is for our current room
  if (data.roomId === state.currentRoom) {
    updateRoomInfo(null, data.userCount);
  }
}


export function setupRoomEventListeners(socket) {
  const elements = getElements();

  // Create room button
  elements.createRoomBtn.addEventListener("click", () => {
    createRoom(elements.newRoomInput.value.trim());
  });

  // Create room on Enter key in input field
  elements.newRoomInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      createRoom(elements.newRoomInput.value.trim());
    }
  });

  // Room switcher dropdown
  elements.roomSwitcher.addEventListener("change", (e) => {
    const roomId = e.target.value;
    if (roomId) {
      joinRoom(roomId);
      elements.roomSwitcher.value = ""; // Reset selector
    }
  });
}
