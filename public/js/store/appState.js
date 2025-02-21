// appState.js - Client-side state management

// Application state
const state = {
  currentRoom: "",
  username: "",
  messageCache: new Map(), // Cache messages by ID to prevent duplicates
};


export function getState(prop) {
  if (prop) {
    return state[prop];
  }
  return { ...state }; // Return copy to prevent direct mutation
}


export function setState(updates) {
  Object.assign(state, updates);
}

/**
 * Clear message cache (used when switching rooms)
 */
export function clearMessageCache() {
  state.messageCache.clear();
}

/**
 * Check if a message exists in the cache
 * @param {string} messageId - The message ID to check
 * @returns {boolean} - True if the message is in the cache
 */
export function hasMessage(messageId) {
  return state.messageCache.has(messageId);
}


export function cacheMessage(messageId) {
  state.messageCache.set(messageId, true);
}


export function removeMessage(messageId) {
  state.messageCache.delete(messageId);
}
