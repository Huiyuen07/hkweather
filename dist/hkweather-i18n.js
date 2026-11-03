// Text shown by the badges and the card. Keys match the code tables in hkweather-data.js.

export const LANGUAGES = {
  tc: { name: "繁體中文", tag: "zh-HK" },
  sc: { name: "简体中文", tag: "zh-CN" },
  en: { name: "English", tag: "en" },
};

const STRINGS = {
  tc: {
    source: "資料來源：香港天文台",
    noWarnings: "現時沒有警告",
    weatherUnavailable: "未能取得天氣",
    warningsUnavailable: "未能取得警告",
    issued: (time) => `（${time} 發出）`,
    stale: (time) => `更新失敗，顯示 ${time} 的資料`,
    staleNoTime: "更新失敗",
    humidity: "濕度",
    listSeparator: "・",
  },
  sc: {
    source: "资料来源：香港天文台",
    noWarnings: "现时没有警告",
    weatherUnavailable: "未能取得天气",
    warningsUnavailable: "未能取得警告",
    issued: (time) => `（${time} 发出）`,
    stale: (time) => `更新失败，显示 ${time} 的资料`,
    staleNoTime: "更新失败",
    humidity: "湿度",
    listSeparator: "・",
  },
  en: {
    source: "Source: Hong Kong Observatory",
    noWarnings: "No warnings in force",
    weatherUnavailable: "Weather unavailable",
    warningsUnavailable: "Warnings unavailable",
    issued: (time) => ` (issued ${time})`,
    stale: (time) => `Update failed, showing data from ${time}`,
    staleNoTime: "Update failed",
    humidity: "Humidity",
    listSeparator: " · ",
  },
};

/** Maps a BCP 47 tag such as `zh-Hant`, `zh-CN` or `en-GB` to tc, sc or en. */
export function languageFromTag(tag) {
  const lower = String(tag ?? "").toLowerCase();
  if (!lower.startsWith("zh")) return "en";
  return /hans|-cn|-sg|-my/.test(lower) ? "sc" : "tc";
}

/** `auto` follows Home Assistant's language; anything unknown falls back to Traditional Chinese. */
export function resolveLanguage(setting, hass) {
  if (setting in STRINGS) return setting;
  if (setting === "auto" || setting === undefined) {
    const tag = hass?.locale?.language ?? hass?.language;
    return tag ? languageFromTag(tag) : "tc";
  }
  return "tc";
}

export const strings = (lang) => STRINGS[lang] ?? STRINGS.tc;

/** Local Hong Kong time as HH:MM, whatever time zone the browser is in. */
export function formatTime(value, lang) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LANGUAGES[lang]?.tag ?? "zh-HK", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Hong_Kong",
  }).format(date);
}
