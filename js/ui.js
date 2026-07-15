// ============================================================
// ui.js
// ============================================================
// Ansvar: ENDA filen som rör DOM. Läser state via state.js och
// anropar regelfunktioner i economy/combat/arrest/movement/events.
// Håller även transient UI-state som inte hör hemma i spelstate
// (t.ex. "vilken modal är öppen just nu", "pågår tärninganimation").
//
// Struktur (sök på ▶ SEKTION för att hoppa):
//   ▶ SEKTION: Transient UI-state
//   ▶ SEKTION: Hjälpfunktioner (overlay, toast)
//   ▶ SEKTION: Rendering
//   ▶ SEKTION: Startskärm (enhet + antal spelare)
//   ▶ SEKTION: Språk
//   ▶ SEKTION: Tärning + polisval (5:a/6:a)
//   ▶ SEKTION: Ekonomi (last, betalning)
//   ▶ SEKTION: Arrestering
//   ▶ SEKTION: Slagsmål
//   ▶ SEKTION: Justera-modal (admin)
//   ▶ SEKTION: Regler-modal
//   ▶ SEKTION: Init
// ============================================================

import {
    getState, getPlayer, subscribe, resetGame as resetGameState,
    mutatePlayer, mutateCityBank, DIRECTION, WINNING_VAULT, CARGO_VALUE
} from './state.js';
import { t, interpolate, gangName, changeLanguage, i18n } from './i18n.js';
import { startNewGame, isCarryingCargo, getAllPlayerIds, getOtherActivePlayers, PLAYER_COLORS } from './players.js';
import { isActionAllowed, getCurrentTurnPlayerId, advanceTurn } from './turnOrder.js';
import { performRoll, getDotsForValue } from './dice.js';
import { resolveDiceRoll, resolveCopChoice, COP_CHOICE } from './movement.js';
import { drawRandomEvent } from './events.js';
import { getCargo, refillPocketAtKing, dropCargoInVault, transferMoney, getPaymentRecipients, executePickpocket, CITY_BANK_RECIPIENT, EconomyResult } from './economy.js';
import { resolveFight } from './combat.js';
import { executeArrestFromCopMove, ArrestResult } from './arrest.js';

// ▶ SEKTION: Transient UI-state (hör inte hemma i spelstate.js)
let isRolling = false;
let isFighting = false;
let activePayerId = null;
let activeAttackerId = null;
let currentActiveEventIndex = null;
let pendingDiceSteps = null;   // hur många steg huvudpjäsen ska gå, väntar på att annonseras
let copFlowContext = null;     // håller reda på var i 5:an/6:an-kedjan vi befinner oss
let pendingPickpocket = false; // true = det aktuella händelsekortet är Ficktjuv, kräver målval

// ▶ SEKTION: Hjälpfunktioner
function qs(id) { return document.getElementById(id); }

function showOverlay(id) { qs(id).classList.add('active'); }
function hideOverlay(id) { qs(id).classList.remove('active'); }

