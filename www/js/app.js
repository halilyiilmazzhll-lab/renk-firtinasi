/* ══════════════════════════════════════
   APP.JS — İstemci Oyun Akışı & Ağ
   ══════════════════════════════════════ */

// Dinamik olarak bulunduğu sunucuya bağlanır (Localhost veya Render veya TWA)
const socket = io({ transports: ['websocket', 'polling'] });

let googleUser = null;

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    await initializeGoogleAuth();
    loadStoredName();
    loadSettings();
    setupEventListeners();
    setupSocketListeners();

    // URL'den room parametresi al
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomCode = urlParams.get('room');
    if (joinRoomCode) {
        document.getElementById('input-room-code').value = joinRoomCode.toUpperCase();
        clientState.isHost = false;
        document.getElementById('setup-title').textContent = 'Odaya Katıl';
        document.getElementById('room-code-input-row').classList.remove('hidden');
        showScreen('screen-setup');
    } else {
        showScreen('screen-menu');
    }
}

async function initializeGoogleAuth() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();

        if (config.googleClientId) {
            initGoogleIdentity(config.googleClientId);
        }
    } catch (err) {
        console.error('Config load failed', err);
    }
}

function initGoogleIdentity(clientId) {
    if (typeof google === 'undefined' || !google.accounts) {
        // Retry shortly if script isn't loaded yet
        setTimeout(() => initGoogleIdentity(clientId), 100);
        return;
    }

    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse
    });

    google.accounts.id.renderButton(
        document.getElementById("google-login-button"),
        { theme: "filled_blue", size: "large", width: 250, text: "continue_with" }
    );
}

async function handleGoogleResponse(response) {
    try {
        const rs = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await rs.json();
        if (data.success) {
            googleUser = data.user;
            clientState.appToken = data.appToken;
            localStorage.setItem('duno_app_token', data.appToken);

            showToast(`Hoş geldin, ${googleUser.name}`);
            document.getElementById('input-player-name').value = googleUser.name;
        }
    } catch (err) {
        console.error('Auth error', err);
        showToast('Giriş başarısız.');
    }
}

function loadStoredName() {
    clientState.appToken = localStorage.getItem('duno_app_token') || null;
    try {
        const name = localStorage.getItem('duno_player_name') || '';
        if (name) {
            document.getElementById('input-player-name').value = name;
        }
    } catch (e) { }
}

function loadSettings() {
    const defaultSettings = { music: false, sfx: true, vibration: true, largeCards: false, reduceMotion: false };
    try {
        const stored = localStorage.getItem('duno_settings');
        if (stored) {
            clientState.settings = { ...defaultSettings, ...JSON.parse(stored) };
        } else {
            clientState.settings = defaultSettings;
        }
    } catch (e) {
        clientState.settings = defaultSettings;
    }
    applySettings();
}

function applySettings() {
    const s = clientState.settings;
    document.getElementById('setting-music').checked = s.music;
    document.getElementById('setting-sfx').checked = s.sfx;
    document.getElementById('setting-vibration').checked = s.vibration;
    document.getElementById('setting-large-cards').checked = s.largeCards;
    document.getElementById('setting-reduce-motion').checked = s.reduceMotion;

    if (s.largeCards) {
        document.body.classList.add('mode-large-cards');
    } else {
        document.body.classList.remove('mode-large-cards');
    }

    if (s.reduceMotion) {
        document.body.classList.add('mode-reduce-motion');
    } else {
        document.body.classList.remove('mode-reduce-motion');
    }
}

