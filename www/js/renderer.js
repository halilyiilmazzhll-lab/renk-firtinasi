/* ══════════════════════════════════════
   RENDERER.JS — DOM Güncelleme
   ══════════════════════════════════════ */

function createCardElement(card, options = {}) {
    const { inHand = false, playable = false } = options;

    const el = document.createElement('div');
    el.className = `card card-${card.color}`;
    if (inHand) el.classList.add('hand-card');
    if (inHand && playable) el.classList.add('playable');
    if (inHand && !playable) el.classList.add('unplayable');

    el.dataset.cardId = card.id;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', getCardAriaLabel(card));

    // Beyaz eğimli oval
    const oval = document.createElement('div');
    oval.className = 'card-oval';

    // Köşe sol üst
    const cornerTL = document.createElement('span');
    cornerTL.className = 'card-corner card-corner-tl';
    cornerTL.innerHTML = `<span>${card.displayValue}</span><span>${card.symbol}</span>`;

    // Merkez konteyner
    const center = document.createElement('div');
    center.className = 'card-center';

    if (['skip', 'reverse', 'draw2', 'wild', 'wildDraw4'].includes(card.value)) {
        const icon = document.createElement('span');
        icon.className = 'card-action-icon';
        icon.textContent = card.displayValue;
        center.appendChild(icon);
    } else {
        const val = document.createElement('span');
        val.className = 'card-value';
        val.textContent = card.displayValue;
        center.appendChild(val);

        const sym = document.createElement('span');
        sym.className = 'card-symbol';
        sym.textContent = card.symbol;
        center.appendChild(sym);
    }

    // Köşe sağ alt
    const cornerBR = document.createElement('span');
    cornerBR.className = 'card-corner card-corner-br';
    cornerBR.innerHTML = `<span>${card.displayValue}</span><span>${card.symbol}</span>`;

    el.appendChild(oval);
    el.appendChild(cornerTL);
    el.appendChild(center);
    el.appendChild(cornerBR);

    return el;
}

function getCardAriaLabel(card) {
    const colorName = COLOR_NAMES[card.color] || 'Joker';
    const valueNames = {
        skip: 'Pas', reverse: 'Ters', draw2: 'Artı 2',
        wild: 'Joker Renk Seç', wildDraw4: 'Joker Artı 4'
    };
    const valueName = valueNames[card.value] || card.value;
    return `${colorName} ${valueName}`;
}

function renderTopCard() {
    const topCardEl = document.getElementById('top-card');
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (!topCard) return;

    // Clear and rebuild
    topCardEl.className = `card card-${topCard.color === 'wild' ? gameState.currentColor : topCard.color}`;
    topCardEl.innerHTML = '';
    topCardEl.dataset.cardId = topCard.id;

    // Joker kartsa seçilen rengi göster
    const displayCard = { ...topCard };
    if (topCard.color === 'wild') {
        displayCard.symbol = SYMBOLS[gameState.currentColor];
    }

    // Beyaz eğimli oval
    const oval = document.createElement('div');
    oval.className = 'card-oval';

    const cornerTL = document.createElement('span');
    cornerTL.className = 'card-corner card-corner-tl';
    cornerTL.innerHTML = `<span>${displayCard.displayValue}</span><span>${displayCard.symbol}</span>`;

    const center = document.createElement('div');
    center.className = 'card-center';
    const icon = document.createElement('span');
    icon.className = ['skip', 'reverse', 'draw2', 'wild', 'wildDraw4'].includes(topCard.value)
        ? 'card-action-icon' : 'card-value';
    icon.textContent = displayCard.displayValue;
    center.appendChild(icon);

    const sym = document.createElement('span');
    sym.className = 'card-symbol';
    sym.textContent = displayCard.symbol;
    center.appendChild(sym);

    const cornerBR = document.createElement('span');
    cornerBR.className = 'card-corner card-corner-br';
    cornerBR.innerHTML = `<span>${displayCard.displayValue}</span><span>${displayCard.symbol}</span>`;

    topCardEl.appendChild(oval);
    topCardEl.appendChild(cornerTL);
    topCardEl.appendChild(center);
    topCardEl.appendChild(cornerBR);
}

