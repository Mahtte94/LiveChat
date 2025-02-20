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

// App state
let currentRoom = "";
let username = "";
let messageCache = new Map(); // Cache messages by ID to prevent duplicates

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

  // Update room and reset state
  currentRoom = roomId;
  messageCache.clear(); // Clear message cache when changing rooms

  // Show UI
  roomSelection.style.display = "none";
  chatContainer.style.display = "flex";

  // Set up empty messages container with loading state
  showLoadingState();

  // Join the room
  socket.emit("join room", { roomId, username }, (response) => {
    if (response.success) {
      // Update room name display
      currentRoomName.textContent = response.roomName || roomName;

      // If we don't know the room name yet, set it from response
      if (!roomName && response.roomName) {
        roomName = response.roomName;
      }

      // Update online count
      updateOnlineCount(response.userCount || 1);

      // Set a timeout to show "no messages" if we don't get any history
      setTimeout(() => {
        if (
          messages.childElementCount === 1 &&
          messages.firstChild.id === "loading-messages"
        ) {
          showNoMessagesState();
        }
      }, 3000);
    } else {
      alert("Failed to join room: " + (response.error || "Unknown error"));
      // Go back to room selection
      roomSelection.style.display = "block";
      chatContainer.style.display = "none";
    }
  });
}

// Show a loading state in the messages container
function showLoadingState() {
  messages.innerHTML = "";
  const loadingItem = document.createElement("div");
  loadingItem.id = "loading-messages";
  loadingItem.className = "loading-message";
  loadingItem.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading message history...</div>
  `;
  messages.appendChild(loadingItem);
}

// Show empty state when no messages are available
function showNoMessagesState() {
  messages.innerHTML = "";
  const emptyState = document.createElement("div");
  emptyState.className = "empty-messages";
  emptyState.textContent = "No messages yet. Be the first to say hello!";
  messages.appendChild(emptyState);
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

// Handle chat history messages
socket.on("chat history", (messagesData) => {
  console.log(
    `Received chat history with ${
      Array.isArray(messagesData) ? messagesData.length : 0
    } messages`
  );

  if (!Array.isArray(messagesData) || messagesData.length === 0) {
    showNoMessagesState();
    return;
  }

  // Filter messages for current room
  const roomMessages = messagesData.filter(
    (msg) => msg && msg.roomId === currentRoom
  );

  if (roomMessages.length === 0) {
    showNoMessagesState();
    return;
  }

  // Start with a fresh container
  messages.innerHTML = "";

  // Display messages
  roomMessages.forEach((msg) => {
    addMessageToDisplay(msg);
  });

  // Scroll to bottom
  scrollToBottom();
});

// Handle new chat messages
socket.on("chat message", (msg) => {
  // Skip if not for current room
  if (!msg || msg.roomId !== currentRoom) return;

  // Remove empty state if it exists
  const emptyState = messages.querySelector(".empty-messages");
  if (emptyState) {
    messages.innerHTML = "";
  }

  // Remove loading state if it exists
  const loadingState = messages.querySelector("#loading-messages");
  if (loadingState) {
    messages.innerHTML = "";
  }

  // Add the new message
  addMessageToDisplay(msg);
  scrollToBottom();
});

// Unified function to add a message to the display
function addMessageToDisplay(msg) {
  // Skip invalid messages
  if (!msg || !msg.content) {
    console.error("Invalid message format", msg);
    return;
  }

  // Skip duplicates (using message ID)
  if (msg._id && messageCache.has(msg._id)) {
    console.log("Skipping duplicate message:", msg._id);
    return;
  }

  // Create message element
  const item = document.createElement("li");

  // Store message ID as data attribute and in cache
  if (msg._id) {
    item.dataset.messageId = msg._id.toString();
    messageCache.set(msg._id, true);
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
  messages.appendChild(item);
}

// Helper to scroll to the bottom of the messages
function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}

socket.on("message deleted", (messageId) => {
  console.log("Message deleted event received:", messageId);

  // Remove from cache
  if (messageCache.has(messageId)) {
    messageCache.delete(messageId);
  }

  // Remove from DOM
  const messageElements = messages.getElementsByTagName("li");
  for (let element of messageElements) {
    if (element.dataset.messageId === messageId) {
      element.remove();
      break;
    }
  }

  // Show empty state if no messages left
  if (messages.getElementsByTagName("li").length === 0) {
    showNoMessagesState();
  }
});

socket.on("messages cleared", () => {
  console.log("All messages cleared");
  messageCache.clear();
  showNoMessagesState();
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

// Debug: log all socket events
socket.onAny((eventName, ...args) => {
  console.log("Received event:", eventName, "with args:", args);
});

// Load rooms when page loads
document.addEventListener("DOMContentLoaded", loadRooms);
