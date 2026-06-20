const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const getDbConnection = require('../db');
const schools = require('../data/schools');
const { levelUpFromExp } = require('../game/character');
const { baseEmbed, authorFor, progressBar, outcomeColor } = require('../utils/embeds');
const { revealCombat } = require('../utils/combat_anim');
const { formatDuration } = require('../game/actionpoints');
const { incStat, setStatMax } = require('../game/player_stats');
const { checkAchievements, achievementsField } = require('../data/achievements');
const G = require('../data/guilds');
const GB = require('../data/guild_battle');

async function nameOf(db, discordId) {
    const p = await db.get('SELECT name FROM players WHERE discord_id = ?', discordId);
    return p ? p.name : 'Nieznany';
}

function roleLabel(role) {
    return role === 'leader' ? 'lider' : role === 'officer' ? 'oficer' : 'członek';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gildia')
        .setDescription('Gildie: skarbiec, akademia, portal i wspólne granie.')
        .addSubcommand((s) => s.setName('info').setDescription('Pokaż swoją gildię.'))
        .addSubcommand((s) => s.setName('stworz').setDescription(`Załóż gildię (koszt ${G.GUILD_COST} koron).`)
            .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa gildii').setRequired(true)))
        .addSubcommand((s) => s.setName('dolacz').setDescription('Dołącz do istniejącej gildii.')
            .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa gildii').setRequired(true)))
        .addSubcommand((s) => s.setName('opusc').setDescription('Opuść swoją gildię.'))
        .addSubcommand((s) => s.setName('wesprzyj').setDescription('Wpłać korony do skarbca gildii.')
            .addIntegerOption((o) => o.setName('ilosc').setDescription('Ile koron').setRequired(true).setMinValue(1)))
        .addSubcommand((s) => s.setName('ulepsz').setDescription('Ulepsz budynek gildii (lider/oficer).')
            .addStringOption((o) => o.setName('co').setDescription('Co ulepszyć').setRequired(true)
                .addChoices({ name: 'Skarbiec (+1% statystyk)', value: 'skarbiec' }, { name: 'Akademia (+1% exp)', value: 'akademia' })))
        .addSubcommand((s) => s.setName('portal').setDescription('Pokaż portal gildii.'))
        .addSubcommand((s) => s.setName('atakuj').setDescription('Zaatakuj portal gildii (raz dziennie).'))
        .addSubcommand((s) => s.setName('wojna').setDescription('Wypowiedz wojnę innej gildii (lider/oficer).')
            .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa gildii przeciwnika').setRequired(true)))
        .addSubcommand((s) => s.setName('wyrzuc').setDescription('Wyrzuć członka (lider).')
            .addUserOption((o) => o.setName('gracz').setDescription('Kogo wyrzucić').setRequired(true)))
        .addSubcommand((s) => s.setName('awansuj').setDescription('Awansuj/degraduj członka na oficera (lider).')
            .addUserOption((o) => o.setName('gracz').setDescription('Kogo').setRequired(true)))
        .addSubcommand((s) => s.setName('ranking').setDescription('Ranking gildii.')),

    async execute(interaction) {
        const db = await getDbConnection();
        const sub = interaction.options.getSubcommand();
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
        if (!player || !player.school) {
            return interaction.reply({ content: 'Najpierw stwórz postać komendą `/postac`.', flags: MessageFlags.Ephemeral });
        }
        const eph = { flags: MessageFlags.Ephemeral };

        // --- RANKING (nie wymaga gildii) ---
        if (sub === 'ranking') {
            const list = await G.listGuilds(db);
            if (!list.length) return interaction.reply({ content: 'Nie ma jeszcze żadnej gildii. Załóż pierwszą przez `/gildia stworz`.', ...eph });
            const embed = baseEmbed('Ranking gildii');
            embed.setDescription(list.slice(0, 10).map((g, i) =>
                `**${i + 1}. ${g.name}** — portal etap ${g.portal_stage} · chwała ${g.guild_honor || 1000} · wojny ${g.war_wins || 0}W/${g.war_losses || 0}P · ${g._members} członków`
            ).join('\n'));
            return interaction.reply({ embeds: [embed] });
        }

        // --- STWORZ ---
        if (sub === 'stworz') {
            if (await G.getMember(db, interaction.user.id)) return interaction.reply({ content: 'Jesteś już w gildii. Najpierw ją opuść (`/gildia opusc`).', ...eph });
            const nazwa = interaction.options.getString('nazwa').trim().slice(0, 40);
            if (nazwa.length < 3) return interaction.reply({ content: 'Nazwa musi mieć co najmniej 3 znaki.', ...eph });
            if (await G.getGuildByName(db, nazwa)) return interaction.reply({ content: 'Gildia o tej nazwie już istnieje.', ...eph });
            if ((player.crowns || 0) < G.GUILD_COST) return interaction.reply({ content: `Potrzebujesz ${G.GUILD_COST} koron, masz ${player.crowns || 0}.`, ...eph });
            await db.run('UPDATE players SET crowns = crowns - ? WHERE discord_id = ?', G.GUILD_COST, interaction.user.id);
            await G.createGuild(db, nazwa, interaction.user.id);
            await setStatMax(db, interaction.user.id, 'guild_joined', 1);
            const embed = baseEmbed('Gildia założona').setAuthor(authorFor(player)).setDescription(`Powstała gildia **${nazwa}**! Jesteś jej liderem.\nZapraszaj graczy (dołączają przez \`/gildia dolacz nazwa:${nazwa}\`), wpłacajcie korony i bijcie portal.`);
            const af = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af) embed.addFields(af);
            return interaction.reply({ embeds: [embed] });
        }

        // --- DOLACZ ---
        if (sub === 'dolacz') {
            if (await G.getMember(db, interaction.user.id)) return interaction.reply({ content: 'Jesteś już w gildii.', ...eph });
            const nazwa = interaction.options.getString('nazwa').trim();
            const guild = await G.getGuildByName(db, nazwa);
            if (!guild) return interaction.reply({ content: 'Nie ma gildii o tej nazwie.', ...eph });
            if (await G.memberCount(db, guild.id) >= G.MAX_MEMBERS) return interaction.reply({ content: 'Ta gildia jest pełna.', ...eph });
            await G.joinGuild(db, guild.id, interaction.user.id);
            await setStatMax(db, interaction.user.id, 'guild_joined', 1);
            const embed = baseEmbed('Dołączono do gildii').setAuthor(authorFor(player)).setDescription(`Witaj w **${guild.name}**! Zobacz \`/gildia info\` i wesprzyj skarbiec przez \`/gildia wesprzyj\`.`);
            const af = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af) embed.addFields(af);
            return interaction.reply({ embeds: [embed] });
        }

        // Pozostałe akcje wymagają członkostwa.
        const member = await G.getMember(db, interaction.user.id);
        if (!member) return interaction.reply({ content: 'Nie należysz do żadnej gildii. Załóż (`/gildia stworz`) lub dołącz (`/gildia dolacz`).', ...eph });
        const guild = await G.getGuildById(db, member.guild_id);

        // --- OPUSC ---
        if (sub === 'opusc') {
            const res = await G.removeMember(db, guild.id, interaction.user.id);
            let msg = `Opuściłeś gildię **${guild.name}**.`;
            if (res.disbanded) msg += ' Byłeś ostatnim członkiem — gildia została rozwiązana.';
            else if (res.newLeader) msg += ` Przywództwo przejął **${await nameOf(db, res.newLeader)}**.`;
            return interaction.reply({ content: msg, ...eph });
        }

        // --- WESPRZYJ ---
        if (sub === 'wesprzyj') {
            const ilosc = interaction.options.getInteger('ilosc');
            if ((player.crowns || 0) < ilosc) return interaction.reply({ content: `Masz tylko ${player.crowns || 0} koron.`, ...eph });
            await db.run('UPDATE players SET crowns = crowns - ? WHERE discord_id = ?', ilosc, interaction.user.id);
            await G.donate(db, guild.id, interaction.user.id, ilosc);
            await incStat(db, interaction.user.id, 'guild_donated', ilosc);
            const g = await G.getGuildById(db, guild.id);
            const embed = baseEmbed('Wsparcie skarbca').setAuthor(authorFor(player)).setDescription(`Wpłaciłeś **${ilosc}** koron do skarbca **${guild.name}**.\nSkarbiec gildii: **${g.treasury}** koron.`);
            const af = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af) embed.addFields(af);
            return interaction.reply({ embeds: [embed] });
        }

        // --- ULEPSZ ---
        if (sub === 'ulepsz') {
            if (member.role === 'member') return interaction.reply({ content: 'Tylko lider lub oficer może ulepszać budynki.', ...eph });
            const co = interaction.options.getString('co');
            const res = await G.upgradeBuilding(db, guild, co);
            if (res.error === 'max') return interaction.reply({ content: 'Ten budynek osiągnął maksymalny poziom.', ...eph });
            if (res.error === 'funds') return interaction.reply({ content: `Za mało w skarbcu — potrzeba ${res.cost} koron, jest ${guild.treasury}. Wpłaćcie więcej przez \`/gildia wesprzyj\`.`, ...eph });
            const label = co === 'skarbiec' ? 'Skarbiec' : 'Akademia';
            const effect = co === 'skarbiec' ? `+${res.newLevel}% do statystyk wszystkich członków` : `+${res.newLevel}% do doświadczenia wszystkich członków`;
            return interaction.reply({ embeds: [baseEmbed('Ulepszono budynek').setDescription(`**${label}** gildii **${guild.name}** osiągnął **poziom ${res.newLevel}**.\n${effect}.\nKoszt: ${res.cost} koron ze skarbca.`)] });
        }

        // --- PORTAL ---
        if (sub === 'portal') {
            const bossName = G.portalBossName(guild.portal_stage);
            const attackedToday = member.last_portal_attack === new Date().toISOString().split('T')[0];
            const embed = baseEmbed('Portal gildii').setAuthor(authorFor(player))
                .setDescription(`**${guild.name}** — etap **${guild.portal_stage}**\nStrażnik portalu: **${bossName}**`)
                .addFields(
                    { name: 'Wytrzymałość', value: `${guild.portal_hp}/${guild.portal_max_hp}\n${progressBar(guild.portal_hp, guild.portal_max_hp)}`, inline: false },
                    { name: 'Twój dzisiejszy atak', value: attackedToday ? 'Już wykorzystany — wróć jutro.' : 'Dostępny! Użyj `/gildia atakuj`.', inline: false }
                )
                .setFooter({ text: 'Każdy członek może uderzyć raz dziennie. Pokonanie etapu nagradza całą gildię.' });
            return interaction.reply({ embeds: [embed] });
        }

        // --- ATAKUJ ---
        if (sub === 'atakuj') {
            const power = await G.playerPower(db, player);
            const result = await G.attackPortal(db, guild, player, power);
            if (result.cooldown) return interaction.reply({ content: 'Dziś już atakowałeś portal. Wróć jutro.', ...eph });

            if (!result.cleared) {
                const embed = baseEmbed('Atak na portal').setColor(0x5d7a8f).setAuthor(authorFor(player))
                    .setDescription(`Zadałeś **${result.damage}** obrażeń strażnikowi portalu.`)
                    .addFields({ name: 'Wytrzymałość portalu', value: `${result.remaining}/${result.max}\n${progressBar(result.remaining, result.max)}`, inline: false })
                    .setFooter({ text: 'Wróć jutro po kolejny atak. Dobijcie go wspólnie!' });
                return interaction.reply({ embeds: [embed] });
            }

            // Etap pokonany — nagroda dobijającego (exp + awans) na bazie świeżego stanu.
            const school = schools[player.school];
            const fresh = await db.get('SELECT * FROM players WHERE discord_id = ?', interaction.user.id);
            fresh.exp += result.finisherExp;
            const levels = levelUpFromExp(fresh, school);
            fresh.hp = fresh.max_hp;
            await db.run('UPDATE players SET exp = ?, level = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ?, hp = ?, max_hp = ? WHERE discord_id = ?',
                fresh.exp, fresh.level, fresh.str, fresh.dex, fresh.intel, fresh.wit, fresh.luck, fresh.hp, fresh.max_hp, interaction.user.id);
            await incStat(db, interaction.user.id, 'portal_clears', 1);

            const embed = baseEmbed('Portal pokonany!').setColor(0x3ba55d).setAuthor(authorFor(player))
                .setDescription(`Twoim ciosem (**${result.damage}** obr.) gildia **${guild.name}** pokonała strażnika **etapu ${result.clearedStage}**!`)
                .addFields(
                    { name: 'Nagroda dla całej gildii', value: `+${result.perMember} koron dla każdego z ${result.memberCount} członków` + (result.earsBonus ? `\n+${result.earsBonus} Ucho dla każdego!` : ''), inline: false },
                    { name: 'Twoja premia za dobicie', value: `+${result.finisherExp} exp` + (levels.length ? ` · awans na poziom ${fresh.level}!` : ''), inline: false },
                    { name: 'Nowy etap', value: `Portal wzmocnił się do **etapu ${result.newStage}**.`, inline: false }
                );
            const af = achievementsField(await checkAchievements(db, interaction.user.id));
            if (af) embed.addFields(af);
            return interaction.reply({ embeds: [embed] });
        }

        // --- WOJNA (gildia vs gildia) ---
        if (sub === 'wojna') {
            if (member.role === 'member') return interaction.reply({ content: 'Tylko lider lub oficer może wypowiadać wojny.', ...eph });
            const cd = GB.warCooldownLeft(guild);
            if (cd > 0) return interaction.reply({ content: `Twoja gildia musi odpocząć jeszcze ${formatDuration(cd)} przed kolejną wojną.`, ...eph });
            const nazwa = interaction.options.getString('nazwa').trim();
            const target = await G.getGuildByName(db, nazwa);
            if (!target) return interaction.reply({ content: 'Nie ma gildii o tej nazwie.', ...eph });
            if (target.id === guild.id) return interaction.reply({ content: 'Nie możesz wypowiedzieć wojny własnej gildii.', ...eph });

            const memA = await G.getMembers(db, guild.id);
            const memB = await G.getMembers(db, target.id);
            const res = await GB.simulateGuildBattle(db, guild, target, memA, memB);
            if (res.error === 'empty') {
                await GB.stampWar(db, guild.id);
                return interaction.reply({ content: 'Przeciwna gildia nie ma członków zdolnych do walki.', ...eph });
            }

            const attackerWon = res.winnerSide === 'A';
            const winner = attackerWon ? guild : target;
            const loser = attackerWon ? target : guild;
            const winnerMembers = attackerWon ? memA : memB;
            const reward = await GB.applyWarResult(db, winner, loser, winnerMembers);
            await GB.stampWar(db, guild.id); // cooldown dla atakującego, niezależnie od wyniku

            let af = null;
            if (attackerWon) {
                await incStat(db, interaction.user.id, 'guild_war_wins', 1);
                af = achievementsField(await checkAchievements(db, interaction.user.id));
            }

            const matchup = `**${guild.name}** vs **${target.name}**`;
            const makeFrame = (visible) => baseEmbed('Wojna gildii').setAuthor(authorFor(player))
                .setDescription(`${matchup}\n\n${visible.join('\n')}`);

            const finalEmbed = baseEmbed(attackerWon ? 'Zwycięstwo w wojnie gildii' : 'Porażka w wojnie gildii')
                .setColor(outcomeColor(attackerWon)).setAuthor(authorFor(player))
                .setDescription(matchup)
                .addFields(
                    { name: 'Przebieg bitwy', value: res.log.join('\n').slice(0, 1024), inline: false },
                    { name: 'Wynik', value: `**${winner.name}** zwycięża! Ocaleni z szyku zwycięzcy: ${attackerWon ? res.survivorsA : res.survivorsB}/${attackerWon ? res.sizeA : res.sizeB}.`, inline: false }
                );
            if (attackerWon) {
                finalEmbed.addFields({ name: 'Nagroda', value: `+${reward.honor} chwały gildii\n+${reward.memberReward} koron dla każdego z ${reward.members} członków`, inline: false });
            } else {
                finalEmbed.addFields({ name: 'Skutek', value: `Wasza gildia traci ${GB.LOSS_HONOR} chwały. Wzmocnijcie szyk i spróbujcie ponownie.`, inline: false });
            }
            if (af) finalEmbed.addFields(af);

            await interaction.reply({ embeds: [makeFrame([])] });
            await revealCombat(interaction, res.log, makeFrame, finalEmbed, { steps: 6, delayMs: 1000 });
            return;
        }

        // --- WYRZUC ---
        if (sub === 'wyrzuc') {
            if (member.role !== 'leader') return interaction.reply({ content: 'Tylko lider może wyrzucać członków.', ...eph });
            const target = interaction.options.getUser('gracz');
            if (target.id === interaction.user.id) return interaction.reply({ content: 'Nie możesz wyrzucić samego siebie. Użyj `/gildia opusc`.', ...eph });
            const tm = await G.getMember(db, target.id);
            if (!tm || tm.guild_id !== guild.id) return interaction.reply({ content: 'Ten gracz nie należy do Twojej gildii.', ...eph });
            await G.removeMember(db, guild.id, target.id);
            return interaction.reply({ content: `Wyrzucono **${await nameOf(db, target.id)}** z gildii.`, ...eph });
        }

        // --- AWANSUJ (oficer toggle) ---
        if (sub === 'awansuj') {
            if (member.role !== 'leader') return interaction.reply({ content: 'Tylko lider może mianować oficerów.', ...eph });
            const target = interaction.options.getUser('gracz');
            const tm = await G.getMember(db, target.id);
            if (!tm || tm.guild_id !== guild.id) return interaction.reply({ content: 'Ten gracz nie należy do Twojej gildii.', ...eph });
            if (tm.role === 'leader') return interaction.reply({ content: 'Nie możesz zmienić rangi lidera.', ...eph });
            const newRole = tm.role === 'officer' ? 'member' : 'officer';
            await G.setRole(db, target.id, newRole);
            return interaction.reply({ content: `**${await nameOf(db, target.id)}** jest teraz ${roleLabel(newRole)}em gildii.`, ...eph });
        }

        // --- INFO (domyślny widok) ---
        const members = await G.getMembers(db, guild.id);
        const lines = [];
        for (const m of members) {
            lines.push(`• ${await nameOf(db, m.discord_id)} _(${roleLabel(m.role)})_ — wpłacono ${m.donated}`);
        }
        const tBonus = Math.round(guild.treasure_level * G.TREASURE_PER_LVL * 100);
        const aBonus = Math.round(guild.academy_level * G.ACADEMY_PER_LVL * 100);
        const embed = baseEmbed(guild.name).setAuthor(authorFor(player))
            .setDescription(`Lider: **${await nameOf(db, guild.leader_id)}** · członków: ${members.length}/${G.MAX_MEMBERS}`)
            .addFields(
                { name: 'Skarbiec', value: `${guild.treasury} koron`, inline: true },
                { name: 'Budynek: Skarbiec', value: `poz. ${guild.treasure_level} (+${tBonus}% statystyk)`, inline: true },
                { name: 'Budynek: Akademia', value: `poz. ${guild.academy_level} (+${aBonus}% exp)`, inline: true },
                { name: 'Portal', value: `etap ${guild.portal_stage} · ${guild.portal_hp}/${guild.portal_max_hp}\n${progressBar(guild.portal_hp, guild.portal_max_hp)}`, inline: false },
                { name: 'Wojny gildii', value: `chwała ${guild.guild_honor || 1000} · rekord ${guild.war_wins || 0}W/${guild.war_losses || 0}P`, inline: false },
                { name: 'Członkowie', value: lines.join('\n').slice(0, 1024), inline: false }
            )
            .setFooter({ text: 'Ulepszenia: /gildia ulepsz · Wsparcie: /gildia wesprzyj · Portal: /gildia atakuj' });
        return interaction.reply({ embeds: [embed] });
    }
};
