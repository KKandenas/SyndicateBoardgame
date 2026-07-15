// ============================================================
// state.js
// ============================================================
// Detta är EN källa till sanning för hela spelet.
// Regler:
//   - Ingen DOM-kod här. Ingen alert(), ingen document.*.
//   - Alla ändringar av state ska gå via funktionerna i denna fil
//     (aldrig players[id].pocket = X direkt från ui.js).
//   - Detta gör det säkert att senare koppla på Firebase: skriv
//     state hit, låt notify() trigga ui.updateUI(), klart.
// ============================================================

// ---- Spelbalans-konstanter (ändra ENDAST efter godkännande) ----
export const START_POCKET = 20;
export const CARGO_VALUE = 1000;      // Värdet på en skattkista
export const WINNING_VAULT = 3000;    // 3 kistor = vinst
export const CITY_BANK_START = 100000; // Praktiskt oändligt "startkapital" för staden

// Turordning runt det fysiska brädet, medurs: Nightspades -> Diamond ->
// Crimson -> Iron Clovers. Detta styr BÅDE vilka spelar-id:n som blir
// aktiva vid 2-3 spelare, OCH i vilken ordning turen går.
export const BOARD_ORDER = [1, 4, 2, 3];

export const SUITS = {
    1: 'spades',
    2: 'hearts',
    3: 'clubs',
    4: 'diamonds'
};

// Riktning: vad spelaren är på väg att göra just nu.
// "toKing"  = på väg för att hämta en last ($1000) hos sin Kung
// "toAce"   = bär på en last, på väg att lämna den på sitt Ess
export const DIRECTION = {
    TO_KING: 'toKing',
    TO_ACE: 'toAce'
};

// ---- Fabriksfunktion för en enskild spelare ----
function createPlayer(id, active) {
    return {
        id,
        suit: SUITS[id],
        active,                     // med i denna omgång (stöd för 2-4 spelare)
        direction: DIRECTION.TO_KING,
        pocket: START_POCKET,       // kontanter i fickan, kan gå ner mot 0
        vault: 0,                   // säkrade kistor (separat frÃ¥n pocket, se regel nedan)
        hasCargo: false,            // bär just nu på en $1000-last i fickan
        skipNextTurn: false         // t.ex. efter att ha landat på en Dam/Bar
    };
}

// ---- Hela spelets state ----
let state = {
    players: {
        1: createPlayer(1, true),
        2: createPlayer(2, true),
        3: createPlayer(3, true),
        4: createPlayer(4, true)
    },
    cityBank: CITY_BANK_START,
    activePlayerId: 1,
    turnOrder: [1, 2, 3, 4],     // ordning spelare turas om i (endast active spelare ingår)
    gameOver: false,
    winnerId: null,
    language: 'sv',
    deviceMode: null,             // 'ipad' | 'iphone'
    lastDiceRoll: null,
    pendingCopMove: null,        // se movement.js — håller reda på om ett knektval väntar
    economicCrisisDrawerId: null // NYTT: satt till spelar-id när "Ekonomisk Kris" dras,
                                  // rensas när det blir samma spelares tur igen (se turnOrder.js)
};

// ---- Pub/sub så UI kan reagera på ändringar utan tight koppling ----
const listeners = [];

export function subscribe(listener) {
    listeners.push(listener);
}

function notify() {
    listeners.forEach(fn => fn(state));
}

// ---- Läsfunktioner (read-only access) ----
export function getState() {
    return state;
}

export function getPlayer(id) {
    return state.players[id];
}

export function getActivePlayer() {
    return state.players[state.activePlayerId];
}

export function getActivePlayers() {
    return Object.values(state.players).filter(p => p.active);
}

// ---- Setup: antal spelare (2-4) ----
// Regel: inaktiva spelares Kung/Ess ligger kvar fysiskt på bordet,
// men appen räknar dem inte i turordning eller vinstvillkor.
// Tull som annars gått till en inaktiv spelare tillfaller stadsbanken (se economy.js).
export function setupPlayerCount(count) {
    if (count < 2 || count > 4) {
        throw new Error('Antal spelare måste vara 2-4');
    }
    const activeIds = BOARD_ORDER.slice(0, count);
    for (let id = 1; id <= 4; id++) {
        state.players[id].active = activeIds.includes(id);
    }
    state.turnOrder = activeIds;
    state.activePlayerId = activeIds[0];
    notify();
}

// ---- Generell mutationsfunktion, används av economy/combat/arrest/movement ----
// applyChanges tar en lista av { path, value } och skriver dem säkert.
// Exempel: mutatePlayer(2, { pocket: 30, hasCargo: true })
export function mutatePlayer(id, changes) {
    const player = state.players[id];
    if (!player) {
        throw new Error(`Okänd spelare: ${id}`);
    }
    Object.assign(player, changes);
    notify();
}

export function mutateCityBank(delta) {
    state.cityBank += delta;
    notify();
}

export function setActivePlayerId(id) {
    state.activePlayerId = id;
    notify();
}

export function setLastDiceRoll(value) {
    state.lastDiceRoll = value;
    notify();
}

export function setPendingCopMove(data) {
    state.pendingCopMove = data;
    notify();
}

// Ekonomisk Kris-händelsekortet: dubbel tull tills det blir samma
// spelares (drawerId:s) tur igen. Rensas automatiskt av advanceTurn()
// i turnOrder.js när den vändan kommer runt.
export function setEconomicCrisis(drawerId) {
    state.economicCrisisDrawerId = drawerId;
    notify();
}

export function clearEconomicCrisis() {
    state.economicCrisisDrawerId = null;
    notify();
}

export function setLanguage(lang) {
    state.language = lang;
    notify();
}

export function setDeviceMode(mode) {
    state.deviceMode = mode;
    notify();
}

// ---- Vinstkontroll ----
// Regel: 3 säkrade kistor ($3000 i vault) = spelet slut, spelaren vinner.
export function checkWinCondition(id) {
    const player = state.players[id];
    if (player.vault >= WINNING_VAULT && !state.gameOver) {
        state.gameOver = true;
        state.winnerId = id;
        notify();
        return true;
    }
    return false;
}

// ---- Reset ----
export function resetGame() {
    const previousCount = state.turnOrder.length;
    state.players = {
        1: createPlayer(1, true),
        2: createPlayer(2, true),
        3: createPlayer(3, true),
        4: createPlayer(4, true)
    };
    state.cityBank = CITY_BANK_START;
    state.gameOver = false;
    state.winnerId = null;
    state.lastDiceRoll = null;
    state.pendingCopMove = null;
    state.economicCrisisDrawerId = null;
    setupPlayerCount(previousCount); // notify() körs i setupPlayerCount
}