// Icke-blockerande meddelande, ersätter alert() rakt av.
function toast(message, variant = 'default') {
    const container = qs('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${variant}`;
    el.innerText = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-visible'));
    setTimeout(() => {
        el.classList.remove('toast-visible');
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

function showConfirm(message, onConfirm) {
    qs('confirm-message').innerText = message;
    showOverlay('confirm-overlay');
    const yesBtn = qs('confirm-yes-btn');
    const newYesBtn = yesBtn.cloneNode(true); // rensa gamla listeners
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    newYesBtn.addEventListener('click', () => {
        hideOverlay('confirm-overlay');
        onConfirm();
    });
}

// ▶ SEKTION: Rendering
function renderAll() {
    const state = getState();
    applyStaticTranslations();
    getAllPlayerIds().forEach(renderPlayerPanel);
    renderTurnBanner(state);
    renderCityBank(state);
    renderWinOverlay(state);
    renderRules();

    // NYTT: på iPhone växlar vi automatiskt till den flik vars tur det är,
    // t.ex. direkt när "Nästa spelare" trycks. Manuell flikbläddring för
    // att kika på andra spelares paneler stör inte detta, eftersom
    // switchTab() i sig inte triggar en ny renderAll().
    if (document.body.classList.contains('mode-iphone') && !state.gameOver) {
        switchTab(state.activePlayerId);
    }
}

function renderPlayerPanel(id) {
    const player = getPlayer(id);
    const panel = qs(`p${id}`);
    if (!panel) return;

    panel.style.display = player.active ? '' : 'none';
    if (!player.active) return;

    qs(`p${id}-gang-title`).innerText = gangName(id);
    qs(`p${id}-pocket`).innerText = `$${player.pocket}`;
    qs(`p${id}-vault`).innerText = `$${player.vault}`;

    // Riktningsbadge (NYTT) — visar tydligt vad spelaren är på väg att göra.
    const badge = qs(`p${id}-direction-badge`);
    if (badge) {
        badge.innerText = player.direction === DIRECTION.TO_KING
            ? t('directionToKing')
            : t('directionToAce');
        badge.className = 'direction-badge ' + (player.direction === DIRECTION.TO_KING ? 'dir-king' : 'dir-ace');
    }

    // Kontextuella last-knappar: bara EN av de tre är synlig åt gången.
    const btnGetCargo = qs(`p${id}-btn-get-cargo`);
    const btnRefill = qs(`p${id}-btn-refill`);
    const btnDropCargo = qs(`p${id}-btn-drop-cargo`);
    if (btnGetCargo && btnRefill && btnDropCargo) {
        btnGetCargo.style.display = (!player.hasCargo) ? 'flex' : 'none';
        btnRefill.style.display = (player.hasCargo && player.pocket < 20) ? 'flex' : 'none';
        btnDropCargo.style.display = (player.hasCargo) ? 'flex' : 'none';
    }

    // Turordningsspärr: bara aktiv spelares knappar är klickbara.
    const isMyTurn = isActionAllowed(id);
    panel.classList.toggle('is-active-turn', isMyTurn);
    panel.querySelectorAll('button').forEach(btn => {
        btn.disabled = !isMyTurn;
    });
}

function renderTurnBanner(state) {
    const banner = qs('turn-banner');
    if (!banner || state.gameOver) return;
    banner.innerText = `${t('yourTurn')}: ${gangName(state.activePlayerId)}`;
    banner.style.borderColor = PLAYER_COLORS[state.activePlayerId];
}

function renderCityBank(state) {
    const el = qs('city-bank-value');
    if (el) el.innerText = `$${state.cityBank}`;
}

function renderWinOverlay(state) {
    if (state.gameOver && state.winnerId) {
        qs('win-message').innerText = interpolate(t('alertWinner'), { name: gangName(state.winnerId) });
        showOverlay('win-overlay');
    } else {
        hideOverlay('win-overlay');
    }
}

// Översätter alla [data-key]-element samt dynamiska element som
// inte kan skötas med enkel data-key (interpolerad text m.m.)
function applyStaticTranslations() {
    document.querySelectorAll('[data-key]').forEach(el => {
        el.innerText = t(el.getAttribute('data-key'));
    });
    document.querySelectorAll('.btn-lang').forEach(btn => {
        const lang = btn.id.endsWith('-sv') ? 'sv' : 'en';
        btn.classList.toggle('active', getState().language === lang);
    });
}

// ▶ SEKTION: Startskärm
export function startGame(mode) {
    if (mode === 'iphone') {
        document.body.classList.add('mode-iphone');
        switchTab(1);
    } else {
        document.body.classList.remove('mode-iphone');
    }
    qs('welcome-screen').classList.add('hidden');
    showOverlay('player-count-overlay');
}

export function choosePlayerCount(count) {
    startNewGame(count);
    hideOverlay('player-count-overlay');
}

export function switchTab(id) {
    document.querySelectorAll('.player-corner').forEach(el => el.classList.remove('active-tab'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    qs(`p${id}`).classList.add('active-tab');
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}

// ▶ SEKTION: Språk
export function setLanguage(lang) {
    changeLanguage(lang); // skriver till state, triggar notify() -> renderAll()
}

// ▶ SEKTION: Tärning + polisval
export function rollDice() {
    if (isRolling) return;
    if (!isActionAllowed(getCurrentTurnPlayerId())) return;

    isRolling = true;
    const label = qs('dice-label');
    label.classList.remove('pulse-text');

    let counter = 0;
    const interval = setInterval(() => {
        const previewVal = Math.floor(Math.random() * 6) + 1;
        drawDiceDots(previewVal);
        label.innerText = t('diceRolling');
        counter++;
        if (counter > 8) {
            clearInterval(interval);
            finishDiceRoll(label);
        }
    }, 65);
}

function finishDiceRoll(label) {
    const finalResult = performRoll();
    drawDiceDots(finalResult);
    label.innerText = t('diceSlog') + finalResult;
    isRolling = false;

    setTimeout(() => {
        if (!isRolling) {
            label.innerText = t('diceClick');
            label.classList.add('pulse-text');
        }
    }, 3000);

    const interpretation = resolveDiceRoll(finalResult);

    if (interpretation.requiresCopChoice) {
        // Vid 5:a/6:a görs polis-/händelsevalet FÖRST — pjäsflytten
        // annonseras sist, efter att hela kedjan är klar (se
        // handleCopChoice / proceedAfterEventStage / announceMainSteps).
        pendingDiceSteps = interpretation.steps;
        openCopChoiceModal(finalResult, interpretation.options);
    } else {
        toast(interpolate(t('moveTokenNow'), { steps: interpretation.steps }), 'info');
        toast(t('reminderPayRent'), 'info');
    }
}

function drawDiceDots(value) {
    for (let i = 1; i <= 9; i++) {
        qs(`d${i}`).style.visibility = 'hidden';
    }
    getDotsForValue(value).forEach(dotId => {
        qs(`d${dotId}`).style.visibility = 'visible';
    });
}

function openCopChoiceModal(roll, options) {
    qs('cop-choice-title').innerText = interpolate(t('copChoiceTitle'), { roll });
    qs('cop-choice-desc').innerText = roll === 5 ? t('copChoice5Desc') : t('copChoice6Desc');

    const labelMap = {
        [COP_CHOICE.MOVE_COP_ONE]: 'copChoiceMove1',
        [COP_CHOICE.MOVE_COP_TWO]: 'copChoiceMove2',
        [COP_CHOICE.DRAW_EVENT]: 'copChoiceDrawEvent'
    };
    const container = qs('cop-choice-options');
    container.innerHTML = '';
    options.forEach(choiceId => {
        const btn = document.createElement('button');
        btn.className = 'police-btn';
        btn.innerText = t(labelMap[choiceId]);
        btn.onclick = () => handleCopChoice(choiceId);
        container.appendChild(btn);
    });

    showOverlay('cop-choice-overlay');
}

function handleCopChoice(choiceId) {
    hideOverlay('cop-choice-overlay');
    const { copSteps, drawsEvent, copMoved } = resolveCopChoice(choiceId);
    copFlowContext = { copSteps, drawsEvent, copMoved, mainSteps: pendingDiceSteps };
    pendingDiceSteps = null;

    if (drawsEvent) {
        openEventPopup(); // fortsätter kedjan i closeEventPopup() -> proceedAfterEventStage()
    } else {
        proceedAfterEventStage();
    }
}

// Fortsätter kedjan efter ett ev. händelsekort: knektflytt -> "landade
// den på någon?" -> och till sist annonsering av huvudpjäsens flytt.
function proceedAfterEventStage() {
    if (!copFlowContext) return;
    if (copFlowContext.copMoved) {
        toast(interpolate(t('moveCopNow'), { steps: copFlowContext.copSteps }), 'info');
        openCopLandedModal();
    } else {
        announceMainSteps();
    }
}

// Sista steget i 5:an/6:an-kedjan: berätta hur många steg huvudpjäsen
// (Ess/Kung-token) ska flyttas, nu när ev. polis/händelse är klar.
function announceMainSteps() {
    if (copFlowContext) {
        toast(interpolate(t('moveTokenNow'), { steps: copFlowContext.mainSteps }), 'info');
        toast(t('reminderPayRent'), 'info');
        copFlowContext = null;
    }
}

// Efter en knektflytt: frågar om knekten landade på en motståndare.
function openCopLandedModal() {
    qs('cop-landed-yes-btn').onclick = () => {
        hideOverlay('cop-landed-overlay');
        openArrestTargetModal(getCurrentTurnPlayerId());
    };
    qs('cop-landed-no-btn').onclick = () => {
        hideOverlay('cop-landed-overlay');
        announceMainSteps();
    };
    showOverlay('cop-landed-overlay');
}

// ▶ SEKTION: Händelsekort
function openEventPopup() {
    const { index, card } = drawRandomEvent();
    currentActiveEventIndex = index;
    pendingPickpocket = (card.id === 'pickpocket');
    qs('event-dice-badge').innerText = interpolate(t('eventBadge'), { roll: getState().lastDiceRoll ?? '' });
    qs('event-title').innerText = card.title;
    qs('event-desc').innerText = card.desc;
    showOverlay('event-overlay');
}

export function closeEventPopup() {
    hideOverlay('event-overlay');
    currentActiveEventIndex = null;

    if (pendingPickpocket) {
        pendingPickpocket = false;
        openPickpocketTargetModal();
    } else {
        proceedAfterEventStage();
    }
}

// Ficktjuv-kortet kräver att spelaren väljer VEM pengarna tas från
// (staden är aldrig ett alternativ). Fortsätter 5:an/6:an-kedjan
// (announceMainSteps) när valet är klart.
function openPickpocketTargetModal() {
    qs('police-title').innerText = t('pickpocketTitle');
    qs('police-subtitle').innerText = '';
    const grid = qs('police-targets');
    grid.innerHTML = '';
    getOtherActivePlayers(getCurrentTurnPlayerId()).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'police-btn';
        btn.innerText = `🕵️ ${gangName(p.id)}`;
        btn.onclick = () => {
            const res = executePickpocket(getCurrentTurnPlayerId(), p.id);
            toast(`+$${res.stolen}`, 'success');
            hideOverlay('police-overlay');
            proceedAfterEventStage();
        };
        grid.appendChild(btn);
    });
    showOverlay('police-overlay');
}

// ▶ SEKTION: Ekonomi
export function handleGetCargo(playerId) {
    const res = getCargo(playerId);
    if (res.result === EconomyResult.CITY_BANK_EMPTY) toast(t('alertCityBankEmpty'), 'danger');
    if (res.result === EconomyResult.ALREADY_CARRYING) toast(t('alertAlreadyCarrying'), 'danger');
}

export function handleRefillPocket(playerId) {
    const res = refillPocketAtKing(playerId);
    if (res.result === EconomyResult.OK) toast('$20', 'success');
}

export function handleDropCargo(playerId) {
    const res = dropCargoInVault(playerId);
    if (res.result === EconomyResult.NO_CARGO_TO_DROP) toast(t('alertNoCargoToDrop'), 'danger');
    if (res.result === EconomyResult.WON) {
        // renderWinOverlay() sköter visningen via subscribe/renderAll
    }
}

export function openPayModal(id) {
    activePayerId = id;
    qs('pay-title').innerText = gangName(id) + t('payPayer');
    const select = qs('pay-target');
    select.innerHTML = '';
    getPaymentRecipients(id).forEach(recipient => {
        const opt = document.createElement('option');
        opt.value = recipient.id;
        opt.innerText = recipient.isCityBank ? t('statCityBank') : gangName(recipient.id);
        select.appendChild(opt);
    });
    showOverlay('pay-overlay');
}

export function closePayModal() {
    hideOverlay('pay-overlay');
    activePayerId = null;
}

export function executePaymentFromModal() {
    const targetRaw = qs('pay-target').value;
    const targetId = targetRaw === CITY_BANK_RECIPIENT ? CITY_BANK_RECIPIENT : Number(targetRaw);
    const amount = parseInt(qs('pay-amount').value, 10);
    const res = transferMoney(activePayerId, targetId, amount);
    if (res.result === EconomyResult.BANKRUPT) {
        toast(t('alertBankrupt'), 'danger');
    }
    closePayModal();
}

// ▶ SEKTION: Arrestering
// Enda kvarvarande flödet: den aktiva spelarens EGEN polis (flyttad via
// movement.js vid tärning 5/6, eller "Mutor"-händelsekortet) grep någon.
// Vi frågar bara VEM som greps (copOwner = aktiv spelare per definition).
// Det manuella "Haffad"-flödet är borttaget — hanteras nu helt automatiskt
// via knektflytt-kedjan.
function openArrestTargetModal(activePlayerId) {
    qs('police-title').innerText = t('policeTitle');
    qs('police-subtitle').innerText = t('policeSubtitle');
    const grid = qs('police-targets');
    grid.innerHTML = '';
    getOtherActivePlayers(activePlayerId).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'police-btn';
        btn.innerText = `🚨 ${gangName(p.id)}`;
        btn.onclick = () => {
            const res = executeArrestFromCopMove(activePlayerId, p.id);
            reportArrestResult(res, p.id, activePlayerId);
            hideOverlay('police-overlay');
            announceMainSteps();
        };
        grid.appendChild(btn);
    });
    showOverlay('police-overlay');
}

function reportArrestResult(res, victimId, copOwnerId) {
    if (res.result === ArrestResult.LOOTED) {
        toast(interpolate(t('alertArrested'), {
            victim: gangName(victimId), cop: gangName(copOwnerId), loot: res.loot
        }), 'danger');
    } else {
        toast(interpolate(t('alertJail'), { victim: gangName(victimId) }), 'default');
    }
}

export function closePoliceModal() {
    hideOverlay('police-overlay');
}

// ▶ SEKTION: Slagsmål
export function openFightModal(id) {
    if (isFighting) return;
    activeAttackerId = id;
    qs('fight-setup-view').style.display = 'block';
    qs('fight-rolling-view').style.display = 'none';

    const grid = qs('fight-targets');
    grid.innerHTML = '';
    getOtherActivePlayers(id).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'police-btn';
        btn.innerText = t('fightChallenge') + gangName(p.id);
        btn.onclick = () => startStreetFight(p.id);
        grid.appendChild(btn);
    });
    showOverlay('fight-overlay');
}

