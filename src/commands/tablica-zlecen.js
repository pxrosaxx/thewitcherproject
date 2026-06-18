const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const {
    LOCATIONS, getMonsterForLocation, unlockedLocations
} = require('../data/monsters');
const {
    combatantFromPlayer, combatantFromMonster, simulateCombat
} = require('../game/combat');
const { getStatsAtLevel, calculateMaxHp, expForNextLevel } = require('../game/character');
const { baseEmbed, progressBar } = require('../utils/embeds');
const { effectiveStats, SLOT_ORDER, rollDrop, formatItem, RARITY } = require('../game/equipment');
const { getEquippedMap, addItem } = require('../game/inventory');

// --- AUTOMATYCZNA MIGRACJA BAZY ---
// Ten fragment upewnia się, że w bazie są kolumny na Energię i Uszy, bez kasowania Twoich postaci.
async function ensureTavernColumns(db) {
    try { await db.run("ALTER TABLE players ADD COLUMN stamina INTEGER DEFAULT 100"); } catch (e) {}
    try { await db.run("ALTER TABLE players ADD COLUMN last_stamina_reset TEXT DEFAULT ''"); } catch (e) {}
    try { await db.run("ALTER TABLE players ADD COLUMN ears INTEGER DEFAULT 0"); } catch (e) {}
}

// Sprawdza i odnawia 100 pkt Awanturniczości o północy
async function refreshStamina(db, player) {
    const today = new Date().toISOString().split('T')[0]; // Zwraca np. "2026-06-18"[cite: 1, 15]
    let stamina = player.stamina !== undefined ? player.stamina : 100;
    let lastReset = player.last_stamina_reset || '';

    if (lastReset !== today) {
        stamina = 100;
        lastReset = today;
        await db.run('UPDATE players SET stamina = 100, last_stamina_reset = ? WHERE discord_id = ?', today, player.discord_id);
    }
    return { points: stamina, today };
}

