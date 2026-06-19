// =============================================================================
//  PULA NAZW POTWOROW (wg tieru rzadkosci, z bestiariusza Wiedzmina).
//  Uzywane TYLKO jako nazwy - statystyki/balans sa oryginalne (patrz monsters.js).
//  Elity ciagna nazwe z wyzszego tieru (zamiast przedrostka 'Elitarny').
// =============================================================================

const MONSTER_NAMES = {
    common: ["Dzik", "Pies", "Wilk", "Endriaga Robotnik", "Nekker", "Utopiec", "Ghul", "Zgnilec", "Warg", "Niedźwiedź", "Pantera", "Harpia", "Syrena", "Arachnomorf", "Echinops", "Kobold", "Parszywiec", "Barghest"],
    uncommon: ["Erynia", "Endriaga Truteń", "Endriaga Wojownik", "Skolopendromorf", "Kikimora Robotnica", "Alghul", "Baba Wodna", "Bloedzuiger", "Graveir", "Upiór", "Fleder", "Wiwerna", "Kuroliszek", "Gargulec", "Archespor", "Mglak", "Zjadarka", "Ekimma", "Garkain"],
    rare: ["Widłogon", "Bazyliszek", "Oszluzg", "Gryf", "Echnida", "Sukkub", "Kikimora Wojowniczka", "Krabopająk", "Golem", "Wilkołak", "Poroniec", "Troll skalny", "Troll lodowy", "Troll jaskiniowy", "Doppler", "Silvan", "Borowy", "Baba Cmentarna", "Wicht", "Północnica", "Południca", "Beann'shie", "Alp", "Mula", "Ogar Dzikiego Gonu", "Bożątko"],
    epic: ["Prządka (Pani Lasu)", "Szepciucha (Pani Lasu)", "Kuchta (Pani Lasu)", "Wiwerna Królewska", "Bazyliszek Srebrzysty", "Smok Zielony", "Smok Czerwony", "Smok Czarny", "Smok Biały", "Archegryf", "Mantikora", "Chimera", "Idr", "Zorril", "Żywiołak Lodu", "Żywiołak Ognia", "Żywiołak Ziemi", "Cyklop", "Aguara", "Mamutak", "Szarlej", "Him", "Pokutnik", "Zeugl", "Bruxa", "Czart", "Katakan", "Nosferat"],
    legendary: ["D'jinni", "Ifrit", "Marid", "D'ao", "Kościej", "Przeraza", "Lodowy Gigant", "Strzyga", "Bies", "Leszy"],
    mythic: ["Smok Złoty", "Kejran", "Wampir Wyższy", "Dagon"],
};

module.exports = { MONSTER_NAMES };
