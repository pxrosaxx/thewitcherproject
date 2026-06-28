// =============================================================================
//  SILNIK WALKI - autorska implementacja walki turowej dla pieciu Szkol.
//  Zaprojektowany od zera w oparciu o ogolne wzorce gatunku RPG/incremental:
//  staty -> obrazenia, szansa na krytyk/unik, oraz system efektow statusowych
//  (podpalenie, trucizna, krwawienie, ogluszenie, tarcza, oslabienie, dezorientacja,
//  regeneracja), na ktorym opieraja sie unikalne zdolnosci szkol.
// =============================================================================

const {
    CRIT_MULT,
    critChance,
    dodgeChance,
    damageReduction
} = require('./character');

// Statystyka ofensywna i mnoznik broni dla kazdej Szkoly.
const SCHOOL_COMBAT = {
    wilk:      { offense: 'str',   weaponMult: 2.0, hits: 1 },
    kot:       { offense: 'dex',   weaponMult: 2.2, hits: 1 },
    waz:       { offense: 'dex',   weaponMult: 1.6, hits: 2 },
    gryf:      { offense: 'intel', weaponMult: 1.8, hits: 1 },
    mantykora: { offense: 'intel', weaponMult: 1.4, hits: 1 },
    niedzwiedz: { offense: 'str',   weaponMult: 1.6, hits: 1 }
};

const SIGNS = ['igni', 'aard', 'quen', 'yrden', 'axii'];

const rand = (min, max) => min + Math.random() * (max - min);
const chance = (p) => Math.random() < p;

// --- Budowa zawodnikow ---------------------------------------------------

/** Tworzy zawodnika-gracza na podstawie wiersza z bazy i danych szkoly. */
function combatantFromPlayer(player, school) {
    const cfg = SCHOOL_COMBAT[player.school];
    return {
        name: player.name,
        emoji: school.emoji,
        isPlayer: true,
        schoolKey: player.school,
        stats: {
            str: player.str, dex: player.dex, intel: player.intel,
            wit: player.wit, luck: player.luck
        },
        offenseKey: cfg.offense,
        weaponMult: cfg.weaponMult,
        hits: cfg.hits,
        isMagic: player.school === 'gryf', // Mag: ataki przebijają uniki i bloki
        maxHp: player.max_hp,
        hp: player.max_hp,
        effects: [],
        blockNext: false,
        traits: []
    };
}

/** Tworzy zawodnika-potwora z gotowego obiektu potwora (z monsters.js). */
function combatantFromMonster(monster) {
    return {
        name: monster.name,
        emoji: monster.emoji,
        isPlayer: false,
        schoolKey: null,
        stats: {
            str: monster.str, dex: monster.dex, intel: monster.intel,
            wit: monster.wit, luck: monster.luck
        },
        offenseKey: monster.offense || 'str',
        weaponMult: monster.weaponMult || 1.6,
        hits: 1,
        isMagic: monster.magic === true,
        maxHp: monster.maxHp,
        hp: monster.maxHp,
        effects: [],
        blockNext: false,
        traits: monster.traits || []
    };
}

// --- Efekty statusowe ----------------------------------------------------

function addEffect(target, effect) {
    // Efekty "stackowalne" (trucizna) lacza sie; reszta odswieza czas trwania.
    const existing = target.effects.find((e) => e.type === effect.type);
    if (existing) {
        if (effect.type === 'poison') {
            existing.stacks = Math.min(3, existing.stacks + 1);
            existing.turns = Math.max(existing.turns, effect.turns);
        } else {
            existing.turns = Math.max(existing.turns, effect.turns);
            if (effect.damage) existing.damage = effect.damage;
            if (effect.pct) existing.pct = effect.pct;
        }
    } else {
        target.effects.push({ ...effect });
    }
}

function hasEffect(target, type) {
    return target.effects.some((e) => e.type === type && e.turns > 0);
}