export function closeFightModal() {
    if (isFighting) return;
    hideOverlay('fight-overlay');
}

function startStreetFight(defenderId) {
    isFighting = true;
    qs('fight-setup-view').style.display = 'none';
    qs('fight-rolling-view').style.display = 'block';
    qs('fight-attacker-name').innerText = `👊 ${gangName(activeAttackerId)} (${t('fightAttacker')})`;
    qs('fight-defender-name').innerText = `🛡️ ${gangName(defenderId)} (${t('fightDefender')})`;

    const statusLabel = qs('fight-status-label');
    statusLabel.className = 'order-notice';
    statusLabel.innerText = t('fightRolling');

    let counter = 0;
    const interval = setInterval(() => {
        qs('fight-attacker-dice').innerText = Math.floor(Math.random() * 6) + 1;
        qs('fight-defender-dice').innerText = Math.floor(Math.random() * 6) + 1;
        counter++;
        if (counter > 12) {
            clearInterval(interval);
            finishStreetFight(defenderId, statusLabel);
        }
    }, 70);
}

function finishStreetFight(defenderId, statusLabel) {
    const attackerRoll = Math.floor(Math.random() * 6) + 1;
    const defenderRoll = Math.floor(Math.random() * 6) + 1;
    qs('fight-attacker-dice').innerText = attackerRoll;
    qs('fight-defender-dice').innerText = defenderRoll;

    const res = resolveFight(activeAttackerId, defenderId, attackerRoll, defenderRoll);

    statusLabel.style.backgroundColor = '';
    statusLabel.style.color = '';
    statusLabel.style.borderColor = '';

    if (res.loserWentBankrupt) {
        statusLabel.style.backgroundColor = 'rgba(229, 62, 62, 0.2)';
        statusLabel.style.color = '#f56565';
        statusLabel.style.borderColor = '#e53e3e';
        statusLabel.innerText = res.isDraw
            ? interpolate(t('fightLogDrawBankrupt'), { loser: gangName(res.loserId) })
            : interpolate(t('fightLogWinnerBankrupt'), { winner: gangName(res.winnerId), loser: gangName(res.loserId) });
    } else {
        statusLabel.innerText = res.isDraw
            ? interpolate(t('fightLogDraw'), { winner: gangName(res.winnerId) })
            : interpolate(t('fightLogWinner'), { winner: gangName(res.winnerId) });
    }

    isFighting = false;
    const closeBtn = qs('fight-close-btn');
    closeBtn.style.display = 'block';
    closeBtn.innerText = t('fightClose');
}

