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
import { getCargo, refillPocketAtKing, dropCargoInVault, transferMoney, getPaymentRecipients, executePickpocket, EconomyResult } from './economy.js';
import { resolveFight } from './combat.js';
import { executeArrestFromCopMove, ArrestResult } from './arrest.js';

// ▶ SEKTION: Transient UI-state (hör inte hemma i spelstate.js)
let isRolling = false;
let isFighting = false;
let activePayerId = null;
let selectedPayTargetId = null; // vald mottagare i betalningsmodalen (spelar-id eller CITY_BANK_RECIPIENT)
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

    const recipients = getPaymentRecipients(id);
    selectedPayTargetId = recipients.length ? recipients[0].id : null;

    renderPayTargetButtons(recipients);
    renderPayAmountQuickButtons();
    showOverlay('pay-overlay');
}

// Bygger mottagarknapparna. Ritas om vid varje val så den markerade
// knappen (guld ram) alltid matchar selectedPayTargetId.
function renderPayTargetButtons(recipients) {
    const grid = qs('pay-target-grid');
    grid.innerHTML = '';
    recipients.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'police-btn pay-target-btn';
        if (r.id === selectedPayTargetId) btn.classList.add('selected');
        btn.innerText = r.isCityBank ? t('statCityBank') : gangName(r.id);
        btn.onclick = () => {
            selectedPayTargetId = r.id;
            renderPayTargetButtons(recipients);
        };
        grid.appendChild(btn);
    });
}

// Snabbvalsknappar $2-$10 — täcker alla möjliga korttullar (2-10 i
// en vanlig kortlek). Klick exekverar betalningen direkt, ingen
// extra bekräftelse behövs för dessa vanliga belopp.
function renderPayAmountQuickButtons() {
    const container = qs('pay-amount-quick');
    container.innerHTML = '';
    for (let amount = 2; amount <= 10; amount++) {
        const btn = document.createElement('button');
        btn.className = 'btn-success';
        btn.style.flex = '1 1 17%';
        btn.innerText = `$${amount}`;
        btn.onclick = () => executePayment(amount);
        container.appendChild(btn);
    }
}

function executePayment(amount) {
    if (selectedPayTargetId === null) return;
    const res = transferMoney(activePayerId, selectedPayTargetId, amount);
    if (res.result === EconomyResult.BANKRUPT) {
        toast(t('alertBankrupt'), 'danger');
    }
    closePayModal();
}

export function closePayModal() {
    hideOverlay('pay-overlay');
    activePayerId = null;
    selectedPayTargetId = null;
}

