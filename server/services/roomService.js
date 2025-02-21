// server/services/roomService.js
import { ObjectId } from "mongodb";
import { ROOMS_COLLECTION } from "../config/db.js";

// Track active users per room
const roomUsers = new Map();

export function getRoomUserCount(roomId) {
  return roomUsers.has(roomId) ? roomUsers.get(roomId).size : 0;
}

export function addUserToRoom(roomId, socketId) {
  if (!roomUsers.has(roomId)) {
    roomUsers.set(roomId, new Set());
  }
  roomUsers.get(roomId).add(socketId);
  return getRoomUserCount(roomId);
}

export function removeUserFromRoom(roomId, socketId) {
  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socketId);
    return getRoomUserCount(roomId);
  }
  return 0;
}

export async function getAllRooms(db) {
  const roomsCollection = db.collection(ROOMS_COLLECTION);
  const rooms = await roomsCollection.find().toArray();

  // Enhance rooms with active user counts
  return rooms.map((room) => ({
    ...room,
    userCount: getRoomUserCount(room._id.toString()),
  }));
}

export async function createRoom(db, name) {
  const roomsCollection = db.collection(ROOMS_COLLECTION);

  const result = await roomsCollection.insertOne({
    name: name.trim(),
    createdAt: new Date(),
    userCount: 0,
  });

  return {
    success: true,
    roomId: result.insertedId.toString(),
  };
}

export async function getRoomById(db, roomId) {
  const roomsCollection = db.collection(ROOMS_COLLECTION);

  try {
    return await roomsCollection.findOne({
      _id: new ObjectId(roomId),
    });
  } catch (error) {
    console.error("Error getting room by ID:", error);
    return null;
  }
}