/** Skraca dziennik walki do czytelnej dlugosci. */
function formatLog(log, maxLines = 16) {
    if (log.length <= maxLines) return log.join('\n');
    const head = log.slice(0, maxLines - 3);
    const tail = log.slice(-3);
    return `${head.join('\n')}\n*… pominięto ${log.length - maxLines} akcji …*\n${tail.join('\n')}`;
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName('karczma')
    .setDescription('Wybierz jedno z 3 zleceń z tablicy. Wymaga Awanturniczości.'),

    async execute(interaction) {
        const db = await getDbConnection();
        await ensureTavernColumns(db); // Upewniamy się, że są nowe kolumny

        let player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        if (!player || !player.school) {
            return interaction.reply({
                content: 'Najpierw stwórz postać i wybierz Szkołę komendą `/postac`.',
                ephemeral: true
            });
        }

        // --- SYSTEM ENERGII (AWANTURNICZOŚĆ) ---
        const { points: currentStamina, today } = await refreshStamina(db, player);
        player.stamina = currentStamina;
        player.last_stamina_reset = today;

        if (player.stamina <= 0) {
            const noEnergyEmbed = baseEmbed('🍺 Karczma')
            .setDescription('**Jesteś całkowicie wyczerpany.**\nNie masz już siły na kolejne zlecenia. Wróć tu po północy, aby odzyskać 100 punktów Awanturniczości.');
            return interaction.reply({ embeds: [noEnergyEmbed] });
        }

        const zones = unlockedLocations(player.level);

        // --- GENEROWANIE 3 ZLECEŃ (Styl SFGame) ---
        const questTypes = [
            { id: 0, label: 'Krótkie', cost: 10, mult: 1, style: ButtonStyle.Success },
            { id: 1, label: 'Średnie', cost: 20, mult: 2, style: ButtonStyle.Primary },
            { id: 2, label: 'Długie',  cost: 30, mult: 3, style: ButtonStyle.Danger }
        ];

        const quests = [];
        const row = new ActionRowBuilder();
        const selectEmbed = baseEmbed('🍺 Karczma — Tablica Zleceń')
        .setDescription(`Witaj, wiedźminie **${player.name}**. Spójrz na tablicę, mamy 3 świeże zlecenia.\n\n⚡ **Awanturniczość:** ${player.stamina}/100\n🔥 **Passa zwycięstw:** ${player.win_streak || 0}`);

        for (const qt of questTypes) {
            // Losujemy lokację z odblokowanych
            const locKey = zones[Math.floor(Math.random() * zones.length)];
            const loc = LOCATIONS[locKey];

            // Losujemy potwora
            const monster = getMonsterForLocation(locKey, player.level);

            // Jeśli to "Długie" zlecenie, wymuszamy elitę dla podbicia emocji
            if (qt.id === 2 && !monster.isElite) {
                monster.isElite = true;
                monster.name = `Elitarny ${monster.name}`;
                monster.maxHp = Math.floor(monster.maxHp * 1.5);
            }

            // Skalujemy nagrody względem czasu (kosztu)
            const expReward = monster.expReward * qt.mult;
            const crownReward = monster.crownReward * qt.mult;

            quests.push({
                ...qt,
                loc,
                monster,
                expReward,
                crownReward
            });

            const monsterTitle = `${monster.emoji} ${monster.name} (poz. ${monster.level})`;
            selectEmbed.addFields({
                name: `Zlecenie ${qt.id + 1}: ${qt.label}`,
                value: `📍 **Miejsce:** ${loc.name}\n🐺 **Cel:** ${monsterTitle}\n⚡ **Koszt:** -${qt.cost} Awanturniczości\n🏆 **Nagroda:** ${expReward} XP | ${crownReward} 👑`,
                inline: false
            });

            // Dodajemy przyciski, blokujemy te, na które gracz nie ma już energii
            row.addComponents(
                new ButtonBuilder()
                .setCustomId(`karczma_${qt.id}`)
                .setLabel(`Zlecenie ${qt.id + 1}`)
                .setStyle(qt.style)
                .setDisabled(player.stamina < qt.cost)
            );
        }

        await interaction.reply({ embeds: [selectEmbed], components: [row] });
        const message = await interaction.fetchReply();

        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('karczma_'),
                                                         componentType: ComponentType.Button,
                                                         time: 60000
            });
        } catch {
            const expired = baseEmbed('🍺 Karczma').setDescription('Zbyt długo się zastanawiałeś. Ktoś inny wziął te zlecenia — użyj `/karczma` ponownie.');
            await interaction.editReply({ embeds: [expired], components: [] }).catch(() => {});
            return;
        }

        // --- ROZPOCZĘCIE ZLECENIA I WALKA ---
        const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        const { points: freshStamina } = await refreshStamina(db, fresh);
        fresh.stamina = freshStamina;

        const selectedQuestId = parseInt(choice.customId.split('_')[1]);
        const quest = quests[selectedQuestId];

        if (fresh.stamina < quest.cost) {
            return await choice.update({
                embeds: [baseEmbed('⚡ Brak sił').setDescription('Zabrakło Ci Awanturniczości na to zlecenie.')],
                                       components: []
            });
        }

        // Odejmujemy energię z góry
        fresh.stamina -= quest.cost;

        const school = schools[fresh.school];

        // Przygotowanie statystyk do walki
        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equippedArr = SLOT_ORDER.map((sl) => equippedMap[sl]).filter(Boolean);
        const baseStats = { str: fresh.str, dex: fresh.dex, intel: fresh.intel, wit: fresh.wit, luck: fresh.luck };
        const eff = effectiveStats(baseStats, equippedArr, fresh.school);
        const combatPlayer = { ...fresh, ...eff, max_hp: calculateMaxHp(eff, fresh.level) };

        // Silnik walki
        const pc = combatantFromPlayer(combatPlayer, school);
        const mc = combatantFromMonster(quest.monster);
        const result = simulateCombat(pc, mc);
        const won = result.winner === 'player';

        // --- NAGRODY ---
        let gainedExp = 0, gainedCrowns = 0, earsGained = 0, streakBonus = 0;
        let newStreak = fresh.win_streak || 0;
        const levelsGained = [];
        let drop = null;

        if (won) {
            gainedExp = quest.expReward;
            gainedCrowns = quest.crownReward;
            newStreak += 1;

            // Premia za passe
            if (newStreak % 5 === 0) {
                streakBonus = newStreak * 5;
                gainedCrowns += streakBonus;
            }

            // Waluta premium: Szansa na drop ucha (5% + szansa zależna od poziomu trudności zadania)
            if (Math.random() < (0.05 + quest.id * 0.05)) {
                earsGained = 1;
                fresh.ears = (fresh.ears || 0) + earsGained;
            }

            // Drop przedmiotów (korzysta ze starego dobrego systemu)
            drop = rollDrop(quest.monster.level, quest.loc.levelOffset, quest.monster.isElite);
            if (drop) await addItem(db, interaction.user.id, drop);

            fresh.exp += gainedExp;
            fresh.crowns += gainedCrowns;

            // System awansowania
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

        fresh.hp = fresh.max_hp; // Pełne leczenie po walce
        fresh.win_streak = newStreak;

        // Zapis do bazy wszystkiego łącznie z uszami i energią
        await db.run(
            `UPDATE players SET exp = ?, crowns = ?, level = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?,
            hp = ?, max_hp = ?, win_streak = ?, stamina = ?, last_stamina_reset = ?, ears = ? WHERE discord_id = ?`,
            fresh.exp, fresh.crowns, fresh.level, fresh.str, fresh.dex, fresh.intel, fresh.wit, fresh.luck,
            fresh.hp, fresh.max_hp, fresh.win_streak, fresh.stamina, fresh.last_stamina_reset, (fresh.ears || 0), interaction.user.id
        );

        // --- EKRAN WYNIKOWY ---
        const monsterTitle = `${quest.monster.emoji} ${quest.monster.name} (poz. ${quest.monster.level})`;
        const resultEmbed = baseEmbed(won ? '⚔️ Zlecenie Ukończone!' : '💀 Zlecenie Zakończone Porażką')
        .setDescription(
            `${quest.loc.emoji} **${quest.loc.name}**\n` +
            `Przeciwnik: ${monsterTitle}\n\n` +
            `${formatLog(result.log)}`
        );

        if (won) {
            const expNeeded = expForNextLevel(fresh.level);
            let nagrody = `🟡 **+${gainedExp}** exp\n👑 **+${gainedCrowns}** koron`;
            if (streakBonus > 0) nagrody += ` *(w tym +${streakBonus} za passę!)*`;
            if (earsGained > 0) nagrody += `\n🩸 **+1 Ucho** (zdobyto cenne trofeum!)`;

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
                value: 'Potwór okazał się za silny. Zlecenie przepadło, a straconej energii nikt Ci nie zwróci.',
                inline: false
            });
        }

        resultEmbed.setFooter({
            text: `⚡ Awanturniczość: ${fresh.stamina}/100  •  🔥 Passa: ${newStreak}`
        });

        await choice.update({ embeds: [resultEmbed], components: [] });
    }
};
