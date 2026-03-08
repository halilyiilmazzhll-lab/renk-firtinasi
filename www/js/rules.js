/* ══════════════════════════════════════
   RULES.JS — Kart Oynama Kuralları
   ══════════════════════════════════════ */

function canPlayCard(card, topCard, currentColor) {
    // Joker kartlar her zaman oynanabilir
    if (card.color === 'wild') return true;

    // Aynı renk
    if (card.color === currentColor) return true;

    // Aynı sayı veya sembol
    if (card.value === topCard.value) return true;

    return false;
}

function getPlayableCards(hand, topCard, currentColor) {
    return hand.filter(card => canPlayCard(card, topCard, currentColor));
}

function hasPlayableCard(hand, topCard, currentColor) {
    return hand.some(card => canPlayCard(card, topCard, currentColor));
}

/**
 * Kart oynandıktan sonra etkisini uygula.
 * @returns {object} { message, skipNext, reversedDir, drawAmount, pickColor }
 */
function applyCardEffect(card) {
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
            if (gameState.players.length === 2) {
                // 2 kişide reverse = skip gibi davranır
                result.skipNext = true;
                result.message = 'Yön değişti! (Tekrar senin sıran)';
            } else {
                gameState.direction *= -1;
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
            result.message = 'Sonraki oyuncu +4 kart çekiyor!';
            break;
    }

    return result;
}

function checkWinner(player) {
    return player.hand.length === 0;
}

function shouldShowFirt(player) {
    return player.hand.length === 1 && !player.calledFirt;
}

function applyFirtPenalty(player) {
    // FIRT basılmadıysa 2 ceza kartı
    drawCards(player, 2);
    player.calledFirt = false;
}
