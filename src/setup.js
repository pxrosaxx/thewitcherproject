const getDbConnection = require('./db');

// Pelny schemat tabeli (Etap 1 + Etap 2). Tworzony tylko jesli tabela nie istnieje,
// dzieki czemu ponowne uruchomienie NIE kasuje istniejacych postaci.

const CREATE_PLAYERS = `
    CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        school TEXT,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        crowns INTEGER DEFAULT 100,
        ears INTEGER DEFAULT 0,
        stamina INTEGER DEFAULT 100,
        last_stamina_reset TEXT DEFAULT '',
        str INTEGER DEFAULT 0,
        dex INTEGER DEFAULT 0,
        intel INTEGER DEFAULT 0,
        wit INTEGER DEFAULT 0,
        luck INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 0,
        max_hp INTEGER DEFAULT 0,
        win_streak INTEGER DEFAULT 0,
        bought_str INTEGER DEFAULT 0,
        bought_dex INTEGER DEFAULT 0,
        bought_intel INTEGER DEFAULT 0,
        bought_wit INTEGER DEFAULT 0,
        bought_luck INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

// Kolumny dodawane migracja do istniejacych baz z Etapu 1.
const MIGRATIONS = [
    "ALTER TABLE players ADD COLUMN action_points INTEGER DEFAULT 10",
    "ALTER TABLE players ADD COLUMN max_action_points INTEGER DEFAULT 10",
    "ALTER TABLE players ADD COLUMN last_ap_update INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN win_streak INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN bought_str INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN bought_dex INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN bought_intel INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN bought_wit INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN bought_luck INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN stamina INTEGER DEFAULT 100",
    "ALTER TABLE players ADD COLUMN last_stamina_reset TEXT DEFAULT ''",
    "ALTER TABLE players ADD COLUMN ears INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN honor INTEGER DEFAULT 1000",
    "ALTER TABLE players ADD COLUMN arena_wins INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN arena_losses INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN last_arena_fight INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN daily_streak INTEGER DEFAULT 0",
    "ALTER TABLE players ADD COLUMN last_daily TEXT DEFAULT ''"
];


// Tabela przedmiotow w ekwipunku graczy (Etap 3).
// equipped_slot = NULL oznacza przedmiot w plecaku; nazwa slotu = przedmiot zalozony.
const CREATE_ITEMS = `
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slot TEXT NOT NULL,
        rarity INTEGER NOT NULL,
        school TEXT,
        item_level INTEGER NOT NULL,
        str INTEGER DEFAULT 0,
        dex INTEGER DEFAULT 0,
        intel INTEGER DEFAULT 0,
        wit INTEGER DEFAULT 0,
        luck INTEGER DEFAULT 0,
        equipped_slot TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;


// Postep gracza w lochach (Etap 6): ile etapow danej lokacji pokonano.
const CREATE_DUNGEON_PROGRESS = `
    CREATE TABLE IF NOT EXISTS dungeon_progress (
        discord_id TEXT NOT NULL,
        location TEXT NOT NULL,
        stage INTEGER DEFAULT 0,
        PRIMARY KEY (discord_id, location)
    )
`;

async function createDatabase() {
    try {
        console.log('Przygotowuję bazę SQLite (Etap 2: lochy + punkty akcji)...');
        const db = await getDbConnection();

        await db.exec(CREATE_PLAYERS);
        console.log('✅ Tabela "players" gotowa.');

        await db.exec(CREATE_ITEMS);
        console.log('✅ Tabela "items" gotowa.');

        await db.exec(CREATE_DUNGEON_PROGRESS);
        console.log('✅ Tabela "dungeon_progress" gotowa.');

        // Migracje: dodaj brakujace kolumny. Jesli juz istnieja, SQLite rzuci blad
        // "duplicate column name" - ignorujemy go, to znaczy ze kolumna juz jest.
        for (const sql of MIGRATIONS) {
            try {
                await db.exec(sql);
                console.log(`  ↳ dodano kolumnę: ${sql.match(/ADD COLUMN (\w+)/)[1]}`);
            } catch (e) {
                if (/duplicate column/i.test(e.message)) {
                    // kolumna juz istnieje - ok
                } else {
                    throw e;
                }
            }
        }

        console.log('✅ Baza gotowa. Istniejące postacie zostały zachowane.');
        process.exit();
    } catch (error) {
        console.error('Błąd podczas przygotowywania bazy:', error);
        process.exit(1);
    }
}

createDatabase();
