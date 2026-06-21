# Wiedźmiński Bot — Etap 17: Przegląd balansu + strojenie

> Pełne `src/`. **Bez migracji bazy** — to patch logiki walki i statystyk szkół.

## Jak badałem

Symulacje całego „stacku" mocy razem: bazowe statystyki + ekwipunek (z afinacją +20%) +
komplety + skarbiec gildii + alchemia. Tysiące walk na konfigurację, przeciw bossom finałowym
wszystkich stref, plus pełna macierz PvP szkoła-vs-szkoła i testy wczesnej gry.

## Wnioski: PvE jest zdrowe

- **Onboarding gładki** — mini-bossy 90-100% dla nowicjusza.
- **Finały to ściany na poziomie**, które otwiera zamierzona progresja. Główną osią jest
  **komplet szkoły** (ogromny skok mocy), a dalej poziomy, alchemia i gildia.
- **Endgame dostępny SOLO** — najtrudniejszy boss (finał Toussaint) z samym kompletem to ~50%,
  ale **komplet + alchemia (bez gildii) = ~92%**. Gildia to ułatwienie, nie wymóg.
- **Brak treści niemożliwej** dla rozwiniętego gracza i **brak exploitu „turtlowania"** —
  nawet buildy na regeneracji wygrywają przez zabicie bossa, nie przez przeczekanie do limitu rund.
- Maksowy gracz (komplet + skarbiec 50% + alchemia) przerasta obecną treść (100% przy ~85% HP) —
  to naturalny sufit; tu w przyszłości wejdzie ewentualny endgame/prestiż.

## Co znalazłem i naprawiłem

### 1. Przewaga atakującego w PvP (inicjatywa)
Przy remisie Zręczności pierwszy uderzał zawsze „gracz", czyli w arenie atakujący — lustrzane
buildy dawały atakującemu 56-68% (najgorzej Wąż przez podwójny atak).
**Fix:** w PvP (arena + wojny gildii) remis inicjatywy jest **losowy 50/50**. Lustrzane buildy
wróciły do ~50%. (PvE bez zmian — tam gracz nadal ma pierwszeństwo przy remisie.)

### 2. Gryf był za słaby — globalnie
Gryf przegrywał z każdym w PvP (11-29%) i był najsłabszy w PvE (55-70%, ~15-25pp poniżej reszty).
Diagnoza: świetna ofensywa (Intelekt), ale za niska przeżywalność (niska Witalność, brak sustainu).
**Fix:** podniesiona **Witalność Gryfa** (baza 8→11, wzrost 2→3) — więcej życia i redukcji obrażeń,
bez ruszania jego ofensywy. Efekt: PvE **81-92%** (konkurencyjny), PvP awans do 41-61%.

### 3. Mantykora dominowała pojedynki
Sustain (wieczna regeneracja) + tankowatość czyniły ją najmocniejszą w PvP (85% vs Wilk) i na endgame.
**Fix:** regeneracja stonowana (PvE 1,8%→1,4%/turę, PvP 0,9%) — zachowuje tożsamość „wytrzymałego
alchemika", ale PvP ma teraz realne kontry (Kot i Wąż radzą sobie z Mantykorą).

## Stan po strojeniu

- **PvP**: lustrzane buildy ~50%; macierz szkół ma kontry w wielu kierunkach zamiast jednego
  dominatora i jednego chłopca do bicia.
- **PvE**: wszystkie szkoły zdrowe; każda przechodzi całą treść z pełnym zestawem narzędzi.

### Świadomie zostawione (rock-paper-scissors, nie błędy)
- **Mantykora** pozostaje najmocniejsza „na surowo" w długich walkach z bossami — to jej tożsamość
  (wytrzymałość). Inne szkoły nadrabiają alchemią/poziomami.
- **Wąż** (szybki „glass") słabnie wobec najbardziej tankowatych bossów endgame — naturalna cena
  za siłę we wczesnej/średniej grze.
- Przewaga buildu (komplet vs neutralny) w arenie jest duża, ale ranking ELO paruje podobnych.

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `src/game/combat.js` | opcja PvP: losowy remis inicjatywy + słabsza regeneracja Mantykory |
| `src/data/schools.js` | Gryf: +Witalność (baza i wzrost) |
| `src/commands/arena.js` | przekazuje flagę `pvp` do walki |
| `src/data/guild_battle.js` | przekazuje flagę `pvp` w gauntlecie |

## Instalacja (drop-in)

1. Skopiuj `src/`, **nadpisując**. ⚠️ Zachowaj `src/db.js` i `.env`.
2. (opcjonalnie) `node src/setup.js` — bez zmian schematu.
3. `node src/index.js` (nie trzeba ponownie rejestrować komend — sygnatury się nie zmieniły).

## Strojenie na przyszłość

- **Regeneracja Mantykory:** stała `regenPct` w `simulateCombat` (`src/game/combat.js`).
- **Statystyki szkół:** `baseStats`/`growth` w `src/data/schools.js`.
- Gdybyś chciał głębiej wyrównać macierz PvP (np. relację Wilk↔Mantykora), to już zadanie na
  osobny, ostrożny przebieg z analizą formuły obrażeń — sygnalizuję, nie ruszam pochopnie.
