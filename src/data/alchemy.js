// =============================================================================
//  ALCHEMIA (Etap 12) — eliksiry, oleje, bomby. Strategia przed walką (PvE).
//  Efekty wpinają się w istniejący silnik: modyfikują staty/mnożniki zawodnika
//  albo dorzucają statusy (burn/poison/stun/weaken/regen).
//  Limit: 1 eliksir + 1 olej + 1 bomba na walkę (toksyczność).
// =============================================================================

const round = Math.round;
const { incStat } = require('../game/player_stats');

// Każda mikstura: id, nazwa, kategoria, koszt (korony [+ucho]), opis, apply().
// apply(pc, ec, ctx): pc = zawodnik-gracz, ec = wróg, ctx.level = poziom gracza.
const CONSUMABLES = {
    // --- ELIKSIRY (buf gracza) ---
    elx_jaskolka: {
        name: 'Jaskółka', category: 'eliksir', crowns: 80, ears: 0,
        desc: 'Regeneracja — leczy podczas walki.',
        apply: (pc) => { pc.effects.push({ type: 'regen', pct: 0.045, turns: Infinity }); }
    },
    elx_grom: {
        name: 'Grom', category: 'eliksir', crowns: 120, ears: 0,
        desc: '+30% Siły na czas walki.',
        apply: (pc) => { pc.stats.str = round(pc.stats.str * 1.3); }
    },
    elx_zmora: {
        name: 'Zmora', category: 'eliksir', crowns: 120, ears: 0,
        desc: '+30% Witalności (twardszy).',
        apply: (pc) => { pc.stats.wit = round(pc.stats.wit * 1.3); }
    },
    elx_koci: {
        name: 'Koci Eliksir', category: 'eliksir', crowns: 150, ears: 0,
        desc: '+60% Szczęścia (więcej krytyków).',
        apply: (pc) => { pc.stats.luck = round(pc.stats.luck * 1.6); }
    },

    // --- OLEJE (mnożnik obrażeń) ---
    olej_zwykly: {
        name: 'Olej na ostrze', category: 'olej', crowns: 90, ears: 0,
        desc: '+15% obrażeń od broni.',
        apply: (pc) => { pc.weaponMult *= 1.15; }
    },
    olej_gesty: {
        name: 'Gęsty olej', category: 'olej', crowns: 200, ears: 1,
        desc: '+28% obrażeń od broni.',
        apply: (pc) => { pc.weaponMult *= 1.28; }
    },

    // --- BOMBY (debuff wroga na start) ---
    bomb_ogien: {
        name: 'Tańczące Gwiazdy', category: 'bomba', crowns: 110, ears: 0,
        desc: 'Podpala wroga na starcie.',
        apply: (pc, ec, ctx) => { ec.effects.push({ type: 'burn', damage: round(ctx.level * 2.5 + 8), turns: 3 }); }
    },
    bomb_trucizna: {
        name: 'Diabelskie Ziele', category: 'bomba', crowns: 110, ears: 0,
        desc: 'Zatruwa wroga na starcie.',
        apply: (pc, ec, ctx) => { ec.effects.push({ type: 'poison', damage: round(ctx.level * 1.8 + 6), stacks: 1, turns: 4 }); }
    },
    bomb_mroz: {
        name: 'Północny Wiatr', category: 'bomba', crowns: 150, ears: 0,
        desc: 'Osłabia obrażenia wroga (−30%).',
        apply: (pc, ec) => { ec.effects.push({ type: 'weaken', pct: 0.3, turns: 3 }); }
    },
    bomb_oglusz: {
        name: 'Ogłuszający Pył', category: 'bomba', crowns: 180, ears: 1,
        desc: 'Ogłusza wroga na pierwszą turę.',
        apply: (pc, ec) => { ec.effects.push({ type: 'stun', turns: 1 }); }
    }
};

const CATEGORIES = ['eliksir', 'olej', 'bomba'];
const CATEGORY_LABEL = { eliksir: 'Eliksir', olej: 'Olej', bomba: 'Bomba' };

function byCategory(cat) {
    return Object.entries(CONSUMABLES).filter(([, c]) => c.category === cat).map(([id, c]) => ({ id, ...c }));
}

// --- Zapas i zestaw (baza danych) ----------------------------------------

async function getStock(db, discordId) {
    const rows = await db.all('SELECT consumable_id, qty FROM player_consumables WHERE discord_id = ? AND qty > 0', discordId);
    const map = {};
    for (const r of rows) map[r.consumable_id] = r.qty;
    return map;
}

async function addStock(db, discordId, consumableId, amount) {
    await db.run(
        `INSERT INTO player_consumables (discord_id, consumable_id, qty) VALUES (?, ?, ?)
         ON CONFLICT(discord_id, consumable_id) DO UPDATE SET qty = qty + excluded.qty`,
        discordId, consumableId, amount
    );
}

async function decStock(db, discordId, consumableId) {
    await db.run(
        'UPDATE player_consumables SET qty = qty - 1 WHERE discord_id = ? AND consumable_id = ? AND qty > 0',
        discordId, consumableId
    );
}

/**
 * Stosuje zestaw gracza do walki PvE: dla każdego slotu (eliksir/olej/bomba),
 * jeśli mikstura jest w zapasie — aplikuje efekt i zużywa 1 sztukę.
 * Zwraca listę nazw użytych mikstur (do pokazania w karcie walki).
 */
async function applyLoadout(db, player, playerC, enemyC) {
    const stock = await getStock(db, player.discord_id);
    const slots = [player.prep_eliksir, player.prep_olej, player.prep_bomba];
    const used = [];
    for (const id of slots) {
        if (!id || !CONSUMABLES[id]) continue;
        if ((stock[id] || 0) <= 0) continue;
        CONSUMABLES[id].apply(playerC, enemyC, { level: player.level });
        await decStock(db, player.discord_id, id);
        used.push(CONSUMABLES[id].name);
    }
    if (used.length > 0) await incStat(db, player.discord_id, 'potions_used', used.length);
    return used;
}

module.exports = {
    CONSUMABLES, CATEGORIES, CATEGORY_LABEL, byCategory,
    getStock, addStock, decStock, applyLoadout
};
