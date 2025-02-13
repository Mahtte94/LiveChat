import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { availableParallelism } from 'node:os';
import cluster from 'node:cluster';
import { MongoClient } from 'mongodb';
import { createAdapter as createMongoAdapter } from '@socket.io/mongo-adapter';

// MongoDB connection string - replace with your actual connection string
const MONGO_URL = 'mongodb+srv://mahjeb0518:XN4cOm1u7Mj7xU0H@democluster.x4sk2.mongodb.net/?retryWrites=true&w=majority&appName=DemoCluster';
const DB_NAME = 'chatdb';
const COLLECTION = 'messages';

if (cluster.isPrimary) {
  const numCPUs = availableParallelism();
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i
    });
  }
} else {
  const mongoClient = new MongoClient(MONGO_URL);

  async function initMongo() {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    
    // Create a unique index on client_offset
    await collection.createIndex({ client_offset: 1 }, { unique: true });
    
    return { db, collection };
  }

  const { collection } = await initMongo();

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createMongoAdapter(collection)
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  io.on('connection', async (socket) => {
    socket.on('chat message', async (msg, clientOffset, callback) => {
      try {
        const result = await collection.insertOne({
          content: msg,
          client_offset: clientOffset,
          timestamp: new Date()
        });

        io.emit('chat message', msg, result.insertedId);
        callback();
      } catch (e) {
        if (e.code === 11000) { // Duplicate key error
          callback();
        }
        // else let the client retry
        return;
      }
    });

    if (!socket.recovered) {
      try {
        const messages = await collection
          .find({
            _id: { $gt: socket.handshake.auth.serverOffset || '000000000000000000000000' }
          })
          .sort({ _id: 1 })
          .toArray();

        messages.forEach((row) => {
          socket.emit('chat message', row.content, row._id);
        });
      } catch (e) {
        console.error('Error recovering messages:', e);
      }
    }
  });

  const port = process.env.PORT;
  server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
  });

  // Handle cleanup on server shutdown
  process.on('SIGINT', async () => {
    await mongoClient.close();
    process.exit();
  });
}