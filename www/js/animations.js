/* ══════════════════════════════════════
   ANIMATIONS.JS — Gelişmiş Animasyonlar
   ══════════════════════════════════════ */

/**
 * Kart uçurma (Fly) fonksiyonu
 * Bir başlangıç DOM elemanından veya koordinatından, hedefe veya koordinata bir kopya kart uçurur.
 */
function flyCard(sourceRect, targetRect, cardHtml, duration = 400, onComplete) {
    const flier = document.createElement('div');
    flier.style.position = 'fixed';
    flier.style.zIndex = '9999';
    flier.style.pointerEvents = 'none';
    flier.style.width = `${sourceRect.width}px`;
    flier.style.height = `${sourceRect.height}px`;
    flier.style.left = `${sourceRect.left}px`;
    flier.style.top = `${sourceRect.top}px`;
    flier.style.transition = `all ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    flier.innerHTML = cardHtml;

    // Kopya kartın kendi özel tasarımı için class'ları koru ama üst wrap ayarla
    flier.className = 'flier-card wrap';

    // Kartın orijinal html'ini iç elemente ver
    flier.innerHTML = '';
    const innerCard = document.createElement('div');
    innerCard.className = 'card ' + cardHtml.match(/class="([^"]*)"/)[1].replace('hand-card', '').replace('playable', '');
    innerCard.innerHTML = cardHtml.replace(/<div class="card[^>]*>/, '').replace(/<\/div>$/, '');
    innerCard.style.width = '100%';
    innerCard.style.height = '100%';
    flier.appendChild(innerCard);

    document.body.appendChild(flier);

    // Bir frame bekle ve hedefe gönder
    requestAnimationFrame(() => {
        flier.style.left = `${targetRect.left}px`;
        flier.style.top = `${targetRect.top}px`;
        flier.style.width = `${targetRect.width}px`;
        flier.style.height = `${targetRect.height}px`;

        // Havada hafif dönme efekti eklenebilir
        const rot = (Math.random() - 0.5) * 30; // -15 to 15 deg
        flier.style.transform = `rotate(${rot}deg) scale(1.1)`;

        setTimeout(() => {
            flier.style.transform = `rotate(0deg) scale(1)`;
        }, duration * 0.8);
    });

    setTimeout(() => {
        flier.remove();
        if (onComplete) onComplete();
    }, duration);
}

function getRect(el) {
    // Görünmez bile olsa yerini bulmaya çalış
    if (!el) return { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 76, height: 110 };
    return el.getBoundingClientRect();
}

function animateCardPlay(cardEl, callback) {
    const discardPile = document.getElementById('discard-pile');
    const sourceRect = getRect(cardEl);
    const targetRect = getRect(discardPile);

    // Elimizdeki kart görünmez olsun hemen
    cardEl.style.opacity = '0';

    flyCard(sourceRect, targetRect, cardEl.outerHTML, 300, () => {
        if (callback) callback();
    });
}

function animateCardDraw(cardEl) {
    const drawPile = document.getElementById('draw-pile');
    const sourceRect = getRect(drawPile);
    const targetRect = getRect(cardEl); // Nereye geleceği önceden render edildi varsayımı

    cardEl.style.opacity = '0';
    cardEl.classList.remove('hand-card'); // Genişliğini bozmasın uçarken

    const tempHtml = cardEl.outerHTML;
    cardEl.classList.add('hand-card');

    flyCard(sourceRect, targetRect, tempHtml, 300, () => {
        cardEl.style.opacity = '1';
    });
}

function animateOpponentPlay(opponentIdx, color, isWild) {
    const opponentsBar = document.getElementById('opponents-bar');
    const chips = opponentsBar.querySelectorAll('.opponent-chip');
    const chip = chips[opponentIdx] || opponentsBar;

    const discardPile = document.getElementById('discard-pile');
    const sourceRect = getRect(chip);
    const targetRect = getRect(discardPile);

    // Sahte bir kapalı kart HTML'i üret
    let html = `<div class="card card-back"><div class="card-oval"></div></div>`;

    flyCard(sourceRect, targetRect, html, 400);
}

function animateOpponentDraw(opponentIdx) {
    const opponentsBar = document.getElementById('opponents-bar');
    const chips = opponentsBar.querySelectorAll('.opponent-chip');
    const chip = chips[opponentIdx] || opponentsBar;

    const drawPile = document.getElementById('draw-pile');
    const sourceRect = getRect(drawPile);
    const targetRect = getRect(chip);

    let html = `<div class="card card-back"><div class="card-oval"></div></div>`;

    // Küçülerek rakibin çipine gitsin
    flyCard(sourceRect, { ...targetRect, width: 30, height: 45 }, html, 300);
}


function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toast-text');
    text.textContent = message;
    toast.classList.remove('hidden');

    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 250);
    }, duration);
}

function shakeElement(el) {
    el.classList.add('shake');
    el.addEventListener('animationend', () => {
        el.classList.remove('shake');
    }, { once: true });
}

function triggerMyTurnGlow() {
    const gameScreen = document.getElementById('screen-game');
    gameScreen.classList.remove('my-turn-glow');
    void gameScreen.offsetWidth;
    gameScreen.classList.add('my-turn-glow');

    // Mesaj zıplasın
    const msg = document.getElementById('game-message');
    msg.classList.remove('bounce-in');
    void msg.offsetWidth;
    msg.classList.add('bounce-in');
}

function triggerConfetti() {
    const container = document.getElementById('winner-confetti');
    container.innerHTML = '';

    const colors = ['#e74c3c', '#3498db', '#27ae60', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];

    for (let i = 0; i < 60; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
        piece.style.animationDelay = `${Math.random() * 0.8}s`;
        piece.style.width = `${6 + Math.random() * 10}px`;
        piece.style.height = `${6 + Math.random() * 10}px`;
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

        container.appendChild(piece);
    }
}
