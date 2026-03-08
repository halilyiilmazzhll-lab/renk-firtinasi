const { getDB } = require('./db');

async function saveMatch(matchData) {
    const db = getDB();
    if (!db) return;

    try {
        const matches = db.collection('matches');
        await matches.insertOne({
            roomId: matchData.roomId,
            players: matchData.players.map(p => ({ name: p.name, isWinner: p.socketId === matchData.winnerSocketId })),
            winnerName: matchData.winnerName,
            finishedAt: new Date()
        });

        // Update user stats
        const users = db.collection('users');

        // For each player in the match, update gamesPlayed
        for (const p of matchData.players) {
            if (p.appToken) { // Only update if authenticated user
                const isWinner = p.socketId === matchData.winnerSocketId;
                const update = {
                    $inc: { gamesPlayed: 1 }
                };
                if (isWinner) {
                    update.$inc.wins = 1;
                } else {
                    update.$inc.losses = 1;
                }

                await users.updateOne(
                    { appToken: p.appToken },
                    update
                );
            }
        }
    } catch (err) {
        console.error('Failed to save match:', err);
    }
}

async function getUserStats(appToken) {
    const db = getDB();
    if (!db) return null;

    const user = await db.collection('users').findOne({ appToken });
    if (!user) return null;

    return {
        wins: user.wins || 0,
        losses: user.losses || 0,
        gamesPlayed: user.gamesPlayed || 0,
        winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0
    };
}

module.exports = { saveMatch, getUserStats };
