const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const { baseEmbed, authorFor } = require('../utils/embeds');
const { getAllStats } = require('../game/player_stats');
const {
    ACHIEVEMENTS, CATEGORIES, metricValue, getEarnedIds,
    checkAchievements, unlockedTitles, setTitle
} = require('../data/achievements');

module.exports = {
    data: new SlashCommandBuilder().setName('osiagniecia').setDescription('Twoje osiągnięcia i tytuły.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        await checkAchievements(db, interaction.user.id);
        const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        const stats = await getAllStats(db, interaction.user.id);
        const earned = await getEarnedIds(db, interaction.user.id);

        const embed = baseEmbed('Osiągnięcia').setAuthor(authorFor(fresh))
            .setDescription(`Zdobyto **${earned.size}/${ACHIEVEMENTS.length}**.` + (fresh.title ? `\nTytuł: **${fresh.title}**` : ''));

        for (const cat of CATEGORIES) {
            const lines = ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                if (earned.has(a.id)) {
                    return `✓ **${a.name}**${a.title ? ` — tytuł: ${a.title}` : ''}`;
                }
                const cur = metricValue(a.metric, fresh, stats);
                return `○ ${a.name} — ${cur}/${a.threshold}`;
            });
            embed.addFields({ name: cat, value: lines.join('\n').slice(0, 1024), inline: false });
        }

        const titles = await unlockedTitles(db, interaction.user.id);
        const components = [];
        if (titles.length > 0) {
            const options = [{ label: 'Bez tytułu', value: 'none' }].concat(
                titles.slice(0, 24).map((t) => ({ label: t.slice(0, 100), value: t, default: t === fresh.title }))
            );
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('title_pick').setPlaceholder('Ustaw tytuł na profil').addOptions(options)
            ));
            embed.setFooter({ text: 'Wybierz tytuł z listy poniżej — pojawi się na Twojej karcie postaci.' });
        } else {
            embed.setFooter({ text: 'Zdobywaj osiągnięcia, by odblokować tytuły na profil.' });
        }

        await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
        if (components.length === 0) return;

        const message = await interaction.fetchReply();
        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'title_pick',
                componentType: ComponentType.StringSelect, time: 60000
            });
        } catch {
            await interaction.editReply({ components: [] }).catch(() => {});
            return;
        }

        const picked = choice.values[0] === 'none' ? '' : choice.values[0];
        await setTitle(db, interaction.user.id, picked);
        embed.setDescription(`Zdobyto **${earned.size}/${ACHIEVEMENTS.length}**.` + (picked ? `\nTytuł: **${picked}**` : '\nTytuł zdjęty.'));
        embed.setFooter({ text: picked ? `Ustawiono tytuł: ${picked}` : 'Tytuł zdjęty.' });
        await choice.update({ embeds: [embed], components: [] });
    }
};
