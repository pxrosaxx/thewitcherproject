const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { getProgress, getAllProgress, setProgress } = require('../data/dungeons');
const { listDungeons, getBossFor } = require('../data/dungeon_registry');
const { combatantFromPlayer, combatantFromMonster, simulateCombat } = require('../game/combat');
const { calculateMaxHp, expForNextLevel, levelUpFromExp } = require('../game/character');
const { refreshActionPoints, spendActionPoint, formatDuration } = require('../game/actionpoints');
const {
    effectiveStats, SLOT_ORDER, rollDrop, rollRarity, rollSetDrop, makeItemInstance, RARITY, formatItem
} = require('../game/equipment');
const { ITEMS } = require('../data/items');
const { getEquippedMap, addItem } = require('../game/inventory');
const { baseWithBought } = require('../game/training');
const { baseEmbed, progressBar, authorFor, outcomeColor, combatEmbed } = require('../utils/embeds');
const { imageForName } = require('../data/monster_images');
const { revealCombat } = require('../utils/combat_anim');
const { applyLoadout } = require('../data/alchemy');
const { incStat } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');
const { getBonuses } = require('../data/guilds');

function formatLog(log, maxLines = 14) {
    if (log.length <= maxLines) return log.join('\n');
    return `${log.slice(0, maxLines - 3).join('\n')}\n*… pominięto ${log.length - maxLines} akcji …*\n${log.slice(-3).join('\n')}`;
}

/** Gwarantowany przedmiot z finałowego bossa (dobra rzadkość). */
function bossDrop(levelOffset, level) {
    const rarity = Math.max(3, rollRarity(levelOffset, true));
    let pool = ITEMS.filter((i) => i.rarity === rarity);
    if (!pool.length) pool = ITEMS.filter((i) => i.rarity <= rarity && i.rarity >= 3);
    if (!pool.length) pool = ITEMS.filter((i) => i.rarity === 3);
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    return makeItemInstance(tpl, level);
}

