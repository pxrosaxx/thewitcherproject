// =============================================================================
//  OSIĄGNIĘCIA I TYTUŁY (Etap 13) — spinają wszystkie systemy w sieć celów.
//  Każde osiągnięcie: metryka >= próg. Raz zdobyte jest TRWAŁE (zapisane w bazie),
//  nawet gdy licznik później spadnie. Część odblokowuje tytuł na profil.
// =============================================================================

const { getAllStats } = require('../game/player_stats');

// Metryki czytane wprost z kolumn tabeli players (reszta z player_stats).
const COLUMN_METRICS = new Set(['level', 'honor', 'arena_wins', 'daily_streak', 'win_streak', 'crowns', 'ears']);

// Lista osiągnięć. category służy do grupowania w /osiagniecia.
const ACHIEVEMENTS = [
    // --- POSTĘP ---
    { id: 'lvl5',  name: 'Adept',            category: 'Postęp', metric: 'level', threshold: 5,  title: 'Adept',         crowns: 150 },
    { id: 'lvl15', name: 'Wędrowiec Szlaku', category: 'Postęp', metric: 'level', threshold: 15, title: 'Wędrowiec',     crowns: 400 },
    { id: 'lvl30', name: 'Mistrz Szlaku',    category: 'Postęp', metric: 'level', threshold: 30, title: 'Mistrz Szlaku', crowns: 1000 },
    { id: 'lvl50', name: 'Legenda Szlaku',   category: 'Postęp', metric: 'level', threshold: 50, title: 'Legenda',       crowns: 2500, ears: 3 },

    // --- ARENA ---
    { id: 'arena10',  name: 'Gladiator',       category: 'Arena', metric: 'arena_wins', threshold: 10,  title: 'Gladiator',         crowns: 300 },
    { id: 'arena50',  name: 'Pogromca Areny',  category: 'Arena', metric: 'arena_wins', threshold: 50,  title: 'Pogromca Areny',    crowns: 800 },
    { id: 'arena150', name: 'Czempion Areny',  category: 'Arena', metric: 'arena_wins', threshold: 150, title: 'Czempion Areny',    crowns: 2000, ears: 2 },
    { id: 'honor1300', name: 'Wytrawny Wojownik', category: 'Arena', metric: 'honor', threshold: 1300, crowns: 300 },
    { id: 'honor1600', name: 'Arcymistrz Chwały', category: 'Arena', metric: 'honor', threshold: 1600, title: 'Arcymistrz Chwały', crowns: 1200 },

    // --- ŁOWY ---
    { id: 'mon25',  name: 'Tropiciel',         category: 'Łowy', metric: 'monsters_defeated', threshold: 25,  crowns: 150 },
    { id: 'mon100', name: 'Pogromca Bestii',   category: 'Łowy', metric: 'monsters_defeated', threshold: 100, title: 'Pogromca Bestii',  crowns: 500 },
    { id: 'mon500', name: 'Rzeźnik Potworów',  category: 'Łowy', metric: 'monsters_defeated', threshold: 500, title: 'Rzeźnik z Blaviken', crowns: 2000, ears: 2 },

    // --- LOCHY ---
    { id: 'boss10', name: 'Łowca Bossów',  category: 'Lochy', metric: 'bosses_defeated',     threshold: 10, crowns: 300 },
    { id: 'boss50', name: 'Zmora Bossów',  category: 'Lochy', metric: 'bosses_defeated',     threshold: 50, title: 'Zmora Bossów', crowns: 1000 },
    { id: 'loc1',   name: 'Zdobywca',      category: 'Lochy', metric: 'locations_completed', threshold: 1,  title: 'Zdobywca',     crowns: 400 },
    { id: 'loc3',   name: 'Pan Lochów',    category: 'Lochy', metric: 'locations_completed', threshold: 3,  title: 'Pan Lochów',   crowns: 1000 },
    { id: 'loc5',   name: 'Władca Krain',  category: 'Lochy', metric: 'locations_completed', threshold: 5,  title: 'Władca Krain', crowns: 2500, ears: 3 },

    // --- KARCZMA ---
    { id: 'con25',   name: 'Najemnik',     category: 'Karczma', metric: 'contracts_done', threshold: 25,  crowns: 150 },
    { id: 'con100',  name: 'Zawodowiec',   category: 'Karczma', metric: 'contracts_done', threshold: 100, title: 'Zawodowiec',  crowns: 600 },
    { id: 'streak10', name: 'Nieprzerwany', category: 'Karczma', metric: 'win_streak',    threshold: 10,  title: 'Nieprzerwany', crowns: 400 },
    { id: 'streak25', name: 'Niepokonany',  category: 'Karczma', metric: 'win_streak',    threshold: 25,  title: 'Niepokonany',  crowns: 1200, ears: 1 },

    // --- KOWAL ---
    { id: 'upg10', name: 'Płatnerz',     category: 'Kowal', metric: 'items_upgraded', threshold: 10, crowns: 200 },
    { id: 'upg50', name: 'Mistrz Kuźni', category: 'Kowal', metric: 'items_upgraded', threshold: 50, title: 'Mistrz Kuźni', crowns: 800 },

    // --- ALCHEMIA ---
    { id: 'brew20',  name: 'Zielarz',   category: 'Alchemia', metric: 'potions_brewed', threshold: 20,  crowns: 200 },
    { id: 'brew100', name: 'Alchemik',  category: 'Alchemia', metric: 'potions_brewed', threshold: 100, title: 'Alchemik',         crowns: 800 },
    { id: 'use50',   name: 'Taktyk',    category: 'Alchemia', metric: 'potions_used',   threshold: 50,  title: 'Mistrz Eliksirów', crowns: 600 },

    // --- EKWIPUNEK ---
    { id: 'set2', name: 'Kompletujący', category: 'Ekwipunek', metric: 'max_set_pieces', threshold: 2, crowns: 150 },
    { id: 'set6', name: 'Pełny Komplet', category: 'Ekwipunek', metric: 'max_set_pieces', threshold: 6, title: 'Rycerz Szkoły', crowns: 1500, ears: 1 },

    // --- BOGACTWO ---
    { id: 'rich5000', name: 'Bogacz',           category: 'Bogactwo', metric: 'crowns', threshold: 5000, title: 'Bogacz', crowns: 0 },
    { id: 'ears10',   name: 'Kolekcjoner Uszu', category: 'Bogactwo', metric: 'ears',   threshold: 10,   crowns: 300 },

    // --- CODZIENNOŚĆ ---
    { id: 'daily7',  name: 'Wierny',     category: 'Codzienność', metric: 'daily_streak', threshold: 7,  title: 'Wierny',            crowns: 300 },
    { id: 'daily30', name: 'Niezłomny',  category: 'Codzienność', metric: 'daily_streak', threshold: 30, title: 'Niezłomny Bywalec', crowns: 1500, ears: 2 },

    // --- GILDIA ---
    { id: 'guild1',     name: 'Towarzysz',        category: 'Gildia', metric: 'guild_joined',   threshold: 1,     title: 'Towarzysz',          crowns: 200 },
    { id: 'donate5000', name: 'Dobroczyńca',      category: 'Gildia', metric: 'guild_donated',  threshold: 5000,  title: 'Dobroczyńca Gildii', crowns: 500 },
    { id: 'portal10',   name: 'Pogromca Portalu', category: 'Gildia', metric: 'portal_clears',  threshold: 10,    title: 'Pogromca Portalu',   crowns: 1000 },
    { id: 'wars5',      name: 'Wódz Wojenny',     category: 'Gildia', metric: 'guild_war_wins', threshold: 5,     title: 'Wódz Wojenny',       crowns: 800 }
];

