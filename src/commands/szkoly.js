const { SlashCommandBuilder } = require('discord.js');
const schools = require('../data/schools');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('szkoly')
        .setDescription('Pokazuje wszystkie Szkoły wiedźmińskie i ich style walki.'),

    async execute(interaction) {
        const embed = baseEmbed('Szkoły Wiedźmińskie').setDescription(
            'Pięć szkół, pięć stylów walki. Wyboru dokonuje się przy tworzeniu postaci komendą `/postac` i jest on trwały.'
        );

        for (const school of Object.values(schools)) {
            const s = school.baseStats;
            embed.addFields({
                name: `${school.emoji} ${school.name} — ${school.title}`,
                value: `${school.description}\nStaty startowe: Siła ${s.str} • Zręczność ${s.dex} • Inteligencja ${s.intel} • Witalność ${s.wit} • Szczęście ${s.luck}`
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
