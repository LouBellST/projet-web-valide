import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/';
const MONGO_DB = process.env.MONGO_DB || 'authdb';

let db;

export async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(MONGO_DB);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

export function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
}