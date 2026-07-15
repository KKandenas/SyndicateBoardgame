// ============================================================
// combat.js
// ============================================================
// Ansvar: reglerna för gatuslagsmål. Själva tärningsanimationen
// (snabbt växlande siffror) sköts av ui.js, som sedan anropar
// resolveFight() med de two slutgiltiga tärningsvärdena.
//
// Regler:
//   - Vinnaren tar $10 från förlorarens ficka.
//   - Oavgjort: försvararen (den attackerade) vinner.
//   - Förloraren flyttar sin FYSISKA pjäs tillbaka — inget eget val,
//     det styrs av deras riktning: på väg mot Ess (TO_ACE) -> tillbaka
//     till Kung. På väg mot Kung (TO_KING) -> tillbaka till Ess.
//   - Om förloraren har mindre än $10 i fickan: allt de har går
//     till vinnaren istället, och förlorarens ficka laddas om
//     till $20 (samma "pity"-regel som v1).
//   - NYTT: går förloraren tillbaka till sitt Ess (dvs. riktning var
//     TO_KING) och har mindre än $20 kvar efter transaktionen, fylls
//     fickan på till $20. Gäller INTE när man går tillbaka till Kung
//     — där får man klara sig med vad som blir kvar.
//
// OBS: appen kan inte se om två pjäser fysiskt står på samma ruta
// (ingen brädpositionering, bekräftat av speldesignern). Det är
// spelarna själva som avgör vid bordet att ett slagsmål ska ske,
// och sedan trycker "Slagsmål" i appen för att avgöra utfallet.
// ============================================================

import { getPlayer, mutatePlayer, START_POCKET, DIRECTION } from './state.js';
import { assertCanAct } from './turnOrder.js';

const FIGHT_STAKE = 10;
const PITY_THRESHOLD = 10; // om förloraren har mindre än detta i fickan

export function resolveFight(attackerId, defenderId, attackerRoll, defenderRoll) {
    assertCanAct(attackerId);

    let winnerId, loserId, isDraw = false;

    if (attackerRoll > defenderRoll) {
        winnerId = attackerId;
        loserId = defenderId;
    } else {
        // Försvararen vinner både vid högre slag OCH vid oavgjort.
        winnerId = defenderId;
        loserId = attackerId;
        isDraw = (attackerRoll === defenderRoll);
    }

    const loser = getPlayer(loserId);
    const winner = getPlayer(winnerId);

    let amountTransferred;
    let loserWentBankrupt = false;

    if (loser.pocket < PITY_THRESHOLD) {
        amountTransferred = loser.pocket;
        mutatePlayer(winnerId, { pocket: winner.pocket + amountTransferred });
        mutatePlayer(loserId, { pocket: START_POCKET });
        loserWentBankrupt = true;
    } else {
        amountTransferred = FIGHT_STAKE;
        const pocketAfter = loser.pocket - amountTransferred;
        mutatePlayer(winnerId, { pocket: winner.pocket + amountTransferred });

        // Går förloraren tillbaka till sitt Ess (riktning var TO_KING)
        // och har mindre än $20 kvar: fyll på till $20.
        const goingToAce = loser.direction === DIRECTION.TO_KING;
        if (goingToAce && pocketAfter < START_POCKET) {
            mutatePlayer(loserId, { pocket: START_POCKET });
        } else {
            mutatePlayer(loserId, { pocket: pocketAfter });
        }
    }

    return {
        winnerId,
        loserId,
        isDraw,
        amountTransferred,
        loserWentBankrupt
    };
}
