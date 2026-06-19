const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const { RARITY, makeItemInstance, formatItem } = require('../game/equipment');
const { ITEMS } = require('../data/items');
const { addItem } = require('../game/inventory');
const { baseEmbed } = require('../utils/embeds');

const dayStr = (ms) => new Date(ms).toISOString().split('T')[0];

/** Losowy przedmiot danej rzadkości na poziomie gracza (nagroda kamienia milowego). */
function milestoneItem(rarity, level) {
    const pool = ITEMS.filter((i) => i.rarity === rarity);
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    return makeItemInstance(tpl, level);
}

module.exports = {
    data: new SlashCommandBuilder().setName('dziennie').setDescription('Odbierz codzienną nagrodę. Passa logowań zwiększa łup.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const today = dayStr(Date.now());
        const yesterday = dayStr(Date.now() - 86400000);

        if (player.last_daily === today) {
            const embed = baseEmbed('Codzienna nagroda')
                .setDescription(`Dzisiejszą nagrodę już odebrałeś.\nPassa logowań: **${player.daily_streak || 0}** dni.\nWróć jutro, aby ją przedłużyć.`);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Passa: kontynuacja jeśli wczoraj, inaczej reset do 1.
        const streak = player.last_daily === yesterday ? (player.daily_streak || 0) + 1 : 1;
        const milestone = streak % 7 === 0;

        const crowns = Math.round((50 + player.level * 8) * (1 + Math.min(streak, 7) * 0.15));
        let ears = 0;
        if (milestone) ears = 1;
        else if (Math.random() < 0.12) ears = 1;

        let drop = null;
        if (milestone) {
            const rarity = Math.random() < 0.4 ? 3 : 2;
            drop = milestoneItem(rarity, player.level);
            await addItem(db, interaction.user.id, drop);
        }

        await db.run(
            'UPDATE players SET crowns = crowns + ?, ears = ears + ?, daily_streak = ?, last_daily = ? WHERE discord_id = ?',
            crowns, ears, streak, today, interaction.user.id
        );

        const embed = baseEmbed('Codzienna nagroda')
            .setDescription(`Dzień **${streak}** z rzędu.${milestone ? ' Kamień milowy — większy łup!' : ''}`)
            .addFields({ name: 'Nagroda', value: `+${crowns} koron${ears > 0 ? `\n+${ears} Ucho` : ''}`, inline: false });

        if (drop) {
            embed.addFields({ name: `Przedmiot — ${RARITY[drop.rarity].name}`, value: `${formatItem(drop)}\n*Załóż w \`/ekwipunek\`.*`, inline: false });
        }
        embed.setFooter({ text: 'Wróć jutro, by nie stracić passy.' });

        await interaction.reply({ embeds: [embed] });
    }
};
