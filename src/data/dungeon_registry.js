// =============================================================================
//  REJESTR LOCHÓW — łączy lochy zdefiniowane w danych (data/dungeons.js)
//  z własnymi tworzonymi w grze (/loch-kreator). /loch korzysta z jednego,
//  spójnego interfejsu, nie wiedząc skąd loch pochodzi.
// =============================================================================

const dungeons = require('./dungeons');
const custom = require('./custom_dungeons');

/** Zwraca wszystkie lochy: zdefiniowane w danych + własne (te z co najmniej 1 potworem). */
async function listDungeons(db) {
    const builtin = Object.entries(dungeons.DUNGEONS)
        .filter(([, d]) => d.stages && d.stages.length > 0)
        .map(([key, d]) => ({
            key,
            name: d.name,
            minLevel: d.minLevel,
            levelOffset: d.levelOffset != null ? d.levelOffset : Math.min(4, Math.floor((d.minLevel - 1) / 8)),
            stageCount: d.stages.length,
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

/** Boss danego etapu — dispatch zdefiniowany/własny. */
async function getBossFor(db, entry, stageIndex) {
    if (!entry.isCustom) return dungeons.getBoss(entry.key, stageIndex);
    return custom.getCustomBoss(db, entry.dungeonId, stageIndex, entry.minLevel, entry.stageCount);
}

module.exports = { listDungeons, getBossFor };
