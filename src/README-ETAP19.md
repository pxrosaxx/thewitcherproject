# Wiedźmiński Bot — Etap 19: Lochy do samodzielnego tworzenia

> Pełne `src/`. **Bez migracji bazy.** Komenda `/loch` i kreator `/loch-kreator` zostają.

## Co się zmieniło

Wbudowane lochy (Velen, Novigrad, Skellige, Kaer Morhen, Toussaint) i ich potwory **zostały
usunięte**. Teraz to Ty definiujesz lochy i potwory. Karczma (zlecenia) działa bez zmian — ma
własną pulę potworów, niezależną od lochów.

## Dwa sposoby tworzenia lochów

### 1. W pliku danych (pełna kontrola) — `src/data/dungeons.js`
Edytujesz obiekt `DUNGEONS`. Każdy loch to klucz z polami `name`, `minLevel` i listą `stages`
(etapów). Ostatni etap to automatycznie boss finałowy (mocniejszy, +1 poziom, lepsze nagrody,
większa szansa na część rynsztunku). W pliku jest gotowy szablon z komentarzem. Przykład:

```js
const DUNGEONS = {
    mokradla_velen: {
        name: 'Mokradła Velen', minLevel: 1,
        stages: [
            { name: 'Stary Utopiec', kind: 'default', offense: 'str', weaponMult: 1.6, hpMult: 1.1, traits: ['venomous'] },
            { name: 'Topielec',      kind: 'frenzy',  offense: 'str', weaponMult: 1.6, hpMult: 1.2, traits: ['frenzy'] },
            { name: 'Bies',          kind: 'frenzy',  offense: 'str', weaponMult: 1.9, hpMult: 1.4, traits: ['frenzy'] }
        ]
    }
};
```

Pola potwora:
- `kind` — profil statystyk: `default` | `fast` | `frenzy` | `armored` | `caster`
- `offense` — główna cecha ataku: `str` | `dex` | `intel`
- `weaponMult` — siła ataku (mini-boss max 1.6, finałowy max 1.75)
- `hpMult` — żywotność (mini-boss max 1.3, finałowy max 1.5)
- `traits` — cechy bojowe: `'venomous'` (trucizna), `'frenzy'` (szał), `'lifesteal'` (wampiryzm)
- `imageUrl` — (opcjonalne) URL grafiki potwora

Liczba etapów jest dowolna (np. 3, 6, 10). Poziomy etapów rosną od `minLevel` o +1 na etap.

### 2. W grze — `/loch-kreator` (administrator)
Tworzysz lochy i dodajesz potwory bez ruszania kodu (potwory na bazie archetypów). Bez zmian
względem wcześniejszych etapów.

## Co zostało nietknięte

- `/loch`, `/loch-kreator`, postęp w lochach, dropy części rynsztunku (z Etapu 18).
- Karczma i zlecenia (własna pula potworów).
- Kreator własnych lochów używa tego samego silnika bossów (`buildStageBoss`).

## Uwagi

- Gdy nie ma zdefiniowanego żadnego lochu, `/loch` pokazuje czytelny komunikat.
- **Stary postęp graczy** w usuniętych lochach (np. „velen") staje się bezczynny — nie pasuje do
  żadnego lochu i nie przeszkadza. Nowe lochy mają własne klucze i świeży postęp. Migracja zbędna.
- Jeśli chcesz odtworzyć stare potwory jako punkt wyjścia, ich definicje znajdziesz w pakiecie
  z poprzedniego etapu (w starym `data/dungeons.js`) — wystarczy je wkleić do nowej struktury.

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `src/data/dungeons.js` | wbudowane lochy usunięte; pusta struktura `DUNGEONS` + szablon; samodzielna (odpięta od `LOCATIONS`) |
| `src/data/dungeon_registry.js` | listuje lochy z `DUNGEONS` (zamiast z lokacji karczmy) |
| `src/commands/loch.js` | komunikat przy braku lochów |

## Instalacja

1. Nadpisz `src/`. ⚠️ Zachowaj `src/db.js` i `.env`.
2. Dodaj własne lochy w `src/data/dungeons.js` (albo użyj `/loch-kreator`).
3. `node src/index.js` (bez zmian schematu, bez ponownej rejestracji komend).
