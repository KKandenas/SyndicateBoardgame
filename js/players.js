// ============================================================
// players.js
// ============================================================
// Ansvar: allt som handlar om SPELARE som begrepp — hur många är
// med (2-4), vem äger en färg, enkla härledda uppgifter om en
// spelare (bär last? vilken riktning?).
//
// Faktiska pengaflöden (hämta/lämna last, betalningar, böter)
// ligger i economy.js. Den här filen svarar bara på frågor om
// spelarna, den flyttar inga pengar.
// ============================================================

import { getState, getPlayer, getActivePlayers, setupPlayerCount, DIRECTION } from './state.js';

// CSS-färgvariabler per gäng, används av ui.js för dynamisk styling
// utan att behöva hårdkoda klasser per spelar-id i markupen.
export const PLAYER_COLORS = {
    1: 'var(--spades-color)',
    2: 'var(--hearts-color)',
    3: 'var(--clovers-color)',
    4: 'var(--diamonds-color)'
};

// ---- Setup ----

// Startar en ny omgång med 2-4 spelare. Anropas från startskärmen.
// Regel: spelare som INTE är med (t.ex. spelare 3-4 i ett 2-spelarparti)
// har fortfarande sin Kung/Ess kvar fysiskt på bordet (bekräftat av
// speldesignern), men räknas inte i turordning eller vinstvillkor.
export function startNewGame(playerCount) {
    setupPlayerCount(playerCount);
}

// ---- Frågor om enskilda spelare ----

export function isActive(playerId) {
    return getPlayer(playerId).active;
}

export function isCarryingCargo(playerId) {
    return getPlayer(playerId).hasCargo;
}

export function getDirection(playerId) {
    return getPlayer(playerId).direction;
}

export function isHeadingToKing(playerId) {
    return getDirection(playerId) === DIRECTION.TO_KING;
}

export function isHeadingToAce(playerId) {
    return getDirection(playerId) === DIRECTION.TO_ACE;
}

// ---- Ägarskap per färg ----
// Används av economy.js för regeln: "vid färre än 4 spelare tillfaller
// pengar till stadens kassa om man hamnar på en färg ingen äger".
export function getOwnerOfSuit(suitPlayerId) {
    const player = getPlayer(suitPlayerId);
    return player.active ? player : null;
}

export function isSuitOwned(suitPlayerId) {
    return getOwnerOfSuit(suitPlayerId) !== null;
}

// ---- Listor ----

// Alla aktiva spelare utom en given (t.ex. för att bygga
// mottagarlistor i betalnings-/arresterings-/slagsmålsmodaler).
export function getOtherActivePlayers(excludingId) {
    return getActivePlayers().filter(p => p.id !== Number(excludingId));
}

export function getAllPlayerIds() {
    return [1, 2, 3, 4];
}

export function getActivePlayerCount() {
    return getActivePlayers().length;
}
