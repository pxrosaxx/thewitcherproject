const { EmbedBuilder } = require('discord.js');
const schools = require('../data/schools');

// Stalowy blekit - wiedzminska stal (medalion). Neutralny motyw przewodni.
const KOLOR = 0x5d7a8f;
// Kolory wyniku walki - natychmiastowy sygnal wizualny.
const KOLOR_WIN = 0x3ba55d;   // zielony - zwyciestwo
const KOLOR_LOSS = 0xc04042;  // czerwony - porazka

const DIVIDER = '────────────────────';

/** Kolor wg wyniku starcia. */
function outcomeColor(won) {
    return won ? KOLOR_WIN : KOLOR_LOSS;
}

function baseEmbed(title) {
    return new EmbedBuilder().setColor(KOLOR).setTitle(title);
}

/**
 * Linia autora "Imię · Szkoła X" u góry karty.
 * iconURL zostawione na przyszlosc - gdy pojawia sie herby szkol, wystarczy je tu wpiac.
 */
function authorFor(player) {
    const school = schools[player.school];
    return { name: `${player.name} · ${school ? school.name : 'Wiedźmin'}` };
    // Gdy beda herby: return { name: ..., iconURL: school.crestUrl };
}

/** Pasek postepu z bloczkow unicode. */
function progressBar(current, max, length = 14) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/** Pasek z wartoscia procentowa. */
function progressBarPct(current, max, length = 14) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
    return `${progressBar(current, max, length)} ${Math.round(ratio * 100)}%`;
}

module.exports = {
    baseEmbed, authorFor, outcomeColor,
    progressBar, progressBarPct,
    KOLOR, KOLOR_WIN, KOLOR_LOSS, DIVIDER
};
