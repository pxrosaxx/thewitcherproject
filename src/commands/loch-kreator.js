const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const {
    CUSTOM_ARCHETYPES, ARCHETYPE_KEYS,
    createDungeon, getDungeon, getMonsters, addMonster, deleteDungeon, listDungeons
} = require('../data/custom_dungeons');
const { baseEmbed } = require('../utils/embeds');

const archetypeChoices = ARCHETYPE_KEYS.map((k) => ({ name: CUSTOM_ARCHETYPES[k].label.slice(0, 100), value: k }));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loch-kreator')
        .setDescription('Twórz własne lochy i potwory (tylko admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand((s) => s
            .setName('stworz')
            .setDescription('Stwórz nowy loch.')
            .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa lochu').setRequired(true))
            .addIntegerOption((o) => o.setName('poziom').setDescription('Poziom odblokowania (1-200)').setRequired(true).setMinValue(1).setMaxValue(200)))
        .addSubcommand((s) => s
            .setName('dodaj')
            .setDescription('Dodaj potwora do lochu (kolejny etap; ostatni = finałowy boss).')
            .addIntegerOption((o) => o.setName('loch').setDescription('ID lochu (z /loch-kreator lista)').setRequired(true))
            .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa potwora').setRequired(true))
            .addStringOption((o) => o.setName('archetyp').setDescription('Profil walki').setRequired(true).addChoices(...archetypeChoices))
            .addStringOption((o) => o.setName('grafika').setDescription('URL grafiki (opcjonalnie)').setRequired(false)))
        .addSubcommand((s) => s
            .setName('lista')
            .setDescription('Pokaż wszystkie własne lochy i ich potwory.'))
        .addSubcommand((s) => s
            .setName('usun')
            .setDescription('Usuń własny loch wraz z potworami.')
            .addIntegerOption((o) => o.setName('loch').setDescription('ID lochu').setRequired(true))),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Tylko administrator serwera może tworzyć lochy.', flags: MessageFlags.Ephemeral });
        }

        const db = await getDbConnection();
        const sub = interaction.options.getSubcommand();

        if (sub === 'stworz') {
            const nazwa = interaction.options.getString('nazwa').trim().slice(0, 80);
            const poziom = interaction.options.getInteger('poziom');
            const id = await createDungeon(db, nazwa, poziom, interaction.user.id);
            const embed = baseEmbed('Loch utworzony')
                .setDescription(
                    `**${nazwa}** (ID: \`${id}\`) — odblokowanie od poziomu **${poziom}**.\n\n` +
                    `Dodawaj potwory komendą:\n\`/loch-kreator dodaj loch:${id} nazwa:... archetyp:...\`\n` +
                    `Kolejność dodawania = kolejność etapów. **Ostatni dodany potwór to finałowy boss.**`
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'dodaj') {
            const dungeonId = interaction.options.getInteger('loch');
            const dungeon = await getDungeon(db, dungeonId);
            if (!dungeon) {
                return interaction.reply({ content: `Nie ma lochu o ID ${dungeonId}.`, flags: MessageFlags.Ephemeral });
            }
            const nazwa = interaction.options.getString('nazwa').trim().slice(0, 80);
            const archetyp = interaction.options.getString('archetyp');
            let grafika = interaction.options.getString('grafika');
            if (grafika && !/^https?:\/\//i.test(grafika)) {
                return interaction.reply({ content: 'Grafika musi być adresem URL (http/https) albo pomiń ją.', flags: MessageFlags.Ephemeral });
            }
            const stageIndex = await addMonster(db, dungeonId, { name: nazwa, archetype: archetyp, imageUrl: grafika });
            const count = stageIndex + 1;
            const embed = baseEmbed('Potwór dodany')
                .setDescription(
                    `Do lochu **${dungeon.name}** dodano **${nazwa}** jako etap **${count}** (${CUSTOM_ARCHETYPES[archetyp].label}).\n\n` +
                    `Loch ma teraz ${count} ${count === 1 ? 'etap' : 'etapy/etapów'}. Ostatni dodany jest finałowym bossem.`
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'lista') {
            const dungeons = await listDungeons(db);
            if (dungeons.length === 0) {
                return interaction.reply({ content: 'Nie ma jeszcze żadnych własnych lochów.', flags: MessageFlags.Ephemeral });
            }
            const embed = baseEmbed('Własne lochy');
            for (const d of dungeons) {
                const monsters = await getMonsters(db, d.id);
                let val = `ID: \`${d.id}\` · poziom od ${d.min_level} · etapów: ${d.stageCount}`;
                if (monsters.length > 0) {
                    val += '\n' + monsters.map((m, i) => {
                        const fin = i === monsters.length - 1 ? ' — **finał**' : '';
                        return `${i + 1}. ${m.name} _(${m.archetype})_${fin}`;
                    }).join('\n');
                } else {
                    val += '\n_brak potworów — dodaj je, by loch był grywalny_';
                }
                embed.addFields({ name: d.name, value: val.slice(0, 1024), inline: false });
            }
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'usun') {
            const dungeonId = interaction.options.getInteger('loch');
            const dungeon = await getDungeon(db, dungeonId);
            if (!dungeon) {
                return interaction.reply({ content: `Nie ma lochu o ID ${dungeonId}.`, flags: MessageFlags.Ephemeral });
            }
            await deleteDungeon(db, dungeonId);
            return interaction.reply({ content: `Usunięto loch **${dungeon.name}** wraz z potworami.`, flags: MessageFlags.Ephemeral });
        }
    }
};
