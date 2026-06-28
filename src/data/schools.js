// Definicje Szkol wiedzminskich - pelnia role "klas" postaci.
// baseStats = staty na poziomie 1, growth = ile kazdy stat rosnie za kazdy kolejny poziom.

module.exports = {
    wilk: {
        key: 'wilk',
        name: 'Szkoła Wilka',
        title: 'Wojownik',
        emoji: '🐺',
        description:
            'Mistrz miecza i tarczy. Ma szansę całkowicie zablokować fizyczny cios, a osaczony — gdy spada na niskie HP — bije jeszcze mocniej. Największa pula życia. Tarcza nie zatrzyma jednak magii.',
        baseStats: { str: 12, dex: 10, intel: 6, wit: 12, luck: 8 },
        growth: { str: 3, dex: 2, intel: 1, wit: 3, luck: 1 }
    },
    kot: {
        key: 'kot',
        name: 'Szkoła Kota',
        title: 'Zwiadowca',
        emoji: '🐈‍⬛',
        description:
            'Błyskawiczny zwiadowca i mistrz uników — wymyka się nawet połowie fizycznych ciosów. Magii jednak uniknąć się nie da.',
        baseStats: { str: 8, dex: 14, intel: 6, wit: 8, luck: 10 },
        growth: { str: 1, dex: 4, intel: 1, wit: 2, luck: 2 }
    },
    gryf: {
        key: 'gryf',
        name: 'Szkoła Gryfa',
        title: 'Mag Znaków',
        emoji: '🦅',
        description:
            'Wiedźmin-mag. W każdej turze losowo tnie mieczem albo rzuca jeden z pięciu Znaków (Quen, Yrden, Igni, Aard, Axii). Jego ataki są magiczne — nie da się ich zablokować ani uniknąć, przebijają tarcze i uniki. W zamian sam jest kruchy jak szkło.',
        baseStats: { str: 6, dex: 8, intel: 14, wit: 8, luck: 10 },
        growth: { str: 1, dex: 1, intel: 4, wit: 2, luck: 2 }
    },
    waz: {
        key: 'waz',
        name: 'Szkoła Węża',
        title: 'Zabójca',
        emoji: '🐍',
        description:
            'Zabójca walczący dwoma mieczami — atakuje dwukrotnie w każdej turze, a krytyczne cięcia wywołują krwawienie. Zwinnie unika fizycznych ciosów. Najwyższy potencjał ofensywny, ale i najkruchszy.',
        baseStats: { str: 10, dex: 13, intel: 6, wit: 7, luck: 10 },
        growth: { str: 2, dex: 4, intel: 1, wit: 1, luck: 2 }
    },
    mantykora: {
        key: 'mantykora',
        name: 'Szkoła Mantykory',
        title: 'Alchemik',
        emoji: '🦂',
        description:
            'Mistrz toksycznej alchemii. Ciska zatrutymi fiolkami, które wyniszczają wroga rundę po rundzie. Gdy przeciwnik jest otruty, Mantykora zyskuje sporą szansę na uniki — robi zwody, a trucizna pracuje za nią.',
        baseStats: { str: 7, dex: 8, intel: 11, wit: 12, luck: 8 },
        growth: { str: 1, dex: 1, intel: 3, wit: 3, luck: 1 }
    },
    niedzwiedz: {
        key: 'niedzwiedz',
        name: 'Szkoła Niedźwiedzia',
        title: 'Paladyn',
        emoji: '🐻',
        description:
            'Opancerzony kolos o największej puli życia. Blokuje fizyczne ciosy, a po własnym ataku często przechodzi w postawę obronną, łagodząc kolejne uderzenie. Zadaje PODWÓJNE obrażenia istotom magicznym — to zmora Gryfów. Powolny i mało celny, ale prawie nie do zdarcia.',
        baseStats: { str: 13, dex: 7, intel: 6, wit: 14, luck: 7 },
        growth: { str: 3, dex: 1, intel: 1, wit: 4, luck: 1 }
    }
};
