// ============================================================
// events.js
// ============================================================
// Ansvar: händelsekortspoolen (Noir-kort) och logiken för att
// dra ett slumpmässigt kort ur den.
//
// ÄNDRAT från v1 enligt bekräftat beslut:
//   - Patrullering och Utryckning borttagna (var ren slumpmässig
//     polisflytt 1-2 steg — den mekaniken hanteras nu istället
//     deterministiskt av movement.js vid tärningsslag 5/6).
//   - Insiderjobb borttaget.
//   - Mutor inom polisen är KVAR (flyttar en motståndares knekt
//     till centrum) — detta är fortfarande en giltig händelse man
//     kan dra vid 5:a/6:a, skild från movement.js:s egna polisval.
//
// Precis som i v1 är dessa kort rent BESKRIVANDE text — appen
// utför inga automatiska pengar-/pjäsflyttar när ett kort dras.
// Spelarna utför instruktionen manuellt vid bordet. Det gäller
// även "Ficktjuv" (stjäl $10) — texten instruerar, den drar inte
// pengarna åt spelarna. Säg till om du vill digitalisera det.
// ============================================================

import { getState } from './state.js';

export const eventPool = {
    sv: [
        {
            id: 'bribery',
            title: "💵 Mutor inom polisen",
            desc: "Du har köpt en konstapel. Du får flytta ut valfri motståndares polis (Knekt) till sin ursprungliga startplats i mitten."
        },
        {
            id: 'turfWar',
            title: "💥 Gatustrid",
            desc: "Skuggspel i gränderna! Du får byta plats med ett av dina egna kort och en motståndares kort (dock ej kort där det står en polis)."
        },
        {
            id: 'raid',
            title: "🔍 Razzia!",
            desc: "Polisens strålkastare tänds. Alla dolda kort som ligger direkt intill en valfri polis (Knekt) ska omedelbart vändas upp!"
        },
        {
            id: 'economicCrisis',
            title: "📉 Ekonomisk Kris",
            desc: "Tuffa tider i stan. Under nästa varv kostar det dubbelt så mycket att landa på motståndarnas kvarter."
        },
        {
            id: 'shortcut',
            title: "🏃 Genväg i gränden",
            desc: "Du hittar en olåst dörr. Du får dispens att flytta diagonalt under just detta drag om du vill."
        },
        {
            id: 'pickpocket',
            title: "🕵️ Ficktjuv",
            desc: "Ett snabbt möte i trängseln. Stjäl $10 av fickpengarna från valfri motståndare."
        }
    ],
    en: [
        {
            id: 'bribery',
            title: "💵 Police Bribery",
            desc: "You bought off a constable. Move any opponent's cop (Jack) back to its starting station in the absolute center."
        },
        {
            id: 'turfWar',
            title: "💥 Turf War",
            desc: "Shady maneuvers! Swap one of your own quarters with an opponent's quarter (cannot swap cards occupied by cops)."
        },
        {
            id: 'raid',
            title: "🔍 Police Raid!",
            desc: "The searchlights turn on. Immediately reveal all facedown cards neighboring any cop (Jack)!"
        },
        {
            id: 'economicCrisis',
            title: "📉 Economic Crash",
            desc: "Hard times in the district. During the next round, landing on opponents' quarters costs double rent."
        },
        {
            id: 'shortcut',
            title: "🏃 Alleyway Shortcut",
            desc: "You find an unlocked fire escape. You are permitted to move diagonally during this turn only."
        },
        {
            id: 'pickpocket',
            title: "🕵️ Pickpocket",
            desc: "A brief bump in the crowd. Steal $10 from the pocket cash of any opponent."
        }
    ]
};

// Drar ett slumpmässigt kort för aktuellt språk. Returnerar kortet
// plus dess index (så ui.js kan hämta rätt översättning igen om
// spelaren byter språk medan kortet är öppet, precis som i v1).
export function drawRandomEvent() {
    const lang = getState().language;
    const pool = eventPool[lang];
    const index = Math.floor(Math.random() * pool.length);
    return { index, card: pool[index] };
}

export function getEventByIndex(index) {
    const lang = getState().language;
    return eventPool[lang][index] ?? null;
}
