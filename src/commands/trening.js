const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const { STAT_KEYS, STAT_INFO, costForNextPoint } = require('../game/training');
const { baseEmbed } = require('../utils/embeds');

async function render(db, discordId) {
    const p = await db.get('SELECT * FROM players WHERE discord_id = ?', discordId);

    const embed = baseEmbed('Trening')
        .setDescription(`Szlifuj statystyki za korony. Im wyższa cecha, tym droższy kolejny punkt.\n\nKorony: **${p.crowns}**`);

    let body = '';
    const row = new ActionRowBuilder();
    for (const key of STAT_KEYS) {
        const info = STAT_INFO[key];
        const bought = p[info.col] || 0;
        const value = p[key] + bought;
        const cost = costForNextPoint(value);
        const trained = bought > 0 ? ` _(+${bought} z treningu)_` : '';
        body += `${info.name}: **${value}**${trained} — następny pkt: **${cost}** koron\n`;

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`train_${key}`)
                .setLabel(`${info.short} (${cost})`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(p.crowns < cost)
        );
    }
    embed.addFields({ name: 'Statystyki', value: body, inline: false });

    return { embeds: [embed], components: [row], player: p };
}

module.exports = {
    data: new SlashCommandBuilder().setName('trening').setDescription('Kupuj punkty statystyk za korony.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT discord_id, school FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const view = await render(db, interaction.user.id);
        await interaction.reply({ embeds: view.embeds, components: view.components });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('train_'),
            time: 120000
        });

        collector.on('collect', async (i) => {
            const key = i.customId.replace('train_', '');
            const info = STAT_INFO[key];
            const p = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
            const value = p[key] + (p[info.col] || 0);
            const cost = costForNextPoint(value);

            let note;
            if (p.crowns < cost) {
                note = `Za mało koron na ${info.name} (potrzeba ${cost}).`;
            } else {
                await db.run(
                    `UPDATE players SET crowns = crowns - ?, ${info.col} = ${info.col} + 1 WHERE discord_id = ?`,
                    cost, interaction.user.id
                );
                note = `Wytrenowano +1 ${info.name} za ${cost} koron.`;
            }

            const view2 = await render(db, interaction.user.id);
            view2.embeds[0].setFooter({ text: note });
            await i.update({ embeds: view2.embeds, components: view2.components });
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
