// Logika punktow akcji (AP) - ograniczaja liczbe wejsc do lochu i odnawiaja sie z czasem.

const AP_REGEN_SECONDS = 900; // 1 punkt akcji co 15 minut

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Przelicza i zapisuje aktualne punkty akcji gracza na podstawie uplynietego czasu.
 * Modyfikuje obiekt `player` w miejscu i zapisuje zmiany do bazy.
 * Zwraca { points, max, secondsToNext } gdzie secondsToNext = ile sekund do +1 AP
 * (0 jesli pelne).
 */
async function refreshActionPoints(db, player) {
    const max = player.max_action_points || 10;
    let ap = player.action_points ?? max;
    let last = player.last_ap_update || 0;
    const now = nowSec();

    // Pierwsze uzycie / stary rekord bez znacznika czasu - inicjalizujemy.
    if (last === 0) {
        last = now;
    }

    if (ap < max) {
        const elapsed = now - last;
        const gained = Math.floor(elapsed / AP_REGEN_SECONDS);
        if (gained > 0) {
            ap = Math.min(max, ap + gained);
            // Przesuwamy znacznik o wykorzystany czas (reszta sekund sie przenosi).
            last = ap >= max ? now : last + gained * AP_REGEN_SECONDS;
        }
    } else {
        // Przy pelnych AP nie bankujemy czasu.
        last = now;
    }

    player.action_points = ap;
    player.last_ap_update = last;

    await db.run(
        'UPDATE players SET action_points = ?, last_ap_update = ? WHERE discord_id = ?',
        ap, last, player.discord_id
    );

    const secondsToNext = ap >= max ? 0 : AP_REGEN_SECONDS - (now - last);
    return { points: ap, max, secondsToNext };
}

/** Wydaje 1 punkt akcji (zaklada, ze wczesniej sprawdzono ze jest > 0). */
async function spendActionPoint(db, player) {
    player.action_points = Math.max(0, (player.action_points || 0) - 1);
    // Jesli schodzimy z pelnych AP, ustawiamy znacznik startu regeneracji.
    if (player.last_ap_update === 0 || player.action_points === (player.max_action_points || 10) - 1) {
        player.last_ap_update = nowSec();
    }
    await db.run(
        'UPDATE players SET action_points = ?, last_ap_update = ? WHERE discord_id = ?',
        player.action_points, player.last_ap_update, player.discord_id
    );
}

/** Formatuje sekundy na czytelny zapis "5m 30s". */
function formatDuration(seconds) {
    if (seconds <= 0) return 'pełne';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

module.exports = { AP_REGEN_SECONDS, refreshActionPoints, spendActionPoint, formatDuration };
