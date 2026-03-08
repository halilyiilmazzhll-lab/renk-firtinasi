// server/gameEngine.js
const { shuffleDeck } = require('./deck');

function getNextPlayerIndex(room, skip = 0) {
    const gs = room.gameState;
    const n = gs.players.length;
    let idx = gs.currentPlayerIndex;
    for (let i = 0; i <= skip; i++) {
        idx = (idx + gs.direction + n) % n;
    }
    return idx;
}

function advanceTurn(room, skip = 0) {
    const gs = room.gameState;
    gs.currentPlayerIndex = getNextPlayerIndex(room, skip);
    gs.hasDrawnThisTurn = false;
    gs.firtRequired = false;
}

function drawCardsForPlayer(room, player, count = 1) {
    const gs = room.gameState;
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (gs.drawPile.length === 0) {
            if (gs.discardPile.length <= 1) break; // Çöp de yok
            const topCard = gs.discardPile.pop();
            gs.drawPile = shuffleDeck(gs.discardPile);
            gs.discardPile = [topCard];
        }
        if (gs.drawPile.length === 0) break; // Çekilecek kart kalmadı

        const card = gs.drawPile.pop();
        player.hand.push(card);
        drawn.push(card);
    }
    return drawn;
}

function checkWinner(player) {
    return player.hand.length === 0;
}

function setSafeTimeout(room, key, callback, ms) {
    if (!room.timeouts) room.timeouts = {};
    if (room.timeouts[key]) clearTimeout(room.timeouts[key]);

    room.timeouts[key] = setTimeout(() => {
        delete room.timeouts[key];
        callback();
    }, ms);
}

function clearSafeTimeout(room, key) {
    if (room && room.timeouts && room.timeouts[key]) {
        clearTimeout(room.timeouts[key]);
        delete room.timeouts[key];
    }
}

module.exports = {
    getNextPlayerIndex,
    advanceTurn,
    drawCardsForPlayer,
    checkWinner,
    setSafeTimeout,
    clearSafeTimeout
};
