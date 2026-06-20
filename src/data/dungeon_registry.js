// =============================================================================
//  REJESTR LOCHÓW — łączy lochy wbudowane (monsters/dungeons) z własnymi (baza).
//  /loch korzysta z jednego, spójnego interfejsu, nie wiedząc skąd loch pochodzi.
// =============================================================================

const { LOCATIONS, LOCATION_ORDER } = require('./monsters');
const dungeons = require('./dungeons');
const custom = require('./custom_dungeons');

/** Zwraca wszystkie lochy: wbudowane + własne (te z co najmniej 1 potworem). */
async function listDungeons(db) {
    const builtin = LOCATION_ORDER.map((key) => ({
        key,
        name: LOCATIONS[key].name,
        minLevel: LOCATIONS[key].minLevel,
        levelOffset: LOCATIONS[key].levelOffset,
        stageCount: dungeons.STAGES_PER_LOCATION,
        isCustom: false
    }));

    const customs = await custom.listDungeons(db);
    const customEntries = customs
        .filter((c) => c.stageCount > 0)
        .map((c) => ({
            key: `c${c.id}`,
            name: c.name,
            minLevel: c.min_level,
            levelOffset: Math.min(4, Math.floor((c.min_level - 1) / 8)),
            stageCount: c.stageCount,
            isCustom: true,
            dungeonId: c.id
        }));

    return [...builtin, ...customEntries];
}

/** Boss danego etapu — dispatch wbudowany/własny. */
async function getBossFor(db, entry, stageIndex) {
    if (!entry.isCustom) return dungeons.getBoss(entry.key, stageIndex);
    return custom.getCustomBoss(db, entry.dungeonId, stageIndex, entry.minLevel, entry.stageCount);
}

module.exports = { listDungeons, getBossFor };
