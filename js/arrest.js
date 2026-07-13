// ============================================================
// arrest.js
// ============================================================
// Ansvar: vad som händer när en spelare blir haffad.
//
// ÄNDRAT från v1 (bekräftat): det finns ingen spelarbank längre,
// så beslagtagna pengar går alltid till STADSBANKEN, aldrig till
// den arresterande spelarens egna tillgångar.
//
// Turordning: eftersom bara den aktiva spelaren har klickbara
// knappar (turnOrder.js), är det alltid den aktiva spelaren som
// utlöser en arrestering — antingen för att:
//   a) deras EGEN pjäs landade på en stillastående polis, eller
//   b) deras EGEN polis (flyttad via movement.js vid tärning 5/6,
//      eller via "Mutor"-händelsekortet) landade på en motståndare.
// I båda fallen väljer den aktiva spelaren offer (victimId) och
// vilken polis som grep dem (copOwnerId) i en modal — precis som
// "Vem gjorde gripandet?"-flödet i v1, fast copOwnerId är redan
// förifyllt med den aktiva spelaren i fall (b).
//
// Appen flyttar inte fysiska pjäser. Regeln "offrets pjäs skickas
// tillbaka till sin Kung" är oförändrad men utförs av spelarna
// vid bordet.
// ============================================================

import { getPlayer, mutatePlayer, mutateCityBank, START_POCKET } from './state.js';
import { assertCanAct } from './turnOrder.js';

export const ArrestResult = {
    LOOTED: 'looted',       // offret hade extra pengar, de beslagtogs
    NO_LOOT: 'noLoot'        // offret hade bara sina grund-$20, inget att ta
};

// Generellt arresteringsflöde. actingPlayerId måste vara den aktiva
// spelaren (skyddar mot fel-tur-anrop). victimId och copOwnerId väljs
// i UI:ts modal.
export function executeArrest(actingPlayerId, victimId, copOwnerId) {
    assertCanAct(actingPlayerId);

    const victim = getPlayer(victimId);

    if (victim.pocket > START_POCKET) {
        const loot = victim.pocket - START_POCKET;
        mutateCityBank(loot);
        mutatePlayer(victimId, { pocket: START_POCKET });
        return { result: ArrestResult.LOOTED, loot, victimId, copOwnerId };
    }

    // Offret hade redan bara sina $20 — inget att beslagta,
    // men de skickas ändå till häktet (fysiskt, hanteras av spelarna).
    return { result: ArrestResult.NO_LOOT, loot: 0, victimId, copOwnerId };
}

// Genväg för flödet efter en knektflytt (movement.js): där är
// den gripande polisen alltid den aktiva spelarens egen.
export function executeArrestFromCopMove(activePlayerId, victimId) {
    return executeArrest(activePlayerId, victimId, activePlayerId);
}
