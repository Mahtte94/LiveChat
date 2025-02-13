import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import { createAdapter as createMongoAdapter } from '@socket.io/mongo-adapter';

const MONGO_URL = 'mongodb+srv://mahjeb0518:XN4cOm1u7Mj7xU0H@democluster.x4sk2.mongodb.net/?retryWrites=true&w=majority&appName=DemoCluster';
const DB_NAME = 'chatdb';
const COLLECTION = 'messages';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log('Debug: Starting server...');
    
    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('Debug: MongoDB connected');

    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    
    // Create index
    await collection.createIndex({ client_offset: 1 }, { unique: true });
    console.log('Debug: MongoDB index created');

    // Set up Socket.IO adapter
    io.adapter(createMongoAdapter(collection));

    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    io.on('connection', async (socket) => {
        console.log('Debug: Client connected');

        socket.on('chat message', async (msg, clientOffset, callback) => {
            console.log('Debug: Received chat message:', msg);
            
            try {
                await collection.insertOne({
                    content: msg,
                    client_offset: clientOffset,
                    timestamp: new Date()
                });

                console.log('Debug: Message saved to DB');
                io.emit('chat message', msg);
                console.log('Debug: Message broadcast to clients');
                
                if (callback) callback();
            } catch (e) {
                console.error('Debug: Error handling message:', e);
                if (e.code === 11000) { // Duplicate key error
                    if (callback) callback();
                }
            }
        });

        // Load recent messages
        try {
            const messages = await collection
                .find()
                .sort({ timestamp: -1 })
                .limit(50)
                .toArray();

            console.log(`Debug: Sending ${messages.length} recent messages`);
            messages.reverse().forEach(msg => {
                socket.emit('chat message', msg.content);
            });
        } catch (e) {
            console.error('Debug: Error loading messages:', e);
        }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

main().catch(console.error);