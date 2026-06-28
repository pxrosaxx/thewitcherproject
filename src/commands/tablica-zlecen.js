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
const { getStatsAtLevel, calculateMaxHp, expForNextLevel, levelUpFromExp } = require('../game/character');
const { baseEmbed, progressBar, authorFor, outcomeColor, combatEmbed } = require('../utils/embeds');
const { effectiveStats, SLOT_ORDER, rollDrop, formatItem, RARITY } = require('../game/equipment');
const { getEquippedMap, addItem } = require('../game/inventory');
const { baseWithBought } = require('../game/training');
const { buildQuestText } = require('../data/questtext');
const { imageForName } = require('../data/monster_images');
const { revealCombat } = require('../utils/combat_anim');
const { applyLoadout } = require('../data/alchemy');
const { incStat } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');
const { getBonuses } = require('../data/guilds');

// --- AUTOMATYCZNA MIGRACJA BAZY ---
// Ten fragment upewnia się, że w bazie są kolumny na Energię i Uszy, bez kasowania Twoich postaci.
async function ensureTavernColumns(db) {
    try { await db.run("ALTER TABLE players ADD COLUMN stamina INTEGER DEFAULT 100"); } catch (e) {}
    try { await db.run("ALTER TABLE players ADD COLUMN last_stamina_reset TEXT DEFAULT ''"); } catch (e) {}
    try { await db.run("ALTER TABLE players ADD COLUMN ears INTEGER DEFAULT 0"); } catch (e) {}
}

