# Wiedźmiński Bot — Etap 16: Wojny gildii (Gildenkampf)

> Pełne `src/`. **Nowe kolumny w tabeli `guilds`** (migracja nieniszcząca — działa też na bazie z Etapu 15).

## Co nowego

**`/gildia wojna nazwa:`** — wypowiadasz wojnę innej gildii (lider/oficer). Bitwa rozstrzyga się
od razu (PvP asynchroniczne, jak w SFGame).

### Jak działa bitwa

Szyki obu gildii (do 15 zawodników, słabsi z przodu) stają do sekwencji pojedynków w stylu
**„król wzgórza"**: zwycięzca walczy dalej **z resztką życia** przeciw kolejnemu, wypoczętemu
wrogowi — aż jedna strona zostanie wybita. Silny „kotwiczący" członek może sam dobić osłabiony
szyk przeciwnika. Każdy zawodnik staje z pełnym ekwipunkiem i bonusem skarbca swojej gildii.

Log pojedynków odsłania się **krok po kroku** (jak walki w lochu/arenie), a na końcu pojawia się
wynik i nagrody.

### Nagrody i ranking

- Zwycięska gildia: **+30 chwały**, **+80 koron dla każdego członka**, +1 do rekordu zwycięstw.
- Przegrana gildia: **−20 chwały** (min. 0), +1 do rekordu porażek.
- Chwała wojenna wpływa na **`/gildia ranking`** (obok etapu portalu i budynków).
- Cooldown **1 godzina** dla atakującego (niezależnie od wyniku) — bez spamu wojnami.

### Karta gildii i ranking

`/gildia info` pokazuje teraz chwałę i rekord wojen, a `/gildia ranking` — chwałę i bilans W/P.

### Nowe osiągnięcie

**Wódz Wojenny** — wygraj 5 wojen gildii (tytuł). W grze jest teraz **36 osiągnięć**.

## Instalacja (drop-in)

1. Skopiuj `src/`, **nadpisując**. ⚠️ Zachowaj `src/db.js` i `.env`.
2. `node src/setup.js` — dodaje kolumny `war_wins`, `war_losses`, `guild_honor`, `last_war` do `guilds`.
3. `node src/deploy-commands.js` — aktualizuje `/gildia` (nowa podkomenda `wojna`).
4. `node src/index.js`

## Nowe / zmienione pliki

| Plik | Status |
|------|--------|
| `src/data/guild_battle.js` | **NOWY** — szyki, gauntlet „król wzgórza", nagrody |
| `src/commands/gildia.js` | podkomenda `wojna` + chwała/rekord w `info` i `ranking` |
| `src/data/guilds.js` | chwała wojenna w wyniku rankingowym |
| `src/data/achievements.js` | osiągnięcie „Wódz Wojenny" |
| `src/data/help.js` | opis wojen gildii |
| `src/setup.js` | kolumny wojenne w `guilds` (CREATE + migracje) |

## Strojenie

- **Rozmiar szyku, cooldown, nagrody, chwała:** stałe na górze `src/data/guild_battle.js`
  (`GUILD_BATTLE_SIZE`, `WAR_COOLDOWN`, `WIN_HONOR`, `LOSS_HONOR`, `MEMBER_REWARD`).
- **Kolejność szyku:** w `buildLineup` (domyślnie słabsi z przodu — silny kończy).

## Uwaga balansowa

Przenoszenie HP między pojedynkami premiuje **głębię składu i silnych liderów drużyny**, a nie tylko
jednego mocarza. Bonus skarbca liczony jest dla obu stron z ich własnych gildii — bitwa jest uczciwa.
