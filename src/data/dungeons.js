// =============================================================================
//  LOCHY — DEFINIOWANE PRZEZ CIEBIE
//  Wbudowane lochy zostaly usuniete. Tutaj definiujesz wlasne lochy i potwory.
//  Mozesz tez tworzyc lochy w grze komenda /loch-kreator (archetypy potworow).
//
//  Kazdy loch w DUNGEONS:
//    klucz: {                       // unikalny klucz (male litery, bez spacji)
//      name: 'Nazwa Lochu',         // nazwa widoczna w /loch
//      minLevel: 1,                 // poziom 1. etapu (kolejne etapy +1)
//      levelOffset: 0,              // (opcjonalne) trudnosc strefy 0-4; domyslnie z minLevel
//      stages: [ ...potwory... ]    // lista etapow; OSTATNI = boss finalowy
//    }
//
//  Kazdy potwor (etap) w stages:
//    { name: 'Nazwa Potwora',
//      kind: 'default',             // profil statow: default|fast|frenzy|armored|caster
//      offense: 'str',              // glowna cecha ataku: str|dex|intel
//      weaponMult: 1.6,             // sila ataku (mini max 1.6, finalowy max 1.75)
//      hpMult: 1.1,                 // zywotnosc (mini max 1.3, finalowy max 1.5)
//      traits: ['venomous'],        // cechy: 'venomous'(trucizna), 'frenzy'(szal), 'lifesteal'(wampiryzm)
//      imageUrl: null               // (opcjonalne) URL grafiki potwora
//    }
//  Uwaga: liczba etapow jest dowolna (np. 6). Ostatni etap to automatycznie boss finalowy
//  (mocniejszy, +1 do poziomu, lepsze nagrody i wieksza szansa na czesc rynsztunku).
//
//  PRZYKLAD (odkomentuj i edytuj albo dodaj wlasne lochy):
//
//  mokradla_velen: {
//      name: 'Mokradla Velen', minLevel: 1,
//      stages: [
//          { name: 'Stary Utopiec',   kind: 'default', offense: 'str', weaponMult: 1.6, hpMult: 1.1, traits: ['venomous'] },
//          { name: 'Herszt Nekkerow', kind: 'fast',    offense: 'dex', weaponMult: 1.5, hpMult: 1.0, traits: [] },
//          { name: 'Topielec',        kind: 'frenzy',  offense: 'str', weaponMult: 1.6, hpMult: 1.2, traits: ['frenzy'] },
//          { name: 'Slepa Placzka',   kind: 'fast',    offense: 'dex', weaponMult: 1.7, hpMult: 1.0, traits: [] },
//          { name: 'Wodnik',          kind: 'armored', offense: 'str', weaponMult: 1.7, hpMult: 1.3, traits: [] },
//          { name: 'Bies z Mokradel', kind: 'frenzy',  offense: 'str', weaponMult: 1.9, hpMult: 1.4, traits: ['frenzy'] }
//      ]
//  },
// =============================================================================

// Wspolne stale skalowania (spojne z monsters.js).
const STAT_BASE = 6;
const STAT_PER_LVL = 3.0;

