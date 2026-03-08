/* ══════════════════════════════════════
   APP.JS — İstemci Oyun Akışı & Ağ
   ══════════════════════════════════════ */

// Dinamik olarak bulunduğu sunucuya bağlanır (Localhost veya Render veya TWA)
const socket = io({ transports: ['websocket', 'polling'] });

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    loadStoredName();
    setupEventListeners();
    setupSocketListeners();
    showScreen('screen-menu');
}

function loadStoredName() {
    try {
        const name = localStorage.getItem('duno_player_name') || '';
        if (name) {
            document.getElementById('input-player-name').value = name;
        }
    } catch (e) { }
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
            socket.emit('createRoom', nameInput, (res) => {
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

            socket.emit('joinRoom', { roomId: roomCode, playerName: nameInput }, (res) => {
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
        // Sadece sayfayı yenilemek en temizi
        window.location.reload();
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
        // Artık "Hazırım" ekranı yerine herkes kendi telefonunda oynuyor.
        // Ekrana geldiğinde direkt oynayabilir. Fakat sırası gelmesini bekleyebilir.
        // Sunucudan gameStateUpdate gelse bile UI çiziliyor.
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
        // Çıktıktan sonra yeniden host olmak için
        window.location.reload();
    });

    document.getElementById('btn-to-menu').addEventListener('click', () => {
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
