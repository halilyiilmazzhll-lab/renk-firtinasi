const { canPlayCard, applyCardEffect } = require('../server/rules');

describe('rules.js', () => {
    test('canPlayCard returns true for matching color', () => {
        expect(canPlayCard({ color: 'red', value: '5' }, { color: 'blue', value: '9' }, 'red')).toBe(true);
    });

    test('canPlayCard returns true for matching value', () => {
        expect(canPlayCard({ color: 'green', value: '5' }, { color: 'blue', value: '5' }, 'blue')).toBe(true);
    });

    test('canPlayCard returns true for wild cards', () => {
        expect(canPlayCard({ color: 'wild', value: 'wild' }, { color: 'blue', value: '5' }, 'blue')).toBe(true);
    });

    test('canPlayCard returns false if neither match', () => {
        expect(canPlayCard({ color: 'green', value: '3' }, { color: 'blue', value: '5' }, 'blue')).toBe(false);
    });

    test('applyCardEffect for reverse with 2 players', () => {
        const effect = applyCardEffect({ value: 'reverse' }, 2);
        expect(effect.skipNext).toBe(true);
        expect(effect.reversedDir).toBe(false);
    });

    test('applyCardEffect for reverse with 3+ players', () => {
        const effect = applyCardEffect({ value: 'reverse' }, 3);
        expect(effect.skipNext).toBe(false);
        expect(effect.reversedDir).toBe(true);

        const effect4 = applyCardEffect({ value: 'reverse' }, 4);
        expect(effect4.reversedDir).toBe(true);
    });

    test('applyCardEffect for wildDraw4', () => {
        const effect = applyCardEffect({ value: 'wildDraw4' }, 3);
        expect(effect.pickColor).toBe(true);
        expect(effect.drawAmount).toBe(4);
        expect(effect.skipNext).toBe(true);
    });
});
