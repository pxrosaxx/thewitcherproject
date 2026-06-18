const { SlashCommandBuilder } = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { expForNextLevel } = require('../game/character');
const { refreshActionPoints, formatDuration } = require('../game/actionpoints');
const { getEquipmentBonus } = require('../game/inventory');
const { calculateMaxHp } = require('../game/character');
const { baseEmbed, progressBar } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('profil').setDescription('Pokazuje kartę Twojej postaci.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        if (!player) {
            return interaction.reply({
                content: 'Nie masz jeszcze postaci. Użyj `/postac`, żeby ją stworzyć.',
                ephemeral: true
            });
        }

        if (!player.school) {
            return interaction.reply({
                content: `**${player.name}** czeka jeszcze na wybór Szkoły. Użyj \`/postac\`, żeby dokończyć tworzenie.`,
                ephemeral: true
            });
        }

        const school = schools[player.school];
        const expNeeded = expForNextLevel(player.level);
        const ap = await refreshActionPoints(db, player);
        const bonus = await getEquipmentBonus(db, interaction.user.id, player.school);
        const eff = {
            str: player.str + bonus.str, dex: player.dex + bonus.dex, intel: player.intel + bonus.intel,
            wit: player.wit + bonus.wit, luck: player.luck + bonus.luck
        };
        const effMaxHp = calculateMaxHp(eff, player.level);
        const fmt = (base, b) => b > 0 ? `${base + b} (+${b})` : `${base}`;

        const apValue = `${ap.points}/${ap.max} ⚡` +
        (ap.points < ap.max ? `\n*następny za ${formatDuration(ap.secondsToNext)}*` : '');

        const embed = baseEmbed(`${school.emoji} ${player.name}`)
        .setDescription(`${school.name} — *${school.title}*`)
        .addFields(
            { name: 'Poziom', value: `${player.level}`, inline: true },
            {
                name: 'Doświadczenie',
                value: `${player.exp} / ${expNeeded}\n${progressBar(player.exp, expNeeded)}`,
                   inline: true
            },
            { name: 'Korony', value: `${player.crowns} 👑`, inline: true },
            {
                name: 'Punkty życia',
                value: `${effMaxHp} / ${effMaxHp}\n${progressBar(1, 1)}`,
                   inline: false
            },
            { name: 'Punkty akcji', value: apValue, inline: true },
            { name: 'Passa zwycięstw', value: `${player.win_streak || 0} 🔥`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'Siła', value: fmt(player.str, bonus.str), inline: true },
                   { name: 'Zręczność', value: fmt(player.dex, bonus.dex), inline: true },
                   { name: 'Inteligencja', value: fmt(player.intel, bonus.intel), inline: true },
                   { name: 'Witalność', value: fmt(player.wit, bonus.wit), inline: true },
                   { name: 'Szczęście', value: fmt(player.luck, bonus.luck), inline: true },
                   { name: '\u200b', value: '\u200b', inline: true }
        );

        await interaction.reply({ embeds: [embed] });
    }
};
