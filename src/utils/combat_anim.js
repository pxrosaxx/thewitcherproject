// =============================================================================
//  ANIMATOR WALKI — odsłania log starcia krok po kroku, edytując wiadomość.
//  Discord nie lubi zbyt czestych edycji, wiec log ujawniamy PORCJAMI (kilka
//  krokow z odstepami), a nie linia po linii.
// =============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param interaction   - interakcja (po deferUpdate); edytuje oryginalna odpowiedz
 * @param lines         - tablica linii logu do odsloniecia (juz sformatowanych)
 * @param makeFrameEmbed - (widoczneLinie) => EmbedBuilder klatki "w trakcie"
 * @param finalEmbed    - gotowy embed wyniku (nagrody, kolor wg wyniku, grafika)
 */
async function revealCombat(interaction, lines, makeFrameEmbed, finalEmbed, opts = {}) {
    const steps = opts.steps || 5;
    const delayMs = opts.delayMs || 1100;
    const n = lines.length;

    // Bardzo krotka walka - nie ma czego animowac.
    if (n <= 2) {
        await delay(450);
        await interaction.editReply({ embeds: [finalEmbed], components: [] }).catch(() => {});
        return;
    }

    const chunk = Math.max(1, Math.ceil(n / steps));

    // Pierwsza klatka od razu.
    await interaction.editReply({ embeds: [makeFrameEmbed(lines.slice(0, chunk))], components: [] }).catch(() => {});

    for (let shown = chunk * 2; shown < n; shown += chunk) {
        await delay(delayMs);
        await interaction.editReply({ embeds: [makeFrameEmbed(lines.slice(0, shown))], components: [] }).catch(() => {});
    }

    await delay(delayMs);
    await interaction.editReply({ embeds: [finalEmbed], components: [] }).catch(() => {});
}

module.exports = { revealCombat, delay };