// Sprawdza i odnawia 100 pkt Wytrzymałości co 12 godzin (o 00:00 i 12:00 UTC).
async function refreshStamina(db, player) {
    const HALF_DAY_MS = 12 * 60 * 60 * 1000;
    const period = String(Math.floor(Date.now() / HALF_DAY_MS)); // identyfikator okna 12 h
    let stamina = player.stamina !== undefined ? player.stamina : 100;
    let lastReset = player.last_stamina_reset || '';

    if (lastReset !== period) {
        stamina = 100;
        lastReset = period;
        await db.run('UPDATE players SET stamina = 100, last_stamina_reset = ? WHERE discord_id = ?', period, player.discord_id);
    }
    return { points: stamina, today: period };
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
    .setName('tablica-zlecen')
    .setDescription('Wybierz jedno z 3 zleceń z tablicy. Wymaga Wytrzymałości.'),

    async execute(interaction) {
        const db = await getDbConnection();
        await ensureTavernColumns(db); // Upewniamy się, że są nowe kolumny

        let player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        if (!player || !player.school) {
            return interaction.reply({
                content: 'Najpierw stwórz postać i wybierz Szkołę komendą `/postac`.',
                flags: MessageFlags.Ephemeral
            });
        }

        // --- SYSTEM ENERGII (AWANTURNICZOŚĆ) ---
        const { points: currentStamina, today } = await refreshStamina(db, player);
        player.stamina = currentStamina;
        player.last_stamina_reset = today;

        if (player.stamina <= 0) {
            const noEnergyEmbed = baseEmbed('Tablica zleceń')
            .setDescription('Jesteś całkowicie wyczerpany. Nie masz już siły na zlecenia.\nWytrzymałość odnawia się co 12 godzin (o 00:00 i 12:00).');
            return interaction.reply({ embeds: [noEnergyEmbed] });
        }

        const zones = unlockedLocations(player.level);

        // --- GENEROWANIE 3 ZLECEŃ: losowy koszt 1-30, nagroda proporcjonalna do kosztu ---
        const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const tierFor = (cost) =>
            cost <= 10 ? { label: 'Krótkie', style: ButtonStyle.Success }
                : cost <= 20 ? { label: 'Średnie', style: ButtonStyle.Primary }
                    : { label: 'Długie', style: ButtonStyle.Danger };
        const questTypes = [randInt(1, 30), randInt(1, 30), randInt(1, 30)]
            .sort((a, b) => a - b)
            .map((cost, id) => ({ id, cost, mult: cost / 10, elite: cost >= 22, ...tierFor(cost) }));

        const quests = [];
        const row = new ActionRowBuilder();
        const selectEmbed = baseEmbed('Tablica zleceń')
        .setDescription(`Witaj, **${player.name}**. Na tablicy wiszą trzy świeże zlecenia.\nWytrzymałość: **${player.stamina}/100**  ·  Passa: **${player.win_streak || 0}**`);

        for (const qt of questTypes) {
            // Losujemy lokację z odblokowanych
            const locKey = zones[Math.floor(Math.random() * zones.length)];
            const loc = LOCATIONS[locKey];

            // Droższe zlecenie częściej przeciw elicie — mocniejszy potwór.
            const monster = getMonsterForLocation(locKey, player.level, qt.elite);

            // Skalujemy nagrody proporcjonalnie do kosztu (mult = koszt / 10).
            const expReward = Math.max(1, Math.round(monster.expReward * qt.mult));
            const crownReward = Math.max(1, Math.round(monster.crownReward * qt.mult));

            // Narracja zlecenia z 3 filarów (tysiące kombinacji).
            const story = buildQuestText();

            quests.push({ ...qt, loc, monster, expReward, crownReward, story });

            selectEmbed.addFields({
                name: `Zlecenie ${qt.id + 1} — ${qt.label}`,
                value:
                    `*${story}*\n` +
                    `Cel: **${monster.name}** (poz. ${monster.level}) — ${loc.name}\n` +
                    `Koszt: ${qt.cost} Wytrzymałości  ·  Nagroda: ${expReward} exp, ${crownReward} koron`,
                inline: false
            });

            // Dodajemy przyciski, blokujemy te, na które gracz nie ma już energii
            row.addComponents(
                new ButtonBuilder()
                .setCustomId(`zlecenie_${qt.id}`)
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
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('zlecenie_'),
                                                         componentType: ComponentType.Button,
                                                         time: 60000
            });
        } catch {
            const expired = baseEmbed('Tablica zleceń').setDescription('Zbyt długo się zastanawiałeś — ktoś inny wziął te zlecenia. Użyj `/tablica-zlecen` ponownie.');
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
                embeds: [baseEmbed('Brak sił').setDescription('Zabrakło Ci Wytrzymałości na to zlecenie.')],
                                       components: []
            });
        }

        // Odejmujemy energię z góry
        fresh.stamina -= quest.cost;

        const school = schools[fresh.school];

        // Przygotowanie statystyk do walki
        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equippedArr = SLOT_ORDER.map((sl) => equippedMap[sl]).filter(Boolean);
        const baseStats = baseWithBought(fresh);
        const eff = effectiveStats(baseStats, equippedArr, fresh.school);
        const guildBon = await getBonuses(db, interaction.user.id);
        const tMult = guildBon ? guildBon.treasureMult : 1;
        const academyMult = guildBon ? guildBon.academyMult : 1;
        const effB = {
            str: Math.round(eff.str * tMult), dex: Math.round(eff.dex * tMult), intel: Math.round(eff.intel * tMult),
            wit: Math.round(eff.wit * tMult), luck: Math.round(eff.luck * tMult)
        };
        const combatPlayer = { ...fresh, ...effB, max_hp: calculateMaxHp(effB, fresh.level) };

        // Silnik walki
        const pc = combatantFromPlayer(combatPlayer, school);
        const mc = combatantFromMonster(quest.monster);
        const usedConsumables = await applyLoadout(db, fresh, pc, mc);
        const result = simulateCombat(pc, mc);
        const won = result.winner === 'player';

        // --- NAGRODY ---
        let gainedExp = 0, gainedCrowns = 0, earsGained = 0, streakBonus = 0;
        let newStreak = fresh.win_streak || 0;
        const levelsGained = [];
        let drop = null;

        if (won) {
            gainedExp = Math.round(quest.expReward * academyMult);
            gainedCrowns = quest.crownReward;
            newStreak += 1;

            // Premia za passe
            if (newStreak % 5 === 0) {
                streakBonus = newStreak * 5;
                gainedCrowns += streakBonus;
            }

            // Waluta premium: 5% + bonus zależny od kosztu zlecenia (droższe = większa szansa).
            if (Math.random() < (0.05 + (quest.cost / 30) * 0.10)) {
                earsGained = 1;
                fresh.ears = (fresh.ears || 0) + earsGained;
            }

            // Drop przedmiotów (korzysta ze starego dobrego systemu)
            drop = rollDrop(quest.monster.level, quest.loc.levelOffset, quest.monster.isElite);
            if (drop) await addItem(db, interaction.user.id, drop);

            fresh.exp += gainedExp;
            fresh.crowns += gainedCrowns;

            // System awansowania (wspolny helper)
            levelsGained.push(...levelUpFromExp(fresh, school));
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

        if (won) {
            await incStat(db, interaction.user.id, 'monsters_defeated', 1);
            await incStat(db, interaction.user.id, 'contracts_done', 1);
        }
        const newAch = won ? await checkAchievements(db, interaction.user.id) : [];

        // --- EKRAN WYNIKOWY (z animacją krok po kroku) ---
        const monsterImg = imageForName(quest.monster.name);
        const header = `*${quest.story}*\n\n**${quest.monster.name}** — poziom ${quest.monster.level} · ${quest.loc.name}`;
        const raw = result.log;
        const hp = result.hpStates;
        const pMax = result.playerMaxHp, mMax = result.monsterMaxHp;
        const hpAt = (n) => hp[Math.min(Math.max(n, 1), hp.length) - 1] || { p: pMax, m: mMax };

        const makeFrame = (visible) => {
            const st = hpAt(visible.length);
            return combatEmbed({
                title: 'Walka', author: authorFor(fresh), header,
                pName: fresh.name, pHp: st.p, pMax, mName: quest.monster.name, mHp: st.m, mMax,
                logLines: visible.slice(-12), image: monsterImg
            });
        };

        const stF = hp[hp.length - 1] || { p: result.playerHpLeft, m: won ? 0 : mMax };
        const finalEmbed = combatEmbed({
            title: won ? 'Zlecenie ukończone' : 'Zlecenie nieudane',
            color: outcomeColor(won), author: authorFor(fresh), header,
            pName: fresh.name, pHp: stF.p, pMax, mName: quest.monster.name, mHp: stF.m, mMax,
            image: monsterImg
        }).addFields({ name: 'Przebieg walki', value: formatLog(result.log), inline: false });
        if (usedConsumables.length > 0) {
            finalEmbed.addFields({ name: 'Alchemia', value: usedConsumables.join(', '), inline: false });
        }

        if (won) {
            const expNeeded = expForNextLevel(fresh.level);
            let nagrody = `+${gainedExp} exp · +${gainedCrowns} koron`;
            if (streakBonus > 0) nagrody += ` *(w tym +${streakBonus} za passę)*`;
            if (earsGained > 0) nagrody += `\n+1 Ucho — cenne trofeum`;

            finalEmbed.addFields(
                { name: 'Nagroda', value: nagrody, inline: false },
                { name: 'Postęp', value: `Poziom ${fresh.level} · ${fresh.exp}/${expNeeded} exp\n${progressBar(fresh.exp, expNeeded)}`, inline: false }
            );
            if (levelsGained.length > 0) {
                finalEmbed.addFields({ name: 'Awans', value: `Osiągnięto poziom ${fresh.level}. Statystyki wzrosły, a rany się zagoiły.`, inline: false });
            }
            if (drop) {
                finalEmbed.addFields({ name: `Łup — ${RARITY[drop.rarity].name}`, value: `${formatItem(drop)}\n*Załóż w \`/ekwipunek\`.*`, inline: false });
            }
        } else {
            finalEmbed.addFields({ name: 'Skutek', value: 'Potwór okazał się za silny. Zlecenie przepadło, a straconej energii nikt nie zwróci.', inline: false });
        }
        const af = achievementsField(newAch);
        if (af) finalEmbed.addFields(af);
        if (monsterImg) finalEmbed.setImage(monsterImg);
        finalEmbed.setFooter({ text: `Wytrzymałość: ${fresh.stamina}/100  ·  Passa: ${newStreak}` });

        await choice.deferUpdate();
        await revealCombat(interaction, raw, makeFrame, finalEmbed, { steps: Math.min(12, Math.max(4, Math.ceil(raw.length / 2))), delayMs: 850 });
    }
};
