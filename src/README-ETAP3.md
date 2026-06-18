# Wiedźmiński Bot — Etap 3: Ekwipunek, Łup i Sklep

## Co nowego

- **System ekwipunku (6 slotów)** — Broń, Napierśnik, Rękawice, Spodnie, Buty, Kusza.
  *(To autentyczne sloty Wiedźmina 3 — Geralt nie nosi hełmów, pierścieni ani amuletów.)*
- **130 przedmiotów** z nazwami i rzadkościami z Wiedźmina 3: relikty (Aerondight, Deithwen,
  Azurewrath, Moonblade, Longclaw…), miecze frakcyjne, zestawy Białego Tygrysa i Dol Blathanna,
  pancerze (Zireael, Shiadhal, Thyssen…). Statystyki wygenerowane od zera i zbalansowane pod nasz silnik.
- **5 poziomów rzadkości:** ⚪ Zwykły, 🟢 Niezwykły, 🔵 Rzadki, 🟣 Epicki, 🟠 Legendarny
  (mnożniki statów rosnące z rzadkością).
- **Powinowactwo szkół** — przedmiot zgodny z Twoją Szkołą daje **+20%** do swoich statystyk
  (✨ w ekwipunku). Przedmioty neutralne pasują do każdej Szkoły.
- **Łup z lochów** — szansa na przedmiot po zwycięstwie; lepsze rzadkości w głębszych strefach
  i z elit. Statystyki przedmiotu skalują się z poziomem, na którym wypadł.
- **Sklep** — oferta odświeżana codziennie (własna dla każdego gracza), kupno i sprzedaż za korony.
- **Efektywne statystyki** — staty bazowe (z poziomu) + ekwipunek wchodzą do walki i widać je w `/profil`.

## Komendy

- `/ekwipunek` — **NOWA**: przeglądaj założone i plecak, zakładaj przedmioty z menu.
- `/sklep` — **NOWA**: kupuj (oferta dzienna) i sprzedawaj przedmioty.
- `/loch` — teraz używa efektywnych statystyk i wypuszcza łup.
- `/profil` — pokazuje statystyki z bonusem z ekwipunku.

## Instalacja (drop-in)

1. **Skopiuj** zawartość `src/` do projektu, **nadpisując** pliki.
   ⚠️ **ZACHOWAJ swój `src/db.js` i `.env`** — nie ma ich w paczce.

2. **Migracja bazy** (nieniszcząca — dodaje tabelę `items`, zachowuje postacie i przedmioty):
   ```
   node src/setup.js
   ```

3. **Zarejestruj nowe komendy** `/ekwipunek` i `/sklep`:
   ```
   node src/deploy-commands.js
   ```

4. **Odpal bota:**
   ```
   node src/index.js
   ```

## Nowe / zmienione pliki

| Plik | Status |
|------|--------|
| `src/data/items.js` | **NOWY** — katalog 130 przedmiotów (nazwy + rzadkość) |
| `src/game/equipment.js` | **NOWY** — logika: staty, powinowactwo, dropy, sklep |
| `src/game/inventory.js` | **NOWY** — plecak/ekwipunek (baza danych) |
| `src/commands/ekwipunek.js` | **NOWY** — komenda ekwipunku |
| `src/commands/sklep.js` | **NOWY** — komenda sklepu |
| `src/setup.js` | zmieniony — dodana tabela `items` |
| `src/commands/loch.js` | zmieniony — efektywne staty + łup |
| `src/commands/profil.js` | zmieniony — staty z bonusem |
| pozostałe | bez zmian |

## O nazwach i prawach

Nazwy i rzadkości przedmiotów pochodzą z assetów Wiedźmina 3 (wyciągniętych REDkitem).
Wszystkie **statystyki, balans i opisy są oryginalne**, stworzone pod nasz silnik. Część generycznych
slotów (rękawice/spodnie/buty/proste miecze) otrzymała własne polskie nazwy tematyczne zamiast
wewnętrznych identyfikatorów. To projekt fanowski, niekomercyjny.

## Strojenie (gdybyś chciał pokręcić)

- **Siła ekwipunku:** współczynnik budżetu statów w `generateItemStats` (`src/game/equipment.js`).
- **Mnożniki rzadkości / wagi dropów / ceny:** obiekt `RARITY` w `equipment.js`.
- **Szansa na drop:** `rollDrop` w `equipment.js`.
- **Premia za Szkołę:** `AFFINITY_BONUS` (domyślnie 0.2 = +20%).
- **Co wypada gdzie / przypisanie szkół:** `src/data/items.js`.
