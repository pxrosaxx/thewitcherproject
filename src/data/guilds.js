// =============================================================================
//  GILDIE (Etap 15) — wspólne struktury graczy.
//  • Skarbiec  — wpłaty koron, ulepszenia; +1%/poziom do STATYSTYK członków.
//  • Akademia  — j.w.; +1%/poziom do DOŚWIADCZENIA członków.
//  • Portal    — wspólny boss; każdy bije raz dziennie; po pokonaniu nagroda
//                dla całej gildii i awans na mocniejszy etap.
// =============================================================================

const { getEquipmentBonus } = require('../game/inventory');
const { baseWithBought } = require('../game/training');
const { MONSTER_NAMES } = require('./monster_names');

const GUILD_COST = 1000;            // korony za założenie gildii
const MAX_MEMBERS = 20;
const MAX_BUILDING_LEVEL = 50;
const TREASURE_PER_LVL = 0.01;      // +1% statystyk / poziom skarbca
const ACADEMY_PER_LVL = 0.01;       // +1% exp / poziom akademii

/** Koszt ulepszenia budynku z poziomu `level` na `level+1`. */
function upgradeCost(level) {
    return 400 * (level + 1);
}

/** Maksymalne HP portalu na danym etapie. */
function portalMaxHp(stage) {
    return Math.round(1000 * Math.pow(1.35, stage - 1));
}

/** Nazwa bossa portalu wg etapu (z puli potężnych potworów, dla klimatu). */
function portalBossName(stage) {
    const pool = [...(MONSTER_NAMES.mythic || []), ...(MONSTER_NAMES.legendary || [])];
    if (!pool.length) return 'Bestia z Portalu';
    return pool[(stage - 1) % pool.length];
}

// --- Odczyt -----------------------------------------------------------------

async function getGuildById(db, id) {
    return db.get('SELECT * FROM guilds WHERE id = ?', id);
}
async function getGuildByName(db, name) {
    return db.get('SELECT * FROM guilds WHERE name = ? COLLATE NOCASE', name);
}
async function getMember(db, discordId) {
    return db.get('SELECT * FROM guild_members WHERE discord_id = ?', discordId);
}
async function getMembers(db, guildId) {
    return db.all('SELECT * FROM guild_members WHERE guild_id = ? ORDER BY donated DESC, joined_at ASC', guildId);
}
async function memberCount(db, guildId) {
    const r = await db.get('SELECT COUNT(*) c FROM guild_members WHERE guild_id = ?', guildId);
    return r.c;
}

/** Pasywne bonusy gildii dla gracza (mnożniki). Null, jeśli bez gildii. */
async function getBonuses(db, discordId) {
    const m = await getMember(db, discordId);
    if (!m) return null;
    const g = await getGuildById(db, m.guild_id);
    if (!g) return null;
    return {
        guild: g,
        role: m.role,
        treasureMult: 1 + g.treasure_level * TREASURE_PER_LVL,
        academyMult: 1 + g.academy_level * ACADEMY_PER_LVL
    };
}

/** „Moc" gracza = suma efektywnych statystyk (poziom + trening + ekwipunek). */
async function playerPower(db, player) {
    const bonus = await getEquipmentBonus(db, player.discord_id, player.school);
    const base = baseWithBought(player);
    return (base.str + bonus.str) + (base.dex + bonus.dex) + (base.intel + bonus.intel)
        + (base.wit + bonus.wit) + (base.luck + bonus.luck);
}

// --- Zarządzanie ------------------------------------------------------------

async function createGuild(db, name, leaderId) {
    const hp = portalMaxHp(1);
    const r = await db.run(
        'INSERT INTO guilds (name, leader_id, portal_stage, portal_hp, portal_max_hp, created_at) VALUES (?, ?, 1, ?, ?, ?)',
        name, leaderId, hp, hp, Date.now()
    );
    await db.run(
        'INSERT INTO guild_members (discord_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?)',
        leaderId, r.lastID, 'leader', Date.now()
    );
    return r.lastID;
}

async function joinGuild(db, guildId, discordId) {
    await db.run(
        'INSERT INTO guild_members (discord_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?)',
        discordId, guildId, 'member', Date.now()
    );
}

async function deleteGuild(db, guildId) {
    await db.run('DELETE FROM guild_members WHERE guild_id = ?', guildId);
    await db.run('DELETE FROM guilds WHERE id = ?', guildId);
}

