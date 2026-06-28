const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const { RARITY, generateItemStats, statsLine, formatItem } = require('../game/equipment');
const { getBackpack, getEquippedMap, getItem, setItemStats } = require('../game/inventory');
const { baseEmbed } = require('../utils/embeds');
const { incStat } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');

// Koszt ulepszenia poziomu (korony) i przekucia rzadkosci (korony + Uszy).
const USZY_COST = { 2: 2, 3: 3, 4: 5, 5: 8 };
const MAX_RARITY = 5;

function levelUpCost(item) {
    return Math.round(15 * (item.itemLevel + 1) * RARITY[item.rarity].statMult);
}
function rarityUpCost(item) {
    const target = item.rarity + 1;
    return { crowns: Math.round(40 * Math.max(1, item.itemLevel) * RARITY[target].statMult), ears: USZY_COST[target] };
}
function tplFrom(item, rarityOverride) {
    return { id: item.templateId, name: item.name, slot: item.slot, rarity: rarityOverride ?? item.rarity, school: item.school };
}

function detailEmbed(player, item) {
    const canLevel = item.itemLevel < player.level;
    const lvlCost = levelUpCost(item);
    const rUp = item.rarity < MAX_RARITY ? rarityUpCost(item) : null;

    const embed = baseEmbed('Kowal')
        .setDescription(`Korony: **${player.crowns}**  ·  Uszy: **${player.ears || 0}**\n\nWybrany przedmiot:\n${formatItem(item)}`);

    embed.addFields({
        name: 'Ulepsz poziom (+1)',
        value: canLevel
            ? `Poziom ${item.itemLevel} → ${item.itemLevel + 1}. Koszt: **${lvlCost}** koron.`
            : `Przedmiot osiągnął Twój poziom (${player.level}) — najpierw awansuj.`,
        inline: false
    });
    embed.addFields({
        name: 'Przekuj rzadkość (+1)',
        value: rUp
            ? `${RARITY[item.rarity].name} → **${RARITY[item.rarity + 1].name}**. Koszt: **${rUp.crowns}** koron + **${rUp.ears}** Uszy.`
            : 'Przedmiot jest już legendarny — wyżej się nie da.',
        inline: false
    });
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder().setName('kowal').setDescription('Ulepszaj poziom i rzadkość swojego ekwipunku.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const backpack = await getBackpack(db, interaction.user.id);
        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equipped = Object.values(equippedMap);
        const all = [...equipped, ...backpack];

        if (all.length === 0) {
            return interaction.reply({ embeds: [baseEmbed('Kowal').setDescription('Nie masz żadnego przedmiotu do ulepszenia. Zdobądź sprzęt w podziemiach, ze zleceń lub w sklepie.')] });
        }

        const intro = baseEmbed('Kowal')
            .setDescription(`Korony: **${player.crowns}**  ·  Uszy: **${player.ears || 0}**\n\nWybierz przedmiot, który chcesz ulepszyć.`);

        const menu = new StringSelectMenuBuilder()
            .setCustomId('kowal_pick')
            .setPlaceholder('Wybierz przedmiot')
            .addOptions(all.slice(0, 25).map((it) => ({
                label: `${it.name} (poz. ${it.itemLevel})`.slice(0, 100),
                description: `${RARITY[it.rarity].name} · ${it.slot}${it.equippedSlot ? ' · założony' : ''}`.slice(0, 100),
                value: String(it.rowId)
            })));

        await interaction.reply({ embeds: [intro], components: [new ActionRowBuilder().addComponents(menu)] });
        const message = await interaction.fetchReply();

        let pick;
        try {
            pick = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'kowal_pick',
                componentType: ComponentType.StringSelect, time: 60000
            });
        } catch {
            await interaction.editReply({ components: [] }).catch(() => {});
            return;
        }

        const rowId = parseInt(pick.values[0], 10);
        const item = await getItem(db, interaction.user.id, rowId);
        if (!item) {
            return pick.update({ embeds: [baseEmbed('Kowal').setDescription('Nie znaleziono przedmiotu.')], components: [] });
        }

        const canLevel = item.itemLevel < player.level && player.crowns >= levelUpCost(item);
        const rUp = item.rarity < MAX_RARITY ? rarityUpCost(item) : null;
        const canRarity = rUp && player.crowns >= rUp.crowns && (player.ears || 0) >= rUp.ears;

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kowal_level').setLabel('Ulepsz poziom').setStyle(ButtonStyle.Primary).setDisabled(!canLevel),
            new ButtonBuilder().setCustomId('kowal_rarity').setLabel('Przekuj rzadkość').setStyle(ButtonStyle.Success).setDisabled(!canRarity)
        );

        await pick.update({ embeds: [detailEmbed(player, item)], components: [buttons] });

        let act;
        try {
            act = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && (i.customId === 'kowal_level' || i.customId === 'kowal_rarity'),
                componentType: ComponentType.Button, time: 60000
            });
        } catch {
            await interaction.editReply({ components: [] }).catch(() => {});
            return;
        }

        // Ponowne pobranie (anty-nieaktualnosc)
        const freshP = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        const freshItem = await getItem(db, interaction.user.id, rowId);
        if (!freshItem) {
            return act.update({ embeds: [baseEmbed('Kowal').setDescription('Przedmiot już nie istnieje.')], components: [] });
        }
        const before = statsLine(freshItem.stats);

        if (act.customId === 'kowal_level') {
            const cost = levelUpCost(freshItem);
            if (freshItem.itemLevel >= freshP.level || freshP.crowns < cost) {
                return act.update({ embeds: [baseEmbed('Kowal').setDescription('Nie można ulepszyć — brak koron lub osiągnięto limit poziomu.')], components: [] });
            }
            const newLevel = freshItem.itemLevel + 1;
            const newStats = generateItemStats(tplFrom(freshItem), newLevel);
            await setItemStats(db, rowId, newLevel, freshItem.rarity, newStats);
            await db.run('UPDATE players SET crowns = crowns - ? WHERE discord_id = ?', cost, interaction.user.id);

            const updated = await getItem(db, interaction.user.id, rowId);
            await incStat(db, interaction.user.id, 'items_upgraded', 1);
            const embed = baseEmbed('Ulepszono poziom')
                .setDescription(`${formatItem(updated)}\n\nPoziom ${freshItem.itemLevel} → **${newLevel}**\nStaty: ${before}  →  **${statsLine(updated.stats)}**\nKoszt: ${cost} koron · pozostało ${freshP.crowns - cost}.`);
            const af1 = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af1) embed.addFields(af1);
            return act.update({ embeds: [embed], components: [] });
        }

        // kowal_rarity
        const rc = rarityUpCost(freshItem);
        if (freshItem.rarity >= MAX_RARITY || freshP.crowns < rc.crowns || (freshP.ears || 0) < rc.ears) {
            return act.update({ embeds: [baseEmbed('Kowal').setDescription('Nie można przekuć — brak surowców lub przedmiot jest już legendarny.')], components: [] });
        }
        const newRarity = freshItem.rarity + 1;
        const newStats = generateItemStats(tplFrom(freshItem, newRarity), freshItem.itemLevel);
        await setItemStats(db, rowId, freshItem.itemLevel, newRarity, newStats);
        await db.run('UPDATE players SET crowns = crowns - ?, ears = ears - ? WHERE discord_id = ?', rc.crowns, rc.ears, interaction.user.id);

        const updated = await getItem(db, interaction.user.id, rowId);
        await incStat(db, interaction.user.id, 'items_upgraded', 1);
        const embed = baseEmbed('Przekuto rzadkość')
            .setDescription(`${formatItem(updated)}\n\n${RARITY[freshItem.rarity].name} → **${RARITY[newRarity].name}**\nStaty: ${before}  →  **${statsLine(updated.stats)}**\nKoszt: ${rc.crowns} koron + ${rc.ears} Uszy.`);
        const af2 = achievementsField(await checkAchievements(db, interaction.user.id));
        if (af2) embed.addFields(af2);
        return act.update({ embeds: [embed], components: [] });
    }
};
