// =============================================================================
//  SYSTEM EKWIPUNKU
//  Generowanie statystyk przedmiotow (skalowane z poziomem i rzadkoscia),
//  bonus za dopasowanie do Szkoly, agregacja statow do walki, dropy i sklep.
// =============================================================================

const { ITEMS, ITEMS_BY_ID } = require('../data/items');

// Statystyka ofensywna wg Szkoly (spojne z silnikiem walki).
const SCHOOL_OFFENSE = { wilk: 'str', kot: 'dex', gryf: 'intel', waz: 'dex', mantykora: 'intel' };

// Bonus za noszenie przedmiotu zgodnego ze swoja Szkola.
const AFFINITY_BONUS = 0.2; // +20%

const RARITY = {
    1: { name: 'Zwykły',     emoji: '⚪', color: 0x9aa0a6, statMult: 1.0,  weight: 55,  priceMult: 1.0 },
    2: { name: 'Niezwykły',  emoji: '🟢', color: 0x4ade80, statMult: 1.25, weight: 28,  priceMult: 2.2 },
    3: { name: 'Rzadki',     emoji: '🔵', color: 0x3b82f6, statMult: 1.55, weight: 12,  priceMult: 5.0 },
    4: { name: 'Epicki',     emoji: '🟣', color: 0xa855f7, statMult: 1.9,  weight: 4.5, priceMult: 12.0 },
    5: { name: 'Legendarny', emoji: '🟠', color: 0xf59e0b, statMult: 2.4,  weight: 0.5, priceMult: 30.0 }
};

const SLOTS = {
    bron:       { name: 'Broń',       emoji: '⚔️' },
    napiersnik: { name: 'Napierśnik', emoji: '🛡️' },
    rekawice:   { name: 'Rękawice',   emoji: '🧤' },
    spodnie:    { name: 'Spodnie',    emoji: '👖' },
    buty:       { name: 'Buty',       emoji: '🥾' },
    kusza:      { name: 'Kusza',      emoji: '🏹' }
};
const SLOT_ORDER = ['bron', 'napiersnik', 'rekawice', 'spodnie', 'buty', 'kusza'];

// Profile statow per slot. 'offense' to placeholder zamieniany na statystyke
// ofensywna Szkoly (lub rozkladany na STR/DEX/INT dla przedmiotow neutralnych).
const SLOT_PROFILE = {
    bron:       { offense: 0.75, luck: 0.15, wit: 0.10 },
    napiersnik: { wit: 0.70, offense: 0.20, luck: 0.10 },
    spodnie:    { wit: 0.55, dex: 0.35, luck: 0.10 },
    rekawice:   { offense: 0.50, luck: 0.35, dex: 0.15 },
    buty:       { dex: 0.55, wit: 0.30, luck: 0.15 },
    kusza:      { dex: 0.50, luck: 0.35, intel: 0.15 }
};

const STAT_KEYS = ['str', 'dex', 'intel', 'wit', 'luck'];
const emptyStats = () => ({ str: 0, dex: 0, intel: 0, wit: 0, luck: 0 });

/** Rozwija profil slotu, zamieniajac 'offense' na konkretne statystyki. */
function resolveProfile(slot, school) {
    const base = SLOT_PROFILE[slot];
    const out = {};
    for (const [key, w] of Object.entries(base)) {
        if (key !== 'offense') out[key] = (out[key] || 0) + w;
    }
    const offW = base.offense || 0;
    if (offW > 0) {
        if (school && SCHOOL_OFFENSE[school]) {
            const k = SCHOOL_OFFENSE[school];
            out[k] = (out[k] || 0) + offW;
        } else {
            // neutralny: rozloz na trzy staty ofensywne
            for (const k of ['str', 'dex', 'intel']) out[k] = (out[k] || 0) + offW / 3;
        }
    }
    return out;
}

/**
 * Generuje konkretne statystyki przedmiotu na danym poziomie.
 * Wynik jest "zamrazany" w instancji przedmiotu przy dropie.
 */
function generateItemStats(template, itemLevel) {
    const mult = RARITY[template.rarity].statMult;
    const budget = Math.max(1, Math.round((1 + itemLevel * 0.15) * mult));
    const profile = resolveProfile(template.slot, template.school);

    const stats = emptyStats();
    for (const [stat, w] of Object.entries(profile)) {
        stats[stat] = Math.round(budget * w);
    }
    return stats;
}

/**
 * Tworzy instancje przedmiotu (to zapisujemy w ekwipunku gracza).
 * { templateId, name, slot, rarity, school, itemLevel, stats }
 */
function makeItemInstance(template, itemLevel) {
    return {
        templateId: template.id,
        name: template.name,
        slot: template.slot,
        rarity: template.rarity,
        school: template.school,
        itemLevel,
        stats: generateItemStats(template, itemLevel)
    };
}

/**
 * Sumuje bonusy ze statow z zalozonych przedmiotow.
 * equipped: tablica instancji (z polami stats + school).
 * Premia +20% za kazdy przedmiot zgodny ze Szkola gracza.
 */
