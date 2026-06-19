// =============================================================================
//  LOKACJE I POTWORY (PvE)
//  Piec lokacji z uniwersum Wiedzmina o rosnacej trudnosci. Kazdy potwor to
//  archetyp z wagami statow i opcjonalnymi cechami; konkretne wartosci sa
//  generowane proceduralnie.
//
//  SKALOWANIE: trudnosc lokacji to "przesuniecie poziomu" (levelOffset), nie
//  mnoznik. Dzieki temu potwory rosna w TYM SAMYM tempie co gracz, a trudniejsze
//  lokacje sa o stala wartosc mocniejsze - win rate pozostaje stabilny na kazdym
//  poziomie zamiast zalamywac sie na wysokich.
// =============================================================================

// Cechy potworow rozpoznawane przez silnik walki:
//   venomous  - zatruwa przy trafieniu
//   armored   - dodatkowa redukcja otrzymywanych obrazen
//   frenzy    - bije mocniej przy niskim HP
//   lifesteal - leczy sie czescia zadanych obrazen
// Wagi (weights) rozkladaja "moc" potwora miedzy staty; ~1.3 to staty wiodaca.

const { MONSTER_NAMES } = require('./monster_names');

const LOCATIONS = {
    velen: {
        key: 'velen', name: 'Bagna Velen', emoji: '🌿',
        minLevel: 1, levelOffset: 0,
        intro: 'Mokradła, mgła i smród zgnilizny. Tu zaczyna każdy wiedźmin.',
        pool: [
            { name: 'Utopiec', emoji: '🦎', offense: 'str', weaponMult: 1.5, hpMult: 1.0, weights: { str: 1.3, dex: 1.0, intel: 0.4, wit: 1.0, luck: 0.8 }, traits: ['venomous'] },
            { name: 'Nekker', emoji: '👺', offense: 'dex', weaponMult: 1.3, hpMult: 0.8, weights: { str: 0.7, dex: 1.4, intel: 0.4, wit: 0.7, luck: 1.1 }, traits: [] },
            { name: 'Topielec', emoji: '🐸', offense: 'str', weaponMult: 1.5, hpMult: 1.1, weights: { str: 1.4, dex: 0.9, intel: 0.4, wit: 1.1, luck: 0.7 }, traits: [] },
            { name: 'Wilk', emoji: '🐺', offense: 'dex', weaponMult: 1.4, hpMult: 0.9, weights: { str: 0.9, dex: 1.3, intel: 0.3, wit: 0.8, luck: 1.0 }, traits: ['frenzy'] },
            { name: 'Mglak', emoji: '🌫️', offense: 'intel', weaponMult: 1.5, hpMult: 0.85, weights: { str: 0.6, dex: 1.2, intel: 1.3, wit: 0.8, luck: 1.0 }, traits: [] }
        ]
    },
    novigrad: {
        key: 'novigrad', name: 'Kanały Novigradu', emoji: '🏚️',
        minLevel: 5, levelOffset: 1,
        intro: 'Cuchnące podziemia miasta, pełne ghuli i ludzi gorszych od potworów.',
        pool: [
            { name: 'Ghul', emoji: '🧟', offense: 'str', weaponMult: 1.5, hpMult: 1.1, weights: { str: 1.3, dex: 0.9, intel: 0.4, wit: 1.1, luck: 0.8 }, traits: ['frenzy'] },
            { name: 'Szczurołak', emoji: '🐀', offense: 'dex', weaponMult: 1.4, hpMult: 0.9, weights: { str: 0.8, dex: 1.4, intel: 0.5, wit: 0.8, luck: 1.2 }, traits: ['venomous'] },
            { name: 'Bandyta', emoji: '🗡️', offense: 'str', weaponMult: 1.5, hpMult: 1.0, weights: { str: 1.2, dex: 1.1, intel: 0.6, wit: 1.0, luck: 1.0 }, traits: [] },
            { name: 'Alghul', emoji: '💀', offense: 'str', weaponMult: 1.5, hpMult: 1.15, weights: { str: 1.4, dex: 0.9, intel: 0.5, wit: 1.2, luck: 0.8 }, traits: ['armored'] },
            { name: 'Młoda wiwerna', emoji: '🐉', offense: 'dex', weaponMult: 1.5, hpMult: 1.0, weights: { str: 1.0, dex: 1.3, intel: 0.6, wit: 0.9, luck: 1.0 }, traits: ['venomous'] }
        ]
    },
    skellige: {
        key: 'skellige', name: 'Wybrzeża Skellige', emoji: '🌊',
        minLevel: 11, levelOffset: 2,
        intro: 'Lodowate wyspy, gdzie czają się sirenki, trolle i berserkerzy.',
        pool: [
            { name: 'Syrena', emoji: '🧜', offense: 'dex', weaponMult: 1.5, hpMult: 0.9, weights: { str: 0.9, dex: 1.5, intel: 0.7, wit: 0.9, luck: 1.1 }, traits: [] },
            { name: 'Troll lodowy', emoji: '🗿', offense: 'str', weaponMult: 1.7, hpMult: 1.4, weights: { str: 1.5, dex: 0.6, intel: 0.4, wit: 1.4, luck: 0.6 }, traits: ['armored'] },
            { name: 'Berserker', emoji: '🪓', offense: 'str', weaponMult: 1.6, hpMult: 1.0, weights: { str: 1.4, dex: 1.0, intel: 0.4, wit: 0.9, luck: 1.0 }, traits: ['frenzy'] },
            { name: 'Harpia', emoji: '🦅', offense: 'dex', weaponMult: 1.5, hpMult: 0.85, weights: { str: 0.8, dex: 1.5, intel: 0.5, wit: 0.8, luck: 1.2 }, traits: [] },
            { name: 'Niedźwiedź', emoji: '🐻', offense: 'str', weaponMult: 1.7, hpMult: 1.3, weights: { str: 1.5, dex: 0.8, intel: 0.3, wit: 1.3, luck: 0.7 }, traits: ['frenzy'] }
        ]
    },
    kaer_morhen: {
        key: 'kaer_morhen', name: 'Szlak do Kaer Morhen', emoji: '🏔️',
        minLevel: 19, levelOffset: 3,
        intro: 'Górska droga do siedziby wiedźminów, strzeżona przez najgroźniejsze bestie.',
        pool: [
            { name: 'Gryf', emoji: '🦅', offense: 'dex', weaponMult: 1.6, hpMult: 1.1, weights: { str: 1.2, dex: 1.5, intel: 0.6, wit: 1.0, luck: 1.0 }, traits: ['frenzy'] },
            { name: 'Bazyliszek', emoji: '🐍', offense: 'dex', weaponMult: 1.5, hpMult: 1.0, weights: { str: 1.0, dex: 1.4, intel: 0.6, wit: 1.0, luck: 1.1 }, traits: ['venomous'] },
            { name: 'Skalny troll', emoji: '⛰️', offense: 'str', weaponMult: 1.8, hpMult: 1.5, weights: { str: 1.6, dex: 0.6, intel: 0.4, wit: 1.5, luck: 0.6 }, traits: ['armored'] },
            { name: 'Kikimora', emoji: '🕷️', offense: 'dex', weaponMult: 1.5, hpMult: 1.0, weights: { str: 1.1, dex: 1.4, intel: 0.5, wit: 1.0, luck: 1.0 }, traits: ['venomous'] },
            { name: 'Wilkołak', emoji: '🐗', offense: 'str', weaponMult: 1.7, hpMult: 1.1, weights: { str: 1.4, dex: 1.2, intel: 0.4, wit: 1.0, luck: 1.3 }, traits: ['frenzy'] }
        ]
    },
    toussaint: {
        key: 'toussaint', name: 'Winnice Toussaint', emoji: '🍇',
        minLevel: 29, levelOffset: 4,
        intro: 'Bajkowa kraina skrywająca wampiry wyższe i bestie z koszmarów.',
        pool: [
            { name: 'Bruxa', emoji: '🧛', offense: 'dex', weaponMult: 1.6, hpMult: 1.0, weights: { str: 1.1, dex: 1.6, intel: 0.8, wit: 1.0, luck: 1.2 }, traits: ['lifesteal'] },
            { name: 'Garkain', emoji: '🦇', offense: 'str', weaponMult: 1.6, hpMult: 1.1, weights: { str: 1.4, dex: 1.1, intel: 0.6, wit: 1.1, luck: 1.0 }, traits: ['lifesteal'] },
            { name: 'Szarlej', emoji: '👹', offense: 'str', weaponMult: 1.7, hpMult: 1.2, weights: { str: 1.5, dex: 1.0, intel: 0.5, wit: 1.2, luck: 1.0 }, traits: ['frenzy'] },
            { name: 'Bestia z Beauclair', emoji: '🐲', offense: 'str', weaponMult: 1.8, hpMult: 1.4, weights: { str: 1.6, dex: 1.1, intel: 0.6, wit: 1.3, luck: 1.0 }, traits: ['frenzy', 'armored'] },
            { name: 'Wiwerna', emoji: '🐉', offense: 'dex', weaponMult: 1.6, hpMult: 1.1, weights: { str: 1.2, dex: 1.5, intel: 0.6, wit: 1.1, luck: 1.1 }, traits: ['venomous'] }
        ]
    }
};

