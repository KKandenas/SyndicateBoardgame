// ============================================================
// economy.js
// ============================================================
// Ansvar: alla pengaflöden utom slagsmål och arrestering (de har
// egna filer eftersom de även involverar "vinnare/förlorare"-logik).
//
// Centrala regler som implementeras här (alla bekräftade):
//   - Ingen bank per spelare längre — bara EN stadsbank (cityBank).
//   - "Lasten" är en skattkista värd $1000, skild från fickpengar.
//     Hämtas hos Kungen (kostar $1000 ur cityBank), lämnas i kistan
//     (vault) hos Esset. Max en last i taget (oförändrat från v1).
//     Fickpengarna påverkas ALDRIG av att hämta/lämna last — spelaren
//     behåller det de har i fickan oavsett (ingen separat "ladda om
//     ficka"-knapp längre, playtest-beslut).
//   - Betalningar mellan spelare kan även gå till stadsbanken
//     direkt (används när man landar på en färg ingen äger, i
//     spel med färre än 4 spelare).
//   - Bankrutt (kan inte betala en avgift): fickan nollställs till
//     $20, resten av spelarens tillgångar (vault, ev. last) rörs ej.
//
// Alla publika funktioner börjar med assertCanAct() — det är vårt
// skydd mot att en handling utförs åt fel spelare, t.ex. via en
// felaktig/försenad Firebase-uppdatering.
// ============================================================

import {
    getPlayer,
    mutatePlayer,
    mutateCityBank,
    getState,
    checkWinCondition,
    CARGO_VALUE,
    START_POCKET,
    DIRECTION
} from './state.js';
import { assertCanAct } from './turnOrder.js';
import { getOtherActivePlayers } from './players.js';

export const CITY_BANK_RECIPIENT = 'cityBank';

// ---- Resultattyper (så ui.js kan visa rätt meddelande utan att
// själva gissa vad som hände) ----
export const EconomyResult = {
    OK: 'ok',
    ALREADY_CARRYING: 'alreadyCarrying',
    NO_CARGO_TO_DROP: 'noCargoToDrop',
    CITY_BANK_EMPTY: 'cityBankEmpty',
    BANKRUPT: 'bankrupt',
    WON: 'won'
};

// ---- Hämta last hos Kungen ----
// Regel: kostar $1000 ur stadsbanken, kan bara bära en last åt gången.
export function getCargo(playerId) {
    assertCanAct(playerId);
    const player = getPlayer(playerId);

    if (player.hasCargo) {
        return { result: EconomyResult.ALREADY_CARRYING };
    }
    if (getState().cityBank < CARGO_VALUE) {
        return { result: EconomyResult.CITY_BANK_EMPTY };
    }

    mutateCityBank(-CARGO_VALUE);
    mutatePlayer(playerId, {
        hasCargo: true,
        direction: DIRECTION.TO_ACE
    });

    return { result: EconomyResult.OK };
}

// ---- Lämna last i kistan hos Esset ----
export function dropCargoInVault(playerId) {
    assertCanAct(playerId);
    const player = getPlayer(playerId);

    if (!player.hasCargo) {
        return { result: EconomyResult.NO_CARGO_TO_DROP };
    }

    mutatePlayer(playerId, {
        vault: player.vault + CARGO_VALUE,
        hasCargo: false,
        direction: DIRECTION.TO_KING
    });

    const won = checkWinCondition(playerId);
    return { result: won ? EconomyResult.WON : EconomyResult.OK };
}

// ---- Betalning mellan spelare (eller till stadsbanken) ----
// recipientId kan vara ett spelar-id (1-4) eller CITY_BANK_RECIPIENT.
// Används för tull, viten, eller manuella överföringar. Den AKTIVA
// spelaren betalar FRÅN sin egen ficka TILL vald mottagare, med stöd
// för att betala stadsbanken direkt (regeln om oägd färg vid 2-3 spelare).
export function transferMoney(payerId, recipientId, amount) {
    assertCanAct(payerId);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Ogiltigt belopp.');
    }

    const payer = getPlayer(payerId);

    if (payer.pocket < amount) {
        // Bankrutt: fickan räcker inte. Fickan nollställs till $20.
        // OBS: vault och hasCargo rörs aldrig av bankrutt.
        mutatePlayer(payerId, { pocket: START_POCKET });
        return { result: EconomyResult.BANKRUPT };
    }

    mutatePlayer(payerId, { pocket: payer.pocket - amount });

    if (recipientId === CITY_BANK_RECIPIENT) {
        mutateCityBank(amount);
    } else {
        const recipient = getPlayer(recipientId);
        mutatePlayer(recipientId, { pocket: recipient.pocket + amount });
    }

    return { result: EconomyResult.OK };
}

// Bygger en mottagarlista för betalningsmodalen: alla andra aktiva
// spelare + alltid möjligheten att betala stadsbanken direkt.
export function getPaymentRecipients(payerId) {
    const others = getOtherActivePlayers(payerId).map(p => ({
        id: p.id,
        isCityBank: false
    }));
    return [...others, { id: CITY_BANK_RECIPIENT, isCityBank: true }];
}

// ---- Ficktjuv-händelsekortet ----
// Regel: den aktiva spelaren väljer VILKEN motståndare pengarna tas
// från (staden kan inte väljas — bara andra spelare). Tar $10, eller
// hela offrets ficka om den innehåller mindre än $10.
//
// NYTT: töms offrets ficka helt (de hade $10 eller mindre) räknas
// det som bankrutt — precis som vid misslyckad betalning eller
// slagsmåls-pity: fickan laddas om till $20, och ui.js visar den
// blockerande bankrutt-popupen (targetWentBankrupt = true).
const PICKPOCKET_AMOUNT = 10;

export function executePickpocket(activePlayerId, targetId) {
    assertCanAct(activePlayerId);

    const target = getPlayer(targetId);
    const active = getPlayer(activePlayerId);
    const originalPocket = target.pocket;
    const stolen = Math.min(originalPocket, PICKPOCKET_AMOUNT);
    let targetWentBankrupt = false;

    if (stolen > 0) {
        mutatePlayer(activePlayerId, { pocket: active.pocket + stolen });
        const remaining = originalPocket - stolen;
        if (remaining <= 0) {
            targetWentBankrupt = true;
            mutatePlayer(targetId, { pocket: START_POCKET });
        } else {
            mutatePlayer(targetId, { pocket: remaining });
        }
    }

    return { stolen, targetId, targetWentBankrupt };
}
