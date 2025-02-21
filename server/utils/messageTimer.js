// server/utils/messageTimer.js
const MESSAGE_TIMER = 2 * 60 * 60 * 1000; // 2 hours
const messageTimers = new Map();

let io; // Will be set later

export function initMessageTimer(socketIo) {
  io = socketIo;
}

export function scheduleMessageDeletion(messageId, collection, expirationTime) {
  const now = Date.now();
  const timeDuration = expirationTime - now;

  if (timeDuration <= 0) {
    deleteMessage(messageId, collection);
    return;
  }

  const timer = setTimeout(() => {
    deleteMessage(messageId, collection);
  }, timeDuration);

  messageTimers.set(messageId.toString(), timer);
}

export function scheduleExistingMessagesDeletion(messages, collection) {
  messages.forEach((msg) => {
    const expirationTime = msg.timestamp.getTime() + MESSAGE_TIMER;
    scheduleMessageDeletion(msg._id, collection, expirationTime);
  });
}

async function deleteMessage(messageId, collection) {
  try {
    const timerId = messageTimers.get(messageId.toString());

    if (timerId) {
      clearTimeout(timerId);
      messageTimers.delete(messageId.toString());
    }

    await collection.deleteOne({ _id: messageId });

    if (io) {
      io.emit("message deleted", messageId.toString());
    }
    console.log(`Message ${messageId} deleted after expiration`);
  } catch (error) {
    console.error("Error deleting message: ", error);
  }
}

export function cleanupMessageTimers() {
  for (const timer of messageTimers.values()) {
    clearTimeout(timer);
  }
  messageTimers.clear();
}

export function getMessageExpiration() {
  return MESSAGE_TIMER;
}
