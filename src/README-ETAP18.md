# Wiedźmiński Bot — Etap 18: Przebudowa itemów i setów

> Pełne `src/`. **Bez migracji bazy** — zmiana danych itemów i logiki dropów.
> Tabela `items` ma już kolumnę `school`, więc istniejący sprzęt graczy zostaje nietknięty.

## Dlaczego

Dwa problemy zgłoszone słusznie: (1) itemy dawały za mało statów, (2) prawie KAŻDY item był
otagowany jako „szkolny" (121 ze 139!), więc sety leciały wszędzie — nawet w sklepie do kupienia.
Wiedźmiński rynsztunek to konkretny komplet: **6 części na szkołę**, nie losowy sprzęt.

## Co się zmieniło

### 1. Itemy dają więcej statów (umiarkowanie)
Budżet w `generateItemStats`: z `(1 + poziom×0.15)×rzadkość` na **`(2 + poziom×0.20)×rzadkość`**.
Zwykłe itemy nie dają już +1, a rzadkie/legendarne biją mocniej (np. „Miecz Szkoły Wilka" r2
na poz.30: str+8 zamiast +5).

### 2. Prawdziwe sety — 30 części, 6 na szkołę
`src/data/items.js` przebudowany:
- **`ITEMS` (130 szt.)** — sprzęt NEUTRALNY (bez szkoły). Źródło: sklep, karczma, zwykłe potwory.
  Neutralna broń rozkłada atak na trzy cechy (wypełniacz), więc dla Twojej szkoły jest słabsza
  od części setowej (skoncentrowanej) — to celowe.
- **`SET_ITEMS` (30 szt.)** — wiedźmiński rynsztunek: 6 slotów × 5 szkół
  (Miecz/Napierśnik/Rękawice/Spodnie/Buty/Kusza „Szkoły [X]"). To JEDYNE części setowe.

### 3. Sety rzadkie i tylko z lochów
- **Sklep i karczma:** wyłącznie neutralne (zero setów na sprzedaż/w dropie).
- **Zwykłe potwory w lochu:** neutralne.
- **Bossowie lochów:** 30% szansy na część rynsztunku — **dla Twojej szkoły**, z lepszą rzadkością.
- **Mini-bossy (elity):** 12% szansy na część — dla Twojej szkoły.
- Rzadkość części nadawana przy dropie (głębsze strefy = lepsza). Część setowa pokazuje się
  w wyniku walki osobno, wyróżniona: „⚔️ Część rynsztunku!".

## Skutek dla rozgrywki

- Oś progresji to teraz **grind części swojej szkoły z lochów**, a nie kupowanie setu za korony.
- Sprzęt z setem wyraźnie bije neutralny (Toussaint finał: set 72% vs neutralny 13%).
- Endgame jest bramkowany **zdobyciem rynsztunku**, nie surową trudnością bossów.
- Liczby finałów (Wilk, pełny set Epicki vs neutralny): Velen 99/65, Skellige 99/74,
  KaerMorhen 93/44, Toussaint 72/13.

## Uwaga o istniejących postaciach

Stare itemy graczy mają zamrożoną przynależność w bazie, więc **stary „szkolny" sprzęt nadal
liczy się do setu** (grandfathering). Nowe dropy i nowi gracze działają już wg nowych zasad.
Jeśli wolisz twardy reset, można wyczyścić stare itemy szkolne — daj znać.

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `src/data/items.js` | 130 neutralnych + 30 setowych, mapa `SET_BY_SCHOOL` |
| `src/game/equipment.js` | buff budżetu; `makeSetDrop`/`rollSetDrop`; sklep/drop = neutralne |
| `src/commands/loch.js` | dropy setów (boss 30%, elita 12%) dla szkoły gracza |

## Instalacja

1. Nadpisz `src/`. ⚠️ Zachowaj `src/db.js` i `.env`.
2. `node src/index.js` (bez zmian schematu i bez ponownej rejestracji komend).

## Strojenie

- **Siła itemów:** współczynnik `0.20` i baza `2` w `generateItemStats`.
- **Szanse na set:** `setChance` w `loch.js` (boss 0.30, elita 0.12).
- **Rzadkość setów:** `Math.max(2, ...)` w `makeSetDrop`.
