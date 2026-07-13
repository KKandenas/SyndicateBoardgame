// ============================================================
// dice.js
// ============================================================
// Ansvar: ENBART tärningen som mekanik — slumpa fram ett värde
// 1-6 och veta hur prickarna ska visas. Ingen spelregeltolkning
// här (t.ex. "vid 5 får man göra X") — det hör hemma i movement.js,
// som anropar rollDie() och sedan bestämmer vad resultatet betyder.
//
// Ingen DOM-kod. ui.js sköter animationen (växla snabbt mellan
// värden) och anropar sedan rollDie() en gång för det riktiga,
// slutgiltiga resultatet.
// ============================================================

import { setLastDiceRoll } from './state.js';

// Vilka av de 9 prickpositionerna (3x3-rutnät, id 1-9) som ska
// visas för respektive tärningsvärde. Samma mönster som v1.
export const DICE_DOT_PATTERNS = {
    1: [5],
    2: [3, 7],
    3: [3, 5, 7],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
};

// Slumpar fram ett tärningsvärde 1-6. Ren funktion, inget state.
export function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

// Utför ett "riktigt" tärningsslag: slumpar, sparar resultatet i
// state (så UI/andra moduler kan läsa det via getState().lastDiceRoll),
// och returnerar värdet direkt för den som ropade (typiskt movement.js).
export function performRoll() {
    const result = rollDie();
    setLastDiceRoll(result);
    return result;
}

export function getDotsForValue(value) {
    return DICE_DOT_PATTERNS[value] ?? [];
}
