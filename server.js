require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerSocketHandlers } = require('./server/socketHandlers');

const app = express();
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

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'www')));

// Register Game Handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
