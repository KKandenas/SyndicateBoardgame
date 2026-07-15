// ============================================================
// movement.js
// ============================================================
// Ansvar: tolka ett tärningsslag enligt den NYA regeln (ersätter
// v1:s slumpmässiga 35%-händelser):
//
//   1-4 : spelaren går N steg (N = tärningsvärdet)
//   5   : spelaren går 4 steg, VÄLJER SEDAN:
//           a) flytta egen knekt 1 steg, eller
//           b) dra ett händelsekort
//   6   : spelaren går 4 steg, VÄLJER SEDAN:
//           a) flytta egen knekt 2 steg, eller
//           b) dra ett händelsekort
//
// Max antal steg en spelare någonsin flyttar sin egen pjäs är 4.
//
// Appen känner INTE till brädets fysiska layout (bekräftat av
// speldesignern) — "gå N steg" är en instruktion till spelarna,
// inte en animation. Denna fil håller reda på VILKET VAL som
// väntar (pendingCopMove i state), inte var pjäser fysiskt står.
//
// Efter en knektflytt kan knekten ha "landat" på en motståndare
// (fysiskt, vid bordet) — det flödet (fråga "landade den på
// någon?" -> ev. arrestering) orkestreras av ui.js, som anropar
// arrest.js direkt. movement.js känner inte till arrest.js, för
// att undvika onödig koppling mellan modulerna.
// ============================================================

import { setPendingCopMove, getState } from './state.js';

export const COP_CHOICE = {
    MOVE_COP_ONE: 'moveCop1',   // endast vid tärning 5
    MOVE_COP_TWO: 'moveCop2',   // endast vid tärning 6
    DRAW_EVENT: 'drawEvent'     // vid både 5:a och 6:a
};

const MAX_STEPS = 4;

// Tolkar ett tärningsslag och returnerar vad som ska hända.
// Skriver ev. väntande polisval till state så UI kan rendera
// rätt modal. Detta är den enda "entry point" ui.js behöver
// anropa direkt efter ett tärningsslag.
export function resolveDiceRoll(rollValue) {
    if (rollValue < 1 || rollValue > 6) {
        throw new Error(`Ogiltigt tärningsvärde: ${rollValue}`);
    }

    // 1-4: enkelt fall, gå N steg, inget polisval.
    if (rollValue <= 4) {
        setPendingCopMove(null);
        return {
            steps: rollValue,
            requiresCopChoice: false,
            options: []
        };
    }

    // 5: flytta knekt 1 steg ELLER dra händelsekort.
    // 6: flytta knekt 1 steg, ELLER 2 steg, ELLER dra händelsekort.
    const options = rollValue === 5
        ? [COP_CHOICE.MOVE_COP_ONE, COP_CHOICE.DRAW_EVENT]
        : [COP_CHOICE.MOVE_COP_ONE, COP_CHOICE.MOVE_COP_TWO, COP_CHOICE.DRAW_EVENT];

    setPendingCopMove({ roll: rollValue, options, resolved: false });

    return {
        steps: MAX_STEPS,
        requiresCopChoice: true,
        options
    };
}

// Spelaren har gjort sitt val i 5:an/6:an-modalen. Returnerar vad
// ui.js behöver göra härnäst: hur många steg knekten flyttas, och
// om ett händelsekort ska dras (events.js ansvarar för själva kortet).
export function resolveCopChoice(choiceId) {
    const pending = getState().pendingCopMove;
    if (!pending || !pending.options.includes(choiceId)) {
        throw new Error('Inget matchande polisval väntar just nu.');
    }

    let copSteps = 0;
    let drawsEvent = false;

    switch (choiceId) {
        case COP_CHOICE.MOVE_COP_ONE:
            copSteps = 1;
            break;
        case COP_CHOICE.MOVE_COP_TWO:
            copSteps = 2;
            break;
        case COP_CHOICE.DRAW_EVENT:
            drawsEvent = true;
            break;
    }

    setPendingCopMove(null);

    return {
        copSteps,           // 0 = knekten flyttas inte alls den här gången
        drawsEvent,          // true = ui.js ska anropa events.js för att dra kort
        copMoved: copSteps > 0  // true = ui.js bör fråga "landade knekten på någon?"
    };
}

export function hasPendingCopChoice() {
    return getState().pendingCopMove !== null;
}
