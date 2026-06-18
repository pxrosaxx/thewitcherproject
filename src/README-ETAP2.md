# Wiedźmiński Bot — Etap 2: Lochy, Walka i Punkty Akcji

## Co nowego

- **Silnik walki turowej** — autorski system: obrażenia ze statystyk, krytyki (Szczęście),
  uniki (Zręczność), inicjatywa (Zręczność), redukcja z obrony (Witalność) z malejącymi zyskami.
- **Unikalne tożsamości Szkół w walce:**
  - 🐺 **Wilk (Wojownik)** — instynkt przetrwania (+30% obrażeń przy niskim HP), +5% redukcji.
  - 🐈‍⬛ **Kot (Zwiadowca)** — Refleks: szansa na natychmiastowy drugi cios.
  - 🦅 **Gryf (Mag Znaków)** — co turę miecz albo losowy Znak (Igni, Aard, Quen, Yrden, Axii).
  - 🐍 **Wąż (Zabójca)** — dwa ostrza = dwa ataki/turę, krytyki powodują krwawienie.
  - 🦂 **Mantykora (Alchemik)** — bomby nakładają trującą truciznę, regeneracja, odporność na DoT.
- **5 lokacji** z uniwersum Wiedźmina o rosnącej trudności (Velen → Toussaint), odblokowywanych poziomem.
- **Punkty akcji (AP)** — limit wejść do lochu, 1 AP co 15 minut (max 10).
- **Elitarne potwory** (~15% szansy) — mocniejsze, podwójne nagrody.
- **Passa zwycięstw** — premia do koron co 5 wygranych z rzędu.
- **System efektów statusowych** — podpalenie, trucizna, krwawienie, ogłuszenie, tarcza, osłabienie, dezorientacja.

## Komendy

- `/loch` — **NOWA**: wybierz lokację i walcz z potworem (kosztuje 1 AP).
- `/profil` — zaktualizowana: pokazuje punkty akcji i passę.

## Instalacja (drop-in)

1. **Skopiuj** zawartość `src/` do swojego projektu, **nadpisując** istniejące pliki.
   ⚠️ **ZACHOWAJ swój `src/db.js` i `.env`** — nie ma ich w paczce, są Twoje.

2. **Migracja bazy** (nieniszcząca — NIE kasuje istniejących postaci, tylko dodaje kolumny AP):
   ```
   node src/setup.js
   ```

3. **Zarejestruj nową komendę** `/loch`:
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
| `src/game/combat.js` | **NOWY** — silnik walki |
| `src/game/actionpoints.js` | **NOWY** — logika punktów akcji |
| `src/data/monsters.js` | **NOWY** — lokacje i potwory |
| `src/commands/loch.js` | **NOWY** — komenda lochu |
| `src/game/character.js` | zmieniony — dodana matematyka bojowa |
| `src/setup.js` | zmieniony — migracja nieniszcząca |
| `src/commands/profil.js` | zmieniony — pokazuje AP i passę |
| pozostałe | bez zmian (auto-ładowanie komend ogarnia `/loch`) |

## Strojenie balansu (gdybyś chciał pokręcić)

- **Obrażenia/mnożniki Szkół:** `SCHOOL_COMBAT` w `src/game/combat.js`.
- **Siła Znaków:** funkcja `castSign` w `src/game/combat.js`.
- **Regeneracja/odporność Mantykory:** szukaj `regen` i `dotResistance` w `combat.js`.
- **Skalowanie potworów:** `STAT_BASE`, `STAT_PER_LVL` oraz `levelOffset` lokacji w `src/data/monsters.js`.
- **Tempo regeneracji AP:** `AP_REGEN_SECONDS` w `src/game/actionpoints.js` (domyślnie 900s = 15 min).
