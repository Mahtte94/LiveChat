// socketConfig.js - Socket.IO configuration

let socketInstance = null;


export function initSocket() {
  // Create singleton socket instance
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      autoConnect: false, // Don't connect until room is selected
    });
  }

  return socketInstance;
}


export function getSocket() {
  if (!socketInstance) {
    // Initialize if it doesn't exist yet
    initSocket();
  }
  return socketInstance;
}


export function connectSocket() {
  const socket = getSocket();

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}
