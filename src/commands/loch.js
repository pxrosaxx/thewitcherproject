const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { LOCATIONS, LOCATION_ORDER } = require('../data/monsters');
const {
    getBoss, getAllProgress, getProgress, setProgress, STAGES_PER_LOCATION, FINAL_STAGE_INDEX
} = require('../data/dungeons');
const { combatantFromPlayer, combatantFromMonster, simulateCombat } = require('../game/combat');
const { calculateMaxHp, expForNextLevel, levelUpFromExp } = require('../game/character');
const { refreshActionPoints, spendActionPoint, formatDuration } = require('../game/actionpoints');
const {
    effectiveStats, SLOT_ORDER, rollDrop, rollRarity, makeItemInstance, RARITY, formatItem
} = require('../game/equipment');
const { ITEMS } = require('../data/items');
const { getEquippedMap, addItem } = require('../game/inventory');
const { baseWithBought } = require('../game/training');
const { baseEmbed, progressBar } = require('../utils/embeds');

function formatLog(log, maxLines = 14) {
    if (log.length <= maxLines) return log.join('\n');
    return `${log.slice(0, maxLines - 3).join('\n')}\n*… pominięto ${log.length - maxLines} akcji …*\n${log.slice(-3).join('\n')}`;
}

/** Gwarantowany przedmiot z finałowego bossa (dobra rzadkość). */
function bossDrop(loc, level) {
    const rarity = Math.max(3, rollRarity(loc.levelOffset, true));
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

        const embed = baseEmbed('Lochy')
            .setDescription(
                `**${player.name}** — punkty akcji: **${ap.points}/${ap.max}**` +
                (ap.points < ap.max ? `  (następny za ${formatDuration(ap.secondsToNext)})` : '')
            );

        const row = new ActionRowBuilder();
        let anyPlayable = false;

        for (const key of LOCATION_ORDER) {
            const loc = LOCATIONS[key];
            const stage = progress[key] || 0;
            const locked = player.level < loc.minLevel;
            const done = stage >= STAGES_PER_LOCATION;

            let status;
            if (locked) {
                status = `_Zablokowane — wymaga ${loc.minLevel} poz._`;
            } else if (done) {
                status = '**Ukończono** ✓';
            } else {
                const next = getBoss(key, stage);
                const label = stage === FINAL_STAGE_INDEX ? 'Finałowy boss' : `Etap ${stage + 1}/${STAGES_PER_LOCATION}`;
                status = `${label} — następny: **${next.name}** (poz. ${next.level})`;
            }
            embed.addFields({ name: `${loc.name}`, value: status, inline: false });

            if (!locked && !done) {
                anyPlayable = true;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`loch_${key}`)
                        .setLabel(loc.name)
                        .setStyle(stage === FINAL_STAGE_INDEX ? ButtonStyle.Danger : ButtonStyle.Primary)
                        .setDisabled(ap.points <= 0)
                );
            }
        }

        if (ap.points <= 0) {
            embed.setFooter({ text: `Brak punktów akcji — wróć za ${formatDuration(ap.secondsToNext)}` });
        }

        const components = anyPlayable ? [row] : [];
        await interaction.reply({ embeds: [embed], components });
        if (!anyPlayable || ap.points <= 0) return;

        const message = await interaction.fetchReply();
        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('loch_'),
                componentType: ComponentType.Button, time: 60000
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

        const key = choice.customId.replace('loch_', '');
        const loc = LOCATIONS[key];
        const stage = await getProgress(db, interaction.user.id, key);
        if (stage >= STAGES_PER_LOCATION) {
            return choice.update({ embeds: [baseEmbed('Lochy').setDescription('Ta lokacja jest już ukończona.')], components: [] });
        }

        await spendActionPoint(db, fresh);

        const boss = getBoss(key, stage);
        const school = schools[fresh.school];

        // Efektywne staty = poziom + trening + ekwipunek
        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equippedArr = SLOT_ORDER.map((sl) => equippedMap[sl]).filter(Boolean);
        const eff = effectiveStats(baseWithBought(fresh), equippedArr, fresh.school);
        const combatPlayer = { ...fresh, ...eff, max_hp: calculateMaxHp(eff, fresh.level) };

        const result = simulateCombat(combatantFromPlayer(combatPlayer, school), combatantFromMonster(boss));
        const won = result.winner === 'player';

        const isFinal = stage === FINAL_STAGE_INDEX;
        const stageLabel = isFinal ? 'Finałowy boss' : `Etap ${stage + 1}/${STAGES_PER_LOCATION}`;

        let drop = null;
        const levelsGained = [];

        if (won) {
            await setProgress(db, interaction.user.id, key, stage + 1);

            fresh.exp += boss.expReward;
            fresh.crowns += boss.crownReward;
            levelsGained.push(...levelUpFromExp(fresh, school));

            // Łup: finałowy boss gwarantuje przedmiot, mini-boss ma szansę.
            drop = isFinal ? bossDrop(loc, boss.level) : rollDrop(boss.level, loc.levelOffset, false);
            if (drop) await addItem(db, interaction.user.id, drop);

            fresh.hp = fresh.max_hp;
            await db.run(
                `UPDATE players SET exp = ?, crowns = ?, level = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?, hp = ?, max_hp = ? WHERE discord_id = ?`,
                fresh.exp, fresh.crowns, fresh.level, fresh.str, fresh.dex, fresh.intel, fresh.wit, fresh.luck, fresh.hp, fresh.max_hp, interaction.user.id
            );
        }

        const title = won ? (isFinal ? 'Lokacja ukończona!' : 'Etap pokonany') : 'Porażka';
        const resultEmbed = baseEmbed(title)
            .setDescription(`${loc.name} — ${stageLabel}\nPrzeciwnik: **${boss.name}** (poz. ${boss.level})\n\n${formatLog(result.log)}`);

        if (won) {
            const nextStage = stage + 1;
            const expNeeded = expForNextLevel(fresh.level);
            resultEmbed.addFields(
                { name: 'Nagroda', value: `+${boss.expReward} exp · +${boss.crowns ?? boss.crownReward} koron`, inline: false },
                { name: 'Postęp', value: `Poziom ${fresh.level} · ${fresh.exp}/${expNeeded} exp\n${progressBar(fresh.exp, expNeeded)}`, inline: false }
            );
            if (levelsGained.length > 0) {
                resultEmbed.addFields({ name: 'Awans', value: `Osiągnięto **poziom ${fresh.level}**.`, inline: false });
            }
            if (drop) {
                resultEmbed.addFields({ name: `Łup — ${RARITY[drop.rarity].name}`, value: formatItem(drop), inline: false });
            }
            if (isFinal) {
                resultEmbed.addFields({ name: 'Lokacja zaliczona', value: `Pokonałeś wszystkich bossów **${loc.name}**. Farm zdobywaj w karczmie i arenie.`, inline: false });
            } else {
                const next = getBoss(key, nextStage);
                if (nextStage < STAGES_PER_LOCATION) {
                    resultEmbed.setFooter({ text: `Następny: ${next.name} (poz. ${next.level})` });
                }
            }
        } else {
            resultEmbed.addFields({ name: 'Skutek', value: 'Boss okazał się za silny. Rozwiń się i spróbuj ponownie.', inline: false });
        }

        await choice.update({ embeds: [resultEmbed], components: [] });
    }
};
