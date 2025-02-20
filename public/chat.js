// Initialize socket with both transport options
const socket = io(window.location.origin, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  autoConnect: false, // Don't connect until room is selected
});

// DOM Elements
const roomSelection = document.getElementById("room-selection");
const chatContainer = document.getElementById("chat-container");
const roomList = document.getElementById("room-list");
const usernameInput = document.getElementById("username-input");
const newRoomInput = document.getElementById("new-room-input");
const createRoomBtn = document.getElementById("create-room-btn");
const roomSwitcher = document.getElementById("room-switcher");
const currentRoomName = document.getElementById("current-room-name");
const onlineCount = document.getElementById("online-count");
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const thisRooms = document.getElementById("current-room");

// App state
let currentRoom = "";
let username = "";

// Initialize by loading available rooms
function loadRooms() {
  fetch("/rooms")
    .then((response) => response.json())
    .then((rooms) => {
      roomList.innerHTML = "";

      if (rooms.length === 0) {
        roomList.innerHTML =
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
        roomList.appendChild(roomElement);
      });

      // Add event listeners to join buttons
      document.querySelectorAll(".join-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const roomId = e.target.dataset.roomId;
          joinRoom(roomId);
        });
      });

      // Also update room switcher
      updateRoomSwitcher(rooms);
    })
    .catch((error) => {
      console.error("Error loading rooms:", error);
      roomList.innerHTML =
        '<div class="error">Failed to load rooms. Please try again.</div>';
    });
}

function updateRoomSwitcher(rooms) {
  // Keep the first option
  roomSwitcher.innerHTML = '<option value="">Switch Room</option>';

  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room._id;
    option.textContent = room.name;
    roomSwitcher.appendChild(option);
  });
}

function joinRoom(roomId, roomName) {
  username =
    usernameInput.value.trim() || `Guest_${Math.floor(Math.random() * 10000)}`;

  // If we're already connected, leave current room first
  if (socket.connected && currentRoom) {
    socket.emit("leave room", currentRoom);
  }

  // Connect if not already connected
  if (!socket.connected) {
    socket.connect();
  }

  currentRoom = roomId;

  // Join the room
  socket.emit("join room", { roomId, username }, (response) => {
    if (response.success) {
      // Update UI to show chat interface
      roomSelection.style.display = "none";
      chatContainer.style.display = "flex";
      thisRooms.style.display = "flex";
      currentRoomName.textContent = response.roomName || roomName;
      messages.innerHTML = ""; // Clear messages when joining new room

      // If we don't know the room name yet, set it from response
      if (!roomName && response.roomName) {
        roomName = response.roomName;
      }

      // Update online count
      updateOnlineCount(response.userCount || 1);
    } else {
      alert("Failed to join room: " + (response.error || "Unknown error"));
    }
  });
}

function createRoom() {
  const roomName = newRoomInput.value.trim();
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

function updateOnlineCount(count) {
  onlineCount.textContent = `${count} online`;
}

// Event listeners
createRoomBtn.addEventListener("click", createRoom);

roomSwitcher.addEventListener("change", (e) => {
  const roomId = e.target.value;
  if (roomId) {
    joinRoom(roomId);
    roomSwitcher.value = ""; // Reset selector
  }
});

// Socket event handlers
socket.on("connect", () => {
  console.log("Connected to server with ID:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("connect_error", (error) => {
  console.log("Connection error:", error);
});

socket.on("room users update", ({ roomId, userCount }) => {
  if (roomId === currentRoom) {
    updateOnlineCount(userCount);
  }
});

// Message handler
socket.on("chat message", (msg) => {
  console.log("Received message with data:", msg);

  // Only display messages for current room
  if (msg.roomId !== currentRoom) return;

  const item = document.createElement("li");

  // Store the message ID and log it
  if (msg._id) {
    item.dataset.messageId = msg._id.toString();
    console.log("Setting message ID:", msg._id.toString());
  }

  if (typeof msg === "string") {
    item.textContent = msg;
  } else if (msg && msg.content) {
    // Add username display if available
    const usernameDisplay = msg.username ? `${msg.username}: ` : "";
    item.textContent = `${usernameDisplay}${msg.content}`;

    // Style based on sender
    if (msg.sender === socket.id) {
      item.classList.add("own-message");
    } else {
      item.classList.add("other-message");
    }
  }

  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

socket.on("message deleted", (messageId) => {
  console.log("Message deleted event received:", messageId);
  const messages = document.getElementById("messages");
  const messageElements = messages.getElementsByTagName("li");
  console.log("Total message elements:", messageElements.length);

  for (let element of messageElements) {
    console.log("Checking element:", element.dataset.messageId);
    if (element.dataset.messageId === messageId) {
      console.log("Found matching message, removing it");
      element.remove();
      break;
    }
  }
});

socket.on("messages cleared", () => {
  console.log("All messages cleared");
  const messages = document.getElementById("messages");
  messages.innerHTML = "";
});

// Form submission
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    const clientOffset = `${socket.id}-${Date.now()}`;

    console.log("Sending message:", input.value);

    socket.emit(
      "chat message",
      {
        content: input.value,
        roomId: currentRoom,
        username: username,
        clientOffset: clientOffset,
      },
      (error) => {
        if (error) {
          console.error("Error sending message:", error);
          return;
        }
        console.log("Message sent successfully");
      }
    );

    input.value = "";
  }
});

socket.onAny((eventName, ...args) => {
  console.log("Received event:", eventName, "with args:", args);
});

// Load rooms when page loads
document.addEventListener("DOMContentLoaded", loadRooms);
