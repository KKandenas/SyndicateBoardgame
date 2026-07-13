// ============================================================
// main.js
// ============================================================
// Ansvar: startpunkten. Kopplar ihop allt.
//
// Eftersom ui.js är en ES-modul (export/import) är dess funktioner
// INTE globala. index.html använder fortfarande enkla onclick-attribut
// (t.ex. onclick="window.NoirUI.rollDice()") för att hållas läsbar,
// så vi exponerar alla ui.js-funktioner via window.NoirUI här — det
// är den enda platsen i hela appen som medvetet skriver till window.
// ============================================================

import * as UI from './ui.js';

window.NoirUI = UI;

document.addEventListener('DOMContentLoaded', () => {
    UI.initUI();
});