function totalWeaken(target) {
    return target.effects
        .filter((e) => e.type === 'weaken' && e.turns > 0)
        .reduce((acc, e) => Math.max(acc, e.pct), 0);
}

/** Czy zawodnik jest niemal odporny na obrazenia od czasu (Mantykora). */
function dotResistance(target) {
    return target.schoolKey === 'mantykora' ? 0 : 0;
}

/**
 * Przetwarza efekty na poczatku tury zawodnika: obrazenia od czasu (DoT)
 * i regeneracje. Zwraca tablice linii do dziennika.
 */
function tickEffects(c, log) {
    const resist = dotResistance(c);

    for (const e of c.effects) {
        if (e.turns <= 0) continue;

        if (e.type === 'burn') {
            const dmg = Math.max(1, Math.round(e.damage * (1 - resist)));
            c.hp -= dmg;
            log.push(`**${c.name}** płonie i traci ${dmg} HP`);
        } else if (e.type === 'poison') {
            const dmg = Math.max(1, Math.round(e.damage * e.stacks * (1 - resist)));
            c.hp -= dmg;
            log.push(`**${c.name}** cierpi od trucizny (${e.stacks}x) i traci ${dmg} HP`);
        } else if (e.type === 'bleed') {
            const dmg = Math.max(1, Math.round(e.damage * (1 - resist)));
            c.hp -= dmg;
            log.push(`**${c.name}** wykrwawia się i traci ${dmg} HP`);
        } else if (e.type === 'regen') {
            const heal = Math.round(c.maxHp * e.pct);
            if (c.hp > 0 && c.hp < c.maxHp) {
                c.hp = Math.min(c.maxHp, c.hp + heal);
                log.push(`**${c.name}** regeneruje ${heal} HP`);
            }
        }
    }

    // Zmniejszamy czas trwania wszystkich efektow czasowych (poza wieczna regeneracja).
    for (const e of c.effects) {
        if (e.turns !== Infinity) e.turns -= 1;
    }
    c.effects = c.effects.filter((e) => e.turns > 0);
}

// --- Zadawanie obrazen ---------------------------------------------------

/** Aplikuje obrazenia uwzgledniajac tarcze Quen i lifesteal atakujacego. */
function applyDamage(attacker, defender, amount, log, opts = {}) {
    if (defender.blockNext) {
        defender.blockNext = false;
        log.push(`**${defender.name}** blokuje cios Znakiem Quen!`);
        return 0;
    }
    if (defender.braceNext) {
        defender.braceNext = false;
        amount = Math.max(1, Math.round(amount * 0.7));
        log.push(`**${defender.name}** w postawie obronnej łagodzi cios!`);
    }
    defender.hp -= amount;

    if (attacker && attacker.traits.includes('lifesteal')) {
        const heal = Math.round(amount * 0.25);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        if (heal > 0) log.push(`**${attacker.name}** wysysa ${heal} HP`);
    }
    return amount;
}

/**
 * Szansa na unik z uwzglednieniem Szkoly i typu ataku.
 * - Magii (Gryf) nie da sie uniknac.
 * - Zwiadowca (Kot) to mistrz unikow (limit 50%), Zabojca (Waz) 40%, reszta 35%.
 * - Doktor Zarazy (Mantykora) robi uniki, gdy atakujacy wrog jest zatruty.
 */
function effectiveDodge(defender, attacker) {
    if (attacker.isMagic) return 0;
    let cap;
    switch (defender.schoolKey) {
        case 'kot': cap = 0.5; break;
        case 'waz': cap = 0.4; break;
        default: cap = 0.35;
    }
    let d = Math.min(cap, defender.stats.dex * 0.006);
    if (defender.schoolKey === 'mantykora' && hasEffect(attacker, 'poison')) {
        d = Math.min(0.3, d + 0.10);
    }
    return d;
}

/**
 * Standardowe trafienie broni. Zwraca {dodged, blocked, crit, damage} i NIE aplikuje
 * jeszcze obrazen (pozwala to szkolom modyfikowac wynik).
 */
