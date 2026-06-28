// =============================================================================
//  HUB POMOCY (Etap 14) — treść przewodników. Komenda /pomoc renderuje to
//  w interaktywnym menu tematów.
// =============================================================================

const OVERVIEW =
    'Witaj na **Szlaku Wiedźmina**! To gra RPG osadzona w świecie Wiedźmina: tworzysz postać, ' +
    'wybierasz Szkołę, polujesz na potwory, zdobywasz ekwipunek i piniesz się w siłę.\n\n' +
    '**Pętla rozgrywki:**\n' +
    '1. Stwórz postać i wybierz Szkołę — `/postac`\n' +
    '2. Bierz zlecenia z tablicy — `/tablica-zlecen`\n' +
    '3. Zakładaj zdobyty sprzęt — `/ekwipunek`\n' +
    '4. Przebijaj się przez podziemia i bossów — `/podziemia`\n' +
    '5. Mierz się z innymi na arenie — `/arena`\n' +
    '6. Rozwijaj postać: trening, kowal, alchemia, komplety\n\n' +
    'Wybierz temat z menu poniżej, by dowiedzieć się więcej.';

// Tematy w kolejności menu. body = treść embeda (Markdown).
const TOPICS = [
    {
        key: 'start',
        label: 'Pierwsze kroki',
        short: 'Od czego zacząć',
        title: 'Pierwsze kroki',
        body:
            'Świeżo na Szlaku? Oto droga:\n\n' +
            '**1. `/postac`** — stwórz postać i wybierz jedną z 5 Szkół. Szkoła określa styl walki ' +
            'i statystyki startowe (możesz podejrzeć je w `/szkoly`).\n' +
            '**2. `/trening`** — wydaj korony na podbicie statystyk.\n' +
            '**3. `/tablica-zlecen`** — bierz zlecenia na potwory. To główne źródło doświadczenia, koron i łupu.\n' +
            '**4. `/ekwipunek`** — zakładaj zdobyty sprzęt, by walczyć skuteczniej.\n' +
            '**5. `/dziennie`** — odbieraj codzienną nagrodę (im dłuższa passa, tym lepiej).\n\n' +
            'Gdy okrzepniesz, ruszaj na `/podziemia` i `/arena`. Reszta — kowal, alchemia, komplety, ' +
            'osiągnięcia — to narzędzia, którymi stajesz się potężniejszy.'
    },
    {
        key: 'postac',
        label: 'Postać i rozwój',
        short: 'Poziomy, statystyki, energia',
        title: 'Postać i rozwój',
        body:
            '**`/postac`** — tworzenie postaci i wybór Szkoły.\n' +
            '**`/profil`** — Twoja karta: poziom, statystyki, waluty, passy, tytuł, osiągnięcia.\n' +
            '**`/trening`** — kupuj punkty statystyk za korony.\n\n' +
            '**Statystyki:** Siła i Zręczność napędzają obrażenia (zależnie od Szkoły), ' +
            'Witalność daje życie i redukcję obrażeń, Szczęście zwiększa szansę na trafienia krytyczne, ' +
            'Inteligencja zasila Szkoły magiczne.\n\n' +
            '**Energia:** *Punkty akcji* (podziemia) i *Wytrzymałość* (zlecenia) odnawiają się z czasem — ' +
            'Wytrzymałość resetuje się codziennie. Bez energii musisz poczekać.'
    },
    {
        key: 'walka',
        label: 'Aktywności i walka',
        short: 'Zlecenia, podziemia, arena',
        title: 'Aktywności i walka',
        body:
            '**`/tablica-zlecen`** — zlecenia na potwory. Każda wygrana to exp, korony i szansa na łup oraz Ucho. ' +
            'Wygrane z rzędu budują **passę** (coraz większe nagrody). Kosztuje Wytrzymałość.\n\n' +
            '**`/podziemia`** — krainy podzielone na etapy zakończone bossem. Pokonuj ich po kolei; ' +
            'finałowy boss kończy podziemie i daje gwarantowany, lepszy łup. Kosztuje Punkty akcji.\n\n' +
            '**`/arena`** — pojedynki PvP z innymi graczami. Wygrane podnoszą **chwałę** (ranking ELO), ' +
            'porażki ją obniżają. Sprawdź drabinkę w `/ranking`. Między walkami obowiązuje krótki odstęp.\n\n' +
            'Walka rozgrywa się automatycznie na podstawie statystyk, ekwipunku i alchemii — log odsłania się krok po kroku.'
    },
    {
        key: 'ekwipunek',
        label: 'Ekwipunek i komplety',
        short: 'Sprzęt, sklep, kowal, sety',
        title: 'Ekwipunek i komplety',
        body:
            '**`/ekwipunek`** — zakładaj i zmieniaj sprzęt (6 slotów). Lepsza rzadkość = mocniejsze staty.\n' +
            '**`/sklep`** — kupuj przedmioty za korony (oferta odświeża się).\n' +
            '**`/kowal`** — ulepszaj poziom przedmiotu (korony) albo przekuwaj jego rzadkość (korony + Uszy).\n' +
            '**`/komplety`** — sprzęt jednej Szkoły tworzy **komplet**: bonusy przy 2, 4 i 6 częściach, ' +
            'rosnące z poziomem przedmiotów.\n\n' +
            '**Afinacja:** sprzęt zgodny z Twoją Szkołą daje dodatkowe +20% do statystyk — opłaca się ' +
            'kompletować ekwipunek własnej Szkoły.'
    },
    {
        key: 'alchemia',
        label: 'Alchemia',
        short: 'Eliksiry, oleje, bomby',
        title: 'Alchemia',
        body:
            '**`/alchemia`** — warzysz mikstury i ustawiasz **zestaw** na walkę. Trzy kategorie:\n' +
            '• **Eliksiry** — wzmacniają Ciebie (regeneracja, siła, obrona, krytyki).\n' +
            '• **Oleje** — zwiększają obrażenia Twojej broni.\n' +
            '• **Bomby** — osłabiają wroga na starcie (podpalenie, trucizna, osłabienie, ogłuszenie).\n\n' +
            '**Zestaw:** możesz mieć aktywną 1 miksturę z każdej kategorii. Każda walka w **podziemiu i na zleceniu** ' +
            'zużywa po jednej z zapasu (jeśli ją masz). W arenie alchemia nie działa.\n\n' +
            'Podkomendy: `warz` (warzenie), `zestaw` (ustaw aktywne), `plecak` (zapas i przepisy).'
    },
    {
        key: 'gildie',
        label: 'Gildie',
        short: 'Skarbiec, akademia, portal',
        title: 'Gildie',
        body:
            '**`/gildia`** — wspólne granie z innymi graczami.\n\n' +
            '**Skarbiec** — wpłacajcie korony (`/gildia wesprzyj`); lider ulepsza go (`/gildia ulepsz`), ' +
            'a każdy poziom daje **+1% do statystyk** wszystkich członków w każdej walce.\n' +
            '**Akademia** — analogicznie, każdy poziom to **+1% doświadczenia** dla członków.\n' +
            '**Portal** — wspólny boss. Każdy bije go raz dziennie (`/gildia atakuj`); po pokonaniu ' +
            'cała gildia dostaje nagrodę, a portal awansuje na mocniejszy etap.\n' +
            '**Wojny gildii** — `/gildia wojna nazwa:` wysyła szyk Twojej gildii przeciw innej. ' +
            'Członkowie walczą w sekwencji „król wzgórza" (zwycięzca walczy dalej z resztką życia), aż jedna ' +
            'strona padnie. Zwycięska gildia zyskuje chwałę i korony dla członków.\n\n' +
            'Zakładasz gildię przez `/gildia stworz` (koszt koron), dołączasz przez `/gildia dolacz`. ' +
            'Lider zarządza członkami (`wyrzuc`, `awansuj`). Drabinkę gildii pokazuje `/gildia ranking`.'
    },
    {
        key: 'osiagniecia',
        label: 'Osiągnięcia i tytuły',
        short: 'Cele i tytuły na profil',
        title: 'Osiągnięcia i tytuły',
        body:
            '**`/osiagniecia`** — kamienie milowe ze wszystkich systemów: poziom, areny, pokonani bossowie, ' +
            'kontrakty, ulepszenia, mikstury, komplety i więcej.\n\n' +
            'Osiągnięcia są **trwałe** i dają nagrody (korony/Uszy). Część odblokowuje **tytuły**, które ' +
            'możesz nosić na karcie postaci — wybierzesz je z menu w `/osiagniecia`.\n\n' +
            'Nowe osiągnięcia pojawiają się od razu po walce lub akcji, która przekroczyła próg.'
    },
    {
        key: 'waluty',
        label: 'Waluty',
        short: 'Korony i Uszy',
        title: 'Waluty',
        body:
            '**Korony** — podstawowa waluta. Zdobywasz je ze zleceń, podziemi, areny i z codziennej nagrody. ' +
            'Wydajesz w sklepie, na trening, u kowala i w alchemii.\n\n' +
            '**Uszy** — rzadkie trofea (z trudniejszych walk). Potrzebne do przekuwania rzadkości u kowala ' +
            'i do warzenia najmocniejszych mikstur. Traktuj je jak walutę premium — wydawaj rozważnie.'
    },
    {
        key: 'komendy',
        label: 'Wszystkie komendy',
        short: 'Pełna lista',
        title: 'Wszystkie komendy',
        body:
            '**Postać:** `/postac` · `/profil` · `/trening`\n' +
            '**Aktywności:** `/tablica-zlecen` · `/podziemia` · `/arena` · `/dziennie`\n' +
            '**Ekwipunek:** `/ekwipunek` · `/sklep` · `/kowal` · `/komplety`\n' +
            '**Alchemia:** `/alchemia`\n' +
            '**Gildia:** `/gildia` _(skarbiec, akademia, portal — granie zespołowe)_\n' +
            '**Meta:** `/osiagniecia` · `/ranking` · `/szkoly` · `/pomoc`'
    }
];

const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.key, t]));

module.exports = { OVERVIEW, TOPICS, TOPIC_MAP };
