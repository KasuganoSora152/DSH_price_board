/**
 * Pure pricing / calendar logic for the API price board.
 *
 * Data source: DeepSeek official "Models & Pricing" page, checked 2026-10-21:
 *   https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 *
 * Peak: Beijing time, Monday-Friday, 09:00-12:00 and 14:00-18:00, excluding
 * Chinese statutory holidays. Everything else (weekends, holidays, lunch,
 * evenings) is off-peak. Off-peak = peak x 0.5.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const BEIJING_OFFSET_MS = 8 * 60 * MINUTE_MS;

/** Official peak windows, minutes from Beijing midnight, half-open. */
export const PEAK_WINDOWS = Object.freeze([
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]);

/** 2026 statutory holidays (dates, not the make-up weekend workdays). */
export const HOLIDAYS_2026 = Object.freeze([
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07',
]);

export const HOLIDAY_YEARS = Object.freeze([2026]);

const HOLIDAY_SET = new Set(HOLIDAYS_2026);

/** Prices are CNY per one million tokens. Only peak prices are listed. */
export const PRICING = Object.freeze({
  currency: 'CNY',
  unit: 'perMillionTokens',
  verifiedAt: '2026-10-21',
  offPeakMultiplier: 0.5,
  models: Object.freeze([
    {
      id: 'deepseek-flash',
      label: 'DeepSeek V4.1 Flash',
      aliases: [
        'deepseek-flash',
        'deepseek-v4-flash',
        'deepseek-v4-flash-vision-exp',
        'deepseek-v4.1-flash',
      ],
      peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    },
    {
      id: 'deepseek-v4-pro',
      label: 'DeepSeek V4 Pro',
      aliases: ['deepseek-v4-pro', 'deepseek-v4-pro-0813'],
      peak: { cacheHit: 0.3, cacheMiss: 9, output: 27 },
    },
  ]),
  services: Object.freeze([
    {
      id: 'search',
      label: 'Search',
      price: 5,
      unit: 'per1000SuccessfulRequests',
    },
    {
      id: 'fetch',
      label: 'Fetch',
      price: 5,
      unit: 'per1000SuccessfulRequests',
    },
  ]),
});

/** DSH/Claude Code/Codex server-side Search/Fetch calls are free until this instant. */
export const SERVICE_WAIVER_UNTIL = '2026-11-01T00:00:00+08:00';
export const SERVICE_WAIVER_UNTIL_MS = Date.parse(SERVICE_WAIVER_UNTIL);

/** @param {number} ms - epoch milliseconds. @returns {boolean} */
export function isHoliday(ms) {
  const parts = beijingParts(ms);
  return HOLIDAY_SET.has(parts.dateKey);
}

/**
 * Break an instant into Beijing wall-clock fields without relying on the host TZ.
 * @param {number} ms - epoch milliseconds.
 * @returns {{year:number,month:number,day:number,weekday:number,minutes:number,dateKey:string,dayStartMs:number}}
 */
export function beijingParts(ms) {
  const shifted = new Date(ms + BEIJING_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    weekday: shifted.getUTCDay(),
    minutes: hour * 60 + minute,
    dateKey,
    dayStartMs: Date.UTC(year, month - 1, day) - BEIJING_OFFSET_MS,
  };
}

/** @param {{weekday:number,dateKey:string}} parts @returns {boolean} */
export function isWorkday(parts) {
  return parts.weekday >= 1 && parts.weekday <= 5 && !HOLIDAY_SET.has(parts.dateKey);
}

/** @param {{weekday:number,dateKey:string,minutes:number}} parts @returns {boolean} */
export function isPeakParts(parts) {
  if (!isWorkday(parts)) return false;
  return PEAK_WINDOWS.some(([start, end]) => parts.minutes >= start && parts.minutes < end);
}

/**
 * The next peak/off-peak boundary at or after `now`.
 * @param {number} now - epoch milliseconds.
 * @returns {{at:number, nextPeriod:'peak'|'offpeak'}}
 */
export function nextTransition(now) {
  const parts = beijingParts(now);
  if (isPeakParts(parts)) {
    const window = PEAK_WINDOWS.find(([start, end]) => parts.minutes >= start && parts.minutes < end);
    return { at: parts.dayStartMs + window[1] * MINUTE_MS, nextPeriod: 'offpeak' };
  }
  if (isWorkday(parts)) {
    if (parts.minutes < 9 * 60) {
      return { at: parts.dayStartMs + 9 * 60 * MINUTE_MS, nextPeriod: 'peak' };
    }
    if (parts.minutes >= 12 * 60 && parts.minutes < 14 * 60) {
      return { at: parts.dayStartMs + 14 * 60 * MINUTE_MS, nextPeriod: 'peak' };
    }
  }
  return { at: nextWorkdayStart(parts), nextPeriod: 'peak' };
}

