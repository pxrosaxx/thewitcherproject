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
    kot:       { offense: 'dex',   weaponMult: 1.7, hits: 1 },
    waz:       { offense: 'dex',   weaponMult: 1.4, hits: 2 },
    gryf:      { offense: 'intel', weaponMult: 2.4, hits: 1 },
    mantykora: { offense: 'intel', weaponMult: 1.4, hits: 1 }
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
            existing.stacks = Math.min(5, existing.stacks + 1);
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
    return target.schoolKey === 'mantykora' ? 0.5 : 0;
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
    defender.hp -= amount;

    if (attacker && attacker.traits.includes('lifesteal')) {
        const heal = Math.round(amount * 0.25);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        if (heal > 0) log.push(`**${attacker.name}** wysysa ${heal} HP`);
    }
    return amount;
}

/**
 * Standardowe trafienie broni. Zwraca {dodged, crit, damage} i NIE aplikuje
 * jeszcze obrazen (pozwala to szkolom modyfikowac wynik).
 */
function rollHit(attacker, defender, multiplier) {
    if (chance(dodgeChance(defender.stats))) {
        return { dodged: true, crit: false, damage: 0 };
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

    // Oslabienie (Yrden) zmniejsza obrazenia atakujacego.
    dmg *= 1 - totalWeaken(attacker);

    let cc = critChance(attacker.stats);
    if (attacker.schoolKey === 'waz') cc += 0.06; // Zabójca: wrodzona precyzja
    const crit = chance(cc);
    if (crit) dmg *= CRIT_MULT;

    // Redukcja z obrony celu; Wilk jako cel ma dodatkowe 5% (zaprawiony w bojach).
    dmg *= 1 - damageReduction(defender.stats.wit);
    if (defender.schoolKey === 'wilk') dmg *= 0.95;
    if (defender.traits.includes('armored')) dmg *= 0.85;

    return { dodged: false, crit, damage: Math.max(1, Math.round(dmg)) };
}

/** Wykonuje jedno standardowe trafienie wraz z logiem i aplikacja obrazen. */
function strike(attacker, defender, multiplier, log, label = 'atakuje') {
    const res = rollHit(attacker, defender, multiplier);
    if (res.dodged) {
        log.push(`**${defender.name}** unika ciosu`);
        return res;
    }
    const dealt = applyDamage(attacker, defender, res.damage, log);
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
            strike(attacker, defender, attacker.weaponMult, log, 'tnie');
            const secondChance = Math.min(0.5, 0.15 + attacker.stats.dex * 0.008);
            if (defender.hp > 0 && chance(secondChance)) {
                log.push(`Refleks! **${attacker.name}** uderza ponownie`);
                strike(attacker, defender, attacker.weaponMult, log, 'tnie');
            }
            break;
        }
        case 'waz': {
            for (let i = 0; i < 2 && defender.hp > 0; i++) {
                const res = strike(attacker, defender, attacker.weaponMult, log, i === 0 ? 'tnie pierwszym ostrzem' : 'tnie drugim ostrzem');
                if (res.crit && !res.dodged) {
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
            if (!res.dodged) {
                addEffect(defender, { type: 'poison', damage: Math.round(attacker.stats.intel * 0.25), stacks: 1, turns: 3 });
                log.push(`Mikstura żre wroga (trucizna)`);
            }
            break;
        }
        case 'wilk':
        default: {
            // Wilk oraz wszystkie potwory: pojedynczy, solidny cios.
            // Cecha 'venomous' u potwora dokłada truciznę.
            const res = strike(attacker, defender, attacker.weaponMult, log, 'atakuje');
            if (!res.dodged && attacker.traits.includes('venomous')) {
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
function simulateCombat(playerC, monsterC) {
    const log = [];

    // Inicjatywa: szybszy (wyzsza Zrecznosc) zaczyna; remis -> gracz.
    const playerFirst = playerC.stats.dex >= monsterC.stats.dex;
    const order = playerFirst ? [playerC, monsterC] : [monsterC, playerC];
    if (!playerFirst) {
        log.push(`**${monsterC.name}** jest szybszy i atakuje pierwszy!`);
    }

    // Mantykora wchodzi do walki z wieczna regeneracja (mutageny) - dotyczy obu stron (PvP).
    if (playerC.schoolKey === 'mantykora') {
        playerC.effects.push({ type: 'regen', pct: 0.018, turns: Infinity });
    }
    if (monsterC.schoolKey === 'mantykora') {
        monsterC.effects.push({ type: 'regen', pct: 0.018, turns: Infinity });
    }

    const MAX_ROUNDS = 60;
    let round = 0;

    while (playerC.hp > 0 && monsterC.hp > 0 && round < MAX_ROUNDS) {
        round++;
        for (const attacker of order) {
            const defender = attacker === playerC ? monsterC : playerC;
            if (playerC.hp <= 0 || monsterC.hp <= 0) break;

            // Efekty na poczatku tury (DoT, regen).
            tickEffects(attacker, log);
            if (attacker.hp <= 0) break;

            // Ogluszenie - tracimy ture.
            if (hasEffect(attacker, 'stun')) {
                log.push(`**${attacker.name}** jest ogłuszony i traci turę`);
                attacker.effects = attacker.effects.map((e) =>
                    e.type === 'stun' ? { ...e, turns: e.turns - 1 } : e
                ).filter((e) => e.turns > 0);
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
        }
    }

    let winner;
    if (playerC.hp <= 0 && monsterC.hp > 0) winner = 'monster';
    else if (monsterC.hp <= 0 && playerC.hp > 0) winner = 'player';
    else winner = playerC.hp / playerC.maxHp >= monsterC.hp / monsterC.maxHp ? 'player' : 'monster';

    return { winner, rounds: round, log, playerHpLeft: Math.max(0, playerC.hp) };
}

module.exports = {
    SCHOOL_COMBAT,
    combatantFromPlayer,
    combatantFromMonster,
    simulateCombat
};
