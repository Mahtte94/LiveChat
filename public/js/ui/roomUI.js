// roomUI.js - Room-related UI operations

import { getElements } from "./elements.js";
import { joinRoom } from "../services/roomService.js";


export function renderRoomList(rooms) {
  const elements = getElements();
  elements.roomList.innerHTML = "";

  if (rooms.length === 0) {
    elements.roomList.innerHTML =
      '<div class="no-rooms">No rooms available. Create one!</div>';
    return;
  }

  rooms.forEach((room) => {
    const roomElement = document.createElement("div");
    roomElement.className = "room-item";
    roomElement.innerHTML = `
      <div class="room-name">${room.name}</div>
      <div class="room-users">${room.userCount} users</div>
      <button class="join-btn" data-room-id="${room._id}">Join</button>
    `;
    elements.roomList.appendChild(roomElement);
  });

  // Add event listeners to join buttons
  document.querySelectorAll(".join-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const roomId = e.target.dataset.roomId;
      joinRoom(roomId);
    });
  });
}


export function updateRoomSwitcher(rooms) {
  const elements = getElements();

  // Keep the first option
  elements.roomSwitcher.innerHTML = '<option value="">Switch Room</option>';

  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room._id;
    option.textContent = room.name;
    elements.roomSwitcher.appendChild(option);
  });
}


export function updateRoomInfo(roomName, userCount) {
  const elements = getElements();

  if (roomName) {
    elements.currentRoomName.textContent = roomName;
  }

  if (userCount !== undefined) {
    elements.onlineCount.textContent = `${userCount} online`;
  }
}

/**
 * Show the chat UI, hide room selection
 */
export function showChatUI() {
  const elements = getElements();
  elements.roomSelection.style.display = "none";
  elements.chatContainer.style.display = "flex";
  elements.currentRoomElement.style.display = "flex";
}

/**
 * Show the room selection UI, hide chat
 */
export function showRoomSelectionUI() {
  const elements = getElements();
  elements.roomSelection.style.display = "block";
  elements.chatContainer.style.display = "none";
  elements.currentRoomElement.style.display = "none";
}
