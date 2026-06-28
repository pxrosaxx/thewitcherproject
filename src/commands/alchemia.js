const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const { baseEmbed, authorFor, DIVIDER } = require('../utils/embeds');
const {
    CONSUMABLES, CATEGORIES, CATEGORY_LABEL, byCategory, getStock, addStock
} = require('../data/alchemy');
const { incStat } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');

const PREP_COL = { eliksir: 'prep_eliksir', olej: 'prep_olej', bomba: 'prep_bomba' };

function costLabel(c) {
    return `${c.crowns} kr${c.ears ? ` + ${c.ears} ucho` : ''}`;
}

// Wybory do /warz (wszystkie mikstury) i /zestaw (per kategoria + "brak").
const brewChoices = Object.entries(CONSUMABLES).map(([id, c]) => ({
    name: `${c.name} — ${costLabel(c)}`.slice(0, 100), value: id
}));
const slotChoices = {};
for (const cat of CATEGORIES) {
    slotChoices[cat] = [{ name: '— brak —', value: 'none' }].concat(
        byCategory(cat).map((c) => ({ name: `${c.name} — ${c.desc}`.slice(0, 100), value: c.id }))
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alchemia')
        .setDescription('Warz mikstury i ustaw zestaw na walki w podziemiach i na zleceniach.')
        .addSubcommand((s) => s
            .setName('warz')
            .setDescription('Uwarz miksturę (płacisz koronami, mocne za Uszy).')
            .addStringOption((o) => o.setName('mikstura').setDescription('Co warzysz').setRequired(true).addChoices(...brewChoices))
            .addIntegerOption((o) => o.setName('ilosc').setDescription('Ile sztuk (1-20)').setRequired(false).setMinValue(1).setMaxValue(20)))
        .addSubcommand((s) => s
            .setName('zestaw')
            .setDescription('Ustaw, co używasz na walkę (1 z każdej kategorii).')
            .addStringOption((o) => o.setName('eliksir').setDescription('Eliksir na walkę').setRequired(false).addChoices(...slotChoices.eliksir))
            .addStringOption((o) => o.setName('olej').setDescription('Olej na walkę').setRequired(false).addChoices(...slotChoices.olej))
            .addStringOption((o) => o.setName('bomba').setDescription('Bomba na walkę').setRequired(false).addChoices(...slotChoices.bomba)))
        .addSubcommand((s) => s
            .setName('plecak')
            .setDescription('Pokaż zapas mikstur, zestaw i przepisy.')),

    async execute(interaction) {
        const db = await getDbConnection();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }
        const sub = interaction.options.getSubcommand();

        // --- WARZENIE ---
        if (sub === 'warz') {
            const id = interaction.options.getString('mikstura');
            const qty = interaction.options.getInteger('ilosc') || 1;
            const c = CONSUMABLES[id];
            const totalCrowns = c.crowns * qty;
            const totalEars = c.ears * qty;

            if ((player.crowns || 0) < totalCrowns) {
                return interaction.reply({ content: `Za mało koron — potrzeba ${totalCrowns}, masz ${player.crowns || 0}.`, flags: MessageFlags.Ephemeral });
            }
            if ((player.ears || 0) < totalEars) {
                return interaction.reply({ content: `Za mało Uszu — potrzeba ${totalEars}, masz ${player.ears || 0}.`, flags: MessageFlags.Ephemeral });
            }

            await db.run('UPDATE players SET crowns = crowns - ?, ears = ears - ? WHERE discord_id = ?', totalCrowns, totalEars, interaction.user.id);
            await addStock(db, interaction.user.id, id, qty);
            await incStat(db, interaction.user.id, 'potions_brewed', qty);

            const embed = baseEmbed('Alembik').setAuthor(authorFor(player))
                .setDescription(`Uwarzono **${c.name}** ×${qty}.\n_${c.desc}_`)
                .addFields({ name: 'Koszt', value: `${totalCrowns} koron${totalEars ? ` + ${totalEars} Uszu` : ''}`, inline: true })
                .setFooter({ text: `Pozostało: ${(player.crowns || 0) - totalCrowns} koron · ${(player.ears || 0) - totalEars} Uszu` });
            const af = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af) embed.addFields(af);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // --- USTAWIANIE ZESTAWU ---
        if (sub === 'zestaw') {
            const updates = [];
            const params = [];
            const summary = [];
            let touched = false;
            for (const cat of CATEGORIES) {
                const val = interaction.options.getString(cat);
                if (val === null) continue; // slot nietknięty
                touched = true;
                const newVal = val === 'none' ? '' : val;
                updates.push(`${PREP_COL[cat]} = ?`);
                params.push(newVal);
            }
            if (touched) {
                params.push(interaction.user.id);
                await db.run(`UPDATE players SET ${updates.join(', ')} WHERE discord_id = ?`, ...params);
            }

            const fresh = await db.get('SELECT prep_eliksir, prep_olej, prep_bomba FROM players WHERE discord_id = ?', interaction.user.id);
            const stock = await getStock(db, interaction.user.id);
            for (const cat of CATEGORIES) {
                const id = fresh[PREP_COL[cat]];
                if (id && CONSUMABLES[id]) {
                    const have = stock[id] || 0;
                    summary.push(`**${CATEGORY_LABEL[cat]}:** ${CONSUMABLES[id].name}` + (have > 0 ? ` _(masz ${have})_` : ' _(brak w zapasie!)_'));
                } else {
                    summary.push(`**${CATEGORY_LABEL[cat]}:** —`);
                }
            }

            const embed = baseEmbed('Zestaw alchemiczny').setAuthor(authorFor(player))
                .setDescription(summary.join('\n'))
                .setFooter({ text: 'Każda walka w podziemiu lub na zleceniu zużywa po 1 sztuce z zapasu.' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // --- PLECAK / PRZEPISY ---
        const stock = await getStock(db, interaction.user.id);
        const embed = baseEmbed('Alchemia').setAuthor(authorFor(player))
            .setDescription(`Korony: **${player.crowns || 0}** · Uszy: **${player.ears || 0}**`);

        // Aktualny zestaw
        const zestaw = CATEGORIES.map((cat) => {
            const id = player[PREP_COL[cat]];
            return `**${CATEGORY_LABEL[cat]}:** ${id && CONSUMABLES[id] ? CONSUMABLES[id].name : '—'}`;
        }).join('\n');
        embed.addFields({ name: 'Twój zestaw', value: zestaw, inline: false });

        // Zapas
        const owned = Object.entries(stock).filter(([, q]) => q > 0);
        embed.addFields({
            name: 'Zapas',
            value: owned.length ? owned.map(([id, q]) => `${CONSUMABLES[id] ? CONSUMABLES[id].name : id} ×${q}`).join('\n') : '_pusto — uwarz coś przez_ `/alchemia warz`',
            inline: false
        });

        // Przepisy wg kategorii
        for (const cat of CATEGORIES) {
            const list = byCategory(cat).map((c) => `**${c.name}** — ${costLabel(c)}\n_${c.desc}_`).join('\n');
            embed.addFields({ name: `${CATEGORY_LABEL[cat]}y`, value: list, inline: false });
        }
        embed.setFooter({ text: 'Limit: 1 eliksir + 1 olej + 1 bomba na walkę. Działa w podziemiach i na zleceniach.' });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
