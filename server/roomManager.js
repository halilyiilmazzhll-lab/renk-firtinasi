// server/roomManager.js

const rooms = {};
const ROOM_IDLE_TIMEOUT_MS = parseInt(process.env.ROOM_IDLE_TIMEOUT_MS) || 2 * 60 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const roomId in rooms) {
        if (now - rooms[roomId].lastActivity > ROOM_IDLE_TIMEOUT_MS) {
            deleteRoom(roomId);
            console.log(`Birlikte kullanılmayan ${roomId} silindi.`);
        }
    }
}, 60 * 60 * 1000);

function updateActivity(roomId) {
    if (rooms[roomId]) {
        rooms[roomId].lastActivity = Date.now();
    }
}

function generateRoomCode() {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getRoom(roomId) {
    return rooms[roomId];
}

function createRoom(roomId, player) {
    rooms[roomId] = {
        id: roomId,
        status: 'lobby',
        players: [player],
        lastActivity: Date.now(),
        timeouts: {}
    };
    return rooms[roomId];
}

function deleteRoom(roomId) {
    const room = rooms[roomId];
    if (room && room.timeouts) {
        Object.values(room.timeouts).forEach(clearTimeout);
    }
    delete rooms[roomId];
}

function getSanitizedStateForPlayer(room, socketId) {
    if (!room.gameState) return null;

    const sanitizedState = { ...room.gameState };
    sanitizedState.players = room.gameState.players.map(p => {
        if (p.socketId === socketId) {
            return { ...p, isMe: true };
        } else {
            return { ...p, hand: [], handCount: p.hand.length, isMe: false };
        }
    });

    return sanitizedState;
}

module.exports = {
    rooms,
    updateActivity,
    generateRoomCode,
    getRoom,
    createRoom,
    deleteRoom,
    getSanitizedStateForPlayer
};
