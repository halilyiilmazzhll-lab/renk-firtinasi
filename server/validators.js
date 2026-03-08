// server/validators.js

function validateRoom(room, requirePlaying = true) {
    if (!room) return { valid: false, message: 'Oda bulunamadı', code: 'ROOM_NOT_FOUND' };
    if (requirePlaying && room.status !== 'playing') return { valid: false, message: 'Oyun aktif değil', code: 'GAME_NOT_ACTIVE' };
    return { valid: true };
}

function validateTurn(room, socketId) {
    const gs = room.gameState;
    if (!gs || !gs.players || gs.phase !== 'playing') return { valid: false, message: 'Oyun durumu geçersiz', code: 'INVALID_STATE' };

    const player = gs.players[gs.currentPlayerIndex];
    if (player.socketId !== socketId) return { valid: false, message: 'Sıra sende değil', code: 'NOT_YOUR_TURN' };

    return { valid: true, player };
}

function validateColor(color) {
    const validColors = ['red', 'blue', 'green', 'yellow'];
    return validColors.includes(color);
}

module.exports = {
    validateRoom,
    validateTurn,
    validateColor
};