// ▶ SEKTION: Justera-modal (admin, kringgår avsiktligt turordning)
export function openAdjustModal() {
    const select = qs('mod-player');
    select.innerHTML = '';
    getAllPlayerIds().forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = gangName(id);
        select.appendChild(opt);
    });
    loadPlayerValuesToModal();
    showOverlay('adjust-overlay');
}

export function loadPlayerValuesToModal() {
    const pId = qs('mod-player').value;
    if (!pId) return;
    const player = getPlayer(pId);
    qs('mod-pocket').value = player.pocket;
    qs('mod-vault').value = player.vault;
    qs('mod-citybank').value = getState().cityBank;
}

export function closeAdjustModal() {
    hideOverlay('adjust-overlay');
}

export function saveAdjustments() {
    const pId = qs('mod-player').value;
    if (!pId) return;
    // NOTERA: detta är ett admin-rättningsverktyg och går INTE via
    // economy.js/assertCanAct — det ska fungera oavsett vems tur det är.
    mutatePlayer(pId, {
        pocket: parseInt(qs('mod-pocket').value, 10) || 0,
        vault: parseInt(qs('mod-vault').value, 10) || 0
    });
    const newCityBank = parseInt(qs('mod-citybank').value, 10) || 0;
    mutateCityBank(newCityBank - getState().cityBank);
    closeAdjustModal();
}