// Kvarvarande manuellt fält för belopp utanför $2-$10.
export function executePaymentFromModal() {
    const amount = parseInt(qs('pay-amount').value, 10);
    executePayment(amount);
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

    // NYTT: destinationen är inget val — den styrs av förlorarens
    // egen riktning (på väg till Ess -> tillbaka till Kung, och tvärtom).
    const loser = getPlayer(res.loserId);
    const destinationKey = loser.direction === DIRECTION.TO_ACE ? 'fightLoserToKing' : 'fightLoserToAce';
    statusLabel.innerText += ' ' + interpolate(t(destinationKey), { loser: gangName(res.loserId) });

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
    // hålls som en HTML-sträng per språk. Bygger vidare på v1:s röst
    // och struktur (1920-talets Chicago-gängkänsla), uppdaterad med
    // alla v2-regler: stadskassa, skattkista/ficka-separation, ny
    // tärningsregel, automatisk arrestering, 2-4 spelare, m.m.
    const R = i18n[lang];
    return lang === 'sv' ? `
        <h1 style="color:#2b6cb0; text-align:center; letter-spacing: 2px;">THE NOIR SYNDICATE — REGLER</h1>

        <h2>Spelplan & Setup (Kortlayout)</h2>
        <p>Bygg upp spelplanen på bordet med en vanlig kortlek enligt bilden nedan. Grundmönstret: Ess i hörnen, Kungar på kanterna, gator däremellan, och samtliga Knektar (poliser) startar samlade på polisstationen i mitten. <strong>Alla övriga kort — allt utom Ess, Kung och Knekt — läggs upp och ner (dolda) på sina platser innan spelet börjar.</strong> Varje spelare placerar sin droska på sitt eget Ess. Ess och Kung ligger fast hela spelet och flyttas aldrig.</p>
        <div class="setup-image-container"><img src="setup.PNG" alt="Setup"></div>
        <p>Spelar ni 2 eller 3 syndikat: de oanvända färgernas Ess och Kung ligger ändå kvar på bordet som vanligt — de är helt enkelt inte i spel den här kvällen.</p>

        <h2>Spelidé & Mål</h2>
        <p>Du leder ett brottssyndikat i 1920-talets Chicago. Din uppgift är att hämta laster med svarta pengar — skattkistor värda $1000 styck — hos din Boss (Kung), smuggla dem genom stadens farliga gator, och gömma dem säkert i ditt Högkvarter (Ess). Först till <strong>tre fulla kistor ($${WINNING_VAULT} totalt)</strong> säkrade i sin kista tar över staden och vinner spelet.</p>

        <h2>Turordning</h2>
        <p>Bara en spelare i taget styr appen — namnet syns i turordnings-bannern högst upp. Slå tärningen, flytta din droska på brädet, gör upp eventuella affärer (betala tull, slagsmål, etc.), och avsluta ditt drag genom att trycka "${R.btnNextPlayer}". Turordningen följer bordets layout medurs: <strong>Nightspades → Diamond → Crimson → Iron Clovers</strong>.</p>

        <h2>Tärningsregel</h2>
        <ul>
            <li><strong>1-4:</strong> Gå så många steg tärningen visar.</li>
            <li><strong>5:</strong> Välj FÖRST: flytta din knekt 1 steg, ELLER dra ett händelsekort. Gå SEDAN 4 steg med din egen droska.</li>
            <li><strong>6:</strong> Välj FÖRST: flytta din knekt 2 steg, ELLER dra ett händelsekort. Gå SEDAN 4 steg med din egen droska.</li>
            <li>Du får gå framåt, bakåt eller i sidled — aldrig diagonalt (om inte ett händelsekort säger annat).</li>
            <li>Du måste alltid gå <strong>hela</strong> antalet steg. Undantag: om du inte kan gå längre (blockerad), eller om du når fram till din egen Kung eller ditt eget Ess innan stegen är slut — då stannar du där direkt, oavsett hur många steg som återstår.</li>
            <li>Du får inte backa till ett kort du redan passerat tidigare under samma drag.</li>
        </ul>
        <p style="color:#ecc94b;">💡 Glöm inte att betala tull om du landar på en motståndares kvarter — appen påminner dig efter varje drag, men det är upp till er vid bordet att faktiskt göra det.</p>

        <h2>Skattkistan & Fickan</h2>
        <p>Fickan (kontanter du bär på dig, start $20) och Kistan (säkrade pengar i ditt Högkvarter) är två helt separata saldon som aldrig blandas ihop.</p>
        <ul>
            <li><strong>Hos din Kung:</strong> om du inte redan bär en last, hämtar du en skattkista för $1000 ur stadens kassa. Max en last åt gången.</li>
            <li><strong>På väg till ditt Ess:</strong> om fickan sjunker mot $0 medan du bär en last, gå tillbaka till din Kung och ladda om fickan till $20 — helt gratis. Du behåller lasten, inga framsteg går förlorade.</li>
            <li><strong>Hos ditt Ess:</strong> lämna av lasten i din kista. Kistan växer med $1000, och du kan ge dig ut på en ny runda.</li>
        </ul>

        <h2>Regler för brädet</h2>
        <ul>
            <li>Du får inte passera över en motståndares knekt — hitta en annan väg.</li>
            <li>Du får passera men aldrig stanna på en motståndares Kung eller Ess.</li>
            <li>Landar du på ett <strong>dolt (upp-och-nervänt) kort</strong> vänds det upp direkt, och du betalar tull som vanligt utifrån kortets värde.</li>
            <li>Landar du på ett redan <strong>öppet kvarter</strong> betalar du tull till den spelare som äger den färgen.</li>
            <li>Landar du på ett kort av <strong>din egen färg</strong> är det alltid gratis — men kortet vänds ändå upp om det låg dolt.</li>
            <li><strong>Tullens storlek styrs av kortets eget värde:</strong> landar du t.ex. på Spader 5 betalar du $5 till Nightspades, landar du på Ruter 9 betalar du $9 till Diamond, och så vidare.</li>
            <li>2-3 spelare: tull för en färg som ingen äger går till stadens kassa istället (via "Överför pengar" → Stadens kassa).</li>
        </ul>

        <h2>Regler för Gatuslagsmål 💥</h2>
        <p>Landar din droska på en ruta där en motståndare redan står blir det gatuslagsmål på stubben! Tryck "Slagsmål" och välj motståndare.</p>
        <ul>
            <li>Båda slår varsin digital tärning.</li>
            <li><strong>Vinst:</strong> vinnaren stjäl $10 direkt ur förlorarens ficka.</li>
            <li><strong>Oavgjort:</strong> den som blev attackerad (försvararen) vinner.</li>
            <li>Har förloraren mindre än $10 kvar i fickan tar vinnaren allt som finns, och förlorarens ficka laddas om till $20.</li>
            <li>Förloraren flyttar sin fysiska droska tillbaka — inget eget val, det styrs av vart de var på väg: på väg mot Ess → tillbaka till Kung. På väg mot Kung → tillbaka till Ess. Appen visar exakt vart du ska.</li>
        </ul>

        <h2>Barerna (Damerna) 🥂</h2>
        <p>Barerna är neutral, fredad mark. Du kan varken bli attackerad i ett slagsmål eller haffad av polisen där, och det är alltid gratis att landa på en Dam oavsett färg. Men bara en spelare åt gången får plats vid baren — eftersom man inte kan slåss där kan du helt enkelt inte gå in på en Dam som redan är upptagen. Och det goda livet har sitt pris: du tappar fokus och måste <strong>stå över din nästa runda</strong>.</p>

        <h2>Polisen (Knektar) & Arresteringar 🚨</h2>
        <p>Poliserna rör sig ENDAST när du väljer det vid tärningsslag 5 eller 6, eller via händelsekortet "Mutor inom polisen". Landar din knekt på en motståndares droska blir den spelaren automatiskt haffad — appen frågar dig direkt efter flytten. Det finns ingen manuell "Haffad"-knapp längre, allt sköts av appen.</p>
        <p>Straffet för den som grips:</p>
        <ul>
            <li><strong>HELA</strong> offrets fickinnehåll — oavsett belopp — går rakt in i din egen ficka.</li>
            <li>Bar offret på en skattkista förlorar de den helt. Den försvinner spårlöst, går varken till staden eller någon annan spelare.</li>
            <li>Offrets riktning återställs till "på väg till Kung", och fickan laddas om till $20.</li>
        </ul>

        <h2>Händelsekort 🎴</h2>
        <p>Sex Noir-kort finns kvar i leken: Mutor inom polisen, Gatustrid, Razzia, Ekonomisk Kris, Genväg i gränden och Ficktjuv. De flesta är rent beskrivande text — läs och utför dem vid bordet på hedersord. Ett undantag: drar du <strong>Ficktjuv</strong> väljer du direkt i appen vilken motståndare du sno $10 ifrån (stadens kassa kan aldrig väljas).</p>

        <h2>Betalningar & Stadens Kassa 🏛️</h2>
        <p>Behöver du betala tull, böter eller annat till en motståndare — eller till staden, om du landar på en färg som ingen äger i ett 2-3-spelarparti — tryck "Överför pengar" på din panel och välj mottagare och belopp. Stadens kassa syns inte på skärmen men finns hela tiden i bakgrunden, och det är därifrån nya skattkistor betalas ut hos Kungarna.</p>

        <button class="popup-btn" onclick="window.NoirUI.closeRulesModal()">Stäng och återgå till spelet</button>
    ` : `
        <h1 style="color:#2b6cb0; text-align:center; letter-spacing: 2px;">THE NOIR SYNDICATE — RULES</h1>

        <h2>Board Setup (Card Layout)</h2>
        <p>Arrange the physical board using a standard deck of cards according to the image below. Core pattern: Aces in the corners, Kings along the edges, streets in between, and all Jacks (cops) start together at the precinct in the center. <strong>Every other card — everything except Aces, Kings, and Jacks — is placed face-down on its spot before play begins.</strong> Every player places their token on their own Ace. Aces and Kings are fixed for the whole game and never move.</p>
        <div class="setup-image-container"><img src="setup.PNG" alt="Setup"></div>
        <p>Playing with 2 or 3 syndicates: the unused colors' Ace and King still sit on the table as usual — they're simply not in play tonight.</p>

        <h2>Objective</h2>
        <p>You lead a crime syndicate in 1920s Chicago. Your job is to pick up contraband cash shipments — $1000 treasure chests — from your Boss (King), smuggle them through the city's dangerous streets, and stash them safely in your Headquarters (Ace). First to secure <strong>three full chests ($${WINNING_VAULT} total)</strong> in their vault takes over the city and wins.</p>

        <h2>Turn Order</h2>
        <p>Only one player at a time controls the app — their name is shown in the turn banner up top. Roll the dice, move your token on the board, settle any business (pay rent, fights, etc.), then end your turn by tapping "${R.btnNextPlayer}". Turn order follows the board layout clockwise: <strong>Nightspades → Diamond → Crimson → Iron Clovers</strong>.</p>

        <h2>Dice Rule</h2>
        <ul>
            <li><strong>1-4:</strong> Move that many spaces.</li>
            <li><strong>5:</strong> Choose FIRST: move your cop 1 step, OR draw an event card. THEN move your own token 4 spaces.</li>
            <li><strong>6:</strong> Choose FIRST: move your cop 2 steps, OR draw an event card. THEN move your own token 4 spaces.</li>
            <li>You may move forward, backward, or sideways — never diagonally (unless an event card says otherwise).</li>
            <li>You must always move the <strong>full</strong> number of spaces. Exceptions: if you can't move further (blocked), or if you reach your own King or Ace before the spaces run out — then you stop there immediately, no matter how many spaces remain.</li>
            <li>You may not backtrack onto a card you already passed earlier in the same move.</li>
        </ul>
        <p style="color:#ecc94b;">💡 Don't forget to pay rent if you land on an opponent's quarter — the app reminds you after every move, but it's on you at the table to actually do it.</p>

        <h2>The Vault & Your Pocket</h2>
        <p>Your Pocket (cash on hand, starts at $20) and your Vault (secured funds at HQ) are two completely separate balances that never mix.</p>
        <ul>
            <li><strong>At your King:</strong> if you're not already carrying cargo, pick up a $1000 shipment straight out of the city treasury. Max one shipment at a time.</li>
            <li><strong>Heading to your Ace:</strong> if your pocket runs toward $0 while carrying cargo, head back to your King and refill your pocket to $20 — completely free. You keep the cargo, no progress lost.</li>
            <li><strong>At your Ace:</strong> drop the cargo into your vault. Your vault grows by $1000, and you're ready to head out again.</li>
        </ul>

        <h2>Board Rules</h2>
        <ul>
            <li>You may not pass over an opponent's cop — you'll have to find another way around.</li>
            <li>You may pass but never stop on an opponent's King or Ace.</li>
            <li>Land on a <strong>face-down card</strong> and it's flipped up immediately — pay rent as usual, based on the card's value.</li>
            <li>Land on an already <strong>face-up quarter</strong> and you pay rent to whichever player owns that color.</li>
            <li>Land on a card of <strong>your own color</strong> and it's always free — though the card still gets flipped up if it was face-down.</li>
            <li><strong>Rent is set by the card's own value:</strong> land on Spades 5, pay $5 to Nightspades. Land on Diamonds 9, pay $9 to Diamond, and so on.</li>
            <li>2-3 players: rent for an unowned color goes to the city treasury instead (via "Transfer Cash" → City Treasury).</li>
        </ul>

        <h2>Street Fight Rules 💥</h2>
        <p>If your token lands on a square already held by an opponent, a street fight breaks out on the spot! Tap "Street Fight" and pick your opponent.</p>
        <ul>
            <li>Both roll a digital die.</li>
            <li><strong>Victory:</strong> the winner steals $10 straight from the loser's pocket.</li>
            <li><strong>Draw:</strong> the one who got attacked (the defender) wins.</li>
            <li>If the loser has less than $10 left, the winner takes everything they have, and the loser's pocket is refilled to $20.</li>
            <li>The loser moves their physical token back — no choice involved, it's determined by where they were heading: heading to Ace → back to King. Heading to King → back to Ace. The app shows exactly where to go.</li>
        </ul>

        <h2>The Bars (Queens) 🥂</h2>
        <p>Bars are neutral, safe ground. You can't be attacked in a fight or busted by the cops there, and landing on a Queen is always free regardless of color. But only one player fits at the bar at a time — since fights can't happen there, you simply can't enter a Queen that's already occupied. And the high life comes at a price: you lose focus and must <strong>skip your next round</strong>.</p>

        <h2>The Cops (Jacks) & Arrests 🚨</h2>
        <p>Cops move ONLY when you choose to at a dice roll of 5 or 6, or via the "Police Bribery" event card. If your cop lands on an opponent's token, that player is automatically busted — the app asks you right after the move. There's no manual "Busted" button anymore, the app handles it all.</p>
        <p>The penalty for whoever gets caught:</p>
        <ul>
            <li><strong>ALL</strong> of the victim's pocket cash — whatever the amount — goes straight into your own pocket.</li>
            <li>If the victim was carrying a shipment, they lose it completely. It vanishes without a trace — it doesn't go to the city or any other player.</li>
            <li>The victim's direction resets to "heading to King", and their pocket is refilled to $20.</li>
        </ul>

        <h2>Event Cards 🎴</h2>
        <p>Six Noir cards remain in the deck: Police Bribery, Turf War, Police Raid, Economic Crash, Alleyway Shortcut, and Pickpocket. Most are purely descriptive — read them aloud and carry them out at the table on your honor. One exception: draw <strong>Pickpocket</strong> and you choose right in the app which opponent to steal $10 from (the city treasury can never be chosen).</p>

        <h2>Payments & the City Treasury 🏛️</h2>
        <p>Need to pay rent, a fine, or anything else to an opponent — or to the city, if you land on a color nobody owns in a 2-3 player game — tap "Transfer Cash" on your panel and pick a recipient and amount. The city treasury isn't shown on screen but is always ticking away in the background, and it's what pays out new shipments at the Kings.</p>

        <button class="popup-btn" onclick="window.NoirUI.closeRulesModal()">Close and Resume Game</button>
    `;
}

// ▶ SEKTION: Init
export function initUI() {
    subscribe(() => renderAll());
    renderAll();
    drawDiceDots(1);
}
