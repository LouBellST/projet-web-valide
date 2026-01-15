import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/';
const MONGO_DB = process.env.MONGO_DB || 'postsdb';

let db;

export async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(MONGO_DB);
        console.log('Connected to MongoDB (Posts service) - Database:', MONGO_DB);
        
        // Créer des index pour améliorer les performances
        await db.collection('posts').createIndex({ authorId: 1 });
        await db.collection('posts').createIndex({ createdAt: -1 });
        await db.collection('posts').createIndex({ 'likes.userId': 1 });
        
        await db.collection('comments').createIndex({ postId: 1 });
        await db.collection('comments').createIndex({ authorId: 1 });
        await db.collection('comments').createIndex({ createdAt: -1 });
        
        await db.collection('bookmarks').createIndex({ userId: 1, postId: 1 }, { unique: true });
        await db.collection('bookmarks').createIndex({ userId: 1 });
        
        console.log('Indexes created');
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

export { ObjectId };