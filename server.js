require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerSocketHandlers } = require('./server/socketHandlers');
const { connectDB } = require('./server/db');
const { handleGoogleLogin } = require('./server/auth');

const app = express();
app.use(express.json());
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "capacitor://localhost"
];

if (process.env.ALLOWED_ORIGIN) {
    allowedOrigins.push(process.env.ALLOWED_ORIGIN);
}

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// API Routes
app.get('/api/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});
app.post('/api/auth/google', handleGoogleLogin);

app.get('/api/stats', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const appToken = authHeader && authHeader.split(' ')[1];

    if (!appToken) return res.json({ success: false, message: 'Unauthorized' });

    const db = require('./server/db').getDB();
    if (!db) return res.json({ success: false, message: 'No DB' });

    const user = await db.collection('users').findOne({ appToken });
    if (!user) return res.json({ success: false, message: 'User not found' });

    const matches = await db.collection('matches')
        .find({ "players.appToken": appToken })
        .sort({ finishedAt: -1 })
        .limit(10)
        .toArray();

    res.json({
        success: true,
        stats: {
            wins: user.wins || 0,
            gamesPlayed: user.gamesPlayed || 0,
            winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0
        },
        matches: matches.map(m => {
            const me = m.players.find(p => p.appToken === appToken);
            return {
                roomId: m.roomId,
                winnerName: m.winnerName,
                isWinner: me ? me.isWinner : false,
                date: m.finishedAt,
                playerCount: m.players.length
            };
        })
    });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'www')));

// Register Game Handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});
