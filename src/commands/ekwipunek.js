const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const {
    SLOTS, SLOT_ORDER, RARITY, statsLine, equipmentBonus, activeSets
} = require('../game/equipment');
const { getBackpack, getEquippedMap, equipItem } = require('../game/inventory');
const { baseEmbed } = require('../utils/embeds');
const { setStatMax } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');

const STAT_NAMES = { str: 'SIŁ', dex: 'ZRĘ', intel: 'INT', wit: 'WIT', luck: 'SZCZ' };

function bonusLine(bonus) {
    const parts = Object.keys(STAT_NAMES).filter((k) => bonus[k] > 0).map((k) => `+${bonus[k]} ${STAT_NAMES[k]}`);
    return parts.length ? parts.join(', ') : 'brak';
}

async function render(db, discordId, schoolKey) {
    const equippedMap = await getEquippedMap(db, discordId);
    const backpack = await getBackpack(db, discordId);
    const equippedArr = SLOT_ORDER.map((s) => equippedMap[s]).filter(Boolean);
    const bonus = equipmentBonus(equippedArr, schoolKey);

    const embed = baseEmbed('Ekwipunek');

    // Zalozone przedmioty per slot
    let equippedText = '';
    for (const slot of SLOT_ORDER) {
        const it = equippedMap[slot];
        const s = SLOTS[slot];
        if (it) {
            const match = it.school === schoolKey ? ' ★' : '';
            equippedText += `${s.emoji} **${s.name}:** ${RARITY[it.rarity].emoji} ${it.name}${match} — _${statsLine(it.stats)}_\n`;
        } else {
            equippedText += `${s.emoji} **${s.name}:** _— puste —_\n`;
        }
    }
    embed.addFields({ name: 'Założone', value: equippedText, inline: false });
    embed.addFields({ name: 'Łączny bonus z ekwipunku', value: bonusLine(bonus) + '\n★ = premia za zgodność ze Szkołą (+20%)', inline: false });

    const sets = activeSets(equippedArr);
    if (sets.length > 0) {
        const setText = sets.map((s) => `**${s.name}** (${s.count}/6): ${statsLine(s.bonus)}`).join('\n');
        embed.addFields({ name: 'Aktywne komplety', value: `${setText}\n_Pełen przegląd: \`/komplety\`_`, inline: false });
    }

    // Plecak
    if (backpack.length === 0) {
        embed.addFields({ name: 'Plecak', value: '_pusty — zdobywaj przedmioty w podziemiach (`/podziemia`)_', inline: false });
    } else {
        const lines = backpack.slice(0, 15).map((it) => {
            const match = it.school === schoolKey ? ' ★' : (it.school ? ` (szkoła: ${it.school})` : '');
            return `${RARITY[it.rarity].emoji} ${SLOTS[it.slot].emoji} **${it.name}**${match} — _${statsLine(it.stats)}_`;
        });
        let val = lines.join('\n');
        if (backpack.length > 15) val += `\n_…i ${backpack.length - 15} więcej_`;
        embed.addFields({ name: `Plecak (${backpack.length})`, value: val, inline: false });
    }

    // Menu zakladania
    const components = [];
    if (backpack.length > 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('eq_equip')
            .setPlaceholder('Załóż przedmiot z plecaka…')
            .addOptions(backpack.slice(0, 25).map((it) => ({
                label: `${it.name}`.slice(0, 100),
                description: `${SLOTS[it.slot].name} • ${RARITY[it.rarity].name} • ${statsLine(it.stats)}`.slice(0, 100),
                value: String(it.rowId)
            })));
        components.push(new ActionRowBuilder().addComponents(menu));
    }
    return { embeds: [embed], components };
}

module.exports = {
    data: new SlashCommandBuilder().setName('ekwipunek').setDescription('Przeglądaj i zakładaj przedmioty.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT discord_id, school FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply(await render(db, interaction.user.id, player.school));
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 120000
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'eq_equip') {
                const rowId = Number(i.values[0]);
                const res = await equipItem(db, interaction.user.id, rowId);

                const eqMap = await getEquippedMap(db, interaction.user.id);
                const eqArr = SLOT_ORDER.map((s) => eqMap[s]).filter(Boolean);
                const maxPieces = activeSets(eqArr).reduce((m, s) => Math.max(m, s.count), 0);
                if (maxPieces > 0) await setStatMax(db, interaction.user.id, 'max_set_pieces', maxPieces);
                const newAch = await checkAchievements(db, interaction.user.id);

                const view = await render(db, interaction.user.id, player.school);
                if (res && res.equipped) {
                    let note = `Założono **${res.equipped.name}**`;
                    if (res.replaced) note += ` (zdjęto **${res.replaced.name}** do plecaka)`;
                    view.embeds[0].setFooter({ text: note });
                }
                const af = achievementsField(newAch);
                if (af) view.embeds[0].addFields(af);
                await i.update(view);
            }
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