const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const CATEGORIES = [...new Set(ACHIEVEMENTS.map((a) => a.category))];

function metricValue(metric, player, stats) {
    if (COLUMN_METRICS.has(metric)) return player[metric] || 0;
    return stats[metric] || 0;
}

async function getEarnedIds(db, discordId) {
    const rows = await db.all('SELECT achievement_id FROM player_achievements WHERE discord_id = ?', discordId);
    return new Set(rows.map((r) => r.achievement_id));
}

/**
 * Sprawdza i przyznaje nowo zdobyte osiągnięcia. Re-czyta gracza i liczniki z bazy,
 * więc działa po dowolnej akcji. Wypłaca nagrody (korony/Uszy) relatywnie.
 * Zwraca tablicę nowo zdobytych osiągnięć.
 */
async function checkAchievements(db, discordId) {
    const player = await db.get('SELECT * FROM players WHERE discord_id = ?', discordId);
    if (!player) return [];
    const stats = await getAllStats(db, discordId);
    const earned = await getEarnedIds(db, discordId);

    const newly = [];
    let crowns = 0, ears = 0;
    for (const a of ACHIEVEMENTS) {
        if (earned.has(a.id)) continue;
        if (metricValue(a.metric, player, stats) >= a.threshold) {
            await db.run(
                'INSERT OR IGNORE INTO player_achievements (discord_id, achievement_id, earned_at) VALUES (?, ?, ?)',
                discordId, a.id, Date.now()
            );
            crowns += a.crowns || 0;
            ears += a.ears || 0;
            newly.push(a);
        }
    }
    if (crowns > 0 || ears > 0) {
        await db.run('UPDATE players SET crowns = crowns + ?, ears = ears + ? WHERE discord_id = ?', crowns, ears, discordId);
    }
    return newly;
}

