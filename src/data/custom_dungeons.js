// =============================================================================
//  WŁASNE LOCHY (Etap 11) — definiowane przez adminów, zapisane w bazie.
//  Potwór = ARCHETYP (profil walki) + nazwa + (opcjonalnie) grafika. Poziom etapu
//  wynika z poziomu lochu i kolejności (jak w lochach wbudowanych) — trzyma balans.
// =============================================================================

const { buildStageBoss } = require('./dungeons');

// Gotowe archetypy do wyboru przez admina (profile walki).
const CUSTOM_ARCHETYPES = {
    wojownik: { label: 'Wojownik (siła, wytrzymały)',     kind: 'default', offense: 'str',   weaponMult: 1.6, hpMult: 1.1, traits: [] },
    szybki:   { label: 'Szybki (zręczność, uniki)',        kind: 'fast',    offense: 'dex',   weaponMult: 1.6, hpMult: 1.0, traits: [] },
    berserk:  { label: 'Berserk (wściekły przy niskim HP)', kind: 'frenzy',  offense: 'str',   weaponMult: 1.7, hpMult: 1.2, traits: ['frenzy'] },
    pancerny: { label: 'Pancerny (tankowaty)',             kind: 'armored', offense: 'str',   weaponMult: 1.6, hpMult: 1.3, traits: [] },
    mag:      { label: 'Mag (inteligencja)',               kind: 'caster',  offense: 'intel', weaponMult: 1.7, hpMult: 1.0, traits: [] },
    jadowity: { label: 'Jadowity (zatruwa)',               kind: 'fast',    offense: 'dex',   weaponMult: 1.6, hpMult: 1.0, traits: ['venomous'] },
    wampir:   { label: 'Wampir (wysysa życie)',            kind: 'frenzy',  offense: 'str',   weaponMult: 1.6, hpMult: 1.1, traits: ['lifesteal'] }
};

const ARCHETYPE_KEYS = Object.keys(CUSTOM_ARCHETYPES);

// --- CRUD ---------------------------------------------------------------

async function createDungeon(db, name, minLevel, createdBy) {
    const r = await db.run(
        'INSERT INTO custom_dungeons (name, min_level, created_by) VALUES (?, ?, ?)',
        name, minLevel, createdBy
    );
    return r.lastID;
}

async function getDungeon(db, id) {
    return db.get('SELECT * FROM custom_dungeons WHERE id = ?', id);
}

async function getMonsters(db, dungeonId) {
    return db.all('SELECT * FROM custom_monsters WHERE dungeon_id = ? ORDER BY stage_index ASC', dungeonId);
}

/** Dodaje potwora na koniec lochu (kolejny etap). Ostatni etap = finałowy boss. */
async function addMonster(db, dungeonId, { name, archetype, imageUrl }) {
    const monsters = await getMonsters(db, dungeonId);
    const stageIndex = monsters.length;
    await db.run(
        'INSERT INTO custom_monsters (dungeon_id, stage_index, name, archetype, image_url) VALUES (?, ?, ?, ?, ?)',
        dungeonId, stageIndex, name, archetype, imageUrl || null
    );
    return stageIndex;
}

async function deleteDungeon(db, id) {
    await db.run('DELETE FROM custom_monsters WHERE dungeon_id = ?', id);
    await db.run('DELETE FROM custom_dungeons WHERE id = ?', id);
}

/** Lista lochów z liczbą potworów (do menu i listy admina). */
async function listDungeons(db) {
    const rows = await db.all('SELECT * FROM custom_dungeons ORDER BY id ASC');
    const out = [];
    for (const d of rows) {
        const c = await db.get('SELECT COUNT(*) c FROM custom_monsters WHERE dungeon_id = ?', d.id);
        out.push({ id: d.id, name: d.name, min_level: d.min_level, stageCount: c.c });
    }
    return out;
}

/** Buduje bossa danego etapu własnego lochu (ten sam silnik skalowania co wbudowane). */
async function getCustomBoss(db, dungeonId, stageIndex, minLevel, stageCount) {
    const monsters = await getMonsters(db, dungeonId);
    const m = monsters[stageIndex];
    if (!m) return null;
    const arch = CUSTOM_ARCHETYPES[m.archetype] || CUSTOM_ARCHETYPES.wojownik;
    const def = {
        name: m.name, kind: arch.kind, offense: arch.offense,
        weaponMult: arch.weaponMult, hpMult: arch.hpMult, traits: arch.traits,
        imageUrl: m.image_url || null
    };
    return buildStageBoss(def, minLevel, stageIndex, stageCount);
}

module.exports = {
    CUSTOM_ARCHETYPES, ARCHETYPE_KEYS,
    createDungeon, getDungeon, getMonsters, addMonster, deleteDungeon, listDungeons, getCustomBoss
};