/** @param {{dayStartMs:number}} parts @returns {number} */
function nextWorkdayStart(parts) {
  let start = parts.dayStartMs;
  for (let i = 0; i < 370; i += 1) {
    start += DAY_MS;
    const candidate = beijingParts(start);
    if (isWorkday(candidate)) return start + 9 * 60 * MINUTE_MS;
  }
  // 370 days without a workday is impossible under the Chinese calendar; keep
  // the function total rather than throwing in a render path.
  return parts.dayStartMs + DAY_MS + 9 * 60 * MINUTE_MS;
}

/**
 * Current period and countdown.
 * @param {number} [now] - epoch milliseconds.
 * @returns {{period:'peak'|'offpeak', nextPeriod:'peak'|'offpeak', nextAt:number, msUntilSwitch:number, parts:object}}
 */
export function statusAt(now = Date.now()) {
  const parts = beijingParts(now);
  const peak = isPeakParts(parts);
  const next = nextTransition(now);
  return {
    period: peak ? 'peak' : 'offpeak',
    nextPeriod: next.nextPeriod,
    nextAt: next.at,
    msUntilSwitch: Math.max(0, next.at - now),
    parts,
  };
}

/** @param {number} ms @returns {string} */
export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  return `${minutes}分`;
}

/** @param {number} value @returns {string} e.g. `¥2.00` */
export function formatCny(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `¥${number.toFixed(2)}`;
}

/** @param {string} raw @returns {number|undefined} */
export function parseAmount(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  const number = Number(raw.trim());
  return Number.isFinite(number) ? number : undefined;
}

/** @param {number} value @param {string} [symbol] @returns {string} */
export function formatBalance(value, symbol = '¥') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number > 0 && number < 0.01) return `<${symbol}0.01`;
  return `${symbol}${number.toFixed(2)}`;
}

/**
 * Normalize the model selection projection / event into a pricing row.
 * @param {unknown} raw - `modelSelection` projection, or a selection object.
 * @returns {{status:'known'|'unknown'|'provider'|'missing', provider?:string, model?:string, effort?:string, label?:string, info?:object}}
 */
export function resolveModel(raw) {
  let chosen = raw !== null && typeof raw === 'object' && (raw.next !== undefined || raw.lastUsed !== undefined)
    ? (raw.next ?? raw.lastUsed)
    : raw;
  if (chosen !== null && typeof chosen === 'object' && chosen.provider === undefined && chosen.model === undefined) {
    const nested = chosen.current ?? chosen.selected ?? chosen.value;
    if (nested !== null && typeof nested === 'object') chosen = nested;
  }
  if (chosen === null || typeof chosen !== 'object') return { status: 'missing' };
  const provider = typeof chosen.provider === 'string' ? chosen.provider : '';
  const model = typeof chosen.model === 'string' ? chosen.model : '';
  const effort = typeof chosen.reasoningEffort === 'string' && chosen.reasoningEffort !== ''
    ? chosen.reasoningEffort
    : undefined;
  if (provider === '' && model === '') return { status: 'missing' };
  if (provider !== '' && !provider.toLowerCase().startsWith('deepseek')) {
    return { status: 'provider', provider, model, effort };
  }
  const info = findModel(model);
  if (info === undefined) return { status: 'unknown', provider, model, effort };
  return { status: 'known', provider, model: info.id, effort, label: info.label, info };
}

/** @param {string} model @returns {object|undefined} */
function findModel(model) {
  const id = model.toLowerCase();
  const exact = PRICING.models.find((entry) => entry.aliases.includes(id));
  if (exact !== undefined) return exact;
  if (id.startsWith('deepseek-v4-pro')) return PRICING.models.find((entry) => entry.id === 'deepseek-v4-pro');
  if (id.startsWith('deepseek-v4-flash') || id.startsWith('deepseek-flash')) {
    return PRICING.models.find((entry) => entry.id === 'deepseek-flash');
  }
  return undefined;
}

/**
 * @param {object} info - model info from resolveModel.
 * @param {'peak'|'offpeak'} period - current period.
 * @returns {{cacheHit:number, cacheMiss:number, output:number, multiplier:number}}
 */
export function priceFor(info, period) {
  const multiplier = period === 'offpeak' ? PRICING.offPeakMultiplier : 1;
  return {
    cacheHit: info.peak.cacheHit * multiplier,
    cacheMiss: info.peak.cacheMiss * multiplier,
    output: info.peak.output * multiplier,
    multiplier,
  };
}

/**
 * Search/Fetch price state. The official list price is always 5 CNY per 1,000
 * successful requests; DSH's server-side tool calls are waived until 11/1.
 * @param {number} [now] - epoch milliseconds.
 */
export function serviceState(now = Date.now()) {
  return {
    services: PRICING.services,
    listPrice: 5,
    free: now < SERVICE_WAIVER_UNTIL_MS,
    until: SERVICE_WAIVER_UNTIL_MS,
  };
}
