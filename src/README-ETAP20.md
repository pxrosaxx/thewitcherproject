# Wiedźmiński Bot — Etap 20: Paski życia i czytelniejsze walki

> Pełne `src/`. **Bez migracji bazy.** Czysto wizualne — silnik liczb walki bez zmian.

## Co nowego

Podczas walki (loch, karczma, arena) widać teraz **realne paski życia gracza i przeciwnika**,
które **maleją na żywo** klatka po klatce w trakcie animacji. Wszystkie sekcje są rozdzielone
liniami, żeby nic nie zlewało się w ścianę tekstu.

Każda klatka wygląda tak:

```
**Nazwa Potwora** — poziom 10
Lokacja · Etap 6/6
────────────────────
❤️ **Imię Gracza**
██████████████░░  240/412
💀 **Nazwa Potwora**
██████████░░░░░░  120/300
────────────────────
[log walki — odsłaniany krok po kroku]
```

## Jak to działa

- `simulateCombat` zwraca teraz **migawki HP po każdej linii logu** (`hpStates`), idealnie
  równoległe do logu — dzięki temu pasek pokazuje dokładny stan życia w danym momencie walki.
- Animacja jest napędzana **surowym logiem** (a nie skróconym), więc paski są zsynchronizowane
  co do akcji. Klatka pokazuje przesuwane okno ostatnich linii, żeby nie rosła w nieskończoność.
- Wspólny komponent `combatEmbed` (w `utils/embeds.js`) rysuje nagłówek, paski życia i log
  rozdzielone liniami — używają go loch, karczma i arena, więc wygląd jest spójny.
- Animacja jest płynniejsza (więcej klatek, krótszy odstęp), żeby spadek HP było widać.

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `src/game/combat.js` | `simulateCombat` zwraca `hpStates`, maks. HP i imiona walczących |
| `src/utils/embeds.js` | nowe `hpBar`, `combatBars`, `combatEmbed` (paski + separatory) |
| `src/commands/loch.js` | walka przez `combatEmbed`, paski malejące w animacji |
| `src/commands/tablica-zlecen.js` | jak wyżej (karczma) |
| `src/commands/arena.js` | jak wyżej (PvP — paski obu graczy) |

## Instalacja

1. Nadpisz `src/`. ⚠️ Zachowaj `src/db.js` i `.env`.
2. `node src/index.js` (bez zmian schematu i bez ponownej rejestracji komend).

## Strojenie

- **Wygląd pasków** (ikony ❤️/💀, długość): `hpBar`/`combatBars` w `utils/embeds.js`.
- **Płynność animacji**: parametry `steps` i `delayMs` w wywołaniach `revealCombat`
  (loch/karczma/arena). Więcej `steps` = płynniejszy spadek HP (ale więcej edycji wiadomości).