function renderHand() {
    const container = document.getElementById('hand-cards');
    container.innerHTML = '';

    const me = getCurrentPlayer();
    if (!me || !me.hand) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    // Yalnızca kendi sıramızdaysa oynanabilirlik göster (isMe)
    const isActivePlayer = me.socketId === gameState.players[gameState.currentPlayerIndex].socketId;
    let playableIds = new Set();

    if (isActivePlayer) {
        const playable = getPlayableCards(me.hand, topCard, gameState.currentColor);
        playableIds = new Set(playable.map(c => c.id));
    }

    me.hand.forEach(card => {
        const isPlayable = playableIds.has(card.id);
        const el = createCardElement(card, { inHand: true, playable: isPlayable });
        el.addEventListener('click', () => onCardClick(card, el));
        container.appendChild(el);
    });

    // El scroll'unu ortala
    const scroll = document.getElementById('hand-scroll');
    requestAnimationFrame(() => {
        scroll.scrollLeft = (container.scrollWidth - scroll.clientWidth) / 2;
    });
}

function renderOpponents() {
    const bar = document.getElementById('opponents-bar');
    bar.innerHTML = '';

    gameState.players.forEach((player, idx) => {
        if (player.isMe) return; // Kendimi üstte gösterme

        const chip = document.createElement('div');
        chip.className = 'opponent-chip';
        // Eğer sıra ondaysa parlat
        if (idx === gameState.currentPlayerIndex) {
            chip.classList.add('active-turn');
        }

        const dot = document.createElement('span');
        dot.className = 'opponent-dot';
        dot.style.background = PLAYER_COLORS[idx % PLAYER_COLORS.length];

        const name = document.createElement('span');
        name.textContent = player.name;

        const count = document.createElement('span');
        count.className = 'opponent-count';
        // Server'dan handCount geliyor
        count.textContent = `${player.handCount || 0}`;

        chip.appendChild(dot);
        chip.appendChild(name);
        chip.appendChild(count);
        bar.appendChild(chip);
    });
}

function renderPlayerInfo() {
    const info = document.getElementById('current-player-info');
    const me = getCurrentPlayer();
    if (!me) return;

    // Benim indeximi bulmak için
    const myIndex = gameState.players.findIndex(p => p.isMe);
    const bg = PLAYER_COLORS[myIndex % PLAYER_COLORS.length];

    info.innerHTML = `
    <span style="width:12px;height:12px;border-radius:50%;background:${bg};display:inline-block"></span>
    <span>Ben (${me.name})</span>
    <span style="color:var(--text-muted);font-size:0.85em">(${me.hand.length} kart)</span>
  `;
}

function renderFirtButton() {
    const btn = document.getElementById('btn-firt');
    const me = getCurrentPlayer();
    if (!me) return;

    if (me.hand && me.hand.length === 1 && !me.calledFirt) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

function renderPassButton() {
    const btn = document.getElementById('btn-pass');
    if (gameState.hasDrawnThisTurn) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

let lastTurnSocketId = null;

function renderGame() {
    renderTopCard();
    renderHand();
    renderOpponents();
    renderPlayerInfo();
    renderFirtButton();
    renderPassButton();

    // Mesaj alanı
    const activePlayer = getActivePlayer();
    if (activePlayer) {
        if (activePlayer.socketId === socket.id) {
            updateMessage('Sıra sende!');
            document.getElementById('game-message').style.color = 'var(--accent)';

            if (lastTurnSocketId !== socket.id) {
                triggerMyTurnGlow(); // Sadece sıra bana "yeni" geçtiyse parlat
            }
        } else {
            updateMessage(`Sıra ${activePlayer.name} adlı oyuncuda...`);
            document.getElementById('game-message').style.color = 'var(--text-secondary)';
        }
        lastTurnSocketId = activePlayer.socketId;
    }
}

function updateMessage(text) {
    document.getElementById('game-message').textContent = text;
}
