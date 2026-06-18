const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const {
    SLOTS, RARITY, statsLine, generateShop, itemPrice, sellPrice
} = require('../game/equipment');
const { addItem, getBackpack, removeItem } = require('../game/inventory');
const { baseEmbed } = require('../utils/embeds');

/** Ziarno oferty: stale w obrebie doby i unikalne dla gracza. */
function shopSeed(discordId) {
    const day = Math.floor(Date.now() / 86400000);
    const idHash = [...discordId].reduce((a, c) => a + c.charCodeAt(0), 0);
    return day * 100000 + idHash;
}

async function render(db, discordId) {
    const player = await db.get('SELECT crowns, level FROM players WHERE discord_id = ?', discordId);
    const offers = generateShop(player.level, 6, shopSeed(discordId));
    const backpack = await getBackpack(db, discordId);

    const embed = baseEmbed('🏪 Sklep wiedźmiński')
        .setDescription(`Twoje korony: **${player.crowns}** 👑\n*Oferta odświeża się codziennie.*`);

    const offerText = offers.map((it, idx) =>
        `**${idx + 1}.** ${RARITY[it.rarity].emoji} ${SLOTS[it.slot].emoji} **${it.name}** (poz. ${it.itemLevel})\n   _${statsLine(it.stats)}_ — **${it.price}** 👑`
    ).join('\n');
    embed.addFields({ name: 'Na sprzedaż', value: offerText, inline: false });

    const components = [];

    // Menu kupna
    const buyMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_buy')
        .setPlaceholder('Kup przedmiot…')
        .addOptions(offers.map((it, idx) => ({
            label: `${it.name} — ${it.price} koron`.slice(0, 100),
            description: `${SLOTS[it.slot].name} • ${RARITY[it.rarity].name} • ${statsLine(it.stats)}`.slice(0, 100),
            value: String(idx)
        })));
    components.push(new ActionRowBuilder().addComponents(buyMenu));

    // Menu sprzedazy (jesli plecak niepusty)
    if (backpack.length > 0) {
        const sellMenu = new StringSelectMenuBuilder()
            .setCustomId('shop_sell')
            .setPlaceholder('Sprzedaj przedmiot z plecaka…')
            .addOptions(backpack.slice(0, 25).map((it) => ({
                label: `${it.name} — ${sellPrice(it)} koron`.slice(0, 100),
                description: `${SLOTS[it.slot].name} • ${RARITY[it.rarity].name} • ${statsLine(it.stats)}`.slice(0, 100),
                value: String(it.rowId)
            })));
        components.push(new ActionRowBuilder().addComponents(sellMenu));
    }

    return { embeds: [embed], components, offers };
}

module.exports = {
    data: new SlashCommandBuilder().setName('sklep').setDescription('Kupuj i sprzedawaj przedmioty za korony.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT discord_id, school FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const view = await render(db, interaction.user.id);
        await interaction.reply({ embeds: view.embeds, components: view.components });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 120000
        });

        collector.on('collect', async (i) => {
            let note = '';

            if (i.customId === 'shop_buy') {
                const current = await render(db, interaction.user.id); // te same oferty (to samo ziarno)
                const idx = Number(i.values[0]);
                const item = current.offers[idx];
                const p = await db.get('SELECT crowns FROM players WHERE discord_id = ?', interaction.user.id);
                if (!item) {
                    note = 'Tej oferty już nie ma.';
                } else if (p.crowns < item.price) {
                    note = `Za mało koron na **${item.name}** (potrzeba ${item.price}, masz ${p.crowns}).`;
                } else {
                    await db.run('UPDATE players SET crowns = crowns - ? WHERE discord_id = ?', item.price, interaction.user.id);
                    delete item.price; // do plecaka bez ceny
                    await addItem(db, interaction.user.id, item);
                    note = `Kupiono **${item.name}**! Sprawdź \`/ekwipunek\`.`;
                }
            } else if (i.customId === 'shop_sell') {
                const rowId = Number(i.values[0]);
                const item = await removeItem(db, interaction.user.id, rowId);
                if (!item) {
                    note = 'Tego przedmiotu już nie masz.';
                } else {
                    const gold = sellPrice(item);
                    await db.run('UPDATE players SET crowns = crowns + ? WHERE discord_id = ?', gold, interaction.user.id);
                    note = `Sprzedano **${item.name}** za ${gold} 👑.`;
                }
            }

            const view2 = await render(db, interaction.user.id);
            if (note) view2.embeds[0].setFooter({ text: note });
            await i.update({ embeds: view2.embeds, components: view2.components });
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