/** Usuwa członka. Jeśli odchodzi lider: przekazuje przywództwo lub rozwiązuje gildię. */
async function removeMember(db, guildId, discordId) {
    const member = await getMember(db, discordId);
    await db.run('DELETE FROM guild_members WHERE discord_id = ?', discordId);
    if (member && member.role === 'leader') {
        const rest = await getMembers(db, guildId);
        if (rest.length === 0) {
            await db.run('DELETE FROM guilds WHERE id = ?', guildId);
            return { disbanded: true };
        }
        // Następny lider: najpierw oficer, inaczej najdłużej obecny.
        const heir = rest.find((m) => m.role === 'officer') || rest[0];
        await db.run('UPDATE guild_members SET role = ? WHERE discord_id = ?', 'leader', heir.discord_id);
        await db.run('UPDATE guilds SET leader_id = ? WHERE id = ?', heir.discord_id, guildId);
        return { newLeader: heir.discord_id };
    }
    return {};
}

async function setRole(db, discordId, role) {
    await db.run('UPDATE guild_members SET role = ? WHERE discord_id = ?', role, discordId);
}

async function donate(db, guildId, discordId, amount) {
    await db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', amount, guildId);
    await db.run('UPDATE guild_members SET donated = donated + ? WHERE discord_id = ?', amount, discordId);
}

/** Ulepsza budynek ('skarbiec'|'akademia') za korony ze skarbca. */
async function upgradeBuilding(db, guild, building) {
    const col = building === 'skarbiec' ? 'treasure_level' : 'academy_level';
    const level = guild[col];
    if (level >= MAX_BUILDING_LEVEL) return { error: 'max' };
    const cost = upgradeCost(level);
    if (guild.treasury < cost) return { error: 'funds', cost };
    await db.run(`UPDATE guilds SET ${col} = ${col} + 1, treasury = treasury - ? WHERE id = ?`, cost, guild.id);
    return { ok: true, cost, newLevel: level + 1 };
}

// --- Portal -----------------------------------------------------------------

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Atak na portal (raz dziennie). Zwraca wynik: obrażenia, czy pokonano etap,
 * nagrody. Po pokonaniu rozdaje korony WSZYSTKIM członkom i awansuje etap.
 */
async function attackPortal(db, guild, player, power) {
    const member = await getMember(db, player.discord_id);
    if (member.last_portal_attack === todayStr()) {
        return { cooldown: true };
    }
    await db.run('UPDATE guild_members SET last_portal_attack = ? WHERE discord_id = ?', todayStr(), player.discord_id);

    const damage = Math.max(1, Math.round(power * (0.85 + Math.random() * 0.3)));
    let hp = guild.portal_hp - damage;

    if (hp > 0) {
        await db.run('UPDATE guilds SET portal_hp = ? WHERE id = ?', hp, guild.id);
        return { damage, remaining: hp, max: guild.portal_max_hp, cleared: false };
    }

    // Etap pokonany — nagroda dla całej gildii, awans.
    const stage = guild.portal_stage;
    const newStage = stage + 1;
    const newHp = portalMaxHp(newStage);
    const perMember = 40 + stage * 25;
    const finisherExp = 60 + stage * 40;
    const earsBonus = newStage % 5 === 0 ? 1 : 0; // ucho co 5 etapów

    const members = await getMembers(db, guild.id);
    for (const m of members) {
        await db.run('UPDATE players SET crowns = crowns + ? WHERE discord_id = ?', perMember, m.discord_id);
    }
    if (earsBonus > 0) {
        for (const m of members) {
            await db.run('UPDATE players SET ears = ears + ? WHERE discord_id = ?', earsBonus, m.discord_id);
        }
    }
    await db.run(
        'UPDATE guilds SET portal_stage = ?, portal_hp = ?, portal_max_hp = ? WHERE id = ?',
        newStage, newHp, newHp, guild.id
    );

    return {
        damage, cleared: true, clearedStage: stage, newStage,
        perMember, finisherExp, earsBonus, memberCount: members.length
    };
}

/** Wynik gildii do rankingu: etap portalu waży najwięcej, potem budynki i chwała wojen. */
function guildScore(g) {
    return g.portal_stage * 1000 + (g.treasure_level + g.academy_level) * 50 + ((g.guild_honor || 1000) - 1000);
}

async function listGuilds(db) {
    const guilds = await db.all('SELECT * FROM guilds');
    for (const g of guilds) g._members = await memberCount(db, g.id);
    guilds.sort((a, b) => guildScore(b) - guildScore(a));
    return guilds;
}

module.exports = {
    GUILD_COST, MAX_MEMBERS, MAX_BUILDING_LEVEL, TREASURE_PER_LVL, ACADEMY_PER_LVL,
    upgradeCost, portalMaxHp, portalBossName,
    getGuildById, getGuildByName, getMember, getMembers, memberCount,
    getBonuses, playerPower,
    createGuild, joinGuild, deleteGuild, removeMember, setRole, donate, upgradeBuilding,
    attackPortal, guildScore, listGuilds
};
