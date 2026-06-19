const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, MessageFlags
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { simulateCombat } = require('../game/combat');
const {
    ARENA_COOLDOWN, MIN_HONOR, honorDelta, cooldownLeft, buildCombatant, crownReward
} = require('../game/arena');
const { formatDuration } = require('../game/actionpoints');
const { baseEmbed } = require('../utils/embeds');

function formatLog(log, maxLines = 12) {
    if (log.length <= maxLines) return log.join('\n');
    const head = log.slice(0, maxLines - 3);
    const tail = log.slice(-3);
    return `${head.join('\n')}\n*… pominięto ${log.length - maxLines} akcji …*\n${tail.join('\n')}`;
}

async function rankOf(db, honor) {
    const row = await db.get('SELECT COUNT(*) c FROM players WHERE school IS NOT NULL AND honor > ?', honor);
    return row.c + 1;
}

module.exports = {
    data: new SlashCommandBuilder().setName('arena').setDescription('Wyzwij innego gracza na pojedynek w arenie.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const me = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!me || !me.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }

        const myRank = await rankOf(db, me.honor);
        const totalRow = await db.get('SELECT COUNT(*) c FROM players WHERE school IS NOT NULL');

        // Cooldown
        const cd = cooldownLeft(me);
        if (cd > 0) {
            const embed = baseEmbed('Arena')
                .setDescription(`**${me.name}** — pozycja **#${myRank}** • **${me.honor}** pkt chwały\n\nMusisz odpocząć po ostatnim pojedynku.\nNastępna walka za **${formatDuration(cd)}**.`);
            return interaction.reply({ embeds: [embed] });
        }

        // Przeciwnicy: inni gracze, najblizej poziomem
        const opponents = await db.all(
            `SELECT * FROM players WHERE discord_id != ? AND school IS NOT NULL
             ORDER BY ABS(level - ?) ASC, ABS(honor - ?) ASC LIMIT 6`,
            interaction.user.id, me.level, me.honor
        );

        if (opponents.length === 0) {
            const embed = baseEmbed('Arena')
                .setDescription(`**${me.name}** — pozycja **#${myRank}** • **${me.honor}** pkt chwały\n\nNa razie nie ma kogo wyzwać — potrzeba więcej wiedźminów na serwerze.`);
            return interaction.reply({ embeds: [embed] });
        }

        const embed = baseEmbed('Arena — wybierz przeciwnika')
            .setDescription(`**${me.name}** — pozycja **#${myRank}** z ${totalRow.c} • **${me.honor}** pkt chwały\nWygrane: ${me.arena_wins || 0} • Porażki: ${me.arena_losses || 0}\n\nWyzwij kogoś z listy:`);

        for (const o of opponents) {
            const oRank = await rankOf(db, o.honor);
            embed.addFields({
                name: `${schools[o.school].emoji} ${o.name}`,
                value: `poz. ${o.level} • #${oRank} • ${o.honor} pkt`,
                inline: true
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('arena_pick')
            .setPlaceholder('Kogo wyzywasz?')
            .addOptions(opponents.map((o) => ({
                label: `${o.name} (poz. ${o.level})`.slice(0, 100),
                description: `${schools[o.school].title} • ${o.honor} pkt chwały`.slice(0, 100),
                value: o.discord_id
            })));

        await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        const message = await interaction.fetchReply();

        let choice;
        try {
            choice = await message.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'arena_pick',
                componentType: ComponentType.StringSelect,
                time: 60000
            });
        } catch {
            await interaction.editReply({ components: [] }).catch(() => {});
            return;
        }

        // Ponowne pobranie i kontrola cooldownu (anty-dublowanie)
        const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (cooldownLeft(fresh) > 0) {
            return choice.update({ embeds: [baseEmbed('Arena').setDescription('Musisz jeszcze odpocząć przed kolejną walką.')], components: [] });
        }

        const opp = await db.get('SELECT * FROM players WHERE discord_id = ?', choice.values[0]);
        if (!opp) {
            return choice.update({ embeds: [baseEmbed('Arena').setDescription('Ten przeciwnik już nie istnieje.')], components: [] });
        }

        // Walka na pelnych efektywnych statach
        const pcMe = await buildCombatant(db, fresh);
        const pcOpp = await buildCombatant(db, opp);
        const result = simulateCombat(pcMe, pcOpp);
        const won = result.winner === 'player';

        // ELO (suma zerowa)
        const delta = honorDelta(fresh.honor, opp.honor, won);
        const myNewHonor = Math.max(MIN_HONOR, fresh.honor + delta);
        const oppNewHonor = Math.max(MIN_HONOR, opp.honor - delta);

        // Nagrody atakujacego
        let gainedCrowns = 0, gainedEars = 0;
        if (won) {
            gainedCrowns = crownReward(opp.level);
            if (Math.random() < 0.08) gainedEars = 1;
        }

        // Zapis: atakujacy
        await db.run(
            `UPDATE players SET honor = ?, arena_wins = arena_wins + ?, arena_losses = arena_losses + ?,
             crowns = crowns + ?, ears = ears + ?, last_arena_fight = ? WHERE discord_id = ?`,
            myNewHonor, won ? 1 : 0, won ? 0 : 1, gainedCrowns, gainedEars,
            Math.floor(Date.now() / 1000), interaction.user.id
        );
        // Zapis: obronca (zmiana honoru + statystyka obrony)
        await db.run(
            `UPDATE players SET honor = ?, arena_wins = arena_wins + ?, arena_losses = arena_losses + ? WHERE discord_id = ?`,
            oppNewHonor, won ? 0 : 1, won ? 1 : 0, opp.discord_id
        );

        const newRank = await rankOf(db, myNewHonor);
        const deltaTxt = delta >= 0 ? `+${delta}` : `${delta}`;

        const resultEmbed = baseEmbed(won ? 'Zwycięstwo w arenie' : 'Porażka w arenie')
            .setDescription(
                `${schools[fresh.school].emoji} **${fresh.name}** vs ${schools[opp.school].emoji} **${opp.name}**\n\n${formatLog(result.log)}`
            )
            .addFields({
                name: 'Punkty chwały',
                value: `${fresh.honor} → **${myNewHonor}** (${deltaTxt})\nPozycja w rankingu: **#${newRank}**`,
                inline: false
            });

        if (won) {
            let nagrody = `**+${gainedCrowns}** koron`;
            if (gainedEars > 0) nagrody += `\n**+1 Ucho**`;
            resultEmbed.addFields({ name: 'Nagroda', value: nagrody, inline: false });
        }
        resultEmbed.setFooter({ text: `Następna walka za ${formatDuration(ARENA_COOLDOWN)}` });

        await choice.update({ embeds: [resultEmbed], components: [] });
    }
};
