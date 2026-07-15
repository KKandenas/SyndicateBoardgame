// ============================================================
// turnOrder.js
// ============================================================
// Ansvar: vems tur det är, och att bara den spelaren får agera.
//
// Turbyte är MANUELLT (bekräftat): spelaren trycker "Nästa spelare"
// själv efter att ha flyttat sin pjäs och slutfört ev. handling
// (överföring, slagsmål, arrestering).
//
// Denna fil känner även till "stå över nästa runda"-regeln (Dam/Bar,
// befintlig regel från v1) via players.skipNextTurn.
//
// Inga DOM-anrop här. ui.js frågar isActionAllowed() innan den
// aktiverar knappar, och anropar advanceTurn() när "Nästa spelare"
// klickas.
// ============================================================

import { getState, mutatePlayer, setActivePlayerId, clearEconomicCrisis } from './state.js';

// ---- Kärnfråga: får denna spelare agera just nu? ----
// Används av ui.js för att disabla/enabla knappar per spelarpanel,
// och av alla action-funktioner (economy/combat/arrest) som ett
// sista skyddsvillkor innan de ändrar state.
export function isActionAllowed(playerId) {
    const state = getState();
    if (state.gameOver) return false;
    return Number(playerId) === state.activePlayerId;
}

// Kastar ett tydligt fel om en handling försöker köras i fel tur.
// Regelfilerna (economy.js, combat.js, arrest.js) anropar denna
// högst upp i varje publik funktion — det är vårt skydd mot att
// t.ex. en försenad Firebase-uppdatering råkar utföra en handling
// åt fel spelare.
export function assertCanAct(playerId) {
    if (!isActionAllowed(playerId)) {
        throw new Error(`Spelare ${playerId} kan inte agera — det är inte deras tur.`);
    }
}

export function getCurrentTurnPlayerId() {
    return getState().activePlayerId;
}

// ---- Turbyte ----
// Manuellt: anropas när spelaren trycker "Nästa spelare".
// Hoppar automatiskt över spelare med skipNextTurn = true (Bar-regeln)
// och konsumerar deras flagga så de är med igen nästa gång.
export function advanceTurn() {
    const state = getState();
    if (state.gameOver) return;

    const order = state.turnOrder; // t.ex. [1,2,3,4] eller [1,3] vid 2 spelare
    const currentIndex = order.indexOf(state.activePlayerId);
    let nextIndex = (currentIndex + 1) % order.length;
    let nextPlayerId = order[nextIndex];

    // Säkerhetsspärr: max ett helt varv för att undvika oändlig loop
    // om samtliga spelare skulle ha skipNextTurn = true samtidigt.
    let safetyCounter = 0;

    while (getState().players[nextPlayerId].skipNextTurn && safetyCounter < order.length) {
        // Konsumera flaggan — spelaren har nu stått över sin runda.
        mutatePlayer(nextPlayerId, { skipNextTurn: false });
        nextIndex = (nextIndex + 1) % order.length;
        nextPlayerId = order[nextIndex];
        safetyCounter++;
    }

    // Ekonomisk Kris upphör när det blir samma spelares tur igen
    // (den som drog kortet) — se ui.js där krisen sätts vid dragning.
    if (state.economicCrisisDrawerId !== null && nextPlayerId === state.economicCrisisDrawerId) {
        clearEconomicCrisis();
    }

    setActivePlayerId(nextPlayerId);
}

// Sätter skipNextTurn-flaggan för en spelare (t.ex. när de landar
// på en Dam/Bar). Ren dataändring, ingen alert — ui.js visar
// meddelandet baserat på att flaggan sattes.
export function markSkipNextTurn(playerId) {
    mutatePlayer(playerId, { skipNextTurn: true });
}
