const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { dealCards, shuffleDeck } = require('./server/deck');
const { canPlayCard, applyCardEffect } = require('./server/rules');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Statik dosyaları sun (Frontend)
app.use(express.static(path.join(__dirname, 'www')));

// Tüm odaların tutulduğu obje
const rooms = {};

// Sunucu bellek şişmesini engellemek için periyodik temizlik (Her 1 saatte bir çalışır)
setInterval(() => {
    const now = Date.now();
    for (const roomId in rooms) {
        // Eğer odada son 2 saattir hiçbir aktivite olmadıysa, odayı sil
        if (now - rooms[roomId].lastActivity > 2 * 60 * 60 * 1000) {
            delete rooms[roomId];
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

// Oyuncuya özel state hazırlama (diğerlerinin elini gizleme)
function getSanitizedStateForPlayer(room, socketId) {
    if (!room.gameState) return null;

    const sanitizedState = { ...room.gameState };
    sanitizedState.players = room.gameState.players.map(p => {
        if (p.socketId === socketId) {
            return { ...p, isMe: true };
        } else {
            // Başka bir oyuncuysa eli gönderme, sadece kart sayısını gönder
            return { ...p, hand: [], handCount: p.hand.length, isMe: false };
        }
    });

    return sanitizedState;
}

// Tüm odadaki oyunculara kendi state'lerini gönder
function broadcastGameState(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(p => {
        const state = getSanitizedStateForPlayer(room, p.socketId);
        io.to(p.socketId).emit('gameStateUpdate', state);
    });
}

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
        if (gs.drawPile.length === 0) break;

        const card = gs.drawPile.pop();
        player.hand.push(card);
        drawn.push(card);
    }
    return drawn;
}

function checkWinner(player) {
    return player.hand.length === 0;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName, callback) => {
        console.log(`[CREATE ROOM] İstek geldi. Socket: ${socket.id}, Player: ${playerName}`);
        let roomId;
        do {
            roomId = generateRoomCode();
        } while (rooms[roomId]);

        const player = {
            socketId: socket.id,
            name: playerName || 'Oyuncu',
            isHost: true
        };

        rooms[roomId] = {
            id: roomId,
            status: 'lobby',
            players: [player],
            lastActivity: Date.now()
        };

        socket.join(roomId);
        callback({ success: true, roomId, players: rooms[roomId].players });
    });

    socket.on('joinRoom', ({ roomId, playerName }, callback) => {
        roomId = roomId.toUpperCase();
        const room = rooms[roomId];

        if (!room) {
            return callback({ success: false, message: 'Oda bulunamadı' });
        }
        if (room.status !== 'lobby') {
            return callback({ success: false, message: 'Oyun zaten başlamış' });
        }
        if (room.players.length >= 4) {
            return callback({ success: false, message: 'Oda dolu' });
        }
        if (room.players.some(p => p.socketId === socket.id)) {
            return callback({ success: true, roomId, players: room.players });
        }

        const player = {
            socketId: socket.id,
            name: playerName || `Oyuncu ${room.players.length + 1}`,
            isHost: false
        };

        room.players.push(player);
        updateActivity(roomId);
        socket.join(roomId);

        io.to(roomId).emit('roomUpdated', { players: room.players });
        callback({ success: true, roomId, players: room.players });
    });

    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players[0].socketId !== socket.id) return; // Sadece host
        if (room.players.length < 2) return; // En az 2 kişi

        room.status = 'playing';
        const playerCount = room.players.length;

        // Kartları dağıt
        const { hands, drawPile, firstCard } = dealCards(playerCount);

        room.gameState = {
            phase: 'playing',
            players: room.players.map((p, i) => ({
                ...p,
                hand: hands[i],
                calledFirt: false
            })),
            currentPlayerIndex: 0,
            direction: 1,
            drawPile: drawPile,
            discardPile: [firstCard],
            currentColor: firstCard.color,
            hasDrawnThisTurn: false,
            firtRequired: false
        };

        io.to(roomId).emit('gameStarted');
        updateActivity(roomId);
        broadcastGameState(roomId);
    });

    socket.on('playCard', ({ roomId, cardId, chosenColor }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;

        const gs = room.gameState;
        const player = gs.players[gs.currentPlayerIndex];

        if (player.socketId !== socket.id) return; // Sıra bende değil

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return; // Kart elde yok

        const card = player.hand[cardIndex];
        const topCard = gs.discardPile[gs.discardPile.length - 1];

        if (!canPlayCard(card, topCard, gs.currentColor)) {
            socket.emit('showToast', 'Bu kart oynanamaz!');
            return;
        }

        // Kart oynama
        player.hand.splice(cardIndex, 1);
        gs.discardPile.push(card);

        if (card.color !== 'wild') {
            gs.currentColor = card.color;
        } else if (chosenColor) {
            gs.currentColor = chosenColor;
        } else {
            // Renk seçilmediyse bekle
            // Normalde frontend seçimi burada gönderir ama biz ayrı ayrı ele alabiliriz.
            // Daha güvenli olması için frontend wild + renk yollamalı.
        }

        // Oynama animasyonu için tüm odaya haber ver
        io.to(roomId).emit('cardPlayed', {
            playerIndex: gs.currentPlayerIndex,
            card: card,
            socketId: player.socketId
        });

        const effect = applyCardEffect(card, gs.players.length);

        // Draw amount
        if (effect.drawAmount > 0) {
            const nextIdx = getNextPlayerIndex(room);
            const nextPlayer = gs.players[nextIdx];
            drawCardsForPlayer(room, nextPlayer, effect.drawAmount);
            io.to(roomId).emit('showToast', `${nextPlayer.name} ${effect.drawAmount} kart çekti!`);

            io.to(roomId).emit('cardDrawn', {
                playerIndex: nextIdx,
                count: effect.drawAmount,
                socketId: nextPlayer.socketId
            });
        }

        if (effect.message && card.color !== 'wild') { // wild seçimi vs
            io.to(roomId).emit('showToast', effect.message);
        }

        // Kazanan kontrolü
        if (checkWinner(player)) {
            room.status = 'end';
            gs.phase = 'end';
            gs.winner = { name: player.name, socketId: player.socketId };
            io.to(roomId).emit('gameEnded', gs.winner);
            return;
        }

        // FIRT kontrol
        if (player.hand.length === 1 && !player.calledFirt) {
            gs.firtRequired = true;
            gs.firtPlayerId = player.socketId;
            // 3 sn süre ver
            setTimeout(() => {
                const stillRoom = rooms[roomId];
                if (stillRoom && stillRoom.status === 'playing') {
                    const stillPlayer = stillRoom.gameState.players.find(p => p.socketId === player.socketId);
                    if (stillPlayer && stillPlayer.hand.length === 1 && !stillPlayer.calledFirt) {
                        drawCardsForPlayer(stillRoom, stillPlayer, 2); // ceza
                        io.to(roomId).emit('showToast', `${stillPlayer.name} FIRT demediği için 2 kart yedi!`);

                        const stillIdx = stillRoom.gameState.players.findIndex(p => p.socketId === stillPlayer.socketId);
                        io.to(roomId).emit('cardDrawn', {
                            playerIndex: stillIdx,
                            count: 2,
                            socketId: stillPlayer.socketId
                        });

                        broadcastGameState(roomId);
                    }
                }
            }, 3000);
        }

        const skip = effect.skipNext ? 1 : 0;
        advanceTurn(room, skip);

        gs.phase = 'turnTransition';
        setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom && currentRoom.status === 'playing') {
                currentRoom.gameState.phase = 'playing';
                broadcastGameState(roomId);
            }
        }, 1500); // UI geçişi için ufak gecikme

        broadcastGameState(roomId);
    });

    socket.on('drawCard', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;

        const gs = room.gameState;
        const player = gs.players[gs.currentPlayerIndex];

        if (player.socketId !== socket.id) return;
        if (gs.hasDrawnThisTurn) {
            socket.emit('showToast', 'Bu tur zaten kart çektin!');
            return;
        }

        const drawn = drawCardsForPlayer(room, player, 1);
        if (drawn.length > 0) {
            gs.hasDrawnThisTurn = true;
            socket.emit('showToast', '1 kart çektin');

            // Çekme animasyonu için tüm odaya haber ver
            io.to(roomId).emit('cardDrawn', {
                playerIndex: gs.currentPlayerIndex,
                count: 1,
                socketId: player.socketId
            });
        }
        broadcastGameState(roomId);
    });

    socket.on('passTurn', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;

        const gs = room.gameState;
        const player = gs.players[gs.currentPlayerIndex];

        if (player.socketId !== socket.id || !gs.hasDrawnThisTurn) return;

        advanceTurn(room);

        gs.phase = 'turnTransition';
        setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom && currentRoom.status === 'playing') {
                currentRoom.gameState.phase = 'playing';
                broadcastGameState(roomId);
            }
        }, 1000);

        broadcastGameState(roomId);
    });

    socket.on('firt', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;

        const gs = room.gameState;
        const player = gs.players.find(p => p.socketId === socket.id);

        if (player && player.hand.length === 1 && !player.calledFirt) {
            player.calledFirt = true;
            io.to(roomId).emit('showToast', `${player.name} FIRT dedi! 🎉`);
            broadcastGameState(roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Odalardan çıkar
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    // Eğer host çıktıysa yeni host belirle
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }
                    if (room.status === 'playing') {
                        io.to(roomId).emit('showToast', 'Bir oyuncu ayrıldı.');
                        // Oyunu iptal de edebiliriz ama devam etmesi için atlıyoruz beklemede
                    }
                    io.to(roomId).emit('roomUpdated', { players: room.players });
                }
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
