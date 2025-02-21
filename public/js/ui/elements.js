// elements.js - DOM element references

// Cache DOM element references for better performance
const elements = {
  // Room selection elements
  roomSelection: document.getElementById("room-selection"),
  roomList: document.getElementById("room-list"),
  usernameInput: document.getElementById("username-input"),
  newRoomInput: document.getElementById("new-room-input"),
  createRoomBtn: document.getElementById("create-room-btn"),

  // Chat UI elements
  chatContainer: document.getElementById("chat-container"),
  currentRoomElement: document.getElementById("current-room"),
  currentRoomName: document.getElementById("current-room-name"),
  onlineCount: document.getElementById("online-count"),
  roomSwitcher: document.getElementById("room-switcher"),

  // Message elements
  messagesContainer: document.getElementById("messages"),
  messageForm: document.getElementById("form"),
  messageInput: document.getElementById("input"),
};

/**
 * Get DOM elements object or a specific element
 * @param {string} [elementName] - Optional element name to get specific element
 * @returns {Object|HTMLElement} - All elements or the requested element
 */
export function getElements(elementName) {
  if (elementName) {
    return elements[elementName];
  }
  return elements;
}

/**
 * Validate that all required DOM elements exist
 * @throws {Error} If any required elements are missing
 */
export function validateElements() {
  const requiredElements = [
    "roomSelection",
    "roomList",
    "chatContainer",
    "messagesContainer",
    "messageForm",
    "messageInput",
  ];

  for (const element of requiredElements) {
    if (!elements[element]) {
      throw new Error(`Required DOM element "${element}" not found`);
    }
  }
}