/** Tytuły odblokowane przez zdobyte osiągnięcia. */
async function unlockedTitles(db, discordId) {
    const earned = await getEarnedIds(db, discordId);
    return ACHIEVEMENTS.filter((a) => a.title && earned.has(a.id)).map((a) => a.title);
}

async function setTitle(db, discordId, title) {
    await db.run('UPDATE players SET title = ? WHERE discord_id = ?', title || '', discordId);
}

/** Krótki opis progu (do listy). */
function thresholdLabel(a) {
    const labels = {
        level: 'poziom', honor: 'honor', arena_wins: 'wygrane areny', daily_streak: 'passa logowań',
        win_streak: 'passa karczmy', crowns: 'korony', ears: 'Uszy', monsters_defeated: 'pokonani wrogowie',
        bosses_defeated: 'pokonani bossowie', locations_completed: 'ukończone lochy', contracts_done: 'kontrakty',
        items_upgraded: 'ulepszenia', potions_brewed: 'uwarzone mikstury', potions_used: 'użyte mikstury',
        max_set_pieces: 'części kompletu', guild_joined: 'gildia', guild_donated: 'wpłacono do gildii', portal_clears: 'pokonane portale', guild_war_wins: 'wygrane wojny'
    };
    return `${labels[a.metric] || a.metric}: ${a.threshold}`;
}

/** Pole embeda z nowo zdobytymi osiągnięciami (lub null). */
function achievementsField(newly) {
    if (!newly || newly.length === 0) return null;
    const lines = newly.map((a) => {
        const t = a.title ? ` · tytuł: **${a.title}**` : '';
        const r = (a.crowns || a.ears) ? ` _(+${a.crowns || 0} kr${a.ears ? ` +${a.ears} ucho` : ''})_` : '';
        return `🏆 **${a.name}**${t}${r}`;
    });
    return { name: 'Nowe osiągnięcie!', value: lines.join('\n'), inline: false };
}

module.exports = {
    ACHIEVEMENTS, BY_ID, CATEGORIES, COLUMN_METRICS,
    metricValue, getEarnedIds, checkAchievements, unlockedTitles, setTitle, thresholdLabel, achievementsField
};