module.exports = {
    data: new SlashCommandBuilder().setName('loch').setDescription('Przemierzaj lokacje, pokonuj bossów etap po etapie.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const ap = await refreshActionPoints(db, player);
        const progress = await getAllProgress(db, interaction.user.id);
        const all = await listDungeons(db);

        const embed = baseEmbed('Lochy').setAuthor(authorFor(player))
            .setDescription(
                `Punkty akcji: **${ap.points}/${ap.max}**` +
                (ap.points < ap.max ? `  (następny za ${formatDuration(ap.secondsToNext)})` : '')
            );

        const options = [];
        if (all.length === 0) {
            embed.addFields({
                name: 'Brak lochów',
                value: 'Nie zdefiniowano jeszcze żadnego lochu. Administrator może je dodać w pliku `data/dungeons.js` albo komendą `/loch-kreator`.',
                inline: false
            });
        }
        for (const d of all) {
            const stage = progress[d.key] || 0;
            const locked = player.level < d.minLevel;
            const done = stage >= d.stageCount;

            let status;
            if (locked) {
                status = `_Zablokowane — wymaga ${d.minLevel} poz._`;
            } else if (done) {
                status = '**Ukończono** ✓';
            } else {
                const next = await getBossFor(db, d, stage);
                const isFinal = stage === d.stageCount - 1;
                const label = isFinal ? 'Finałowy boss' : `Etap ${stage + 1}/${d.stageCount}`;
                status = `${label} — następny: **${next.name}** (poz. ${next.level})`;
            }
            embed.addFields({ name: d.isCustom ? `${d.name} (własny)` : d.name, value: status, inline: false });

            if (!locked && !done) {
                options.push({
                    label: `${d.name}`.slice(0, 100),
                    description: `${stage === d.stageCount - 1 ? 'Finałowy boss' : `Etap ${stage + 1}/${d.stageCount}`}`.slice(0, 100),
                    value: d.key
                });
            }
        }

        if (ap.points <= 0) {
            embed.setFooter({ text: `Brak punktów akcji — wróć za ${formatDuration(ap.secondsToNext)}` });
        }

        const canPlay = options.length > 0 && ap.points > 0;
        const components = canPlay
            ? [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('loch_pick').setPlaceholder('Wybierz loch').addOptions(options.slice(0, 25)))]
            : [];

        await interaction.reply({ embeds: [embed], components });
        if (!canPlay) return;

        const message = await interaction.fetchReply();
        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'loch_pick',
                componentType: ComponentType.StringSelect, time: 60000
            });
        } catch {
            await interaction.editReply({ components: [] }).catch(() => {});
            return;
        }

        const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        await refreshActionPoints(db, fresh);
        if ((fresh.action_points || 0) <= 0) {
            return choice.update({ embeds: [baseEmbed('Lochy').setDescription('Nie masz już punktów akcji.')], components: [] });
        }

        const key = choice.values[0];
        const entry = (await listDungeons(db)).find((d) => d.key === key);
        if (!entry) {
            return choice.update({ embeds: [baseEmbed('Lochy').setDescription('Ten loch już nie istnieje.')], components: [] });
        }
        const stage = await getProgress(db, interaction.user.id, key);
        if (stage >= entry.stageCount) {
            return choice.update({ embeds: [baseEmbed('Lochy').setDescription('Ten loch jest już ukończony.')], components: [] });
        }

        await spendActionPoint(db, fresh);

        const boss = await getBossFor(db, entry, stage);
        const school = schools[fresh.school];

        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equippedArr = SLOT_ORDER.map((sl) => equippedMap[sl]).filter(Boolean);
        const eff = effectiveStats(baseWithBought(fresh), equippedArr, fresh.school);
        const guildBon = await getBonuses(db, interaction.user.id);
        const tMult = guildBon ? guildBon.treasureMult : 1;
        const academyMult = guildBon ? guildBon.academyMult : 1;
        const effB = {
            str: Math.round(eff.str * tMult), dex: Math.round(eff.dex * tMult), intel: Math.round(eff.intel * tMult),
            wit: Math.round(eff.wit * tMult), luck: Math.round(eff.luck * tMult)
        };
        const combatPlayer = { ...fresh, ...effB, max_hp: calculateMaxHp(effB, fresh.level) };

        const pc = combatantFromPlayer(combatPlayer, school);
        const mc = combatantFromMonster(boss);
        const usedConsumables = await applyLoadout(db, fresh, pc, mc);
        const result = simulateCombat(pc, mc);
        const won = result.winner === 'player';

        const isFinal = stage === entry.stageCount - 1;
        const stageLabel = isFinal ? 'Finałowy boss' : `Etap ${stage + 1}/${entry.stageCount}`;

        let drop = null;
        let setDrop = null;
        const levelsGained = [];

        if (won) {
            await setProgress(db, interaction.user.id, key, stage + 1);

            fresh.exp += Math.round(boss.expReward * academyMult);
            fresh.crowns += boss.crownReward;
            levelsGained.push(...levelUpFromExp(fresh, school));

            drop = isFinal ? bossDrop(entry.levelOffset, boss.level) : rollDrop(boss.level, entry.levelOffset, false);
            if (drop) await addItem(db, interaction.user.id, drop);

            // Część wiedźmińskiego rynsztunku — tylko z lochów, dla szkoły gracza.
            // Boss finałowy: 30% (lepsza rzadkość). Mini-boss (elita): 12%.
            const setChance = isFinal ? 0.30 : 0.12;
            setDrop = rollSetDrop(fresh.school, boss.level, entry.levelOffset, isFinal, setChance);
            if (setDrop) await addItem(db, interaction.user.id, setDrop);

            fresh.hp = fresh.max_hp;
            await db.run(
                `UPDATE players SET exp = ?, crowns = ?, level = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?, hp = ?, max_hp = ? WHERE discord_id = ?`,
                fresh.exp, fresh.crowns, fresh.level, fresh.str, fresh.dex, fresh.intel, fresh.wit, fresh.luck, fresh.hp, fresh.max_hp, interaction.user.id
            );

            await incStat(db, interaction.user.id, 'monsters_defeated', 1);
            await incStat(db, interaction.user.id, 'bosses_defeated', 1);
            if (isFinal) await incStat(db, interaction.user.id, 'locations_completed', 1);
        }

        const newAch = won ? await checkAchievements(db, interaction.user.id) : [];

        // --- Oprawa: nagłówek, paski życia, animacja krok po kroku ---
        const monsterImg = boss.imageUrl || imageForName(boss.name);
        const header = `**${boss.name}** — poziom ${boss.level}\n${entry.name} · ${stageLabel}`;
        const raw = result.log;
        const hp = result.hpStates;
        const pMax = result.playerMaxHp, mMax = result.monsterMaxHp;
        const hpAt = (n) => hp[Math.min(Math.max(n, 1), hp.length) - 1] || { p: pMax, m: mMax };

        const makeFrame = (visible) => {
            const st = hpAt(visible.length);
            return combatEmbed({
                title: 'Walka', author: authorFor(fresh), header,
                pName: fresh.name, pHp: st.p, pMax, mName: boss.name, mHp: st.m, mMax,
                logLines: visible.slice(-12), image: monsterImg
            });
        };

        const title = won ? (isFinal ? 'Lochy ukończone' : 'Etap pokonany') : 'Porażka';
        const stF = hp[hp.length - 1] || { p: result.playerHpLeft, m: won ? 0 : mMax };
        const finalEmbed = combatEmbed({
            title, color: outcomeColor(won), author: authorFor(fresh), header,
            pName: fresh.name, pHp: stF.p, pMax, mName: boss.name, mHp: stF.m, mMax,
            image: monsterImg
        }).addFields({ name: 'Przebieg walki', value: formatLog(result.log), inline: false });
        if (usedConsumables.length > 0) {
            finalEmbed.addFields({ name: 'Alchemia', value: usedConsumables.join(', '), inline: false });
        }

        if (won) {
            const expNeeded = expForNextLevel(fresh.level);
            finalEmbed.addFields(
                { name: 'Nagroda', value: `+${boss.expReward} exp · +${boss.crownReward} koron`, inline: false },
                { name: 'Postęp', value: `Poziom ${fresh.level} · ${fresh.exp}/${expNeeded} exp\n${progressBar(fresh.exp, expNeeded)}`, inline: false }
            );
            if (levelsGained.length > 0) {
                finalEmbed.addFields({ name: 'Awans', value: `Osiągnięto poziom ${fresh.level}.`, inline: false });
            }
            if (drop) {
                finalEmbed.addFields({ name: `Łup — ${RARITY[drop.rarity].name}`, value: formatItem(drop), inline: false });
            }
            if (setDrop) {
                finalEmbed.addFields({ name: `⚔️ Część rynsztunku! — ${RARITY[setDrop.rarity].name}`, value: formatItem(setDrop), inline: false });
            }
            if (isFinal) {
                finalEmbed.addFields({ name: 'Loch zaliczony', value: `Pokonałeś wszystkich bossów: **${entry.name}**.`, inline: false });
            } else {
                const next = await getBossFor(db, entry, stage + 1);
                if (next) finalEmbed.setFooter({ text: `Następny: ${next.name} (poz. ${next.level})` });
            }
        } else {
            finalEmbed.addFields({ name: 'Skutek', value: 'Boss okazał się za silny. Rozwiń się i spróbuj ponownie.', inline: false });
        }
        const af = achievementsField(newAch);
        if (af) finalEmbed.addFields(af);
        if (monsterImg) finalEmbed.setImage(monsterImg);

        await choice.deferUpdate();
        await revealCombat(interaction, raw, makeFrame, finalEmbed, { steps: Math.min(12, Math.max(4, Math.ceil(raw.length / 2))), delayMs: 850 });
    }
};
