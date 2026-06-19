// =============================================================================
//  PLECAK / EKWIPUNEK GRACZA (warstwa bazy danych)
//  Przechowuje instancje przedmiotow i obsluguje zakladanie/zdejmowanie.
// =============================================================================

const { equipmentBonus, SLOT_ORDER } = require('./equipment');

const STAT_KEYS = ['str', 'dex', 'intel', 'wit', 'luck'];

/** Zamienia wiersz z bazy na instancje przedmiotu uzywana przez logike. */
function rowToInstance(row) {
    return {
        rowId: row.id,
        templateId: row.template_id,
        name: row.name,
        slot: row.slot,
        rarity: row.rarity,
        school: row.school,
        itemLevel: row.item_level,
        equippedSlot: row.equipped_slot || null,
        stats: { str: row.str, dex: row.dex, intel: row.intel, wit: row.wit, luck: row.luck }
    };
}

/** Dodaje instancje przedmiotu do plecaka gracza. Zwraca id wiersza. */
async function addItem(db, discordId, inst) {
    const res = await db.run(
        `INSERT INTO items (discord_id, template_id, name, slot, rarity, school, item_level, str, dex, intel, wit, luck, equipped_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        discordId, inst.templateId, inst.name, inst.slot, inst.rarity, inst.school, inst.itemLevel,
        inst.stats.str, inst.stats.dex, inst.stats.intel, inst.stats.wit, inst.stats.luck
    );
    return res.lastID;
}

/** Przedmioty w plecaku (niezalozone). */
async function getBackpack(db, discordId) {
    const rows = await db.all(
        'SELECT * FROM items WHERE discord_id = ? AND equipped_slot IS NULL ORDER BY rarity DESC, slot, item_level DESC',
        discordId
    );
    return rows.map(rowToInstance);
}

/** Zalozone przedmioty jako mapa slot -> instancja. */
async function getEquippedMap(db, discordId) {
    const rows = await db.all(
        'SELECT * FROM items WHERE discord_id = ? AND equipped_slot IS NOT NULL',
        discordId
    );
    const map = {};
    for (const row of rows) map[row.equipped_slot] = rowToInstance(row);
    return map;
}

/** Pojedynczy przedmiot gracza po id wiersza. */
async function getItem(db, discordId, rowId) {
    const row = await db.get('SELECT * FROM items WHERE id = ? AND discord_id = ?', rowId, discordId);
    return row ? rowToInstance(row) : null;
}

/**
 * Zaklada przedmiot z plecaka. Jesli slot jest zajety, zdejmuje stary do plecaka.
 * Zwraca { equipped, replaced } lub null gdy przedmiot nie istnieje.
 */
async function equipItem(db, discordId, rowId) {
    const item = await getItem(db, discordId, rowId);
    if (!item) return null;

    // Zdejmij to, co aktualnie w tym slocie.
    const current = await db.get(
        'SELECT * FROM items WHERE discord_id = ? AND equipped_slot = ?',
        discordId, item.slot
    );
    if (current) {
        await db.run('UPDATE items SET equipped_slot = NULL WHERE id = ?', current.id);
    }
    await db.run('UPDATE items SET equipped_slot = ? WHERE id = ?', item.slot, rowId);
    return { equipped: item, replaced: current ? rowToInstance(current) : null };
}

/** Zdejmuje przedmiot z danego slotu do plecaka. */
async function unequipSlot(db, discordId, slot) {
    const row = await db.get('SELECT * FROM items WHERE discord_id = ? AND equipped_slot = ?', discordId, slot);
    if (!row) return null;
    await db.run('UPDATE items SET equipped_slot = NULL WHERE id = ?', row.id);
    return rowToInstance(row);
}

/** Usuwa przedmiot (sprzedaz). Zwraca usunieta instancje lub null. */
async function removeItem(db, discordId, rowId) {
    const item = await getItem(db, discordId, rowId);
    if (!item) return null;
    await db.run('DELETE FROM items WHERE id = ? AND discord_id = ?', rowId, discordId);
    return item;
}

/** Aktualizuje poziom, rzadkosc i staty przedmiotu (uzywane przez kowala). */
async function setItemStats(db, rowId, itemLevel, rarity, stats) {
    await db.run(
        `UPDATE items SET item_level = ?, rarity = ?, str = ?, dex = ?, intel = ?, wit = ?, luck = ? WHERE id = ?`,
        itemLevel, rarity, stats.str, stats.dex, stats.intel, stats.wit, stats.luck, rowId
    );
}

/** Bonus statow z zalozonego ekwipunku (z premia za Szkole). */
async function getEquipmentBonus(db, discordId, schoolKey) {
    const map = await getEquippedMap(db, discordId);
    const equipped = SLOT_ORDER.map((s) => map[s]).filter(Boolean);
    return equipmentBonus(equipped, schoolKey);
}

module.exports = {
    rowToInstance, addItem, getBackpack, getEquippedMap, getItem,
    equipItem, unequipSlot, removeItem, setItemStats, getEquipmentBonus
};
