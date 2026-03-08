// server/deck.js
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SYMBOLS = { red: '♦', blue: '●', green: '▲', yellow: '★', wild: '✦' };
const ACTION_LABELS = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '✦', wildDraw4: '+4' };

let cardIdCounter = 0;

function makeCard(color, value) {
    const symbol = SYMBOLS[color] || '';
    let displayValue = value;
    if (value === 'skip') displayValue = ACTION_LABELS.skip;
    else if (value === 'reverse') displayValue = ACTION_LABELS.reverse;
    else if (value === 'draw2') displayValue = ACTION_LABELS.draw2;
    else if (value === 'wild') displayValue = ACTION_LABELS.wild;
    else if (value === 'wildDraw4') displayValue = ACTION_LABELS.wildDraw4;

    return {
        id: cardIdCounter++,
        color,
        value,
        symbol,
        displayValue,
        label: `${displayValue} ${symbol}`
    };
}

function createDeck() {
    cardIdCounter = 0;
    const cards = [];

    for (const color of COLORS) {
        cards.push(makeCard(color, '0'));
        for (let n = 1; n <= 9; n++) {
            cards.push(makeCard(color, String(n)));
            cards.push(makeCard(color, String(n)));
        }
        for (const action of ['skip', 'reverse', 'draw2']) {
            cards.push(makeCard(color, action));
            cards.push(makeCard(color, action));
        }
    }
    for (let i = 0; i < 4; i++) {
        cards.push(makeCard('wild', 'wild'));
        cards.push(makeCard('wild', 'wildDraw4'));
    }
    return cards;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(numPlayers, cardsPerPlayer = 7) {
    const deck = shuffleDeck(createDeck());
    const hands = [];
    for (let p = 0; p < numPlayers; p++) {
        hands.push(deck.splice(0, cardsPerPlayer));
    }
    let firstCard;
    do {
        firstCard = deck.shift();
        if (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2'].includes(firstCard.value)) {
            deck.push(firstCard);
            shuffleDeck(deck);
            firstCard = null;
        }
    } while (!firstCard);

    return { hands, drawPile: deck, firstCard };
}

module.exports = { createDeck, shuffleDeck, dealCards };
