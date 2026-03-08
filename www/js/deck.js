/* ══════════════════════════════════════
   DECK.JS — Deste Oluşturma ve Karıştırma
   ══════════════════════════════════════ */

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

    // Her renk için kartlar
    for (const color of COLORS) {
        // 0 kartı (1 adet)
        cards.push(makeCard(color, '0'));

        // 1-9 kartları (2'şer adet)
        for (let n = 1; n <= 9; n++) {
            cards.push(makeCard(color, String(n)));
            cards.push(makeCard(color, String(n)));
        }

        // Aksiyon kartları (2'şer adet)
        for (const action of ['skip', 'reverse', 'draw2']) {
            cards.push(makeCard(color, action));
            cards.push(makeCard(color, action));
        }
    }

    // Joker kartlar (4'er adet)
    for (let i = 0; i < 4; i++) {
        cards.push(makeCard('wild', 'wild'));
        cards.push(makeCard('wild', 'wildDraw4'));
    }

    return cards; // Toplam 108 kart
}

function shuffleDeck(deck) {
    // Fisher-Yates shuffle
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

    // İlk kart: sayı kartı olana kadar çek
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

function recycleDiscardPile() {
    if (gameState.drawPile.length > 0) return;

    // Son kartı koru, geri kalanını karıştırarak desteye ekle
    const topCard = gameState.discardPile.pop();
    gameState.drawPile = shuffleDeck(gameState.discardPile);
    gameState.discardPile = [topCard];
}

function drawCards(player, count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
        recycleDiscardPile();
        if (gameState.drawPile.length === 0) break;
        const card = gameState.drawPile.pop();
        player.hand.push(card);
        drawn.push(card);
    }
    return drawn;
}
