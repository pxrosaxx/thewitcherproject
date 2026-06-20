// =============================================================================
//  STATYSTYKI GRACZA (Etap 13) — generyczny licznik (klucz -> wartość).
//  Zasila osiągnięcia. Elastyczny: nowe metryki bez zmian schematu.
// =============================================================================

/** Zwiększa licznik o `amount` (domyślnie 1). */
async function incStat(db, discordId, key, amount = 1) {
    await db.run(
        `INSERT INTO player_stats (discord_id, stat_key, value) VALUES (?, ?, ?)
         ON CONFLICT(discord_id, stat_key) DO UPDATE SET value = value + excluded.value`,
        discordId, key, amount
    );
}

/** Ustawia licznik na maksimum z obecnej i nowej wartości (np. szczytowa passa, komplet). */
async function setStatMax(db, discordId, key, value) {
    await db.run(
        `INSERT INTO player_stats (discord_id, stat_key, value) VALUES (?, ?, ?)
         ON CONFLICT(discord_id, stat_key) DO UPDATE SET value = MAX(value, excluded.value)`,
        discordId, key, value
    );
}

/** Mapa wszystkich liczników gracza. */
async function getAllStats(db, discordId) {
    const rows = await db.all('SELECT stat_key, value FROM player_stats WHERE discord_id = ?', discordId);
    const map = {};
    for (const r of rows) map[r.stat_key] = r.value;
    return map;
}

module.exports = { incStat, setStatMax, getAllStats };
