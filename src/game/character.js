// Formuly zwiazane z postacia oraz wspolna matematyka bojowa.
// Trzymane osobno od danych szkol i od silnika walki, zeby latwo bylo to stroic.

const STAT_KEYS = ['str', 'dex', 'intel', 'wit', 'luck'];

// --- Progresja postaci ---------------------------------------------------

/** Staty danej szkoly na danym poziomie. */
function getStatsAtLevel(school, level) {
    const stats = {};
    for (const key of STAT_KEYS) {
        stats[key] = school.baseStats[key] + school.growth[key] * (level - 1);
    }
    return stats;
}

/** Maksymalne HP na podstawie Witalnosci (wit) i poziomu. */
function calculateMaxHp(stats, level) {
    return 50 + stats.wit * 8 + level * 5;
}

/** Ile exp trzeba, zeby przejsc z danego poziomu na kolejny. */
function expForNextLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.4));
}

// --- Wspolna matematyka bojowa ------------------------------------------
// Te funkcje przyjmuja sam obiekt statystyk, wiec dzialaja tak samo
// dla gracza jak i dla potwora.

const CRIT_MULT = 1.75; // mnoznik obrazen przy trafieniu krytycznym

/** Szansa na krytyka: bazowo 5% + 0.5% za kazdy punkt Szczescia, sufit 50%. */
function critChance(stats) {
    return Math.min(0.5, 0.05 + stats.luck * 0.005);
}

/** Szansa na unik: 0.6% za kazdy punkt Zrecznosci, sufit 35%. */
function dodgeChance(stats) {
    return Math.min(0.35, stats.dex * 0.006);
}

/**
 * Procentowa redukcja obrazen z obrony (Witalnosci).
 * Malejace zyski - pancerz nigdy nie daje 100% odpornosci.
 */
function damageReduction(defenseStat) {
    return defenseStat / (defenseStat + 80);
}

module.exports = {
    STAT_KEYS,
    getStatsAtLevel,
    calculateMaxHp,
    expForNextLevel,
    CRIT_MULT,
    critChance,
    dodgeChance,
    damageReduction
};
