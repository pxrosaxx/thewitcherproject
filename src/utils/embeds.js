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

/** Pojedynczy pasek zycia walczacego: ikona, imie, pasek i liczby. */
function hpBar(icon, name, hp, max) {
    const cur = Math.max(0, Math.round(hp));
    const m = Math.max(1, Math.round(max));
    return `${icon} **${name}**\n${progressBar(cur, m, 16)}  \`${cur}/${m}\``;
}

/** Blok zycia obu stron (gracz na zielono/serce, przeciwnik na czerwono/czacha). */
function combatBars(pName, pHp, pMax, mName, mHp, mMax) {
    return `${hpBar('❤️', pName, pHp, pMax)}\n${hpBar('💀', mName, mHp, mMax)}`;
}

/**
 * Wspolny embed walki — sekcje rozdzielone liniami:
 *   naglowek  ──  paski zycia  ──  log  [+ pola: nagrody/alchemia]
 * Uzywany jako klatka animacji i jako embed koncowy (podziemia / zlecenia / arena).
 */
function combatEmbed({ title, color, author, header, pName, pHp, pMax, mName, mHp, mMax, logLines, image, fields }) {
    const e = baseEmbed(title);
    if (color != null) e.setColor(color);
    if (author) e.setAuthor(author);

    const parts = [];
    if (header) parts.push(header, DIVIDER);
    parts.push(combatBars(pName, pHp, pMax, mName, mHp, mMax));
    const logText = (logLines || []).join('\n');
    if (logText) {
        // Bezpieczny limit opisu embeda (4096); zostawiamy zapas, trzymajac ogon (najnowsze).
        parts.push(DIVIDER, logText.length > 3500 ? `…\n${logText.slice(-3500)}` : logText);
    }
    e.setDescription(parts.join('\n'));

    if (image) e.setImage(image);
    if (fields && fields.length) e.addFields(...fields);
    return e;
}

module.exports = {
    baseEmbed, authorFor, outcomeColor,
    progressBar, progressBarPct, hpBar, combatBars, combatEmbed,
    KOLOR, KOLOR_WIN, KOLOR_LOSS, DIVIDER
};
