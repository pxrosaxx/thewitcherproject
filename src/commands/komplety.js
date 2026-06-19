const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { SET_DEF, SLOTS, SLOT_ORDER, activeSets, statsLine } = require('../game/equipment');
const { getEquippedMap, getBackpack } = require('../game/inventory');
const { baseEmbed } = require('../utils/embeds');

const STAT_PL = { str: 'Siła', dex: 'Zręczność', intel: 'Inteligencja', wit: 'Witalność', luck: 'Szczęście' };
const SET_ORDER = ['wilk', 'kot', 'gryf', 'waz', 'mantykora'];

module.exports = {
    data: new SlashCommandBuilder().setName('komplety').setDescription('Przeglądaj komplety szkół i swój postęp w ich zbieraniu.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const equippedMap = await getEquippedMap(db, interaction.user.id);
        const equipped = Object.values(equippedMap);
        const backpack = await getBackpack(db, interaction.user.id);
        const owned = [...equipped, ...backpack];

        // Aktywne komplety (z założonego sprzętu)
        const active = {};
        for (const s of activeSets(equipped)) active[s.school] = s;

        const embed = baseEmbed('Komplety ekwipunku')
            .setDescription(
                'Noszenie **2 / 4 / 6** części tej samej szkoły daje rosnący bonus.\n' +
                'Komplet własnej szkoły dodatkowo korzysta z premii afinacji (+20%) na każdej części.'
            );

        for (const sc of SET_ORDER) {
            const def = SET_DEF[sc];
            const equippedN = equipped.filter((it) => it.school === sc).length;
            const ownedSlots = new Set(owned.filter((it) => it.school === sc).map((it) => it.slot));
            const missing = SLOT_ORDER.filter((sl) => !ownedSlots.has(sl)).map((sl) => SLOTS[sl].name);

            const wzmacnia = Object.keys(def.stats).map((k) => STAT_PL[k]).join(', ');
            let value = `Wzmacnia: ${wzmacnia}\n`;
            value += `Założone: **${equippedN}/6**`;
            if (active[sc]) value += `  ·  Bonus: **${statsLine(active[sc].bonus)}**`;
            value += `\nPosiadane sloty: **${ownedSlots.size}/6**`;
            if (missing.length > 0 && missing.length <= 6) value += `  (brakuje: ${missing.join(', ')})`;

            const mine = sc === player.school ? '  — Twoja szkoła' : '';
            embed.addFields({ name: `${def.name}${mine}`, value, inline: false });
        }

        embed.setFooter({ text: 'Części zdobywasz w lochu, karczmie i arenie. Wzmacniaj je u kowala.' });
        await interaction.reply({ embeds: [embed] });
    }
};
