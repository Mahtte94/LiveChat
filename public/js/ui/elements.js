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


export function getElements(elementName) {
  if (elementName) {
    return elements[elementName];
  }
  return elements;
}


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
