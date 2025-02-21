// server/services/messageService.js
import { MESSAGES_COLLECTION } from "../config/db.js";
import {
  scheduleMessageDeletion,
  getMessageExpiration,
} from "../utils/messageTimer.js";

export async function getRoomMessages(db, roomId, limit = 50) {
  const messagesCollection = db.collection(MESSAGES_COLLECTION);

  const messages = await messagesCollection
    .find({ roomId: roomId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  // Return in chronological order
  return messages.reverse();
}

export async function saveMessage(db, messageData) {
  const messagesCollection = db.collection(MESSAGES_COLLECTION);

  // Insert the message
  const result = await messagesCollection.insertOne(messageData);

  // Add the _id to the messageData
  messageData._id = result.insertedId;

  // Schedule message deletion after expiration time
  scheduleMessageDeletion(
    messageData._id,
    messagesCollection,
    messageData.timestamp.getTime() + getMessageExpiration()
  );

  return messageData;
}

export async function deleteRoomMessages(db, roomId) {
  const messagesCollection = db.collection(MESSAGES_COLLECTION);
  return await messagesCollection.deleteMany({ roomId: roomId });
}
