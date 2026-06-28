// =============================================================================
//  BITWY GILDII (Etap 16) — wojny między gildiami.
//  Szyki obu gildii stają do sekwencji pojedynków „król wzgórza": zwycięzca
//  walczy dalej z RESZTKĄ ŻYCIA przeciw kolejnemu wrogowi (pełne HP), aż jedna
//  strona zostanie wybita. Rozstrzygane natychmiast (PvP asynchroniczne).
// =============================================================================

const { buildCombatant } = require('../game/arena');
const { simulateCombat } = require('../game/combat');

const GUILD_BATTLE_SIZE = 15;       // maks. zawodników w szyku
const WAR_COOLDOWN = 3600;          // sekundy między wojnami gildii (atakujący)
const WIN_HONOR = 30;
const LOSS_HONOR = 20;
const MEMBER_REWARD = 80;           // korony dla każdego członka zwycięskiej gildii

function applyTreasure(c, mult) {
    if (!mult || mult === 1) return;
    for (const k of ['str', 'dex', 'intel', 'wit', 'luck']) c.stats[k] = Math.round(c.stats[k] * mult);
    c.maxHp = Math.round(c.maxHp * mult);
    c.hp = c.maxHp;
}

function powerOf(c) {
    const s = c.stats;
    return s.str + s.dex + s.intel + s.wit + s.luck;
}

/** Buduje szyk gildii: zawodnicy z ekwipunkiem + bonus skarbca, słabsi z przodu. */
async function buildLineup(db, members, treasureMult) {
    const fighters = [];
    for (const m of members) {
        const player = await db.get('SELECT * FROM players WHERE discord_id = ?', m.discord_id);
        if (!player || !player.school) continue;
        const c = await buildCombatant(db, player);
        applyTreasure(c, treasureMult);
        fighters.push({ name: player.name, c });
    }
    fighters.sort((a, b) => powerOf(a.c) - powerOf(b.c)); // najsłabsi pierwsi (silny kończy)
    return fighters.slice(0, GUILD_BATTLE_SIZE);
}

function resetForDuel(c) {
    c.effects = [];
    c.blockNext = false;
    // HP celowo NIE resetowane — zwycięzca niesie obrażenia dalej.
}

/**
 * Rozgrywa gauntlet między szykami A i B. Zwraca zwycięską stronę + log pojedynków.
 */
function gauntlet(A, B) {
    const log = [];
    let ai = 0, bi = 0;
    while (ai < A.length && bi < B.length) {
        resetForDuel(A[ai].c);
        resetForDuel(B[bi].c);
        const res = simulateCombat(A[ai].c, B[bi].c, { pvp: true });
        if (res.winner === 'player') {
            log.push(`${A[ai].name} pokonał(a) ${B[bi].name} — został(a) z ${Math.round(A[ai].c.hp)} HP`);
            bi++;
        } else {
            log.push(`${B[bi].name} pokonał(a) ${A[ai].name} — został(a) z ${Math.round(B[bi].c.hp)} HP`);
            ai++;
        }
    }
    return { winnerSide: ai < A.length ? 'A' : 'B', log, survivorsA: A.length - ai, survivorsB: B.length - bi };
}

/** Pełna symulacja bitwy dwóch gildii (czyste obliczenie, bez zapisu do bazy). */
async function simulateGuildBattle(db, guildA, guildB, membersA, membersB) {
    const tA = 1 + guildA.treasure_level * 0.01;
    const tB = 1 + guildB.treasure_level * 0.01;
    const A = await buildLineup(db, membersA, tA);
    const B = await buildLineup(db, membersB, tB);
    if (A.length === 0 || B.length === 0) return { error: 'empty', emptySide: A.length === 0 ? 'A' : 'B' };
    const result = gauntlet(A, B);
    return { ...result, sizeA: A.length, sizeB: B.length };
}

/** Zapisuje wynik wojny: rekordy, chwała gildii, nagrody dla zwycięzców. */
async function applyWarResult(db, winner, loser, winnerMembers) {
    await db.run('UPDATE guilds SET war_wins = war_wins + 1, guild_honor = guild_honor + ? WHERE id = ?',
        WIN_HONOR, winner.id);
    await db.run('UPDATE guilds SET war_losses = war_losses + 1, guild_honor = MAX(0, guild_honor - ?) WHERE id = ?',
        LOSS_HONOR, loser.id);
    for (const m of winnerMembers) {
        await db.run('UPDATE players SET crowns = crowns + ? WHERE discord_id = ?', MEMBER_REWARD, m.discord_id);
    }
    return { honor: WIN_HONOR, memberReward: MEMBER_REWARD, members: winnerMembers.length };
}

/** Zapisuje datę wojny u atakującego (cooldown dotyczy inicjatora, nie zwycięzcy). */
async function stampWar(db, guildId) {
    await db.run('UPDATE guilds SET last_war = ? WHERE id = ?', Math.floor(Date.now() / 1000), guildId);
}

function warCooldownLeft(guild) {
    const left = (guild.last_war || 0) + WAR_COOLDOWN - Math.floor(Date.now() / 1000);
    return left > 0 ? left : 0;
}

module.exports = {
    GUILD_BATTLE_SIZE, WAR_COOLDOWN, WIN_HONOR, LOSS_HONOR, MEMBER_REWARD,
    simulateGuildBattle, applyWarResult, stampWar, warCooldownLeft
};
