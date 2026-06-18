const { EmbedBuilder } = require('discord.js');

// Odcien starego zlota - kolor medalionu wiedzminskiego, uzywany jako motyw przewodni embedow.
const KOLOR = 0xc0a062;

function baseEmbed(title) {
    return new EmbedBuilder()
        .setColor(KOLOR)
        .setTitle(title)
        .setFooter({ text: 'Szlak Wiedźmina' })
        .setTimestamp();
}

/**
 * Prosty pasek postepu z bloczkow unicode, np. dla HP albo exp.
 */
function progressBar(current, max, length = 10) {
    const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = { baseEmbed, progressBar, KOLOR };