function equipmentBonus(equipped, schoolKey) {
    const total = emptyStats();
    for (const item of equipped) {
        if (!item) continue;
        const factor = item.school === schoolKey ? 1 + AFFINITY_BONUS : 1;
        for (const k of STAT_KEYS) total[k] += (item.stats[k] || 0) * factor;
    }
    for (const k of STAT_KEYS) total[k] = Math.round(total[k]);
    return total;
}

/** Efektywne statystyki = bazowe (z poziomu) + ekwipunek. */
function effectiveStats(baseStats, equipped, schoolKey) {
    const bonus = equipmentBonus(equipped, schoolKey);
    const out = {};
    for (const k of STAT_KEYS) out[k] = baseStats[k] + bonus[k];
    return out;
}

// --- Dropy ---------------------------------------------------------------

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Losuje rzadkosc wg wag, z premia za glebokosc strefy i elitarnosc. */
function rollRarity(zoneOffset = 0, isElite = false) {
    // Glebsze strefy i elity przesuwaja wagi ku lepszym rzadkosciom.
    const shift = zoneOffset * 0.6 + (isElite ? 2 : 0);
    const weights = {};
    for (const [r, cfg] of Object.entries(RARITY)) {
        const rNum = Number(r);
        weights[r] = cfg.weight * Math.pow(1.6, shift * (rNum - 1) / 4);
    }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [r, w] of Object.entries(weights)) {
        roll -= w;
        if (roll <= 0) return Number(r);
    }
    return 1;
}

/**
 * Decyduje czy z walki wypada przedmiot. Zwraca instancje lub null.
 * baseChance ~ szansa na jakikolwiek drop.
 */
function rollDrop(monsterLevel, zoneOffset = 0, isElite = false) {
    const baseChance = isElite ? 0.6 : 0.35;
    if (Math.random() > baseChance) return null;

    const rarity = rollRarity(zoneOffset, isElite);
    const pool = ITEMS.filter((i) => i.rarity === rarity);
    if (pool.length === 0) return null;

    const template = pool[Math.floor(Math.random() * pool.length)];
    const itemLevel = Math.max(1, monsterLevel + randInt(-1, 1));
    return makeItemInstance(template, itemLevel);
}

// --- Sklep ---------------------------------------------------------------

/** Generuje oferte sklepu (deterministyczna dla danego ziarna, np. dnia). */
function generateShop(playerLevel, count = 6, seed = null) {
    // Prosty PRNG dla powtarzalnosci oferty w obrebie odswiezenia.
    let s = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    const offers = [];
    for (let i = 0; i < count; i++) {
        // Sklep oferuje glownie zwykle/niezwykle, rzadko rzadkie.
        const r = rng();
        const rarity = r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
        const pool = ITEMS.filter((it) => it.rarity === rarity);
        const template = pool[Math.floor(rng() * pool.length)];
        const itemLevel = Math.max(1, playerLevel + Math.floor(rng() * 3) - 1);
        const inst = makeItemInstance(template, itemLevel);
        inst.price = itemPrice(inst);
        offers.push(inst);
    }
    return offers;
}

/** Cena przedmiotu w koronach. */
function itemPrice(item) {
    const statSum = STAT_KEYS.reduce((a, k) => a + (item.stats[k] || 0), 0);
    return Math.max(10, Math.round((8 + statSum * 2.5) * RARITY[item.rarity].priceMult));
}

/** Cena sprzedazy (odkup przez sklep) - ulamek ceny kupna. */
function sellPrice(item) {
    return Math.max(3, Math.round(itemPrice(item) * 0.3));
}

// --- Formatowanie --------------------------------------------------------

function rarityLabel(rarity) {
    const r = RARITY[rarity];
    return `${r.emoji} ${r.name}`;
}

/** Zwiezly opis statow przedmiotu, np. "+12 DEX, +5 SzCZ". */
function statsLine(stats) {
    const names = { str: 'SIŁ', dex: 'ZRĘ', intel: 'INT', wit: 'WIT', luck: 'SZCZ' };
    const parts = STAT_KEYS.filter((k) => stats[k] > 0).map((k) => `+${stats[k]} ${names[k]}`);
    return parts.length ? parts.join(', ') : 'brak';
}

/** Pelny opis przedmiotu do listy. */
function formatItem(item, withSchool = true) {
    const slot = SLOTS[item.slot];
    let line = `${slot.emoji} **${item.name}** ${RARITY[item.rarity].emoji} (poz. ${item.itemLevel})\n   ${statsLine(item.stats)}`;
    if (withSchool && item.school) line += `  •  szkoła: ${item.school}`;
    return line;
}

module.exports = {
    RARITY, SLOTS, SLOT_ORDER, SCHOOL_OFFENSE, AFFINITY_BONUS,
    generateItemStats, makeItemInstance, equipmentBonus, effectiveStats,
    rollDrop, rollRarity, generateShop, itemPrice, sellPrice,
    rarityLabel, statsLine, formatItem
};