// ── Ekran Yönetimi ──
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ── Olay Dinleyicileri (UI) ──
function setupEventListeners() {
    document.getElementById('btn-create-room').addEventListener('click', () => {
        clientState.isHost = true;
        document.getElementById('setup-title').textContent = 'Oda Kur';
        document.getElementById('room-code-input-row').classList.add('hidden');
        showScreen('screen-setup');
    });

    document.getElementById('btn-join-room-menu').addEventListener('click', () => {
        clientState.isHost = false;
        document.getElementById('setup-title').textContent = 'Odaya Katıl';
        document.getElementById('room-code-input-row').classList.remove('hidden');
        showScreen('screen-setup');
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
        showScreen('screen-menu');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        showScreen('screen-settings');
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        clientState.settings.music = document.getElementById('setting-music').checked;
        clientState.settings.sfx = document.getElementById('setting-sfx').checked;
        clientState.settings.vibration = document.getElementById('setting-vibration').checked;
        clientState.settings.largeCards = document.getElementById('setting-large-cards').checked;
        clientState.settings.reduceMotion = document.getElementById('setting-reduce-motion').checked;

        try {
            localStorage.setItem('duno_settings', JSON.stringify(clientState.settings));
        } catch (e) { }

        applySettings();
        showScreen('screen-menu');
        showToast('Ayarlar kaydedildi');
    });

    document.getElementById('btn-stats').addEventListener('click', async () => {
        showScreen('screen-stats');

        if (!clientState.appToken) {
            document.getElementById('stats-unauth').classList.remove('hidden');
            document.getElementById('stats-auth').classList.add('hidden');
            return;
        }

        document.getElementById('stats-unauth').classList.add('hidden');
        document.getElementById('stats-auth').classList.remove('hidden');

        try {
            const res = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${clientState.appToken}` }
            });
            const data = await res.json();

            if (data.success) {
                document.getElementById('stat-winrate').textContent = `${data.stats.winRate}%`;
                document.getElementById('stat-wins').textContent = data.stats.wins;
                document.getElementById('stat-games').textContent = data.stats.gamesPlayed;

                const historyList = document.getElementById('match-history-list');
                historyList.innerHTML = '';

                if (data.matches.length === 0) {
                    historyList.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Henüz oynanmış maç yok.</div>';
                } else {
                    data.matches.forEach(m => {
                        const div = document.createElement('div');
                        div.style.background = m.isWinner ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)';
                        div.style.border = `1px solid ${m.isWinner ? 'var(--success)' : 'var(--card-red)'}`;
                        div.style.padding = '12px';
                        div.style.borderRadius = '12px';
                        div.style.display = 'flex';
                        div.style.justifyContent = 'space-between';

                        const dt = new Date(m.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

                        div.innerHTML = `
                            <div>
                                <div style="font-weight:bold; color:var(--text-primary);">${m.isWinner ? '🏆 Kazandın' : `❌ ${m.winnerName} kazandı`}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${m.playerCount} Oyuncu</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.85rem; color:var(--text-secondary);">${dt}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${m.roomId}</div>
                            </div>
                        `;
                        historyList.appendChild(div);
                    });
                }
            }
        } catch (err) {
            console.error('Stats load err:', err);
        }
    });

    document.getElementById('btn-back-menu-from-stats').addEventListener('click', () => {
        showScreen('screen-menu');
    });

    document.getElementById('btn-rules').addEventListener('click', () => {
        document.getElementById('modal-rules').classList.remove('hidden');
    });

    document.getElementById('btn-close-rules').addEventListener('click', () => {
        document.getElementById('modal-rules').classList.add('hidden');
    });

    // Kurallar modal dışına tıklanınca kapat
    document.getElementById('rules-backdrop').addEventListener('click', () => {
        document.getElementById('modal-rules').classList.add('hidden');
    });

    // Kurma/Katılma aksiyonu
    document.getElementById('btn-action-setup').addEventListener('click', () => {
        const nameInput = document.getElementById('input-player-name').value.trim();
        if (!nameInput) return showToast('Lütfen adınızı girin');

        // Adı kaydet
        try { localStorage.setItem('duno_player_name', nameInput); } catch (e) { }

        console.log("Setup Action clicked! Host:", clientState.isHost, "Name:", nameInput);

        if (clientState.isHost) {
            console.log("Emitting createRoom...");
            socket.emit('createRoom', { playerName: nameInput, appToken: clientState.appToken }, (res) => {
                console.log("createRoom response:", res);
                if (res.success) {
                    clientState.roomId = res.roomId;
                    clientState.players = res.players;
                    updateLobbyUI();
                    showScreen('screen-lobby');
                }
            });
        } else {
            const roomCode = document.getElementById('input-room-code').value.trim().toUpperCase();
            if (!roomCode) return showToast('Lütfen oda kodunu girin');

            socket.emit('joinRoom', { roomId: roomCode, playerName: nameInput, appToken: clientState.appToken }, (res) => {
                if (res.success) {
                    clientState.roomId = res.roomId;
                    clientState.players = res.players;
                    updateLobbyUI();
                    showScreen('screen-lobby');
                } else {
                    showToast(res.message || 'Odaya katılınamadı');
                }
            });
        }
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
        // Parametreleri temizle ve yenile
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
    });

    document.getElementById('btn-copy-code').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(clientState.roomId);
            showToast('Oda kodu kopyalandı! 📋');
        } catch (err) {
            showToast('Kopyalama başarısız ❌');
        }
    });

    document.getElementById('btn-share-code').addEventListener('click', async () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${clientState.roomId}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Renk Fırtınası',
                    text: `Hadi oynayalım! Oda kodum: ${clientState.roomId}`,
                    url: shareUrl,
                });
            } catch (err) {
                console.log('Share canceled or failed', err);
            }
        } else {
            // Fallback for browsers without Web Share API
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast('Davet linki kopyalandı! 📋');
            } catch (err) {
                showToast('Kopyalama başarısız ❌');
            }
        }
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
        if (clientState.isHost && clientState.roomId) {
            socket.emit('startGame', clientState.roomId);
        }
    });

    // Oyun İçi Butonlar
    document.getElementById('btn-draw').addEventListener('click', () => {
        const btn = document.getElementById('btn-draw');
        // Kendi destemize ufak bir görsel efekt
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = '', 100);
        socket.emit('drawCard', clientState.roomId);
    });

    document.getElementById('btn-pass').addEventListener('click', () => {
        socket.emit('passTurn', clientState.roomId);
    });

    document.getElementById('btn-firt').addEventListener('click', () => {
        socket.emit('firt', clientState.roomId);
    });

    document.getElementById('btn-ready').addEventListener('click', () => {
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
        const btn = document.getElementById('btn-play-again');
        btn.innerHTML = '<span class="btn-icon">⏳</span> Bekleniyor...';
        btn.disabled = true;
        socket.emit('requestRematch', clientState.roomId);
    });

    document.getElementById('btn-to-menu').addEventListener('click', () => {
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
    });

    // Renk seçme butonları
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.currentTarget.dataset.color;
            document.getElementById('modal-color').classList.add('hidden');

            if (pendingWildCardId) {
                // Hangi karta tıklandığını bul
                const handCards = Array.from(document.querySelectorAll('.hand-card'));
                const el = handCards.find(c => c.dataset.cardId == pendingWildCardId);

                if (el) {
                    animateCardPlay(el, () => {
                        socket.emit('playCard', { roomId: clientState.roomId, cardId: pendingWildCardId, chosenColor: color });
                        pendingWildCardId = null;
                    });
                } else {
                    socket.emit('playCard', { roomId: clientState.roomId, cardId: pendingWildCardId, chosenColor: color });
                    pendingWildCardId = null;
                }
            }
        });
    });
}

function updateLobbyUI() {
    document.getElementById('display-room-code').textContent = clientState.roomId;

    const list = document.getElementById('lobby-player-list');
    list.innerHTML = '';

    clientState.players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'lobby-player-item';
        item.innerHTML = `
      <span class="lobby-player-name">${p.name} ${p.socketId === socket.id ? '(Sen)' : ''}</span>
      ${p.isHost ? '<span class="lobby-host-badge">Kurucu</span>' : ''}
    `;
        list.appendChild(item);
    });

    const btnStart = document.getElementById('btn-start-game');
    const waitText = document.getElementById('lobby-waiting-text');

    if (clientState.isHost) {
        if (clientState.players.length >= 2) {
            btnStart.classList.remove('hidden');
            waitText.classList.add('hidden');
        } else {
            btnStart.classList.add('hidden');
            waitText.classList.remove('hidden');
        }
    } else {
        btnStart.classList.add('hidden');
        waitText.classList.remove('hidden');
        waitText.textContent = 'Kurucunun oyunu başlatmasını bekleyin...';
    }
}

// ── Soket Dinleyicileri ──
let isAnimating = false;
let queuedState = null;

function processQueuedState() {
    if (queuedState && !isAnimating) {
        gameState = queuedState;
        queuedState = null;
        if (gameState.phase === 'playing' || gameState.phase === 'turnTransition') {
            showScreen('screen-game');
            renderGame();
        }
    }
}

function setupSocketListeners() {
    socket.on('cardPlayed', (data) => {
        if (data.socketId === socket.id) return; // Ben zaten tıklarken uçurdum
        isAnimating = true;
        // Rakibin oynadığını varsayıyoruz
        const isWild = data.card.color === 'wild';
        animateOpponentPlay(data.playerIndex, data.card.color, isWild);
        setTimeout(() => {
            isAnimating = false;
            processQueuedState();
        }, 400); // animasyon süresi
    });

    socket.on('cardDrawn', (data) => {
        isAnimating = true;
        if (data.socketId === socket.id) {
            // Benim kart çektiğim animasyon (deste -> el)
            const cards = document.querySelectorAll('.hand-card');
            const lastCard = cards[cards.length - 1]; // Yeni eklenen kart varsayımı
            if (lastCard) animateCardDraw(lastCard);
            setTimeout(() => {
                isAnimating = false;
                processQueuedState();
            }, 300);
        } else {
            // Rakip kart çekti
            for (let i = 0; i < data.count; i++) {
                setTimeout(() => {
                    animateOpponentDraw(data.playerIndex);
                }, i * 150); // ardışık çekme
            }
            setTimeout(() => {
                isAnimating = false;
                processQueuedState();
            }, 300 + (data.count * 150));
        }
    });

    socket.on('roomUpdated', (data) => {
        clientState.players = data.players;
        if (document.getElementById('screen-lobby').classList.contains('active')) {
            updateLobbyUI();
        }
    });

    socket.on('gameStarted', () => {
        showScreen('screen-game');
    });

    socket.on('gameStateUpdate', (state) => {
        if (isAnimating) {
            queuedState = state; // Animasyon bitince renderla
        } else {
            gameState = state;
            if (gameState.phase === 'playing' || gameState.phase === 'turnTransition') {
                showScreen('screen-game');
                renderGame();
            }
        }
    });

    socket.on('showToast', (msg) => {
        showToast(msg);
    });

    socket.on('gameEnded', (winnerInfo) => {
        document.getElementById('winner-name').textContent = winnerInfo.name;

        // Reset play again button
        const btn = document.getElementById('btn-play-again');
        btn.innerHTML = '<span class="btn-icon">🔄</span> Tekrar Oyna';
        btn.disabled = false;

        showScreen('screen-winner');
        triggerConfetti();
    });
}

// ── Oyun Mantığı Etkileşimi (UI -> Backend) ──
let pendingWildCardId = null;

function onCardClick(card, element) {
    if (gameState.phase !== 'playing') return;
    const me = getCurrentPlayer();
    const activePlayer = getActivePlayer();
    if (!me || me.socketId !== activePlayer.socketId) return; // Sıra bende değil

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    // Renk/Sayı eşleşmesi (rules.js'i sadece arayüz kontrolü için kullanıyoruz)
    if (!canPlayCard(card, topCard, gameState.currentColor)) {
        shakeElement(element);
        return;
    }

    // Renk seçtirme (Wild)
    if (card.color === 'wild') {
        pendingWildCardId = card.id;
        document.getElementById('modal-color').classList.remove('hidden');
    } else {
        // Uçma animasyonunu başlat ve bitince sokete bildir
        animateCardPlay(element, () => {
            socket.emit('playCard', { roomId: clientState.roomId, cardId: card.id });
        });
    }
}

// ── Hata / Bildirim Gösterimi ──
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toast-text');

    text.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}