function rollHit(attacker, defender, multiplier) {
    if (chance(effectiveDodge(defender, attacker))) {
        return { dodged: true, blocked: false, crit: false, damage: 0 };
    }
    // Wojownik i Paladyn: Tarcza - szansa na zablokowanie fizycznego ciosu (nie dziala na magie).
    if ((defender.schoolKey === 'wilk' || defender.schoolKey === 'niedzwiedz') && !attacker.isMagic && chance(0.30)) {
        return { dodged: false, blocked: true, crit: false, damage: 0 };
    }

    let dmg = attacker.stats[attacker.offenseKey] * multiplier * rand(0.85, 1.15);

    // Wilk: instynkt przetrwania - wiecej obrazen przy niskim HP.
    if (attacker.schoolKey === 'wilk' && attacker.hp < attacker.maxHp * 0.3) {
        dmg *= 1.3;
    }
    // Potwory z cecha 'frenzy' bija mocniej przy niskim HP.
    if (attacker.traits.includes('frenzy') && attacker.hp < attacker.maxHp * 0.4) {
        dmg *= 1.35;
    }
    // Paladyn: Pogromca magii - podwojone obrazenia istotom magicznym (zmora Gryfa).
    if (attacker.schoolKey === 'niedzwiedz' && defender.isMagic) {
        dmg *= 2.0;
    }

    // Oslabienie (Yrden) zmniejsza obrazenia atakujacego.
    dmg *= 1 - totalWeaken(attacker);

    let cc = critChance(attacker.stats);
    if (attacker.schoolKey === 'waz') cc += 0.06; // Zabójca: wrodzona precyzja
    const crit = chance(cc);
    if (crit) dmg *= CRIT_MULT;

    // Redukcja z obrony celu (Witalnosc + pancerz potwora). Magia (Mag) ignoruje 40% redukcji.
    let reduction = damageReduction(defender.stats.wit);
    if (defender.traits.includes('armored')) reduction = Math.min(0.9, reduction + 0.15);
    dmg *= 1 - reduction;

    return { dodged: false, blocked: false, crit, damage: Math.max(1, Math.round(dmg)) };
}

/** Wykonuje jedno standardowe trafienie wraz z logiem i aplikacja obrazen. */
function strike(attacker, defender, multiplier, log, label = 'atakuje') {
    const res = rollHit(attacker, defender, multiplier);
    if (res.dodged) {
        log.push(`**${defender.name}** unika ciosu`);
        return res;
    }
    if (res.blocked) {
        log.push(`**${defender.name}** blokuje cios tarczą!`);
        return res;
    }
    const dealt = applyDamage(attacker, defender, res.damage, log);
    res.landed = dealt > 0;
    if (dealt > 0) {
        const critTxt = res.crit ? ' *(krytyk)*' : '';
        log.push(`**${attacker.name}** ${label} za ${dealt}${critTxt}`);
    }
    return res;
}

// --- Zachowania szkol ----------------------------------------------------

