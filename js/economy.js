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
//   - Om fickan tar slut MEDAN man bär en last: fickan laddas om
//     till $20 genom att gå tillbaka till Kungen. Lasten/kistan
//     påverkas INTE — inga framsteg går förlorade.
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

// ---- Ladda om fickan hos Kungen (medan man bär last) ----
// Regel (bekräftad): om fickan tar slut på väg till Esset går man
// tillbaka till Kungen och får $20 — gratis, kistan/lasten påverkas
// inte, och man behåller sin plats i framstegen mot vinst.
export function refillPocketAtKing(playerId) {
    assertCanAct(playerId);
    const player = getPlayer(playerId);

    if (!player.hasCargo) {
        // Inget fel i sig, men det finns inget att "ladda om för" —
        // ui.js bör bara visa denna knapp när hasCargo är true.
        return { result: EconomyResult.NO_CARGO_TO_DROP };
    }

    mutatePlayer(playerId, { pocket: START_POCKET });
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
// Används för tull, viten, eller manuella överföringar — precis som
// "Överför pengar"-knappen i v1, men nu med stöd för att betala
// stadsbanken direkt (regeln om oägd färg vid 2-3 spelare).
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
