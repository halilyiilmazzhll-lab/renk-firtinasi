const { MongoClient } = require('mongodb');

let db = null;

async function connectDB() {
    if (!process.env.MONGODB_URI) {
        console.warn('MONGODB_URI is not set. Running in memory mode (No persistence).');
        return null; // DB connected status fallback
    }
    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db('renkfirtinasi');
        console.log('Connected to MongoDB');

        // Ensure indexes
        await db.collection('users').createIndex({ googleId: 1 }, { unique: true });
        await db.collection('users').createIndex({ appToken: 1 });

        return db;
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

function getDB() {
    return db;
}

module.exports = { connectDB, getDB };
