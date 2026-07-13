// ============================================================
// combat.js
// ============================================================
// Ansvar: reglerna för gatuslagsmål. Själva tärningsanimationen
// (snabbt växlande siffror) sköts av ui.js, som sedan anropar
// resolveFight() med de two slutgiltiga tärningsvärdena.
//
// Regler (oförändrade från v1, bara flyttade hit och renodlade):
//   - Vinnaren tar $10 från förlorarens ficka.
//   - Oavgjort: försvararen (den attackerade) vinner.
//   - Förloraren flyttar sin FYSISKA pjäs tillbaka till sitt Ess
//     eller sin Kung (spelarens eget val, appen styr inte brädet).
//   - Om förloraren har mindre än $10 i fickan: allt de har går
//     till vinnaren istället, och förlorarens ficka laddas om
//     till $20 (samma "pity"-regel som v1).
//
// OBS: appen kan inte se om två pjäser fysiskt står på samma ruta
// (ingen brädpositionering, bekräftat av speldesignern). Det är
// spelarna själva som avgör vid bordet att ett slagsmål ska ske,
// och sedan trycker "Slagsmål" i appen för att avgöra utfallet.
// ============================================================

import { getPlayer, mutatePlayer, START_POCKET } from './state.js';
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
        mutatePlayer(winnerId, { pocket: winner.pocket + amountTransferred });
        mutatePlayer(loserId, { pocket: loser.pocket - amountTransferred });
    }

    return {
        winnerId,
        loserId,
        isDraw,
        amountTransferred,
        loserWentBankrupt
    };
}
