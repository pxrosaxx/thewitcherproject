// Definicje pieciu Szkol wiedzminskich - to one peelnia role "klas" z SFGame.
// baseStats = staty na poziomie 1, growth = ile kazdy stat rosnie za kazdy kolejny poziom.

module.exports = {
    wilk: {
        key: 'wilk',
        name: 'Szkoła Wilka',
        title: 'Wilk',
        emoji: '🐺',
        description:
            'Szkoła Wilka – jedna z wiedźmińskich organizacji. Rezydowała w zamku Kaer Morhen w królestwie Kaedwen. Wilki kładły nacisk na walkę i profesjonalizm w swoim fachu. Jej symbolem jest medalion w kształcie wilczej paszczy z wyszczerzonymi kłami.',
        baseStats: { str: 12, dex: 10, intel: 6, wit: 12, luck: 8 },
        growth: { str: 3, dex: 2, intel: 1, wit: 3, luck: 1 }
    },
    kot: {
        key: 'kot',
        name: 'Szkoła Kota',
        title: 'Kot',
        emoji: '🐈‍⬛',
        description:
            'Szkoła Kota – jedna z wiedźmińskich organizacji. W została założona przez 20 młodych nieznanych łowców potworów z siedzibą w Beann Grudd. O kotach mówi się, że służą jako szpiedzy, najemnicy i skrytobójcy, a wielu z nich było nawet psychopatami. ',
        baseStats: { str: 8, dex: 14, intel: 6, wit: 8, luck: 10 },
        growth: { str: 1, dex: 4, intel: 1, wit: 2, luck: 2 }
    },
    gryf: {
        key: 'gryf',
        name: 'Szkoła Gryfa',
        title: 'Gryf',
        emoji: '🦅',
        description:
            'Szkoła Gryfa - jedna z wiedzmińskich organizacji. Twórcą tej szkoły był Erland z Larvik z 13 innymi wiedźminami a ich siedziba mieściła się w Kaer Seren w Kovir i Poviss. O wiedźminach z tej szkoły mówi się, że przypominają rycerzy. Ich rynsztunek wyglądał jak rycerska zbroja. Opisywano ich jako szlachetnych. ',
        baseStats: { str: 6, dex: 8, intel: 14, wit: 8, luck: 10 },
        growth: { str: 1, dex: 1, intel: 4, wit: 2, luck: 2 }
    },
    waz: {
        key: 'waz',
        name: 'Szkoła Żmii',
        title: 'Żmija',
        emoji: '🐍',
        description:
            'Szkoła Żmii - jedna z wiedźmińskich organizacji. Na jej czele stał sławny Ivar Złe Oko a ich kwatera główna mieściła się w Gorthur Gvaed. Wiedźmini ze szkoły Żmii uważali, że w ich fachu nie ma miejsca na moralność. Specjalizowali się w walce dwoma mieczami.',
        baseStats: { str: 10, dex: 13, intel: 6, wit: 7, luck: 10 },
        growth: { str: 2, dex: 4, intel: 1, wit: 1, luck: 2 }
    },
    mantykora: {
        key: 'mantykora',
        name: 'Szkoła Mantikory',
        title: 'Mantikora',
        emoji: '🦂',
        description:
            'Szkoła Mantikory - jedna z wiedźmińskich organizacji. Jej założycielem był Iwan a kwatera główna znajduje się w dwóch bliżniaczych twierdzach: Behelt Nar iu Bialsuf Alserea. Wiedźmini ze szkoły Mantikory uważani byli bardziej za obrońców niż łowców potworów. Skupiali się na obronie lokalnych społeczności, a wielu z nich uważało się w swoich stronach za prawdziwych bohaterów. ',
        baseStats: { str: 7, dex: 8, intel: 11, wit: 12, luck: 8 },
        growth: { str: 1, dex: 1, intel: 3, wit: 3, luck: 1 }
    },
    niedzwiedz: {
        key: 'niedzwiedz',
        name: 'Szkoła Niedźwiedzia',
        title: 'Niedźwiedz',
        emoji: '🐻',
        description:
            'Szkoła Niedźwiedzia - jedna z wiedźmińskich organizacji. Jej przywódcą był Arnaghad a kwaterą główną Haern Caduch. Wiedźmini ze Szkoły Niedźwiedzia charakteryzowali się samotniczą naturą, skrajnym pragmatyzmem oraz niespotykaną odpornością.',
        baseStats: { str: 13, dex: 7, intel: 6, wit: 14, luck: 7 },
        growth: { str: 3, dex: 1, intel: 1, wit: 4, luck: 1 }
    }
};
