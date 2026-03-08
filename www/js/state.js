/* ══════════════════════════════════════
   STATE.JS — İstemci Durumu
   ══════════════════════════════════════ */

const COLORS = ['red', 'blue', 'green', 'yellow'];
const SYMBOLS = { red: '♦', blue: '●', green: '▲', yellow: '★', wild: '✦' };
const COLOR_NAMES = { red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı' };
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f1c40f'];

const ACTION_LABELS = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '✦',
  wildDraw4: '+4'
};

// Socket objesi app.js'de tanımlanır

// İstemci durumu
let clientState = {
  playerName: '',
  roomId: null,
  isHost: false,
  players: [] // Lobideki oyuncular
};

// Sunucudan gelen oyun durumu
let gameState = null;

function getCurrentPlayer() {
  if (!gameState) return null;
  // Kendi oyuncumu bul (isMe objesinde işaretlenmişti)
  return gameState.players.find(p => p.isMe);
}

function getActivePlayer() {
  if (!gameState) return null;
  return gameState.players[gameState.currentPlayerIndex];
}
