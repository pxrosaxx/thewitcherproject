const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { baseEmbed } = require('../utils/embeds');


module.exports = {
    data: new SlashCommandBuilder().setName('ranking').setDescription('Tablica chwały areny — najlepsi wiedźmini serwera.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const top = await db.all(
            'SELECT * FROM players WHERE school IS NOT NULL ORDER BY honor DESC, level DESC LIMIT 15'
        );

        if (top.length === 0) {
            return interaction.reply({ content: 'Nikt nie wszedł jeszcze na arenę.', flags: MessageFlags.Ephemeral });
        }

        const me = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        let board = '';
        top.forEach((p, idx) => {
            const pos = `**${idx + 1}.**`;
            const isMe = me && p.discord_id === me.discord_id ? ' (Ty)' : '';
            board += `${pos} ${schools[p.school].emoji} **${p.name}** — ${p.honor} pkt _(poz. ${p.level}, ${p.arena_wins || 0}W/${p.arena_losses || 0}P)_${isMe}\n`;
        });

        const embed = baseEmbed('Tablica chwały — Arena').setDescription(board);

        // Jesli gracz jest poza topka, pokaz jego pozycje osobno
        if (me && me.school && !top.some((p) => p.discord_id === me.discord_id)) {
            const rankRow = await db.get('SELECT COUNT(*) c FROM players WHERE school IS NOT NULL AND honor > ?', me.honor);
            embed.addFields({
                name: 'Twoja pozycja',
                value: `**#${rankRow.c + 1}** — ${me.honor} pkt _(${me.arena_wins || 0}W/${me.arena_losses || 0}P)_`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