const LOCATION_ORDER = ['velen', 'novigrad', 'skellige', 'kaer_morhen', 'toussaint'];

// Tier nazw per lokacja: potwory normalne z 'normal', elity z 'elite' (wyzszy tier).
// Nazwy sluza tylko za etykiete - statystyki wynikaja z archetypu i poziomu.
const LOCATION_TIERS = {
    velen:       { normal: 'common',    elite: 'uncommon' },
    novigrad:    { normal: 'uncommon',  elite: 'rare' },
    skellige:    { normal: 'rare',      elite: 'epic' },
    kaer_morhen: { normal: 'epic',      elite: 'legendary' },
    toussaint:   { normal: 'legendary', elite: 'mythic' }
};

function pickName(tier) {
    const pool = MONSTER_NAMES[tier] || MONSTER_NAMES.common;
    return pool[Math.floor(Math.random() * pool.length)];
}

// Globalne pokretla skalowania potworow (latwe do strojenia).
const STAT_BASE = 6;
const STAT_PER_LVL = 3.0;

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Buduje konkretnego potwora z archetypu na podany "efektywny" poziom. */
function buildMonster(archetype, effLevel, isElite, name) {
    // Elita zachowuje sie jak potwor o 2 poziomy wyzszy + premia do HP i nagrod.
    const lvl = Math.max(1, isElite ? effLevel + 2 : effLevel);
    const core = STAT_BASE + lvl * STAT_PER_LVL;
    const stat = (w) => Math.max(1, Math.round(core * w));

    const stats = {
        str: stat(archetype.weights.str),
        dex: stat(archetype.weights.dex),
        intel: stat(archetype.weights.intel),
        wit: stat(archetype.weights.wit),
        luck: stat(archetype.weights.luck)
    };

    let maxHp = Math.round((40 + stats.wit * 5 + lvl * 5) * archetype.hpMult * (isElite ? 1.5 : 1));

    const expReward = Math.round((22 + effLevel * 12) * (isElite ? 2 : 1));
    const crownReward = Math.round((7 + effLevel * 4) * (isElite ? 2.2 : 1));

    return {
        name: name || archetype.name,
        emoji: archetype.emoji,
        level: effLevel,
        isElite: !!isElite,
        offense: archetype.offense,
        weaponMult: archetype.weaponMult,
        traits: archetype.traits,
        str: stats.str, dex: stats.dex, intel: stats.intel, wit: stats.wit, luck: stats.luck,
        maxHp,
        expReward,
        crownReward
    };
}

/** Losuje potwora odpowiedniego dla lokacji i poziomu gracza. */
function getMonsterForLocation(locationKey, playerLevel, forceElite = false) {
    const loc = LOCATIONS[locationKey];
    if (!loc) return null;

    const archetype = loc.pool[Math.floor(Math.random() * loc.pool.length)];
    const effLevel = Math.max(1, playerLevel + loc.levelOffset + randInt(-1, 1));
    const isElite = forceElite || Math.random() < 0.15;

    const tiers = LOCATION_TIERS[locationKey] || { normal: 'common', elite: 'uncommon' };
    const name = pickName(isElite ? tiers.elite : tiers.normal);

    return buildMonster(archetype, effLevel, isElite, name);
}

/** Lokacje dostepne dla danego poziomu gracza. */
function unlockedLocations(playerLevel) {
    return LOCATION_ORDER.filter((key) => playerLevel >= LOCATIONS[key].minLevel);
}

module.exports = {
    LOCATIONS,
    LOCATION_ORDER,
    getMonsterForLocation,
    unlockedLocations,
    buildMonster
};
