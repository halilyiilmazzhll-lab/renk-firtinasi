// server/socketHandlers.js
const { rooms, updateActivity, generateRoomCode, getRoom, createRoom, deleteRoom, getSanitizedStateForPlayer } = require('./roomManager');
const { getNextPlayerIndex, advanceTurn, drawCardsForPlayer, checkWinner, setSafeTimeout, clearSafeTimeout } = require('./gameEngine');
const { validateRoom, validateTurn, validateColor } = require('./validators');
const { dealCards } = require('./deck');
const { canPlayCard, applyCardEffect } = require('./rules');
const { saveMatch } = require('./models');
const { authenticateSocket } = require('./auth');

function broadcastGameState(io, roomId) {
    const room = getRoom(roomId);
    if (!room) return;

    room.players.forEach(p => {
        const state = getSanitizedStateForPlayer(room, p.socketId);
        io.to(p.socketId).emit('gameStateUpdate', state);
    });
}

function registerSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('createRoom', async (data, callback) => {
            const { playerName, appToken } = data || {};
            let finalName = playerName || 'Oyuncu';
            let finalAppToken = null;

            if (appToken) {
                const user = await authenticateSocket(appToken);
                if (user) {
                    finalName = user.name;
                    finalAppToken = appToken;
                }
            }

            console.log(`[CREATE ROOM] İstek geldi. Socket: ${socket.id}, Player: ${finalName}`);
            let roomId;
            do {
                roomId = generateRoomCode();
            } while (getRoom(roomId));

            const player = {
                socketId: socket.id,
                name: finalName,
                isHost: true,
                appToken: finalAppToken
            };

            const room = createRoom(roomId, player);

            socket.join(roomId);
            callback({ success: true, roomId, players: room.players });
        });

        socket.on('joinRoom', async (data, callback) => {
            let { roomId, playerName, appToken } = data || {};
            if (!roomId) return callback({ success: false, message: 'Geçersiz oda kodu' });
            roomId = String(roomId).toUpperCase();
            const room = getRoom(roomId);

            if (!room) return callback({ success: false, message: 'Oda bulunamadı' });
            if (room.status !== 'lobby') return callback({ success: false, message: 'Oyun zaten başlamış' });
            if (room.players.length >= 4) return callback({ success: false, message: 'Oda dolu' });
            if (room.players.some(p => p.socketId === socket.id)) return callback({ success: true, roomId, players: room.players });

            let finalName = playerName || `Oyuncu ${room.players.length + 1}`;
            let finalAppToken = null;

            if (appToken) {
                const user = await authenticateSocket(appToken);
                if (user) {
                    finalName = user.name;
                    finalAppToken = appToken;
                }
            }

            const player = {
                socketId: socket.id,
                name: finalName,
                isHost: false,
                appToken: finalAppToken
            };

            room.players.push(player);
            updateActivity(roomId);
            socket.join(roomId);

            io.to(roomId).emit('roomUpdated', { players: room.players });
            callback({ success: true, roomId, players: room.players });
        });

        socket.on('startGame', (roomId) => {
            const room = getRoom(roomId);
            const valRoom = validateRoom(room, false);
            if (!valRoom.valid) return;
            if (room.status !== 'lobby') return;
            if (room.players[0].socketId !== socket.id) return; // Sadece host
            if (room.players.length < 2) return; // En az 2 kişi

            room.status = 'playing';
            const playerCount = room.players.length;

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
            broadcastGameState(io, roomId);
        });

        socket.on('playCard', ({ roomId, cardId, chosenColor }) => {
            const room = getRoom(roomId);
            const valRoom = validateRoom(room);
            if (!valRoom.valid) {
                socket.emit('actionError', { code: valRoom.code, message: valRoom.message });
                return;
            }

            const gs = room.gameState;
            const valTurn = validateTurn(room, socket.id);
            if (!valTurn.valid) {
                socket.emit('actionError', { code: valTurn.code, message: valTurn.message });
                return;
            }
            const player = valTurn.player;

            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) {
                socket.emit('actionError', { code: 'CARD_NOT_FOUND', message: 'Kart elde bulunamadı' });
                return;
            }

            const card = player.hand[cardIndex];
            const topCard = gs.discardPile[gs.discardPile.length - 1];

            if (!canPlayCard(card, topCard, gs.currentColor)) {
                socket.emit('showToast', 'Bu kart oynanamaz!');
                return;
            }

            // wild renk kontrolü eklendi (Fix 4)
            if ((card.color === 'wild' || card.value === 'wildDraw4') && !chosenColor) {
                socket.emit('showToast', 'Renk seçmelisin!');
                return;
            }

            if (chosenColor && !validateColor(chosenColor)) {
                socket.emit('actionError', { code: 'INVALID_COLOR', message: 'Geçersiz renk seçimi' });
                return;
            }

            // Kart oynama
            player.hand.splice(cardIndex, 1);
            gs.discardPile.push(card);

            if (card.color !== 'wild') {
                gs.currentColor = card.color;
            } else {
                gs.currentColor = chosenColor;
            }

            io.to(roomId).emit('cardPlayed', {
                playerIndex: gs.currentPlayerIndex,
                card: card,
                socketId: player.socketId
            });

            const effect = applyCardEffect(card, gs.players.length);

            // Uygulanan reverse düzeltildi (Fix 1)
            if (effect.reversedDir) {
                gs.direction *= -1;
            }

            if (effect.drawAmount > 0) {
                const nextPlayerIdx = getNextPlayerIndex(room, 0);
                const nextPlayer = gs.players[nextPlayerIdx];
                drawCardsForPlayer(room, nextPlayer, effect.drawAmount);
                io.to(roomId).emit('showToast', `${nextPlayer.name} ${effect.drawAmount} kart çekti!`);

                io.to(roomId).emit('cardDrawn', {
                    playerIndex: nextPlayerIdx,
                    count: effect.drawAmount,
                    socketId: nextPlayer.socketId
                });
            }

            if (effect.message && card.color !== 'wild') {
                io.to(roomId).emit('showToast', effect.message);
            }

            if (checkWinner(player)) {
                room.status = 'end';
                gs.phase = 'end';
                gs.winner = { name: player.name, socketId: player.socketId };
                clearSafeTimeout(room, 'firt');
                clearSafeTimeout(room, 'turn');

                saveMatch({
                    roomId,
                    players: gs.players.map(p => ({
                        socketId: p.socketId,
                        name: p.name,
                        appToken: p.appToken
                    })),
                    winnerSocketId: player.socketId,
                    winnerName: player.name
                });

                io.to(roomId).emit('gameEnded', gs.winner);
                return;
            }

            if (player.hand.length === 1 && !player.calledFirt) {
                gs.firtRequired = true;
                gs.firtPlayerId = player.socketId;
                const firtTimeoutMs = parseInt(process.env.FIRT_TIMEOUT_MS) || 3000;

                // Güvenli Timeout (Fix 6)
                setSafeTimeout(room, 'firt', () => {
                    const currentRoom = getRoom(roomId);
                    if (currentRoom && currentRoom.status === 'playing') {
                        const stillPlayer = currentRoom.gameState.players.find(p => p.socketId === player.socketId);
                        if (stillPlayer && stillPlayer.hand.length === 1 && !stillPlayer.calledFirt) {
                            drawCardsForPlayer(currentRoom, stillPlayer, 2);
                            io.to(roomId).emit('showToast', `${stillPlayer.name} FIRT demediği için 2 kart yedi!`);

                            const stillIdx = currentRoom.gameState.players.findIndex(p => p.socketId === stillPlayer.socketId);
                            io.to(roomId).emit('cardDrawn', {
                                playerIndex: stillIdx,
                                count: 2,
                                socketId: stillPlayer.socketId
                            });
                            broadcastGameState(io, roomId);
                        }
                    }
                }, firtTimeoutMs);
            }

            const skip = effect.skipNext ? 1 : 0;
            advanceTurn(room, skip);

            gs.phase = 'turnTransition';
            setSafeTimeout(room, 'turn', () => {
                const currentRoom = getRoom(roomId);
                if (currentRoom && currentRoom.status === 'playing') {
                    currentRoom.gameState.phase = 'playing';
                    broadcastGameState(io, roomId);
                }
            }, 1500);

            broadcastGameState(io, roomId);
        });

        socket.on('drawCard', (roomId) => {
            const room = getRoom(roomId);
            const valRoom = validateRoom(room);
            if (!valRoom.valid) return;

            const valTurn = validateTurn(room, socket.id);
            if (!valTurn.valid) {
                socket.emit('actionError', { code: valTurn.code, message: valTurn.message });
                return;
            }

            const gs = room.gameState;
            const player = valTurn.player;

            if (gs.hasDrawnThisTurn) {
                socket.emit('showToast', 'Bu tur zaten kart çektin!');
                return;
            }

            const drawn = drawCardsForPlayer(room, player, 1);
            if (drawn.length > 0) {
                gs.hasDrawnThisTurn = true;
                socket.emit('showToast', '1 kart çektin');

                io.to(roomId).emit('cardDrawn', {
                    playerIndex: gs.currentPlayerIndex,
                    count: 1,
                    socketId: player.socketId
                });
            }
            broadcastGameState(io, roomId);
        });

        socket.on('passTurn', (roomId) => {
            const room = getRoom(roomId);
            const valRoom = validateRoom(room);
            if (!valRoom.valid) return;

            const valTurn = validateTurn(room, socket.id);
            if (!valTurn.valid) {
                socket.emit('actionError', { code: valTurn.code, message: valTurn.message });
                return;
            }

            const gs = room.gameState;

            if (!gs.hasDrawnThisTurn) {
                socket.emit('actionError', { code: 'MUST_DRAW_FIRST', message: 'Önce kart çekmelisin' });
                return;
            }

            advanceTurn(room);

            gs.phase = 'turnTransition';
            setSafeTimeout(room, 'turn', () => {
                const currentRoom = getRoom(roomId);
                if (currentRoom && currentRoom.status === 'playing') {
                    currentRoom.gameState.phase = 'playing';
                    broadcastGameState(io, roomId);
                }
            }, 1000);

            broadcastGameState(io, roomId);
        });

        socket.on('firt', (roomId) => {
            const room = getRoom(roomId);
            const valRoom = validateRoom(room);
            if (!valRoom.valid) return;

            const gs = room.gameState;
            const player = gs.players.find(p => p.socketId === socket.id);

            if (player && player.hand.length === 1 && !player.calledFirt) {
                player.calledFirt = true;
                io.to(roomId).emit('showToast', `${player.name} FIRT dedi! 🎉`);
                broadcastGameState(io, roomId);
            }
        });

        socket.on('requestRematch', (roomId) => {
            const room = getRoom(roomId);
            if (!room || room.status !== 'end') return;

            if (!room.rematchVotes) room.rematchVotes = new Set();
            room.rematchVotes.add(socket.id);

            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                io.to(roomId).emit('showToast', `${player.name} rövanş istiyor!`);
            }

            if (room.rematchVotes.size === room.players.length) {
                const playerCount = room.players.length;
                const { hands, drawPile, firstCard } = dealCards(playerCount);

                room.status = 'playing';
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

                room.rematchVotes.clear();
                io.to(roomId).emit('rematchAccepted');
                io.to(roomId).emit('gameStarted');
                updateActivity(roomId);
                broadcastGameState(io, roomId);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    room.players.splice(playerIndex, 1);

                    // Eğer odada kimse kalmadıysa
                    if (room.players.length === 0) {
                        deleteRoom(roomId);
                        continue;
                    }

                    // Yeni host atama
                    if (player.isHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                        io.to(roomId).emit('hostChanged', { newHostId: room.players[0].socketId });
                    }

                    // Oyun aktifken ayrılma (Fix 3, Fix 7)
                    if (room.status === 'playing') {
                        const gs = room.gameState;
                        const gsPlayerIndex = gs.players.findIndex(p => p.socketId === socket.id);

                        if (gsPlayerIndex !== -1) {
                            gs.players.splice(gsPlayerIndex, 1);

                            // 2 kişiden az kaldıysa bitir
                            if (gs.players.length < 2) {
                                room.status = 'end';
                                gs.phase = 'end';
                                gs.winner = { name: gs.players[0].name, socketId: gs.players[0].socketId };
                                clearSafeTimeout(room, 'firt');
                                clearSafeTimeout(room, 'turn');

                                io.to(roomId).emit('showToast', 'Rakipler ayrıldığı için kazandın!');
                                io.to(roomId).emit('gameEnded', gs.winner);
                                io.to(roomId).emit('roomUpdated', { players: room.players });
                                continue;
                            } else {
                                io.to(roomId).emit('showToast', `${player.name} oyundan ayrıldı.`);
                                io.to(roomId).emit('playerEliminated', { socketId: socket.id });

                                // Çıkan aktif oyuncuysa veya aktiften önceyse sırayı düzelt
                                if (gs.currentPlayerIndex === gsPlayerIndex) {
                                    // Sırayı yeni aktif oyuncuya geçir
                                    if (gs.currentPlayerIndex >= gs.players.length) {
                                        gs.currentPlayerIndex = 0;
                                    }
                                    gs.hasDrawnThisTurn = false;
                                    gs.firtRequired = false;
                                } else if (gsPlayerIndex < gs.currentPlayerIndex) {
                                    gs.currentPlayerIndex--;
                                }
                            }
                        }
                    }

                    io.to(roomId).emit('roomUpdated', { players: room.players });
                    if (room.status === 'playing') {
                        broadcastGameState(io, roomId);
                    }
                }
            }
        });
    });
}

module.exports = { registerSocketHandlers };
