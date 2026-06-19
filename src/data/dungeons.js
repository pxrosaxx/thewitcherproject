// =============================================================================
//  LOCHY — MODEL ETAPÓW Z BOSSAMI (styl SFGame)
//  Każda lokacja to ciąg 6 etapów: 5 mini-bossów + 1 finałowy boss.
//  Gracz pokonuje je po kolei; finałowy boss kończy lokację.
//  Statystyki bossów generowane są proceduralnie (mocniejsze od zwykłych potworów).
// =============================================================================

const { LOCATIONS } = require('./monsters');

// Wspolne stale skalowania (spojne z monsters.js).
const STAT_BASE = 6;
const STAT_PER_LVL = 3.0;

// Domyslny profil bossa; modyfikowany przez ceche.
function weightsFor(kind) {
    switch (kind) {
        case 'fast':     return { str: 1.0, dex: 1.5, intel: 0.5, wit: 1.0, luck: 1.1 };
        case 'armored':  return { str: 1.3, dex: 0.7, intel: 0.4, wit: 1.25, luck: 0.7 };
        case 'frenzy':   return { str: 1.5, dex: 1.1, intel: 0.4, wit: 1.1, luck: 1.0 };
        case 'caster':   return { str: 0.7, dex: 1.0, intel: 1.5, wit: 1.1, luck: 1.0 };
        default:         return { str: 1.3, dex: 1.0, intel: 0.5, wit: 1.2, luck: 0.9 };
    }
}

// Etapy per lokacja: [mini, mini, mini, mini, mini, FINAŁ].
// kind -> profil statow; traits -> cechy bojowe (venomous/armored/frenzy/lifesteal).
const STAGES = {
    velen: [
        { name: 'Stary Utopiec',      kind: 'default', offense: 'str', weaponMult: 1.6, hpMult: 1.1, traits: ['venomous'] },
        { name: 'Herszt Nekkerów',    kind: 'fast',    offense: 'dex', weaponMult: 1.5, hpMult: 1.0, traits: [] },
        { name: 'Topielec z Mokradeł',kind: 'frenzy',  offense: 'str', weaponMult: 1.6, hpMult: 1.2, traits: ['frenzy'] },
        { name: 'Ślepa Płaczka',      kind: 'fast',    offense: 'dex', weaponMult: 1.7, hpMult: 1.0, traits: [] },
        { name: 'Wodnik z Rozlewiska',kind: 'armored', offense: 'str', weaponMult: 1.7, hpMult: 1.3, traits: ['armored'] },
        { name: 'Bies z Mokradeł',    kind: 'frenzy',  offense: 'str', weaponMult: 1.9, hpMult: 1.4, traits: ['frenzy', 'armored'] }
    ],
    novigrad: [
        { name: 'Watażka Bandytów',   kind: 'default', offense: 'str', weaponMult: 1.6, hpMult: 1.0, traits: [] },
        { name: 'Król Szczurów',      kind: 'fast',    offense: 'dex', weaponMult: 1.5, hpMult: 1.0, traits: ['venomous'] },
        { name: 'Ghul Padlinożerca',  kind: 'frenzy',  offense: 'str', weaponMult: 1.7, hpMult: 1.1, traits: ['frenzy'] },
        { name: 'Alghul Cmentarny',   kind: 'armored', offense: 'str', weaponMult: 1.6, hpMult: 1.3, traits: ['armored'] },
        { name: 'Wiwerna z Wież',     kind: 'fast',    offense: 'dex', weaponMult: 1.7, hpMult: 1.1, traits: ['venomous'] },
        { name: 'Bestia Kanałów',     kind: 'frenzy',  offense: 'str', weaponMult: 1.9, hpMult: 1.4, traits: ['frenzy', 'lifesteal'] }
    ],
    skellige: [
        { name: 'Syrena Głębin',      kind: 'fast',    offense: 'dex', weaponMult: 1.6, hpMult: 0.9, traits: [] },
        { name: 'Berserk z Klanu',    kind: 'frenzy',  offense: 'str', weaponMult: 1.7, hpMult: 1.1, traits: ['frenzy'] },
        { name: 'Harpia Skalna',      kind: 'fast',    offense: 'dex', weaponMult: 1.6, hpMult: 0.9, traits: [] },
        { name: 'Niedźwiedź Wyspiarski',kind:'frenzy', offense: 'str', weaponMult: 1.8, hpMult: 1.3, traits: ['frenzy'] },
        { name: 'Lodowy Troll',       kind: 'armored', offense: 'str', weaponMult: 1.8, hpMult: 1.5, traits: ['armored'] },
        { name: 'Morski Diabeł',      kind: 'armored', offense: 'str', weaponMult: 2.0, hpMult: 1.6, traits: ['armored', 'frenzy'] }
    ],
    kaer_morhen: [
        { name: 'Gryf Górski',        kind: 'fast',    offense: 'dex', weaponMult: 1.7, hpMult: 1.1, traits: ['frenzy'] },
        { name: 'Bazyliszek',         kind: 'fast',    offense: 'dex', weaponMult: 1.6, hpMult: 1.0, traits: ['venomous'] },
        { name: 'Kikimora Wojownik',  kind: 'default', offense: 'dex', weaponMult: 1.7, hpMult: 1.1, traits: ['venomous'] },
        { name: 'Wilkołak',           kind: 'frenzy',  offense: 'str', weaponMult: 1.8, hpMult: 1.2, traits: ['frenzy'] },
        { name: 'Skalny Troll',       kind: 'armored', offense: 'str', weaponMult: 1.9, hpMult: 1.5, traits: ['armored'] },
        { name: 'Lodowy Gigant',      kind: 'armored', offense: 'str', weaponMult: 2.1, hpMult: 1.7, traits: ['armored', 'frenzy'] }
    ],
    toussaint: [
        { name: 'Garkain',            kind: 'fast',    offense: 'str', weaponMult: 1.7, hpMult: 1.1, traits: ['lifesteal'] },
        { name: 'Szarlej',            kind: 'frenzy',  offense: 'str', weaponMult: 1.8, hpMult: 1.2, traits: ['frenzy'] },
        { name: 'Bruxa',              kind: 'fast',    offense: 'dex', weaponMult: 1.8, hpMult: 1.0, traits: ['lifesteal'] },
        { name: 'Wiwerna Dorosła',    kind: 'fast',    offense: 'dex', weaponMult: 1.8, hpMult: 1.2, traits: ['venomous'] },
        { name: 'Bestia Cmentarna',   kind: 'armored', offense: 'str', weaponMult: 2.0, hpMult: 1.5, traits: ['armored'] },
        { name: 'Wampir Wyższy',      kind: 'frenzy',  offense: 'str', weaponMult: 2.1, hpMult: 1.6, traits: ['frenzy', 'lifesteal'] }
    ]
};

