// socketConfig.js - Socket.IO configuration

let socketInstance = null;

/**
 * Initialize the Socket.IO connection with configuration
 * @returns {Object} The Socket.IO instance
 */
export function initSocket() {
  // Create singleton socket instance
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      autoConnect: false, // Don't connect until room is selected
    });

    console.log("Socket.IO instance initialized");
  }

  return socketInstance;
}

/**
 * Get the existing Socket.IO instance
 * @returns {Object} The Socket.IO instance
 */
export function getSocket() {
  if (!socketInstance) {
    // Initialize if it doesn't exist yet
    initSocket();
  }
  return socketInstance;
}

/**
 * Connect to the socket server if not already connected
 * @returns {Object} The Socket.IO instance
 */
export function connectSocket() {
  const socket = getSocket();

  if (!socket.connected) {
    console.log("Connecting to socket server...");
    socket.connect();
  }

  return socket;
}
