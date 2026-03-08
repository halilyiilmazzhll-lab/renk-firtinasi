const { getNextPlayerIndex } = require('../server/gameEngine');

describe('gameEngine.js', () => {
    test('getNextPlayerIndex correctly wraps around forward', () => {
        const room = {
            gameState: {
                players: [{}, {}, {}],
                currentPlayerIndex: 2,
                direction: 1
            }
        };
        // Next without skip
        expect(getNextPlayerIndex(room, 0)).toBe(0);
    });

    test('getNextPlayerIndex correctly wraps around backward', () => {
        const room = {
            gameState: {
                players: [{}, {}, {}],
                currentPlayerIndex: 2,
                direction: -1
            }
        };
        expect(getNextPlayerIndex(room, 0)).toBe(1);
        room.gameState.currentPlayerIndex = 0;
        expect(getNextPlayerIndex(room, 0)).toBe(2);
    });

    test('getNextPlayerIndex with skip', () => {
        const room = {
            gameState: {
                players: [{}, {}, {}, {}],
                currentPlayerIndex: 1,
                direction: 1
            }
        };
        // Skip 1 means it advances twice
        expect(getNextPlayerIndex(room, 1)).toBe(3);
    });
});