const STAGES_PER_LOCATION = 6;
const FINAL_STAGE_INDEX = STAGES_PER_LOCATION - 1;

/** Buduje bossa danego etapu dla lokacji. stageIndex: 0..5 (5 = finałowy). */
function getBoss(locationKey, stageIndex) {
    const loc = LOCATIONS[locationKey];
    const def = STAGES[locationKey][stageIndex];
    const isFinal = stageIndex === FINAL_STAGE_INDEX;

    const nominalLevel = loc.minLevel + stageIndex;
    // Skalowanie przez przesuniecie poziomu. Mini-boss na poziomie etapu, finalowy +1.
    const statLevel = nominalLevel + (isFinal ? 1 : 0);
    const core = STAT_BASE + statLevel * STAT_PER_LVL;
    const w = weightsFor(def.kind);
    const stat = (ww) => Math.max(1, Math.round(core * ww));

    const stats = {
        str: stat(w.str), dex: stat(w.dex), intel: stat(w.intel), wit: stat(w.wit), luck: stat(w.luck)
    };
    // Czapki na mnozniki, zeby zaden boss nie byl absurdalny; bossy sa tankowate (boss feel).
    const hpMult = Math.min(def.hpMult, isFinal ? 1.5 : 1.3);
    const weaponMult = Math.min(def.weaponMult, isFinal ? 1.75 : 1.6);
    const maxHp = Math.round((40 + stats.wit * 5 + statLevel * 5) * hpMult);

    const rewardMult = isFinal ? 3.5 : 1.5;
    const expReward = Math.round((22 + nominalLevel * 12) * rewardMult);
    const crownReward = Math.round((7 + nominalLevel * 4) * (isFinal ? 3.0 : 1.5));

    return {
        name: def.name,
        emoji: '', // bossy bez emotek - czysty styl
        level: nominalLevel,
        isElite: isFinal,
        isFinal,
        stageIndex,
        offense: def.offense,
        weaponMult: weaponMult,
        traits: def.traits.filter((t) => t !== 'armored'),
        str: stats.str, dex: stats.dex, intel: stats.intel, wit: stats.wit, luck: stats.luck,
        maxHp,
        expReward,
        crownReward
    };
}

// --- Postep gracza w lochach (baza danych) -------------------------------

/** Postep w lokacji = liczba pokonanych etapow (0..6). 6 = ukonczono. */
async function getProgress(db, discordId, locationKey) {
    const row = await db.get(
        'SELECT stage FROM dungeon_progress WHERE discord_id = ? AND location = ?',
        discordId, locationKey
    );
    return row ? row.stage : 0;
}

/** Mapa lokacja -> postep dla gracza. */
async function getAllProgress(db, discordId) {
    const rows = await db.all('SELECT location, stage FROM dungeon_progress WHERE discord_id = ?', discordId);
    const map = {};
    for (const r of rows) map[r.location] = r.stage;
    return map;
}

/** Zapisuje postep (upsert). */
async function setProgress(db, discordId, locationKey, stage) {
    await db.run(
        `INSERT INTO dungeon_progress (discord_id, location, stage) VALUES (?, ?, ?)
         ON CONFLICT(discord_id, location) DO UPDATE SET stage = excluded.stage`,
        discordId, locationKey, stage
    );
}

module.exports = {
    STAGES, STAGES_PER_LOCATION, FINAL_STAGE_INDEX,
    getBoss, getProgress, getAllProgress, setProgress
};