// ▶ SEKTION: Nästa spelare / Reset
export function nextPlayer() {
    advanceTurn();
}

export function resetGame() {
    showConfirm(t('alertReset'), () => {
        resetGameState();
    });
}

// ▶ SEKTION: Regler-modal
export function openRulesModal() { showOverlay('rules-overlay'); }
export function closeRulesModal() { hideOverlay('rules-overlay'); }

function renderRules() {
    const area = qs('rules-content-area');
    if (!area) return;
    const lang = getState().language;
    area.innerHTML = buildRulesHtml(lang);
}

function buildRulesHtml(lang) {
    // Regeltexten är statisk innehåll (inte spelregler i kod), så den
    // hålls enkel som en HTML-sträng per språk. Uppdaterad för v2:
    // stadsbank, skattkista, riktning, ny tärningsregel, 2-4 spelare.
    const R = i18n[lang];
    return lang === 'sv' ? `
        <h1 style="color:#2b6cb0; text-align:center;">THE NOIR SYNDICATE v2 — REGLER</h1>
        <h2>Mål</h2>
        <p>Hämta skattkistor ($1000 st) hos din Kung, bär dem i fickan till ditt Ess, och säkra dem i din kista. Först till <strong>$${WINNING_VAULT}</strong> säkrat (3 kistor) vinner.</p>
        <h2>Turordning</h2>
        <p>Endast den aktiva spelaren kan agera. Slå tärningen, flytta din pjäs, utför ev. handling, tryck sedan "${R.btnNextPlayer}".</p>
        <h2>Tärningsregel</h2>
        <ul>
            <li><strong>1-4:</strong> Gå så många steg tärningen visar.</li>
            <li><strong>5:</strong> Gå 4 steg. Välj sedan: flytta knekt 1 steg, ELLER dra ett händelsekort.</li>
            <li><strong>6:</strong> Gå 4 steg. Välj sedan: flytta knekt 2 steg, ELLER dra ett händelsekort.</li>
            <li>Du får gå framåt, bakåt eller i sidled — aldrig diagonalt (om inte ett händelsekort säger annat).</li>
        </ul>
        <p style="color:#ecc94b;">💡 Glöm inte att betala tull om du landar på en motståndares kvarter — appen påminner dig efter varje drag, men det är upp till spelarna att göra det manuellt.</p>
        <h2>Skattkistan</h2>
        <p>Fickan och kistan är separata. Om fickan tar slut medan du bär en last: gå tillbaka till din Kung för $20 gratis — du behåller lasten.</p>
        <h2>Regler för brädet</h2>
        <ul>
            <li>Du får inte ställa dig på en motståndares knekt, bara passera.</li>
            <li>Du får passera men inte stanna på en motståndares Kung eller Ess.</li>
            <li>2-3 spelare: tull för en färg ingen äger går till stadens kassa.</li>
        </ul>
        <button class="popup-btn" onclick="window.NoirUI.closeRulesModal()">Stäng</button>
    ` : `
        <h1 style="color:#2b6cb0; text-align:center;">THE NOIR SYNDICATE v2 — RULES</h1>
        <h2>Objective</h2>
        <p>Pick up $1000 cargo shipments from your King, carry them in your pocket to your Ace, and secure them in your vault. First to <strong>$${WINNING_VAULT}</strong> secured (3 shipments) wins.</p>
        <h2>Turn Order</h2>
        <p>Only the active player may act. Roll, move your token, resolve any action, then tap "${R.btnNextPlayer}".</p>
        <h2>Dice Rule</h2>
        <ul>
            <li><strong>1-4:</strong> Move that many spaces.</li>
            <li><strong>5:</strong> Move 4 spaces. Then choose: move your cop 1 step, OR draw an event card.</li>
            <li><strong>6:</strong> Move 4 spaces. Then choose: move your cop 2 steps, OR draw an event card.</li>
            <li>You may move forward, backward, or sideways — never diagonally (unless an event card says otherwise).</li>
        </ul>
        <p style="color:#ecc94b;">💡 Don't forget to pay rent if you land on an opponent's quarter — the app reminds you after every move, but it's up to the players to handle it manually.</p>
        <h2>The Vault</h2>
        <p>Pocket cash and the vault are separate. If your pocket runs out while carrying cargo: return to your King for a free $20 refill — you keep the cargo.</p>
        <h2>Board Rules</h2>
        <ul>
            <li>You may not stop on an opponent's cop, only pass over.</li>
            <li>You may pass but not stop on an opponent's King or Ace.</li>
            <li>2-3 players: rent for an unowned color goes to the city treasury.</li>
        </ul>
        <button class="popup-btn" onclick="window.NoirUI.closeRulesModal()">Close</button>
    `;
}

// ▶ SEKTION: Init
export function initUI() {
    subscribe(() => renderAll());
    renderAll();
    drawDiceDots(1);
}
