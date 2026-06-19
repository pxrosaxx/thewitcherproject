const { EmbedBuilder } = require('discord.js');

// Odcien starego zlota - kolor medalionu wiedzminskiego, motyw przewodni embedow.
const KOLOR = 0xc0a062;

// Cienki separator do wizualnego rozdzielania sekcji w opisach.
const DIVIDER = '────────────────────';

function baseEmbed(title) {
    return new EmbedBuilder()
        .setColor(KOLOR)
        .setTitle(title);
}

/** Pasek postepu z bloczkow unicode (HP, exp itp.). */
function progressBar(current, max, length = 12) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/** Pasek z wartoscia procentowa, np. "████░░░░ 42%". */
function progressBarPct(current, max, length = 12) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
    return `${progressBar(current, max, length)} ${Math.round(ratio * 100)}%`;
}

module.exports = { baseEmbed, progressBar, progressBarPct, KOLOR, DIVIDER };
