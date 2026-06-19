# Wiedźmiński Bot — Etap 10: Nowy wygląd kart + walka krok po kroku

> Pełne `src/`. **Brak nowych migracji bazy.**

## 1. Nowy wygląd kart (emblematy)

- **Koniec ze złotem.** Neutralny motyw to teraz **wiedźmińska stal** (`0x5d7a8f`).
- **Kolor wg wyniku walki:** zielony = zwycięstwo, czerwony = porażka, stal = menu/profil.
  Natychmiastowy sygnał „udało się / poległeś", zanim przeczytasz cokolwiek.
- **Linia autora** u góry kart: „Imię · Szkoła X" — spójna tożsamość.
- **Wszystko w osobnych sekcjach:** Przebieg walki / Nagroda / Postęp / Łup — czytelnie rozdzielone.
- **Wielka grafika potwora na dole** karty walki (loch i karczma), brana z `monster.json`.

## 2. Walka krok po kroku

Log starcia **odsłania się porcjami** (kilka kroków z odstępami), zamiast pojawiać się cały
naraz — w lochu, karczmie i arenie. Wspólny „animator" (`src/utils/combat_anim.js`) edytuje
wiadomość kilka razy (~co 1,1 s), więc nie obciąża limitów Discorda. Krótkie walki pokazują
wynik od razu.

## 3. Grafiki potworów — WAŻNE

Grafiki brane są z linków w `monster.json` (mapa nazwa→URL w `src/data/monster_images.js`).
- Bossy lochu o złożonych nazwach dostają grafikę po dopasowaniu członu (np. „Bies z Mokradeł" → grafika „Bies").
- **Pamiętaj:** to podpisane linki Discorda — mogą wygasać. Gdy karty zaczną pokazywać puste
  miniatury, odśwież adresy w `monster_images.js` (albo docelowo przerzuć grafiki na stały hosting/pliki w repo).

## 4. Herby szkół — miejsce zostawione

Linia autora ma już przygotowane miejsce na **herb szkoły** (ikona). Gdy zdobędziesz grafiki
medalionów, wystarczy w `src/utils/embeds.js` w funkcji `authorFor` dopisać `iconURL` —
jest tam komentarz wskazujący gdzie. Do tego czasu autor pokazuje sam tekst.

## Instalacja (drop-in)

1. Skopiuj `src/`, **nadpisując**. ⚠️ Zachowaj `src/db.js` i `.env`.
2. `node src/setup.js` — bez nowych kolumn.
3. `node src/deploy-commands.js` — bez nowych komend.
4. `node src/index.js`

## Nowe / zmienione pliki

| Plik | Status |
|------|--------|
| `src/utils/embeds.js` | stal zamiast złota, kolory wyniku, `authorFor` |
| `src/utils/combat_anim.js` | **NOWY** — animator walki krok po kroku |
| `src/data/monster_images.js` | **NOWY** — mapa nazwa→grafika potwora |
| `src/commands/loch.js` | sekcje, grafika, kolor wyniku, animacja |
| `src/commands/tablica-zlecen.js` | jw. (karczma) |
| `src/commands/arena.js` | jw. (bez grafiki — PvP) |
| `src/commands/profil.js` | linia autora zamiast emotki w tytule |

## Strojenie

- **Kolory:** `KOLOR` / `KOLOR_WIN` / `KOLOR_LOSS` w `src/utils/embeds.js`.
- **Tempo animacji:** `steps` i `delayMs` w `src/utils/combat_anim.js` (lub przekazane przy wywołaniu).

## Na horyzoncie — Etap 11

Kreator własnych lochów (tylko dla Ciebie/adminów): definiowanie lokacji i potworów
(archetyp + nazwa + poziom), zapis w bazie, integracja z `/loch`. To już ustaliliśmy.
