// ============================================================
// i18n.js
// ============================================================
// Ansvar: enbart textinnehåll för UI-chrome (knappar, labels,
// meddelanden, modaler) på svenska och engelska.
//
// Händelsekortens texter (noirEvents) ligger INTE här — de hör
// hemma i events.js eftersom de är spelregelinnehåll, inte
// generisk UI-text.
//
// Inga DOM-anrop i denna fil. ui.js ansvarar för att applicera
// översatt text på skärmen.
// ============================================================

import { getState, setLanguage as setStateLanguage, subscribe } from './state.js';

export const i18n = {
    sv: {
        // --- Startskärm ---
        welcomeSubtitle: "Kontrollrum",
        welcomePrompt: "Välj vilken enhet du vill spela på ikväll:",
        modeIpad: "💻 iPad (Liggande Bräde)",
        modeIphone: "📱 iPhone (Stående Flikar)",
        choosePlayerCount: "Hur många spelare?",
        playerCount2: "2 Spelare",
        playerCount3: "3 Spelare",
        playerCount4: "4 Spelare",

        // --- Färger / gäng ---
        suitSpades: "Spader",
        suitHearts: "Hjärter",
        suitClovers: "Klöver",
        suitDiamonds: "Ruter",

        // --- Statistik ---
        statPocket: "💼 Fickan",
        statVault: "🔒 Kista (Säkrat)",
        statCityBank: "🏛️ Stadens kassa",

        // --- Scoreboard (NYTT) ---
        sbGang: "Gäng",
        sbDirection: "Riktning",
        sbPocket: "💼 Fickan",
        sbVault: "🔒 Säkrat",

        // --- Riktning (NYTT) ---
        directionToKing: "🚚 På väg till Kung",
        directionToAce: "🏦 På väg till Ess (bär last)",

        // --- Turordning / HUD (NYTT) ---
        yourTurn: "DIN TUR",
        waitingForPlayer: "Väntar på {name}...",
        btnNextPlayer: "✅ Nästa spelare",
        turnStepMove: "1. Flytta din pjäs",
        turnStepAction: "2. Utför ev. handling",
        turnStepEnd: "3. Klart? Tryck Nästa spelare",

        // --- Ekonomiknappar ---
        actGetCargo: "Hämta last ($1000)",
        actDropCargo: "Lämna last i kistan",
        actArrest: "Haffad",
        actFight: "Slagsmål",
        actPay: "Överför pengar ➔",

        // --- Tärning ---
        diceClick: "KLICKA FÖR ATT SLÅ",
        diceRolling: "RULLAR...",
        diceSlog: "SLOG: ",

        // --- Tärning 5/6-val (NYTT) ---
        copChoiceTitle: "Du slog en {roll}:a!",
        copChoice5Desc: "Du har två val: ① Flytta din knekt 1 steg, ELLER ② Dra ett händelsekort. Gör ditt val — sedan flyttar du din egen pjäs 4 steg.",
        copChoice6Desc: "Du har tre val: ① Flytta din knekt 1 steg, ② Flytta din knekt 2 steg, ELLER ③ Dra ett händelsekort. Gör ditt val — sedan flyttar du din egen pjäs 4 steg.",
        copChoiceMove1: "👮 Flytta knekt 1 steg",
        copChoiceMove2: "👮 Flytta knekt 2 steg",
        copChoiceDrawEvent: "🎴 Dra ett händelsekort",
        copChoiceConfirm: "Bekräfta val",
        moveCopNow: "Flytta din knekt {steps} steg",
        moveTokenNow: "Flytta nu din pjäs {steps} steg",
        reminderPayRent: "💡 Glöm inte betala om du landade hos en motståndare!",
        pickpocketTitle: "Vem vill du sno pengar från?",

        // --- Efter knektflytt: landade på motståndare? (NYTT) ---
        copLandedTitle: "Landade din knekt på en motståndare?",
        copLandedDesc: "Om din polis landade på en motståndares pjäs blir denne haffad direkt.",
        copLandedYes: "Ja, haffa spelaren",
        copLandedNo: "Nej, gå vidare",

        // --- Knappar allmänt ---
        btnRules: "📜 Regler",
        btnAdjust: "🛠️ Justera",
        btnReset: "Återställ",
        btnOk: "Uppfattat",
        btnCancel: "Avbryt",
        btnConfirm: "Bekräfta",

        // --- Betalning ---
        payHeader: "Skicka pengar",
        payRecipient: "Mottagare",
        paySum: "Annat belopp ($)",
        payPayer: " betalar",
        payQuickAmount: "Snabbval belopp",
        alertPickRecipient: "Välj en mottagare först!",
        alertPickAmount: "Ange ett belopp först!",
        economicCrisisActive: "📉 Ekonomisk kris pågår denna runda — dubbel tull!",

        // --- Polis / arrestering ---
        policeTitle: "Vem blev gripen?",
        policeSubtitle: "Fickpengarna tillfaller din egen ficka. Den gripne går tillbaka till sin Kung och förlorar en ev. last.",
        arrestResultTitle: "🚨 Haffad!",

        // --- Slagsmål ---
        fightTitle: "Gatuslagsmål!",
        fightPrompt: "Välj vilken motståndare som står på rutan och ska attackeras:",
        fightAttacker: "Anfallare",
        fightDefender: "Försvarare",
        fightRolling: "RULLAR KNOGJÄRNEN...",
        fightClose: "Avsluta duell",
        fightChallenge: "🥊 Utmana ",

        // --- Meddelanden ---
        alertWinner: "BOSS! {name} kontrollerar staden med 3 säkrade kistor!",
        alertNoCargoToDrop: "Du bär ingen last att lämna!",
        alertAlreadyCarrying: "Du bär redan en last — lämna den på Esset först!",
        alertCityBankEmpty: "Stadens kassa är tom just nu!",
        alertArrested: "{victim} greps av {cop}! Beslagtog ${loot}. {victim} går tillbaka till sin Kung med $20 i fickan.",
        alertJail: "{victim} greps, men hade inget extra att beslagta. Går tillbaka till sin Kung.",
        alertBankruptToKing: "{name}s ficka är tom! Fickan laddas om till $20 — kistan påverkas inte. {name} går tillbaka till sin Kung.",
        alertBankruptToAce: "{name}s ficka är tom! Fickan laddas om till $20 — kistan påverkas inte. {name} går tillbaka till sitt Ess.",
        bankruptTitle: "💸 Fickan är tom!",
        alertReset: "Vill du nollställa spelet?",
        alertSkipTurn: "{name} landade på en Dam och står över nästa runda!",
        alertMustEndTurn: "Endast {name} kan agera just nu — det är deras tur.",

        // --- Slagsmålslogg ---
        fightLogDrawBankrupt: "OAVGJORT! Men anfallaren {loser} har inte råd att betala skadan. Fickan laddas om till $20.",
        fightLogWinnerBankrupt: "VINNARE: {winner}! Förloraren {loser} har inte råd att betala. Fickan laddas om till $20.",
        fightLogDraw: "OAVGJORT! {winner} försvarade rutan! Tar $10 och skickar bort anfallaren.",
        fightLogWinner: "VINNARE: {winner}! Tar $10 från förloraren.",
        fightLoserToKing: "{loser} var på väg mot Ess — flyttar tillbaka till sin Kung.",
        fightLoserToAce: "{loser} var på väg mot Kung — flyttar tillbaka till sitt Ess.",

        // --- Händelsekort (chrome) ---
        eventNotice: "⚠️ Utför händelsen först — flytta pjäsen sen!",
        eventBadge: "SLOG EN {roll}:A 🎲",

        // --- Justera-modal ---
        modTitle: "Justera spelarvärden",
        modLblPlayer: "Välj syndikat",
        modLblPocket: "💼 Fickan",
        modLblVault: "🔒 Kista",
        modLblCityBank: "🏛️ Stadens kassa"
    },

    en: {
        welcomeSubtitle: "Control Room",
        welcomePrompt: "Choose which device you are playing on tonight:",
        modeIpad: "💻 iPad (Landscape Board)",
        modeIphone: "📱 iPhone (Portrait Tabs)",
        choosePlayerCount: "How many players?",
        playerCount2: "2 Players",
        playerCount3: "3 Players",
        playerCount4: "4 Players",

        suitSpades: "Spades",
        suitHearts: "Hearts",
        suitClovers: "Clubs",
        suitDiamonds: "Diamonds",

        statPocket: "💼 Pocket",
        statVault: "🔒 Vault (Secured)",
        statCityBank: "🏛️ City Treasury",

        sbGang: "Gang",
        sbDirection: "Direction",
        sbPocket: "💼 Pocket",
        sbVault: "🔒 Secured",

        directionToKing: "🚚 Heading to King",
        directionToAce: "🏦 Heading to Ace (carrying cargo)",

        yourTurn: "YOUR TURN",
        waitingForPlayer: "Waiting for {name}...",
        btnNextPlayer: "✅ Next Player",
        turnStepMove: "1. Move your token",
        turnStepAction: "2. Resolve any action",
        turnStepEnd: "3. Done? Tap Next Player",

        actGetCargo: "Pick Up Cargo ($1000)",
        actDropCargo: "Drop Cargo in Vault",
        actArrest: "Busted",
        actFight: "Street Fight",
        actPay: "Transfer Cash ➔",

        diceClick: "CLICK TO ROLL",
        diceRolling: "ROLLING...",
        diceSlog: "ROLLED: ",

        copChoiceTitle: "You rolled a {roll}!",
        copChoice5Desc: "You have two choices: ① Move your cop 1 step, OR ② Draw an event card. Make your choice — then move your own token 4 steps.",
        copChoice6Desc: "You have three choices: ① Move your cop 1 step, ② Move your cop 2 steps, OR ③ Draw an event card. Make your choice — then move your own token 4 steps.",
        copChoiceMove1: "👮 Move cop 1 step",
        copChoiceMove2: "👮 Move cop 2 steps",
        copChoiceDrawEvent: "🎴 Draw an event card",
        copChoiceConfirm: "Confirm choice",
        moveCopNow: "Move your cop {steps} step(s)",
        moveTokenNow: "Now move your token {steps} steps",
        reminderPayRent: "💡 Don't forget to pay if you landed on an opponent!",
        pickpocketTitle: "Who do you want to pickpocket?",

        copLandedTitle: "Did your cop land on an opponent?",
        copLandedDesc: "If your cop landed on an opponent's token, they are busted immediately.",
        copLandedYes: "Yes, bust the player",
        copLandedNo: "No, continue",

        btnRules: "📜 Rules",
        btnAdjust: "🛠️ Adjust",
        btnReset: "Reset",
        btnOk: "Understood",
        btnCancel: "Cancel",
        btnConfirm: "Confirm",

        payHeader: "Send Money",
        payRecipient: "Recipient",
        paySum: "Custom amount ($)",
        payPayer: " pays",
        payQuickAmount: "Quick amounts",
        alertPickRecipient: "Pick a recipient first!",
        alertPickAmount: "Enter an amount first!",
        economicCrisisActive: "📉 Economic crisis in effect this round — double rent!",

        policeTitle: "Who got caught?",
        policeSubtitle: "The pocket cash goes to your own pocket. The one caught returns to their King and loses any cargo.",
        arrestResultTitle: "🚨 Busted!",

        fightTitle: "Street Fight!",
        fightPrompt: "Select the opponent occupying the square to attack:",
        fightAttacker: "Attacker",
        fightDefender: "Defender",
        fightRolling: "ROLLING KNUCKLES...",
        fightClose: "End Duel",
        fightChallenge: "🥊 Challenge ",

        alertWinner: "BOSS! {name} controls the city with 3 secured vaults!",
        alertNoCargoToDrop: "You aren't carrying any cargo to drop!",
        alertAlreadyCarrying: "You're already carrying cargo — drop it at your Ace first!",
        alertCityBankEmpty: "The city treasury is empty right now!",
        alertArrested: "{victim} busted by {cop}! Confiscated ${loot}. {victim} returns to their King with $20 pocket cash.",
        alertJail: "{victim} busted, but had nothing extra to confiscate. Returns to their King.",
        alertBankruptToKing: "{name}'s pocket is empty! Pocket refilled to $20 — the vault is unaffected. {name} returns to their King.",
        alertBankruptToAce: "{name}'s pocket is empty! Pocket refilled to $20 — the vault is unaffected. {name} returns to their Ace.",
        bankruptTitle: "💸 Pocket Empty!",
        alertReset: "Reset the game?",
        alertSkipTurn: "{name} landed on a Queen and skips the next round!",
        alertMustEndTurn: "Only {name} can act right now — it's their turn.",

        fightLogDrawBankrupt: "DRAW! But attacker {loser} can't afford the damage. Pocket refilled to $20.",
        fightLogWinnerBankrupt: "WINNER: {winner}! Loser {loser} can't afford to pay. Pocket refilled to $20.",
        fightLogDraw: "DRAW! {winner} defended the block! Takes $10 and expels the attacker.",
        fightLogWinner: "WINNER: {winner}! Takes $10 from the loser.",
        fightLoserToKing: "{loser} was heading to their Ace — moves back to their King.",
        fightLoserToAce: "{loser} was heading to their King — moves back to their Ace.",

        eventNotice: "⚠️ Execute the event first — move your piece after!",
        eventBadge: "ROLLED A {roll} 🎲",

        modTitle: "Adjust Player Values",
        modLblPlayer: "Select Syndicate",
        modLblPocket: "💼 Pocket",
        modLblVault: "🔒 Vault",
        modLblCityBank: "🏛️ City Treasury"
    }
};

