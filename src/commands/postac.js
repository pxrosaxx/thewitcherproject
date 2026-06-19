const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { calculateMaxHp } = require('../game/character');
const { baseEmbed } = require('../utils/embeds');

function buildSchoolSelection() {
    const embed = baseEmbed('Wybierz swoją Szkołę').setDescription(
        'Każda szkoła wiedźmińska uczy innego stylu walki. Wybór jest **trwały**, więc przemyśl go dobrze.'
    );

    for (const school of Object.values(schools)) {
        embed.addFields({
            name: `${school.emoji} ${school.name} — ${school.title}`,
            value: school.description
        });
    }

    const row = new ActionRowBuilder().addComponents(
        Object.values(schools).map((school) =>
            new ButtonBuilder()
                .setCustomId(`szkola_${school.key}`)
                .setLabel(school.name)
                .setEmoji(school.emoji)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    return { embeds: [embed], components: [row] };
}

function confirmationEmbed(name, school, maxHp) {
    return baseEmbed('Postać stworzona!')
        .setDescription(
            `**${name}** wyrusza w świat jako wiedźmin ${school.emoji} **${school.name}** (${school.title}).`
        )
        .addFields(
            { name: 'Siła', value: `${school.baseStats.str}`, inline: true },
            { name: 'Zręczność', value: `${school.baseStats.dex}`, inline: true },
            { name: 'Inteligencja', value: `${school.baseStats.intel}`, inline: true },
            { name: 'Witalność', value: `${school.baseStats.wit}`, inline: true },
            { name: 'Szczęście', value: `${school.baseStats.luck}`, inline: true },
            { name: 'Punkty życia', value: `${maxHp}`, inline: true }
        )
        .setFooter({ text: 'Użyj /profil, aby zobaczyć kartę postaci w dowolnej chwili.' });
}

async function applySchoolChoice(db, discordId, schoolKey) {
    const school = schools[schoolKey];
    const stats = school.baseStats;
    const maxHp = calculateMaxHp(stats, 1);

    await db.run(
        `UPDATE players
         SET school = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?, hp = ?, max_hp = ?
         WHERE discord_id = ?`,
        [school.key, stats.str, stats.dex, stats.intel, stats.wit, stats.luck, maxHp, maxHp, discordId]
    );

    return { school, maxHp };
}

async function awaitSchoolButton(user, message, db, discordId, name) {
    try {
        const buttonInteraction = await message.awaitMessageComponent({
            filter: (i) => i.user.id === user.id,
            time: 60_000
        });

        const schoolKey = buttonInteraction.customId.replace('szkola_', '');
        const { school, maxHp } = await applySchoolChoice(db, discordId, schoolKey);

        await buttonInteraction.update({
            embeds: [confirmationEmbed(name, school, maxHp)],
            components: []
        });
    } catch {
        // Czas minął bez kliknięcia - zdejmujemy przyciski, gracz wróci komendą /postac
        await message.edit({ components: [] }).catch(() => {});
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postac')
        .setDescription('Stwórz swoją wiedźmińską postać albo dokończ wybór Szkoły.'),

    async execute(interaction) {
        const db = await getDbConnection();
        const existing = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);

        // Gracz ma już w pełni utworzoną postać
        if (existing && existing.school) {
            const school = schools[existing.school];
            return interaction.reply({
                content: `Masz już postać: **${existing.name}** (${school.name}, poziom ${existing.level}). Użyj \`/profil\`, żeby zobaczyć kartę postaci.`,
                ephemeral: true
            });
        }

        // Gracz istnieje, ale nie dokończył wyboru szkoły
        if (existing && !existing.school) {
            const payload = buildSchoolSelection();
            const msg = await interaction.reply({ ...payload, fetchReply: true });
            return awaitSchoolButton(interaction.user, msg, db, interaction.user.id, existing.name);
        }

        // Zupełnie nowy gracz - najpierw pytamy o imię przez modal
        const modal = new ModalBuilder().setCustomId('postac_imie_modal').setTitle('Stwórz swoją postać');

        const imieInput = new TextInputBuilder()
            .setCustomId('imie')
            .setLabel('Jak ma na imię Twój wiedźmin?')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(20)
            .setPlaceholder('np. Vesemir')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(imieInput));
        await interaction.showModal(modal);

        let modalSubmit;
        try {
            modalSubmit = await interaction.awaitModalSubmit({
                time: 60_000,
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'postac_imie_modal'
            });
        } catch {
            return; // Gracz nie wypełnił modala na czas
        }

        const imie = modalSubmit.fields.getTextInputValue('imie').trim();

        await db.run(`INSERT INTO players (discord_id, name, crowns, level, exp) VALUES (?, ?, 100, 1, 0)`, [
            interaction.user.id,
            imie
        ]);

        const payload = buildSchoolSelection();
        const msg = await modalSubmit.reply({ ...payload, fetchReply: true });
        return awaitSchoolButton(interaction.user, msg, db, interaction.user.id, imie);
    }
};
