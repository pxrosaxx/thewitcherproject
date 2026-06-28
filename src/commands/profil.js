const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { expForNextLevel, calculateMaxHp } = require('../game/character');
const { refreshActionPoints, formatDuration } = require('../game/actionpoints');
const { getEquipmentBonus } = require('../game/inventory');
const { baseWithBought } = require('../game/training');
const { baseEmbed, progressBar, authorFor } = require('../utils/embeds');
const { checkAchievements, getEarnedIds, ACHIEVEMENTS } = require('../data/achievements');

module.exports = {
    data: new SlashCommandBuilder().setName('profil').setDescription('Pokazuje kartę Twojej postaci.'),

    async execute(interaction) {
        const db = await getDbConnection();
        let player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        if (!player) {
            return interaction.reply({
                content: 'Nie masz jeszcze postaci. Użyj `/postac`, żeby ją stworzyć.',
                flags: MessageFlags.Ephemeral
            });
        }
        if (!player.school) {
            return interaction.reply({
                content: `**${player.name}** czeka jeszcze na wybór Szkoły. Użyj \`/postac\`, żeby dokończyć tworzenie.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const school = schools[player.school];

        // Nadgonienie osiągnięć (gdyby coś przekroczyło próg gdzie indziej).
        await checkAchievements(db, interaction.user.id);
        player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        const earnedCount = (await getEarnedIds(db, interaction.user.id)).size;

        const expNeeded = expForNextLevel(player.level);
        const ap = await refreshActionPoints(db, player);
        const bonus = await getEquipmentBonus(db, interaction.user.id, player.school);

        // Efektywne staty = poziom + trening + ekwipunek.
        const base = baseWithBought(player);
        const eff = {
            str: base.str + bonus.str, dex: base.dex + bonus.dex, intel: base.intel + bonus.intel,
            wit: base.wit + bonus.wit, luck: base.luck + bonus.luck
        };
        const effMaxHp = calculateMaxHp(eff, player.level);
        // Pokazujemy wartosc efektywna; w nawiasie laczny bonus (trening + ekwipunek).
        const fmt = (key) => {
            const extra = eff[key] - player[key];
            return extra > 0 ? `${eff[key]} (+${extra})` : `${eff[key]}`;
        };

        const apValue = `${ap.points}/${ap.max}` +
            (ap.points < ap.max ? `\n*następny za ${formatDuration(ap.secondsToNext)}*` : '');

        // Wytrzymalosc (odnawia sie co 12 godzin).
        const today = new Date().toISOString().split('T')[0];
        const stamina = player.last_stamina_reset === today ? player.stamina : 100;
        const maxStamina = 100;

        const embed = baseEmbed('Karta postaci')
            .setAuthor(authorFor(player))
            .setDescription(player.title ? `⚜ *${player.title}*` : `*${school.title}*`)
            .addFields(
                { name: 'Poziom', value: `${player.level}`, inline: true },
                { name: 'Doświadczenie', value: `${player.exp} / ${expNeeded}\n${progressBar(player.exp, expNeeded)}`, inline: true },
                { name: 'Korony', value: `${player.crowns}`, inline: true },
                { name: 'Punkty życia', value: `${effMaxHp} / ${effMaxHp}\n${progressBar(1, 1)}`, inline: false },
                { name: 'Punkty akcji', value: apValue, inline: true },
                { name: 'Wytrzymałość', value: `${stamina}/${maxStamina}`, inline: true },
                { name: 'Uszy', value: `${player.ears || 0}`, inline: true },
                { name: 'Chwała areny', value: `${player.honor ?? 1000} _(${player.arena_wins || 0}W/${player.arena_losses || 0}P)_`, inline: false },
                { name: 'Siła', value: fmt('str'), inline: true },
                { name: 'Zręczność', value: fmt('dex'), inline: true },
                { name: 'Inteligencja', value: fmt('intel'), inline: true },
                { name: 'Witalność', value: fmt('wit'), inline: true },
                { name: 'Szczęście', value: fmt('luck'), inline: true },
                { name: 'Osiągnięcia', value: `${earnedCount}/${ACHIEVEMENTS.length}`, inline: true },
                { name: 'Passa zwycięstw', value: `${player.win_streak || 0}`, inline: true },
                { name: 'Passa logowań', value: `${player.daily_streak || 0} dni`, inline: true }
            )
            .setFooter({ text: 'Tytuł zmienisz w /osiagniecia · bonus w nawiasie = trening + ekwipunek' });

        await interaction.reply({ embeds: [embed] });
    }
};