// Namn per gäng/färg — hålls här eftersom de visas i UI-text
// (t.ex. "Nightspades betalar"). Byt fritt utan att påverka logik.
export const gangNames = {
    1: { sv: "♠ Nightspades", en: "♠ Nightspades" },
    2: { sv: "♥ Crimson", en: "♥ Crimson" },
    3: { sv: "♣ Iron Clovers", en: "♣ Iron Clovers" },
    4: { sv: "♦ Diamond", en: "♦ Diamond" }
};

// ---- Hjälpfunktioner ----

// Hämtar en textsträng för aktuellt språk (state.language).
export function t(key) {
    const lang = getState().language;
    return i18n[lang][key] ?? `[[${key}]]`;
}

// Ersätter {placeholders} i en textsträng, t.ex.
// interpolate(t('alertArrested'), { victim: 'X', cop: 'Y', loot: 50 })
export function interpolate(template, params = {}) {
    return Object.keys(params).reduce(
        (str, key) => str.replaceAll(`{${key}}`, params[key]),
        template
    );
}

export function gangName(playerId) {
    const lang = getState().language;
    return gangNames[playerId][lang];
}

// Byter språk i state. ui.js lyssnar via subscribe() i state.js
// och ansvarar för att applicera texten på DOM när detta anropas.
export function changeLanguage(lang) {
    setStateLanguage(lang);
}

// Låter andra moduler prenumerera på språkbyten specifikt om de vill,
// utan att behöva importera hela state.js-prenumerationslistan.
export function onLanguageChange(callback) {
    subscribe((state) => callback(state.language));
}
