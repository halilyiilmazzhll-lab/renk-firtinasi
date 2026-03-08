// server/rules.js
function canPlayCard(card, topCard, currentColor) {
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value) return true;
    return false;
}

function applyCardEffect(card, playerCount) {
    const result = {
        message: '',
        skipNext: false,
        reversedDir: false,
        drawAmount: 0,
        pickColor: false
    };

    switch (card.value) {
        case 'skip':
            result.skipNext = true;
            result.message = 'Sonraki oyuncu pas geçildi!';
            break;
        case 'reverse':
            if (playerCount === 2) {
                result.skipNext = true;
                result.message = 'Yön değişti! (Tekrar senin sıran)';
            } else {
                result.reversedDir = true;
                result.message = 'Oyun yönü değişti!';
            }
            break;
        case 'draw2':
            result.skipNext = true;
            result.drawAmount = 2;
            result.message = 'Sonraki oyuncu +2 kart çekiyor!';
            break;
        case 'wild':
            result.pickColor = true;
            result.message = 'Renk seçiliyor...';
            break;
        case 'wildDraw4':
            result.pickColor = true;
            result.drawAmount = 4;
            result.skipNext = true;
            result.message = 'Sonraki oyuncu +4 kart çekiyor!';
            break;
    }
    return result;
}

module.exports = { canPlayCard, applyCardEffect };