function castSign(attacker, defender, log) {
    const sign = SIGNS[Math.floor(Math.random() * SIGNS.length)];
    const intel = attacker.stats.intel;

    switch (sign) {
        case 'igni': {
            const res = rollHit(attacker, defender, 1.7);
            if (res.dodged) { log.push(`**${defender.name}** unika Igni`); break; }
            applyDamage(attacker, defender, res.damage, log);
            addEffect(defender, { type: 'burn', damage: Math.round(intel * 0.45), turns: 3 });
            log.push(`**${attacker.name}** rzuca **Igni** za ${res.damage}${res.crit ? ' *(krytyk)*' : ''} i podpala wroga`);
            break;
        }
        case 'aard': {
            const res = rollHit(attacker, defender, 1.5);
            if (!res.dodged) applyDamage(attacker, defender, res.damage, log);
            addEffect(defender, { type: 'stun', turns: 1 });
            log.push(`**${attacker.name}** rzuca **Aard** za ${res.dodged ? 0 : res.damage} i ogłusza wroga`);
            break;
        }
        case 'quen': {
            attacker.blockNext = true;
            const res = rollHit(attacker, defender, 1.2);
            if (!res.dodged) applyDamage(attacker, defender, res.damage, log);
            log.push(`**${attacker.name}** rzuca **Quen** (tarcza) i zadaje ${res.dodged ? 0 : res.damage}`);
            break;
        }
        case 'yrden': {
            const res = rollHit(attacker, defender, 1.4);
            if (!res.dodged) applyDamage(attacker, defender, res.damage, log);
            addEffect(defender, { type: 'weaken', pct: 0.3, turns: 2 });
            log.push(`**${attacker.name}** rzuca **Yrden** za ${res.dodged ? 0 : res.damage} i osłabia wroga`);
            break;
        }
        case 'axii': {
            const res = rollHit(attacker, defender, 1.1);
            if (!res.dodged) applyDamage(attacker, defender, res.damage, log);
            addEffect(defender, { type: 'confusion', turns: 1 });
            log.push(`**${attacker.name}** rzuca **Axii** za ${res.dodged ? 0 : res.damage} — wróg zaatakuje sam siebie`);
            break;
        }
    }
}

/** Wykonuje pelna ture ataku zawodnika zgodnie z jego Szkola/cechami. */
function performAttack(attacker, defender, log) {
    switch (attacker.schoolKey) {
        case 'kot': {
            // Zwiadowca: pojedynczy cios; jego siłą są uniki (do 50%), nie liczba ciosów.
            strike(attacker, defender, attacker.weaponMult, log, 'tnie');
            break;
        }
        case 'waz': {
            for (let i = 0; i < 2 && defender.hp > 0; i++) {
                const res = strike(attacker, defender, attacker.weaponMult, log, i === 0 ? 'tnie pierwszym ostrzem' : 'tnie drugim ostrzem');
                if (res.crit && res.landed) {
                    addEffect(defender, { type: 'bleed', damage: Math.round(attacker.stats.dex * 0.28), turns: 2 });
                    log.push(`Krytyczne cięcie powoduje krwawienie!`);
                }
            }
            break;
        }
        case 'gryf': {
            if (chance(0.5)) {
                strike(attacker, defender, attacker.weaponMult, log, 'tnie mieczem');
            } else {
                castSign(attacker, defender, log);
            }
            break;
        }
        case 'mantykora': {
            const res = strike(attacker, defender, attacker.weaponMult, log, 'ciska bombą');
            if (res.landed) {
                addEffect(defender, { type: 'poison', damage: Math.round(attacker.stats.intel * 0.30), stacks: 1, turns: 3 });
                log.push(`Mikstura żre wroga (trucizna)`);
            }
            break;
        }
        case 'niedzwiedz': {
            // Paladyn: solidny cios, po nim 50% szans na postawe obronna (lagodzi kolejne uderzenie).
            strike(attacker, defender, attacker.weaponMult, log, 'uderza');
            if (chance(0.4)) {
                attacker.braceNext = true;
                log.push(`**${attacker.name}** przyjmuje postawę obronną`);
            }
            break;
        }
        case 'wilk':
        default: {
            // Wilk oraz wszystkie potwory: pojedynczy, solidny cios.
            // Cecha 'venomous' u potwora dokłada truciznę.
            const res = strike(attacker, defender, attacker.weaponMult, log, 'atakuje');
            if (res.landed && attacker.traits.includes('venomous')) {
                addEffect(defender, { type: 'poison', damage: Math.round(attacker.stats.str * 0.2), stacks: 1, turns: 3 });
                log.push(`**${defender.name}** zostaje zatruty`);
            }
            break;
        }
    }
}

// --- Glowna petla --------------------------------------------------------

/**
 * Rozgrywa pelna walke miedzy graczem a potworem.
 * Zwraca { winner: 'player'|'monster', rounds, log, playerHpLeft }.
 */
