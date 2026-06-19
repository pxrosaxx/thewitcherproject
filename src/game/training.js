// =============================================================================
//  TRENING STATYSTYK
//  Kupowanie trwalych punktow statystyk za korony. Koszt kolejnego punktu rosnie
//  wraz z aktualna wartoscia danej statystyki (baza z poziomu + juz kupione).
// =============================================================================

const STAT_KEYS = ['str', 'dex', 'intel', 'wit', 'luck'];
const STAT_INFO = {
    str:   { name: 'Siła',         short: 'SIŁ',  col: 'bought_str' },
    dex:   { name: 'Zręczność',    short: 'ZRĘ',  col: 'bought_dex' },
    intel: { name: 'Inteligencja', short: 'INT',  col: 'bought_intel' },
    wit:   { name: 'Witalność',    short: 'WIT',  col: 'bought_wit' },
    luck:  { name: 'Szczęście',    short: 'SZCZ', col: 'bought_luck' }
};

/** Koszt podbicia statystyki o 1 punkt, gdy ma aktualnie wartosc `value`. */
function costForNextPoint(value) {
    return Math.max(3, Math.round(2 + value * 1.2));
}

/** Laczny koszt kupna `count` punktow startujac od wartosci `value`. */
function bulkCost(value, count) {
    let total = 0;
    let v = value;
    for (let i = 0; i < count; i++) {
        total += costForNextPoint(v);
        v += 1;
    }
    return total;
}

/**
 * Ile punktow danej statystyki gracza stac kupic za `crowns`, startujac od `value`.
 * Zwraca { points, cost }.
 */
function affordablePoints(value, crowns, max = 1000) {
    let spent = 0, points = 0, v = value;
    while (points < max) {
        const c = costForNextPoint(v);
        if (spent + c > crowns) break;
        spent += c; v += 1; points += 1;
    }
    return { points, cost: spent };
}

/**
 * Statystyki bazowe gracza = staty z poziomu + kupione w treningu.
 * (Bonus z ekwipunku dokladany jest osobno przez effectiveStats.)
 */
function baseWithBought(player) {
    return {
        str: player.str + (player.bought_str || 0),
        dex: player.dex + (player.bought_dex || 0),
        intel: player.intel + (player.bought_intel || 0),
        wit: player.wit + (player.bought_wit || 0),
        luck: player.luck + (player.bought_luck || 0)
    };
}

module.exports = { STAT_KEYS, STAT_INFO, costForNextPoint, bulkCost, affordablePoints, baseWithBought };
