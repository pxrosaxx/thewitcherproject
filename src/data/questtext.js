// =============================================================================
//  GENERATOR OPISÓW ZLECEŃ — 3 FILARY (wstęp + rozwinięcie + zakończenie).
//  Każdy filar to samodzielne zdanie, więc dowolna kombinacja czyta się sensownie.
//  15 × 15 × 15 = 3375 unikalnych narracji — nikt nie przeczyta dwa razy tego samego.
// =============================================================================

const WSTEP = [
    'Zdyszany posłaniec z pieczęcią wójta dopada cię z pilną wieścią.',
    'Przy kominku siedzi blada kobieta, ściskając zmięty list.',
    'Stary sołtys stuka kuflem o stół i woła o ciszę.',
    'Na tablicy wisi świeże zlecenie, atrament jeszcze nie wysechł.',
    'Kupiec o przebiegłym spojrzeniu odciąga cię na bok.',
    'Grupka wieśniaków szepcze w kącie, zerkając w twoją stronę.',
    'Zakrwawiony myśliwy ledwie trzyma się na nogach przy barze.',
    'Dziewczę ze wsi przybiega prosto z pola, blade ze strachu.',
    'Pewien jegomość nachyla się nad stołem i ścisza głos do szeptu.',
    'Posłaniec w barwach barona rzuca sakiewkę na stół.',
    'Pod drzwiami czeka kapłan Wiecznego Ognia z pergaminem.',
    'Zgarbiona zielarka wskazuje kościstym palcem na drzwi.',
    'Najemnik o pokiereszowanej twarzy mierzy cię wzrokiem.',
    'Płacząca matka chwyta cię za rękaw, nim zdążysz usiąść.',
    'Włodarz przysiółka kładzie przed tobą garść monet.'
];

const ROZWINIECIE = [
    'W okolicznym lesie grasuje bestia, która nocą porywa bydło.',
    'Studnia we wsi została zatruta, a w jej głębi czai się coś ohydnego.',
    'Na trakcie kupieckim znikają podróżni, jeden po drugim.',
    'Cmentarz przy osadzie obudził się — umarli nie chcą leżeć spokojnie.',
    'Okoliczne mokradła co noc plują nowymi potworami.',
    'W ruinach starej wieży zalęgło się gniazdo paskudztwa.',
    'Pola obracają się w jałowiznę, jakby tknięte klątwą.',
    'Dzieci ze wsi śnią ten sam koszmar i budzą się z siniakami.',
    'Z kopalni nie wrócił żaden z górników wysłanych zeszłego tygodnia.',
    'Rzeka wyrzuca na brzeg ciała naznaczone dziwnymi ranami.',
    'Nocami nad osadą krąży skrzydlaty cień, siejąc trwogę.',
    'W piwnicach młyna zagnieździło się coś, co żywi się krwią.',
    'Wataha zdziczałych stworów obległa drogę do świątyni.',
    'Pod rozstajami ktoś odprawił rytuał i obudził dawne zło.',
    'Bagienne ognie wabią wędrowców prosto w paszczę potwora.'
];

const ZAKONCZENIE = [
    'Trzeba to ubić, nim padnie kolejna ofiara.',
    'Zapłata czeka, gdy tylko przyniesiesz dowód zabicia bestii.',
    'Wieś nie przetrwa kolejnego takiego tygodnia — pośpiesz się.',
    'Kto się tym zajmie, odejdzie z sakiewką cięższą o złoto.',
    'Im szybciej skończysz, tym hojniejsza wdzięczność mieszkańców.',
    'Nagroda jest sowita, lecz droga powrotna niełatwa.',
    'Ludzie modlą się o wiedźmina — może to właśnie ty.',
    'Załatw to po cichu, a zleceniodawca wynagrodzi cię szczodrze.',
    'Nie pytaj o szczegóły — po prostu zrób, co trzeba.',
    'Zlecenie proste w słowach, lecz krwawe w czynie.',
    'Tylko ktoś wprawny w rzemiośle podoła temu zadaniu.',
    'Mieszkańcy złożyli się na zapłatę — nie zawiedź ich.',
    'Czas nagli, a potwór tyje na ich strachu.',
    'Przynieś głowę bestii, a sława pójdzie przed tobą.',
    'Zrób to dobrze, a wrócą tu po ciebie z kolejnym złotem.'
];

// Maly deterministyczny RNG (mulberry32) - pozwala ustabilizowac opis per zlecenie.
function seededPick(arr, seed) {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return arr[Math.floor(r * arr.length)];
}

/**
 * Buduje opis zlecenia z 3 filarów.
 * @param {number|null} seed - jesli podany, opis jest stabilny (ten sam seed = ten sam tekst).
 */
function buildQuestText(seed = null) {
    if (seed === null) {
        const r = () => Math.floor(Math.random() * 1e9);
        return `${WSTEP[Math.floor(Math.random() * WSTEP.length)]} ${ROZWINIECIE[Math.floor(Math.random() * ROZWINIECIE.length)]} ${ZAKONCZENIE[Math.floor(Math.random() * ZAKONCZENIE.length)]}`;
    }
    return `${seededPick(WSTEP, seed)} ${seededPick(ROZWINIECIE, seed * 7 + 13)} ${seededPick(ZAKONCZENIE, seed * 31 + 101)}`;
}

const TOTAL_COMBINATIONS = WSTEP.length * ROZWINIECIE.length * ZAKONCZENIE.length;

module.exports = { buildQuestText, WSTEP, ROZWINIECIE, ZAKONCZENIE, TOTAL_COMBINATIONS };
