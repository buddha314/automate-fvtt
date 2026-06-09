/**
 * Time helpers shared by the dispatcher, controls, and (later) the rules engine.
 *
 * Durations are expressed in **game seconds**. Month/year use fixed approximate
 * lengths (30 / 365 days) so behaviour is deterministic and independent of any
 * calendar module; calendar-aware day/week lengths are a later refinement.
 * @module time/time-util
 */

/** Canonical durations in seconds. */
export const SECONDS = Object.freeze({
  hour: 3600,
  day: 86400,
  week: 7 * 86400,
  month: 30 * 86400,
  year: 365 * 86400,
});

/** Ordered units for UI menus. */
export const STEP_UNITS = Object.freeze(["hour", "day", "week", "month", "year"]);

/**
 * Convert a unit + amount to seconds.
 * @param {keyof SECONDS} unit
 * @param {number} amount
 * @returns {number} seconds (0 if unit is unknown)
 */
export function toSeconds(unit, amount = 1) {
  return (SECONDS[unit] ?? 0) * (Number(amount) || 0);
}

/**
 * Number of whole intervals crossed between two world times. Deterministic and
 * idempotent across large jumps: advancing a year fires the same count whether
 * done in one step or many. Uses aligned-boundary counting
 * (`floor(to/interval) - floor(from/interval)`), so a rule that produces once
 * per interval is correct regardless of step size.
 * @param {number} fromTime  previous world time (seconds)
 * @param {number} toTime    new world time (seconds)
 * @param {number} intervalSeconds  must be > 0
 * @returns {number} count of interval boundaries crossed (>= 0 for forward time)
 */
export function intervalsElapsed(fromTime, toTime, intervalSeconds) {
  if (!(intervalSeconds > 0)) return 0;
  return Math.floor(toTime / intervalSeconds) - Math.floor(fromTime / intervalSeconds);
}

/**
 * Human-readable world time. Prefers the Foundry V13 calendar components when
 * available, else falls back to a day/HH:MM rendering of raw seconds.
 * @param {number} [worldTime=game.time.worldTime]
 * @returns {string}
 */
export function formatWorldTime(worldTime = game.time?.worldTime ?? 0) {
  const comps = game.time?.calendar?.timeToComponents?.(worldTime);
  if (comps) {
    const pad = (n) => String(n ?? 0).padStart(2, "0");
    const day = (comps.day ?? 0) + 1;
    const month = comps.month != null ? `${comps.month + 1}/` : "";
    const year = comps.year != null ? `${comps.year} ` : "";
    return `${year}${month}Day ${day} ${pad(comps.hour)}:${pad(comps.minute)}`;
  }
  const days = Math.floor(worldTime / SECONDS.day);
  const rem = worldTime - days * SECONDS.day;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  return `Day ${days} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
