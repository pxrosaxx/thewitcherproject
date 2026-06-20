const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { OVERVIEW, TOPICS, TOPIC_MAP } = require('../data/help');

function overviewEmbed() {
    return baseEmbed('Pomoc — Szlak Wiedźmina').setDescription(OVERVIEW)
        .setFooter({ text: 'Wybierz temat z menu, by przeczytać więcej.' });
}

function topicEmbed(key) {
    const t = TOPIC_MAP[key];
    if (!t) return overviewEmbed();
    return baseEmbed(t.title).setDescription(t.body)
        .setFooter({ text: 'Wybierz inny temat lub „Przegląd", by wrócić.' });
}

function menuRow(selected) {
    const options = [{ label: 'Przegląd', description: 'Wróć do strony głównej', value: 'overview', default: selected === 'overview' }];
    for (const t of TOPICS) {
        options.push({ label: t.label, description: t.short, value: t.key, default: selected === t.key });
    }
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pomoc_temat').setPlaceholder('Wybierz temat').addOptions(options)
    );
}

module.exports = {
    data: new SlashCommandBuilder().setName('pomoc').setDescription('Przewodnik po grze i komendach.'),

    async execute(interaction) {
        // Pomoc dostępna dla każdego — także bez postaci (to wejście dla nowych graczy).
        await interaction.reply({
            embeds: [overviewEmbed()],
            components: [menuRow('overview')],
            flags: MessageFlags.Ephemeral
        });

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 180000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'To nie jest Twój panel pomocy — otwórz własny przez `/pomoc`.', flags: MessageFlags.Ephemeral });
            }
            const key = i.values[0];
            const embed = key === 'overview' ? overviewEmbed() : topicEmbed(key);
            await i.update({ embeds: [embed], components: [menuRow(key)] });
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
