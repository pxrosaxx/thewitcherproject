// =============================================================================
//  ARENA PvP — logika rankingu (ELO), walki miedzy graczami i nagrod.
// =============================================================================

const { calculateMaxHp } = require('./character');
const { combatantFromPlayer } = require('./combat');
const { baseWithBought } = require('./training');
const { getEquipmentBonus } = require('./inventory');
const schools = require('../data/schools');

const ARENA_COOLDOWN = 300;   // 5 minut miedzy walkami areny
const START_HONOR = 1000;
const MIN_HONOR = 100;
const K_FACTOR = 32;

const nowSec = () => Math.floor(Date.now() / 1000);

/** Szansa oczekiwana (ELO) gracza o honorze a przeciw b. */
function expectedScore(a, b) {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/**
 * Zmiana punktow chwaly atakujacego (suma zerowa: obronca traci tyle samo).
 * won = czy atakujacy wygral.
 */
function honorDelta(myHonor, oppHonor, won) {
    const exp = expectedScore(myHonor, oppHonor);
    return Math.round(K_FACTOR * ((won ? 1 : 0) - exp));
}

/** Sekundy pozostale do konca cooldownu areny (0 jesli gotowe). */
function cooldownLeft(player) {
    const elapsed = nowSec() - (player.last_arena_fight || 0);
    return Math.max(0, ARENA_COOLDOWN - elapsed);
}

/**
 * Buduje zawodnika do walki z pelnymi efektywnymi statami
 * (poziom + trening + ekwipunek).
 */
async function buildCombatant(db, player) {
    const bonus = await getEquipmentBonus(db, player.discord_id, player.school);
    const base = baseWithBought(player);
    const eff = {
        str: base.str + bonus.str, dex: base.dex + bonus.dex, intel: base.intel + bonus.intel,
        wit: base.wit + bonus.wit, luck: base.luck + bonus.luck
    };
    const combatPlayer = { ...player, ...eff, max_hp: calculateMaxHp(eff, player.level) };
    return combatantFromPlayer(combatPlayer, schools[player.school]);
}

/** Nagroda w koronach dla atakujacego za wygrana. */
function crownReward(opponentLevel) {
    return Math.round(50 + opponentLevel * 10);
}

module.exports = {
    ARENA_COOLDOWN, START_HONOR, MIN_HONOR,
    expectedScore, honorDelta, cooldownLeft, buildCombatant, crownReward
};
