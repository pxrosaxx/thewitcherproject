// Definicje pieciu Szkol wiedzminskich - to one peelnia role "klas" z SFGame.
// baseStats = staty na poziomie 1, growth = ile kazdy stat rosnie za kazdy kolejny poziom.

module.exports = {
    wilk: {
        key: 'wilk',
        name: 'Szkoła Wilka',
        title: 'Wojownik',
        emoji: '🐺',
        description:
            'Wszechstronny wiedźmin, mistrz pojedynczego miecza. Stabilny w ataku i obronie — najlepszy wybór na początek wędrówki.',
        baseStats: { str: 12, dex: 10, intel: 6, wit: 12, luck: 8 },
        growth: { str: 3, dex: 2, intel: 1, wit: 3, luck: 1 }
    },
    kot: {
        key: 'kot',
        name: 'Szkoła Kota',
        title: 'Zwiadowca',
        emoji: '🐈‍⬛',
        description:
            'Błyskawiczny i nieprzewidywalny. Wysoka zręczność pozwala unikać ciosów i zadawać częste krytyki, kosztem słabszej wytrzymałości.',
        baseStats: { str: 8, dex: 14, intel: 6, wit: 8, luck: 10 },
        growth: { str: 1, dex: 4, intel: 1, wit: 2, luck: 2 }
    },
    gryf: {
        key: 'gryf',
        name: 'Szkoła Gryfa',
        title: 'Mag Znaków',
        emoji: '🦅',
        description:
            'Wiedźmin zgłębiający magię Znaków. W każdej turze losowo tnie mieczem albo rzuca jeden z pięciu Znaków — Quen, Yrden, Igni, Aard lub Axii.',
        baseStats: { str: 6, dex: 8, intel: 14, wit: 11, luck: 10 },
        growth: { str: 1, dex: 1, intel: 4, wit: 3, luck: 2 }
    },
    waz: {
        key: 'waz',
        name: 'Szkoła Węża',
        title: 'Zabójca',
        emoji: '🐍',
        description:
            'Walczy dwoma mieczami naraz, zadając serie szybkich, mocnych ciosów. Najwyższy potencjał ofensywny, ale i najkruchszy.',
        baseStats: { str: 10, dex: 13, intel: 6, wit: 7, luck: 10 },
        growth: { str: 2, dex: 4, intel: 1, wit: 1, luck: 2 }
    },
    mantykora: {
        key: 'mantykora',
        name: 'Szkoła Mantykory',
        title: 'Alchemik',
        emoji: '🦂',
        description:
            'Mistrz bomb i mutagenów. Nie zadaje największych pojedynczych ciosów, ale jego trujące i ogniste mieszanki wyniszczają wroga z czasem, a wzmocniony organizm leczy się w trakcie walki i jest niemal odporny na trucizny.',
        baseStats: { str: 7, dex: 8, intel: 11, wit: 12, luck: 8 },
        growth: { str: 1, dex: 1, intel: 3, wit: 3, luck: 1 }
    }
};