function simulateCombat(playerC, monsterC, opts = {}) {
    const log = [];

    // Inicjatywa: szybszy (wyzsza Zrecznosc) zaczyna. Remis: w PvE -> gracz,
    // w PvP -> losowo (zeby atakujacy nie mial systematycznej przewagi).
    let playerFirst;
    if (playerC.stats.dex === monsterC.stats.dex && opts.pvp) {
        playerFirst = Math.random() < 0.5;
    } else {
        playerFirst = playerC.stats.dex >= monsterC.stats.dex;
    }
    const order = playerFirst ? [playerC, monsterC] : [monsterC, playerC];
    if (!playerFirst) {
        log.push(`**${monsterC.name}** jest szybszy i atakuje pierwszy!`);
    }

    // Mantykora wchodzi do walki z wieczna regeneracja (mutageny) - dotyczy obu stron (PvP).
    // W PvP regeneracja jest slabsza, by sustain nie dominowal pojedynkow miedzy graczami.
    const regenPct = 0; // Doktor Zarazy: zamiast regeneracji - uniki przy truciźnie
    if (playerC.schoolKey === 'mantykora') {
        playerC.effects.push({ type: 'regen', pct: regenPct, turns: Infinity });
    }
    if (monsterC.schoolKey === 'mantykora') {
        monsterC.effects.push({ type: 'regen', pct: regenPct, turns: Infinity });
    }

    const MAX_ROUNDS = 60;
    let round = 0;

    // Migawki HP po kazdej linii logu (do animacji paskow zycia). Rownolegle do `log`.
    const hpStates = [];
    const snapHp = () => {
        while (hpStates.length < log.length) {
            hpStates.push({ p: Math.max(0, Math.round(playerC.hp)), m: Math.max(0, Math.round(monsterC.hp)) });
        }
    };
    snapHp(); // linia wstepna (inicjatywa) — HP pelne

    while (playerC.hp > 0 && monsterC.hp > 0 && round < MAX_ROUNDS) {
        round++;
        for (const attacker of order) {
            const defender = attacker === playerC ? monsterC : playerC;
            if (playerC.hp <= 0 || monsterC.hp <= 0) break;

            // Efekty na poczatku tury (DoT, regen).
            tickEffects(attacker, log);
            snapHp();
            if (attacker.hp <= 0) break;

            // Ogluszenie - tracimy ture.
            if (hasEffect(attacker, 'stun')) {
                log.push(`**${attacker.name}** jest ogłuszony i traci turę`);
                attacker.effects = attacker.effects.map((e) =>
                    e.type === 'stun' ? { ...e, turns: e.turns - 1 } : e
                ).filter((e) => e.turns > 0);
                snapHp();
                continue;
            }

            // Dezorientacja (Axii) - atakuje samego siebie.
            let realDefender = defender;
            if (hasEffect(attacker, 'confusion')) {
                realDefender = attacker;
                attacker.effects = attacker.effects.map((e) =>
                    e.type === 'confusion' ? { ...e, turns: e.turns - 1 } : e
                ).filter((e) => e.turns > 0);
                log.push(`**${attacker.name}** w amoku atakuje samego siebie!`);
            }

            performAttack(attacker, realDefender, log);
            snapHp();
        }
    }
    snapHp();

    let winner;
    if (playerC.hp <= 0 && monsterC.hp > 0) winner = 'monster';
    else if (monsterC.hp <= 0 && playerC.hp > 0) winner = 'player';
    else winner = playerC.hp / playerC.maxHp >= monsterC.hp / monsterC.maxHp ? 'player' : 'monster';

    return {
        winner, rounds: round, log, playerHpLeft: Math.max(0, playerC.hp),
        hpStates,
        playerMaxHp: playerC.maxHp, monsterMaxHp: monsterC.maxHp,
        playerName: playerC.name, monsterName: monsterC.name
    };
}

module.exports = {
    SCHOOL_COMBAT,
    combatantFromPlayer,
    combatantFromMonster,
    simulateCombat
};
