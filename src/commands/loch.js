const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const {
    LOCATIONS, LOCATION_ORDER, getMonsterForLocation, unlockedLocations
} = require('../data/monsters');
const {
    combatantFromPlayer, combatantFromMonster, simulateCombat
} = require('../game/combat');
const { getStatsAtLevel, calculateMaxHp, expForNextLevel } = require('../game/character');
const { refreshActionPoints, spendActionPoint, formatDuration } = require('../game/actionpoints');
const { baseEmbed, progressBar } = require('../utils/embeds');
const { effectiveStats, SLOT_ORDER, rollDrop, formatItem, RARITY } = require('../game/equipment');
const { getEquippedMap, addItem } = require('../game/inventory');

// Wizualne oznaczenie trudnosci lokacji wg przesuniecia poziomu.
const TRUDNOSC = ['🟢 łatwe', '🟡 umiarkowane', '🟠 trudne', '🔴 bardzo trudne', '💀 ekstremalne'];
const STYL = [ButtonStyle.Success, ButtonStyle.Primary, ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Danger];

/** Skraca dziennik walki do czytelnej dlugosci. */
function formatLog(log, maxLines = 16) {
    if (log.length <= maxLines) return log.join('\n');
    const head = log.slice(0, maxLines - 3);
    const tail = log.slice(-3);
    return `${head.join('\n')}\n*… pominięto ${log.length - maxLines} akcji …*\n${tail.join('\n')}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loch')
        .setDescription('Wyrusz na kontrakt — wybierz lokację i zmierz się z potworem.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        if (!player || !player.school) {
            return interaction.reply({
                content: 'Najpierw stwórz postać i wybierz Szkołę komendą `/postac`.',
                flags: MessageFlags.Ephemeral
            });
        }

        const ap = await refreshActionPoints(db, player);
        const zones = unlockedLocations(player.level);

        // Embed wyboru lokacji.
        const selectEmbed = baseEmbed('🗺️ Tablica kontraktów')
            .setDescription(
                `Wiedźminie **${player.name}**, gdzie ruszasz na łów?\n\n` +
                `⚡ **Punkty akcji:** ${ap.points}/${ap.max}` +
                (ap.points < ap.max ? `  *(następny za ${formatDuration(ap.secondsToNext)})*` : '') +
                `\n🔥 **Passa zwycięstw:** ${player.win_streak || 0}`
            );

        for (const key of zones) {
            const loc = LOCATIONS[key];
            selectEmbed.addFields({
                name: `${loc.emoji} ${loc.name}`,
                value: `${TRUDNOSC[loc.levelOffset]} • od ${loc.minLevel} poz.\n*${loc.intro}*`,
                inline: false
            });
        }

        // Brak punktow akcji - pokazujemy info i konczymy.
        if (ap.points <= 0) {
            selectEmbed.setFooter({ text: `Brak punktów akcji — wróć za ${formatDuration(ap.secondsToNext)}` });
            return interaction.reply({ embeds: [selectEmbed] });
        }

        // Przyciski lokacji (max 5, miesci sie w jednym rzedzie).
        const row = new ActionRowBuilder();
        zones.forEach((key) => {
            const loc = LOCATIONS[key];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`loch_${key}`)
                    .setLabel(loc.name)
                    .setEmoji(loc.emoji)
                    .setStyle(STYL[loc.levelOffset])
            );
        });

        await interaction.reply({ embeds: [selectEmbed], components: [row] });
        const message = await interaction.fetchReply();

        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('loch_'),
                componentType: ComponentType.Button,
                time: 60000
            });
        } catch {
            // Czas minal - wygaszamy przyciski.
            const expired = baseEmbed('🗺️ Tablica kontraktów')
                .setDescription('Zwlekałeś zbyt długo. Kontrakt przepadł — użyj `/loch` ponownie.');
            await interaction.editReply({ embeds: [expired], components: [] }).catch(() => {});
            return;
        }

        // Ponowne pobranie gracza (mogl sie zmienic) i sprawdzenie AP.
        const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        await refreshActionPoints(db, fresh);
        if ((fresh.action_points || 0) <= 0) {
            await choice.update({
                embeds: [baseEmbed('⚡ Brak sił').setDescription('Nie masz już punktów akcji na ten kontrakt.')],
                components: []
            });
            return;
        }

        const locationKey = choice.customId.replace('loch_', '');
        const loc = LOCATIONS[locationKey];

        // Wydajemy 1 AP i generujemy potwora.
        await spendActionPoint(db, fresh);
        const monster = getMonsterForLocation(locationKey, fresh.level);

        const school = schools[fresh.school];

        // Efektywne statystyki = bazowe (z poziomu) + ekwipunek.
        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equippedArr = SLOT_ORDER.map((sl) => equippedMap[sl]).filter(Boolean);
        const baseStats = { str: fresh.str, dex: fresh.dex, intel: fresh.intel, wit: fresh.wit, luck: fresh.luck };
        const eff = effectiveStats(baseStats, equippedArr, fresh.school);
        const combatPlayer = { ...fresh, ...eff, max_hp: calculateMaxHp(eff, fresh.level) };

        const pc = combatantFromPlayer(combatPlayer, school);
        const mc = combatantFromMonster(monster);
        const result = simulateCombat(pc, mc);
        const won = result.winner === 'player';

        // Lup: szansa na przedmiot przy zwyciestwie.
        let drop = null;
        if (won) {
            drop = rollDrop(monster.level, loc.levelOffset, monster.isElite);
            if (drop) await addItem(db, interaction.user.id, drop);
        }

        // --- Nagrody i awans ---
        let gainedExp = 0, gainedCrowns = 0, streakBonus = 0;
        let newStreak = fresh.win_streak || 0;
        const levelsGained = [];

        if (won) {
            gainedExp = monster.expReward;
            gainedCrowns = monster.crownReward;
            newStreak += 1;

            // Premia za passe: co 5 zwyciestw z rzedu - dodatkowe korony.
            if (newStreak % 5 === 0) {
                streakBonus = newStreak * 5;
                gainedCrowns += streakBonus;
            }

            fresh.exp += gainedExp;
            fresh.crowns += gainedCrowns;

            // Petla awansow.
            while (fresh.exp >= expForNextLevel(fresh.level)) {
                fresh.exp -= expForNextLevel(fresh.level);
                fresh.level += 1;
                levelsGained.push(fresh.level);
            }
            if (levelsGained.length > 0) {
                const st = getStatsAtLevel(school, fresh.level);
                fresh.str = Math.round(st.str);
                fresh.dex = Math.round(st.dex);
                fresh.intel = Math.round(st.intel);
                fresh.wit = Math.round(st.wit);
                fresh.luck = Math.round(st.luck);
                fresh.max_hp = calculateMaxHp(st, fresh.level);
            }
        } else {
            newStreak = 0;
        }

        // Po walce leczymy do pelna (na razie brak osobnego systemu leczenia).
        fresh.hp = fresh.max_hp;
        fresh.win_streak = newStreak;

        await db.run(
            `UPDATE players SET exp = ?, crowns = ?, level = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?,
             hp = ?, max_hp = ?, win_streak = ? WHERE discord_id = ?`,
            fresh.exp, fresh.crowns, fresh.level, fresh.str, fresh.dex, fresh.intel, fresh.wit, fresh.luck,
            fresh.hp, fresh.max_hp, fresh.win_streak, interaction.user.id
        );

        // --- Embed wyniku ---
        const monsterTitle = `${monster.emoji} ${monster.name}${monster.isElite ? ' ⭐' : ''} (poz. ${monster.level})`;
        const resultEmbed = baseEmbed(won ? '⚔️ Zwycięstwo!' : '💀 Porażka')
            .setDescription(
                `${loc.emoji} **${loc.name}**\n` +
                `Przeciwnik: ${monsterTitle}\n\n` +
                `${formatLog(result.log)}`
            );

        if (won) {
            const expNeeded = expForNextLevel(fresh.level);
            let nagrody = `🟡 **+${gainedExp}** exp\n👑 **+${gainedCrowns}** koron`;
            if (streakBonus > 0) nagrody += ` *(w tym +${streakBonus} za passę!)*`;
            resultEmbed.addFields(
                { name: 'Łup', value: nagrody, inline: false },
                {
                    name: 'Postęp',
                    value: `Poziom ${fresh.level} • ${fresh.exp}/${expNeeded} exp\n${progressBar(fresh.exp, expNeeded)}`,
                    inline: false
                }
            );
            if (levelsGained.length > 0) {
                resultEmbed.addFields({
                    name: '🎉 Awans!',
                    value: `Osiągnąłeś **poziom ${fresh.level}**! Statystyki wzrosły, a rany się zagoiły.`,
                    inline: false
                });
            }
            if (drop) {
                resultEmbed.addFields({
                    name: `${RARITY[drop.rarity].emoji} Znaleziono przedmiot!`,
                    value: `${formatItem(drop)}\n*Sprawdź \`/ekwipunek\`, by go założyć.*`,
                    inline: false
                });
            }
        } else {
            resultEmbed.addFields({
                name: 'Skutek',
                value: 'Ledwo uszedłeś z życiem. Passa zwycięstw przerwana, ale rany się zagoiły.',
                inline: false
            });
        }

        resultEmbed.setFooter({
            text: `⚡ Punkty akcji: ${fresh.action_points}/${fresh.max_action_points}  •  🔥 Passa: ${newStreak}`
        });

        await choice.update({ embeds: [resultEmbed], components: [] });
    }
};