// 11 lochów fabularnych (od poziomu 1 do 100). Ostatni etap = boss finałowy.
const DUNGEONS = {
    droga_z_ktorej: {
        name: "DROGA, Z KTÓREJ SIĘ NIE WRACA", minLevel: 1,
        stages: [
            {name: "Manissa",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Bladooki",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Kehl",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Fregenal",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Kościej",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]}
        ]
    },
    rozdroze_krukow: {
        name: "ROZDROŻE KRUKÓW", minLevel: 10,
        stages: [
            {name: "Dezerter",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Cibor Ponti",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Kikimora",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Mamutak",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Zorril",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Artamon z Asguth",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Beauregard Frick",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Meritxell, Ponti, Frick",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Strzyga z Brunanburh",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]}
        ]
    },
    ostatnie_zyczenie: {
        name: "OSTATNIE ŻYCZENIE", minLevel: 20,
        stages: [
            {name: "Strzyga",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Bruxa",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Renfri",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Jeż z Erlenwardu",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Silvan Torque",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Dżinn",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
    sezon_burz: {
        name: "SEZON BURZ", minLevel: 30,
        stages: [
            {name: "Idr",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Wigilozaur",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Bue i Bang",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Brehen",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Aguara",kind: "frenzy",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: ["lifesteal"]},
            {name: "Sorel Albert Amador Degerlund",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
    miecz_przeznaczenia: {
        name: "MIECZ PRZEZNACZENIA", minLevel: 40,
        stages: [
            {name: "Vodyanoi",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Nekrofag",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Bazyliszek",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Rębacze z Crinfrid",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Skolopendromorf Yghern",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []}
        ]
    },
    krew_elfow: {
        name: "KREW ELFÓW", minLevel: 50,
        stages: [
            {name: "Fałszywa Straż Temerska",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Komando Scoia'tael",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Żagnica",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Bracia Michelet",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Rience",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
    czas_pogardy: {
        name: "CZAS POGARDY", minLevel: 60,
        stages: [
            {name: "Skomlik i Łapacze",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Młoda Wywerna",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Ralf Blunden, Heimo Kantor i Krótki Yaxa",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Potwór z pustyni Korath",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Artaud Terranova",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Vilgefortz z Roggeveen",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
    chrzest_ognia: {
        name: "CHRZEST OGNIA", minLevel: 70,
        stages: [
            {name: "Ghule",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Havekarzy",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Agenci Vattiera",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Marszałek Vissegerd",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Okogłów",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []}
        ]
    },
    wieza_jaskolki: {
        name: "WIEŻA JASKÓŁKI", minLevel: 80,
        stages: [
            {name: "Barbegazi",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Echinops",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Pukacz",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Schirru",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Słowik",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Drzewce",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Rience",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Leo Bonhart",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]}
        ]
    },
    pani_jeziora: {
        name: "PANI JEZIORA", minLevel: 90,
        stages: [
            {name: "Solpuga",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Kuroliszek",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: ["venomous"]},
            {name: "Pan Schweitzer",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Stefan Skellen",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Eredin Bréacc Glas",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Leo Bonhart",kind: "frenzy",offense: "str",weaponMult: 1.7,hpMult: 1.2,traits: ["frenzy"]},
            {name: "Vilgefortz z Roggeveen",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
    cos_sie_konczy: {
        name: "COŚ SIĘ KOŃCZY, COŚ SIĘ ZACZYNA", minLevel: 100,
        stages: [
            {name: "Upiór Szczypiący w Pośladki",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Vissing „Łup-Cup”",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Pijany Vesemir",kind: "default",offense: "str",weaponMult: 1.6,hpMult: 1.1,traits: []},
            {name: "Borch Trzy Kawki",kind: "armored",offense: "str",weaponMult: 1.6,hpMult: 1.3,traits: []},
            {name: "Pijany Jaskier",kind: "fast",offense: "dex",weaponMult: 1.6,hpMult: 1,traits: []},
            {name: "Nenneke",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []},
            {name: "Yennefer w Furii",kind: "caster",offense: "intel",weaponMult: 1.7,hpMult: 1,traits: []}
        ]
    },
};

// Domyslny profil bossa; modyfikowany przez kind.
function weightsFor(kind) {
    switch (kind) {
        case 'fast':     return { str: 1.0, dex: 1.5, intel: 0.5, wit: 1.0, luck: 1.1 };
        case 'armored':  return { str: 1.3, dex: 0.7, intel: 0.4, wit: 1.25, luck: 0.7 };
        case 'frenzy':   return { str: 1.5, dex: 1.1, intel: 0.4, wit: 1.1, luck: 1.0 };
        case 'caster':   return { str: 0.7, dex: 1.0, intel: 1.5, wit: 1.1, luck: 1.0 };
        default:         return { str: 1.3, dex: 1.0, intel: 0.5, wit: 1.2, luck: 0.9 };
    }
}

/**
 * Wspolny builder bossa etapu — uzywany przez Twoje lochy I lochy z kreatora.
 * def: { name, kind, offense, weaponMult, hpMult, traits, imageUrl? }
 */
function buildStageBoss(def, minLevel, stageIndex, stageCount) {
    const isFinal = stageIndex === stageCount - 1;

    const nominalLevel = minLevel + stageIndex;
    const statLevel = nominalLevel + (isFinal ? 1 : 0);
    const core = STAT_BASE + statLevel * STAT_PER_LVL;
    const w = weightsFor(def.kind);
    const stat = (ww) => Math.max(1, Math.round(core * ww));

    const stats = {
        str: stat(w.str), dex: stat(w.dex), intel: stat(w.intel), wit: stat(w.wit), luck: stat(w.luck)
    };
    const hpMult = Math.min(def.hpMult, isFinal ? 1.5 : 1.3);
    const weaponMult = Math.min(def.weaponMult, isFinal ? 1.75 : 1.6);
    const maxHp = Math.round((40 + stats.wit * 5 + statLevel * 5) * hpMult);

    const rewardMult = isFinal ? 3.5 : 1.5;
    const expReward = Math.round((30 + nominalLevel * 18) * rewardMult);
    const crownReward = Math.round((7 + nominalLevel * 4) * (isFinal ? 3.0 : 1.5));

    return {
        name: def.name,
        emoji: '',
        level: nominalLevel,
        isElite: isFinal,
        isFinal,
        stageIndex,
        offense: def.offense,
        weaponMult: weaponMult,
        traits: (def.traits || []).filter((t) => t !== 'armored'),
        str: stats.str, dex: stats.dex, intel: stats.intel, wit: stats.wit, luck: stats.luck,
        maxHp,
        expReward,
        crownReward,
        imageUrl: def.imageUrl || null
    };
}

/** Buduje bossa danego etapu dla Twojego lochu. stageIndex: 0..(liczba etapow - 1). */
function getBoss(dungeonKey, stageIndex) {
    const d = DUNGEONS[dungeonKey];
    if (!d || !d.stages || !d.stages[stageIndex]) return null;
    return buildStageBoss(d.stages[stageIndex], d.minLevel, stageIndex, d.stages.length);
}

/** Liczba etapow danego lochu (0 jesli nie istnieje). */
function stageCountFor(dungeonKey) {
    const d = DUNGEONS[dungeonKey];
    return d && d.stages ? d.stages.length : 0;
}

// --- Postep gracza w lochach (baza danych) -------------------------------

async function getProgress(db, discordId, locationKey) {
    const row = await db.get(
        'SELECT stage FROM dungeon_progress WHERE discord_id = ? AND location = ?',
        discordId, locationKey
    );
    return row ? row.stage : 0;
}

async function getAllProgress(db, discordId) {
    const rows = await db.all('SELECT location, stage FROM dungeon_progress WHERE discord_id = ?', discordId);
    const map = {};
    for (const r of rows) map[r.location] = r.stage;
    return map;
}

async function setProgress(db, discordId, locationKey, stage) {
    await db.run(
        `INSERT INTO dungeon_progress (discord_id, location, stage) VALUES (?, ?, ?)
         ON CONFLICT(discord_id, location) DO UPDATE SET stage = excluded.stage`,
        discordId, locationKey, stage
    );
}

module.exports = {
    DUNGEONS, getBoss, buildStageBoss, stageCountFor,
    getProgress, getAllProgress, setProgress
};
