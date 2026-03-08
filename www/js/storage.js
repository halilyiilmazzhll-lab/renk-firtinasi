/* ══════════════════════════════════════
   STORAGE.JS — localStorage Yardımcıları
   ══════════════════════════════════════ */

const STORAGE_KEY = 'renk_firtinasi_save';

function saveGame() {
    try {
        const data = JSON.stringify({
            ...gameState,
            savedAt: Date.now()
        });
        localStorage.setItem(STORAGE_KEY, data);
        return true;
    } catch (e) {
        return false;
    }
}

function loadGame() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

function clearSavedGame() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // localStorage erişilemiyorsa sessizce geç
    }
}

function hasSavedGame() {
    return !!localStorage.getItem(STORAGE_KEY);
}
