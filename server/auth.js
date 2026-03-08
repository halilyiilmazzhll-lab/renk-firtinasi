const { OAuth2Client } = require('google-auth-library');
const { getDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

let client = null;

function getAuthClient() {
    if (!client && process.env.GOOGLE_CLIENT_ID) {
        client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
    return client;
}

async function verifyGoogleToken(token) {
    const authClient = getAuthClient();
    if (!authClient) throw new Error('Google Auth client is not configured (Missing GOOGLE_CLIENT_ID)');

    const ticket = await authClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    return ticket.getPayload();
}

async function handleGoogleLogin(req, res) {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const payload = await verifyGoogleToken(token);
        const { sub: googleId, email, name, picture } = payload;

        const db = getDB();
        let user;

        const appToken = uuidv4();

        if (db) {
            const users = db.collection('users');

            const result = await users.findOneAndUpdate(
                { googleId },
                {
                    $set: {
                        lastSeenAt: new Date(),
                        name,
                        picture,
                        email,
                        appToken
                    },
                    $setOnInsert: {
                        googleId,
                        createdAt: new Date(),
                        wins: 0,
                        losses: 0,
                        gamesPlayed: 0
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );

            user = result;
        } else {
            // In-memory fallback
            user = { googleId, name, picture, email, appToken, wins: 0, gamesPlayed: 0 };
        }

        res.json({
            success: true,
            user: {
                name: user.name,
                picture: user.picture,
                wins: user.wins,
                gamesPlayed: user.gamesPlayed
            },
            appToken
        });

    } catch (err) {
        console.error('Google login error:', err);
        res.status(401).json({ success: false, message: 'Invalid token or configuration' });
    }
}

async function authenticateSocket(appToken) {
    if (!appToken) return null;

    const db = getDB();
    if (!db) return null; // Fallback handled by socket assigning anonymous id

    return await db.collection('users').findOne({ appToken });
}

module.exports = { handleGoogleLogin, authenticateSocket };
