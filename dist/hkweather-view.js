// Config handling and the HTML for each badge and the card. Pure functions: the elements in
// hkweather.js only put this HTML into their shadow roots and wire up events.

// HA serves /local files with a month-long cache, so the ?v= of the entry file is passed on to
// every import; a static import would keep loading the old copy after an update.
const version = new URL(import.meta.url).search;
const { DEFAULT_STATION, WEATHER, parseCurrent, parseWarnings } = await import(`./hkweather-data.js${version}`);
const { formatTime, strings } = await import(`./hkweather-i18n.js${version}`);

export const CONTENT_PARTS = ["description", "temperature", "humidity"];
const LANGUAGE_SETTINGS = ["auto", "tc", "sc", "en"];

const DEFAULTS = {
  weather: { content: ["description"], station: DEFAULT_STATION },
  warnings: { show_empty: false, show_names: false },
  card: { content: ["description", "temperature"], station: DEFAULT_STATION, show_weather: true, show_warnings: true },
};

/** Fills in defaults and rejects settings the elements cannot use. */
export function normalizeConfig(config, kind) {
  if (!config || typeof config !== "object") throw new Error("Invalid configuration");
  // A field cleared in the editor arrives as undefined or "", which must not hide the default.
  const given = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== ""));
  const merged = {
    language: "auto", refresh_minutes: 5, tap_action: { action: "none" }, ...DEFAULTS[kind], ...given,
  };
  if (!LANGUAGE_SETTINGS.includes(merged.language)) {
    throw new Error(`language must be one of ${LANGUAGE_SETTINGS.join(", ")}`);
  }
  const minutes = Number(merged.refresh_minutes);
  if (!Number.isFinite(minutes) || minutes < 1) throw new Error("refresh_minutes must be at least 1");
  merged.refresh_minutes = minutes;
  if ("content" in merged) {
    const content = Array.isArray(merged.content) ? merged.content : [merged.content];
    const unknown = content.filter((part) => !CONTENT_PARTS.includes(part));
    if (unknown.length) throw new Error(`content can only list ${CONTENT_PARTS.join(", ")}`);
    merged.content = content;
  }
  return merged;
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
// Tooltips: one line per entry.
const title = (lines) => escapeHtml(lines.filter(Boolean).join("\n")).replace(/\n/g, "&#10;");

/** Out-of-date note when any endpoint this element reads failed on its last try. */
export function staleNote(state, endpoints, lang) {
  const failed = endpoints.filter((type) => state.failed.has(type));
  if (!failed.length) return "";
  const times = failed.map((type) => state.updated[type]).filter((time) => typeof time === "number");
  if (!times.length) return strings(lang).staleNoTime;
  return strings(lang).stale(formatTime(new Date(Math.min(...times)), lang));
}

const unavailableBadge = (message, text) =>
  `<ha-badge class="error" title="${title([message, text.source])}">`
  + `<ha-icon slot="icon" icon="mdi:cloud-alert"></ha-icon>${escapeHtml(message)}</ha-badge>`;

function weatherParts(current, content, lang) {
  const text = strings(lang);
  const parts = [];
  for (const part of content) {
    if (part === "description" && WEATHER[current.icon]) parts.push(WEATHER[current.icon][lang]);
    if (part === "temperature" && current.temperature !== null) parts.push(`${current.temperature}°C`);
    if (part === "humidity" && current.humidity !== null) parts.push(`${text.humidity} ${current.humidity}%`);
  }
  return parts;
}

// The official icon, or the matching Material Design icon once it has failed to load.
function weatherIcon(current, broken, slot = 'slot="icon" ') {
  const mdi = WEATHER[current.icon]?.mdi ?? "mdi:weather-partly-cloudy";
  if (!current.iconUrl || broken.has(current.iconUrl)) return `<ha-icon ${slot}icon="${mdi}"></ha-icon>`;
  return `<img ${slot}src="${escapeHtml(current.iconUrl)}" alt="" data-fallback="${mdi}">`;
}

/**
 * @returns {{hidden: boolean, html: string}} nothing is shown until the first fetch finishes,
 * so a slow network does not flash an error.
 */
export function weatherBadgeView(config, state, lang, broken = new Set()) {
  if (!state) return { hidden: true, html: "" };
  const text = strings(lang);
  const current = parseCurrent(state.data.rhrread, config.station);
  if (!current || current.icon === null) {
    return state.failed.has("rhrread") ? { hidden: false, html: unavailableBadge(text.weatherUnavailable, text) } : { hidden: true, html: "" };
  }
  const parts = weatherParts(current, config.content, lang);
  const stale = staleNote(state, ["rhrread"], lang);
  const description = WEATHER[current.icon]?.[lang] ?? "";
  const classes = ["weather", stale && "stale"].filter(Boolean).join(" ");
  const html = `<ha-badge class="${classes}"${parts.length ? "" : " icon-only"} `
    + `title="${title([description, stale, text.source])}">`
    + `${weatherIcon(current, broken)}${escapeHtml(parts.join(text.listSeparator))}</ha-badge>`;
  return { hidden: false, html };
}

