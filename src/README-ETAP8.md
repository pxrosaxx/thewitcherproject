# Wiedźmiński Bot — Etap 8: Komplety ekwipunku (set bonusy)

> Pełne `src/` (zawiera wszystko z poprzednich etapów). **Brak nowych migracji bazy.**

## Komplety szkół

Każda szkoła ma swój **komplet** (część szkoły = przedmiot z polem `school`).
Noszenie wielu części tej samej szkoły daje rosnący bonus statystyk:

- **2 części** — mały bonus
- **4 części** — średni (skok ×3)
- **6 części (pełen komplet)** — duży (skok ×6)

Bonus **skaluje się z poziomem sprzętu** (wzmacniaj części u kowala, by rósł).
Każdy komplet wzmacnia staty zgodne z tożsamością szkoły:

| Komplet | Wzmacnia |
|---------|----------|
| Wilka | Siła, Witalność |
| Kota | Zręczność, Szczęście |
| Gryfa | Inteligencja, Witalność |
| Żmii | Zręczność, Szczęście |
| Mantykory | Inteligencja, Witalność |

Komplet **własnej szkoły** korzysta dodatkowo z premii afinacji (+20%) na każdej
części — dlatego budowanie pod swoją klasę jest najsilniejsze, ale można też zebrać
komplet innej szkoły jako wybór buildu (traci się wtedy afinację).

## Jak to działa w walce

Bonus kompletu jest doliczany w `effectiveStats`, więc **automatycznie** uwzględniają go
loch, karczma i arena. W symulacjach pełny komplet (r3) podnosi szansę na trudnych
bossów o **~14–17 pkt procentowych** (np. 75% → 92%) — odczuwalna nagroda za
skompletowanie, bez psucia balansu.

## Komenda `/komplety`

Kodeks wszystkich pięciu kompletów: co wzmacniają, ile części masz **założonych** i ile
slotów **posiadasz** (oraz których brakuje). Twoja szkoła jest oznaczona.
`/ekwipunek` pokazuje teraz aktywne komplety w podsumowaniu.

## Uzupełnienie puli przedmiotów

Pula z W3 miała mnóstwo broni, ale Wąż i Mantykora nie mieli części zbroi na wszystkie
sloty — komplet był dla nich niewykonalny. Dodano **9 brakujących części**
(„Szkoły Żmii" / „Szkoły Mantykory"), dzięki czemu **każda szkoła może skompletować
pełny set 6 slotów**. Nowe części normalnie dropią i można je kupić/wzmocnić.

## Instalacja (drop-in)

1. Skopiuj `src/`, **nadpisując**. ⚠️ Zachowaj `src/db.js` i `.env`.
2. `node src/setup.js` — bez nowych kolumn, ale uruchom dla pewności (nieniszczące).
3. `node src/deploy-commands.js` — rejestruje `/komplety`.
4. `node src/index.js`

## Nowe / zmienione pliki

| Plik | Status |
|------|--------|
| `src/commands/komplety.js` | **NOWY** — kodeks kompletów + postęp |
| `src/game/equipment.js` | `SET_DEF`, `setBonus`, `activeSets`; bonus wpięty w `effectiveStats` |
| `src/data/items.js` | +9 części (sloty Węża i Mantykory) |
| `src/commands/ekwipunek.js` | sekcja „Aktywne komplety" |

## Strojenie

- **Siła kompletów:** `SET_FACTOR` (skala z poziomem) i `setTierMult` (progi 2/4/6) w `equipment.js`.
- **Profil statów kompletu:** `SET_DEF` w `equipment.js` (które staty wzmacnia dana szkoła).