function warningTitle(warning, lang) {
  const time = warning.issueTime ? formatTime(warning.issueTime, lang) : "";
  return time ? `${warning.names[lang]}${strings(lang).issued(time)}` : warning.names[lang];
}

/** One warning: the official icon in a round frame, or a coloured dot and short name. */
function warningBadge(warning, lang, { showName, broken, stale, extraTitle }) {
  const label = warningTitle(warning, lang);
  const tip = title([label, extraTitle, strings(lang).source]);
  const classes = ["warning", stale && "stale"].filter(Boolean).join(" ");
  const iconOk = warning.icon && !broken.has(warning.icon);
  if (iconOk) {
    const disc = `<span slot="icon" class="disc" style="background:${warning.background}">`
      + `<img src="${escapeHtml(warning.icon)}" alt="${escapeHtml(warning.names[lang])}"></span>`;
    return showName
      ? `<ha-badge class="${classes}" title="${tip}">${disc}${escapeHtml(warning.short[lang])}</ha-badge>`
      : `<ha-badge class="${classes}" icon-only title="${tip}">${disc}</ha-badge>`;
  }
  return `<ha-badge class="${classes} text" title="${tip}">`
    + `<span slot="icon" class="dot" style="background:${warning.color}"></span>`
    + `${escapeHtml(warning.short[lang])}</ha-badge>`;
}

const WARNING_ENDPOINTS = ["warnsum", "warningInfo"];

export function warningsBadgeView(config, state, lang, now = Date.now(), broken = new Set()) {
  if (!state) return { hidden: true, html: "" };
  const text = strings(lang);
  const { warnsum, warningInfo } = state.data;
  if (warnsum === undefined) {
    return state.failed.has("warnsum") ? { hidden: false, html: unavailableBadge(text.warningsUnavailable, text) } : { hidden: true, html: "" };
  }
  const stale = staleNote(state, WARNING_ENDPOINTS, lang);
  const list = parseWarnings(warnsum, warningInfo, now);
  if (!list.length) {
    if (!config.show_empty) return { hidden: true, html: "" };
    return {
      hidden: false,
      html: `<ha-badge class="none${stale ? " stale" : ""}" title="${title([stale, text.source])}">`
        + `<ha-icon slot="icon" icon="mdi:check-circle-outline"></ha-icon>${escapeHtml(text.noWarnings)}</ha-badge>`,
    };
  }
  const options = { showName: config.show_names, broken, stale: Boolean(stale), extraTitle: stale };
  return { hidden: false, html: list.map((warning) => warningBadge(warning, lang, options)).join("") };
}

/** The card: current weather on the left, warning icons on the right, source underneath. */
export function cardView(config, state, lang, now = Date.now(), broken = new Set()) {
  const text = strings(lang);
  if (!state) return `<ha-card><div class="row loading"></div></ha-card>`;
  const endpoints = [config.show_weather && "rhrread", ...(config.show_warnings ? WARNING_ENDPOINTS : [])]
    .filter(Boolean);
  const stale = staleNote(state, endpoints, lang);
  let weather = "";
  if (config.show_weather) {
    const current = parseCurrent(state.data.rhrread, config.station);
    if (current && current.icon !== null) {
      const [first, ...rest] = weatherParts(current, config.content, lang);
      weather = `<div class="current">${weatherIcon(current, broken, "")}`
        + `<div class="text"><div class="primary">${escapeHtml(first ?? "")}</div>`
        + `<div class="secondary">${escapeHtml(rest.join(text.listSeparator))}</div></div></div>`;
    } else if (state.failed.has("rhrread")) {
      weather = `<div class="current"><ha-icon icon="mdi:cloud-alert"></ha-icon>`
        + `<div class="text"><div class="primary">${escapeHtml(text.weatherUnavailable)}</div></div></div>`;
    }
  }
  let warnings = "";
  if (config.show_warnings && state.data.warnsum !== undefined) {
    const list = parseWarnings(state.data.warnsum, state.data.warningInfo, now);
    warnings = list.length
      ? list.map((warning) => {
        const tip = title([warningTitle(warning, lang)]);
        return warning.icon && !broken.has(warning.icon)
          ? `<span class="disc" title="${tip}" style="background:${warning.background}">`
            + `<img src="${escapeHtml(warning.icon)}" alt="${escapeHtml(warning.names[lang])}"></span>`
          : `<span class="chip" title="${tip}"><span class="dot" style="background:${warning.color}"></span>`
            + `${escapeHtml(warning.short[lang])}</span>`;
      }).join("")
      : (config.show_empty ? `<span class="none">${escapeHtml(text.noWarnings)}</span>` : "");
  }
  const footer = [text.source, stale].filter(Boolean).map(escapeHtml).join(text.listSeparator);
  return `<ha-card><div class="row">${weather}<div class="warnings">${warnings}</div></div>`
    + `<div class="footer${stale ? " stale" : ""}">${footer}</div></ha-card>`;
}
