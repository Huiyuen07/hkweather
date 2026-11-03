// HKO code tables and the pure functions that turn API responses into what the badges show.
// Nothing here touches the DOM or the network, so it can be tested on its own.

const WARNING_ICON_BASE = "https://www.hko.gov.hk/en/wxinfo/dailywx/images/";
const WEATHER_ICON_BASE = "https://www.hko.gov.hk/images/HKOWxIconOutline/pic";

export const warningIconUrl = (file) => (file ? `${WARNING_ICON_BASE}${file}.gif` : null);
export const weatherIconUrl = (code) => (Number.isInteger(code) ? `${WEATHER_ICON_BASE}${code}.png` : null);

// Display order of the HKO website: getWarningIconList() in www.hko.gov.hk/js/menu.js
// (checked 2026-11-04). The pre-no. 8 announcement has no icon there (the site shows it as a
// banner), so it goes straight after the tropical cyclone signal it belongs to.
export const GROUP_ORDER = [
  "WTCSGNL", "WTCPRE8", "WRAIN", "WL", "WTS", "WFNTSA", "WMSGNL",
  "WFROST", "WFIRE", "WCOLD", "WHOT", "WTMW",
];

const TC = "#37474F";
const WHITE = "#FFFFFF";

const warning = (group, file, color, names, short, background = WHITE) =>
  ({ group, file, color, background, names, short });
const n = (tc, sc, en) => ({ tc, sc, en });

// file: the official icon on hko.gov.hk (names differ from API codes). color: our own text
// badge, used when the icon cannot load or there is no official icon.
// background: the official icon's own background, so the round frame matches it.
export const WARNINGS = {
  TC1: warning("WTCSGNL", "tc1", TC, n("一號戒備信號", "一号戒备信号", "Standby Signal No. 1"),
    n("一號信號", "一号信号", "T1")),
  TC3: warning("WTCSGNL", "tc3", TC, n("三號強風信號", "三号强风信号", "Strong Wind Signal No. 3"),
    n("三號信號", "三号信号", "T3")),
  TC8NE: warning("WTCSGNL", "tc8ne", TC,
    n("八號東北烈風或暴風信號", "八号东北烈风或暴风信号", "No. 8 Northeast Gale or Storm Signal"),
    n("八號東北", "八号东北", "T8 NE")),
  TC8SE: warning("WTCSGNL", "tc8se", TC,
    n("八號東南烈風或暴風信號", "八号东南烈风或暴风信号", "No. 8 Southeast Gale or Storm Signal"),
    n("八號東南", "八号东南", "T8 SE")),
  TC8SW: warning("WTCSGNL", "tc8sw", TC,
    n("八號西南烈風或暴風信號", "八号西南烈风或暴风信号", "No. 8 Southwest Gale or Storm Signal"),
    n("八號西南", "八号西南", "T8 SW")),
  TC8NW: warning("WTCSGNL", "tc8nw", TC,
    n("八號西北烈風或暴風信號", "八号西北烈风或暴风信号", "No. 8 Northwest Gale or Storm Signal"),
    n("八號西北", "八号西北", "T8 NW")),
  TC9: warning("WTCSGNL", "tc9", TC,
    n("九號烈風或暴風風力增強信號", "九号烈风或暴风风力增强信号", "Increasing Gale or Storm Signal No. 9"),
    n("九號信號", "九号信号", "T9")),
  TC10: warning("WTCSGNL", "tc10", TC, n("十號颶風信號", "十号飓风信号", "Hurricane Signal No. 10"),
    n("十號信號", "十号信号", "T10")),
  WTCPRE8: warning("WTCPRE8", null, TC,
    n("預警八號特別報告", "预警八号特别报告", "Pre-No. 8 Special Announcement"),
    n("預警八號", "预警八号", "Pre-T8")),
  WRAINA: warning("WRAIN", "raina", "#F5A800",
    n("黃色暴雨警告信號", "黄色暴雨警告信号", "Amber Rainstorm Warning Signal"),
    n("黃雨", "黄雨", "Amber Rain")),
  WRAINR: warning("WRAIN", "rainr", "#D32F2F",
    n("紅色暴雨警告信號", "红色暴雨警告信号", "Red Rainstorm Warning Signal"),
    n("紅雨", "红雨", "Red Rain")),
  WRAINB: warning("WRAIN", "rainb", "#212121",
    n("黑色暴雨警告信號", "黑色暴雨警告信号", "Black Rainstorm Warning Signal"),
    n("黑雨", "黑雨", "Black Rain")),
  WL: warning("WL", "landslip", "#795548", n("山泥傾瀉警告", "山泥倾泻警告", "Landslip Warning"),
    n("山泥傾瀉", "山泥倾泻", "Landslip")),
  WTS: warning("WTS", "ts", "#F9A825", n("雷暴警告", "雷暴警告", "Thunderstorm Warning"),
    n("雷暴", "雷暴", "Thunderstorm"), "#FFBD00"),
  WFNTSA: warning("WFNTSA", "ntfl", "#1565C0",
    n("新界北部水浸特別報告", "新界北部水浸特别报告",
      "Special Announcement on Flooding in the Northern New Territories"),
    n("新界北水浸", "新界北水浸", "NNT Flooding")),
  WMSGNL: warning("WMSGNL", "sms", "#00796B", n("強烈季候風信號", "强烈季候风信号", "Strong Monsoon Signal"),
    n("強烈季候風", "强烈季候风", "Monsoon")),
  WFROST: warning("WFROST", "frost", "#0288D1", n("霜凍警告", "霜冻警告", "Frost Warning"),
    n("霜凍", "霜冻", "Frost")),
  WFIREY: warning("WFIRE", "firey", "#F9A825",
    n("黃色火災危險警告", "黄色火灾危险警告", "Yellow Fire Danger Warning"),
    n("黃色火警", "黄色火警", "Yellow Fire")),
  WFIRER: warning("WFIRE", "firer", "#C62828",
    n("紅色火災危險警告", "红色火灾危险警告", "Red Fire Danger Warning"),
    n("紅色火警", "红色火警", "Red Fire")),
  WCOLD: warning("WCOLD", "cold", "#1E88E5", n("寒冷天氣警告", "寒冷天气警告", "Cold Weather Warning"),
    n("寒冷", "寒冷", "Cold")),
  WHOT: warning("WHOT", "vhot", "#E65100", n("酷熱天氣警告", "酷热天气警告", "Very Hot Weather Warning"),
    n("酷熱", "酷热", "Very Hot")),
  WTMW: warning("WTMW", "tsunami-warn", "#01579B", n("海嘯警告", "海啸警告", "Tsunami Warning"),
    n("海嘯", "海啸", "Tsunami")),
};

const groupRank = (group) => {
  const rank = GROUP_ORDER.indexOf(group);
  return rank === -1 ? GROUP_ORDER.length : rank;
};

function toWarning(code, group, raw) {
  const known = WARNINGS[code];
  if (known) {
    return { code, ...known, icon: warningIconUrl(known.file), issueTime: raw?.issueTime ?? null };
  }
  // A code HKO adds later still shows, as a text badge in the API's own wording.
  const name = String(raw?.name ?? code);
  return {
    code, group, file: null, icon: null, color: TC, background: WHITE,
    names: n(name, name, name), short: n(name, name, name), issueTime: raw?.issueTime ?? null,
  };
}

/**
 * Active warnings in HKO website order.
 * @param warnsum   `weather.php?dataType=warnsum` response (`{}` when nothing is in force)
 * @param warningInfo `weather.php?dataType=warningInfo` response; the only source of WTCPRE8
 * @param now       epoch ms, to drop a thunderstorm warning past its expiry time
 */
export function parseWarnings(warnsum, warningInfo, now = Date.now()) {
  const list = [];
  for (const [group, raw] of Object.entries(warnsum ?? {})) {
    if (!raw || typeof raw !== "object") continue;
    const code = raw.code ?? group;
    if (raw.actionCode === "CANCEL" || code === "CANCEL") continue;
    if (raw.expireTime && Date.parse(raw.expireTime) <= now) continue;
    list.push(toWarning(code, group, raw));
  }
  const details = Array.isArray(warningInfo?.details) ? warningInfo.details : [];
  const pre8 = details.find((item) => item?.warningStatementCode === "WTCPRE8");
  if (pre8) list.push(toWarning("WTCPRE8", "WTCPRE8", { issueTime: pre8.updateTime }));

  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => groupRank(a.item.group) - groupRank(b.item.group)
      || (groupRank(a.item.group) === GROUP_ORDER.length ? a.item.group.localeCompare(b.item.group) : 0)
      || a.index - b.index)
    .map(({ item }) => item);
}

const w = (tc, sc, en, mdi) => ({ tc, sc, en, mdi });
// Captions from www.hko.gov.hk/textonly/v2/explain/wxicon_c.htm / wxicon_e.htm. The night-time
// "Fine" icons differ only by moon phase, so the usage notes in brackets are dropped.
export const WEATHER = {
  50: w("陽光充沛", "阳光充沛", "Sunny", "mdi:weather-sunny"),
  51: w("間有陽光", "间有阳光", "Sunny Periods", "mdi:weather-partly-cloudy"),
  52: w("短暫陽光", "短暂阳光", "Sunny Intervals", "mdi:weather-partly-cloudy"),
  53: w("間有陽光幾陣驟雨", "间有阳光几阵骤雨", "Sunny Periods with A Few Showers", "mdi:weather-partly-rainy"),
  54: w("短暫陽光有驟雨", "短暂阳光有骤雨", "Sunny Intervals with Showers", "mdi:weather-partly-rainy"),
  60: w("多雲", "多云", "Cloudy", "mdi:weather-cloudy"),
  61: w("密雲", "密云", "Overcast", "mdi:weather-cloudy"),
  62: w("微雨", "微雨", "Light Rain", "mdi:weather-rainy"),
  63: w("雨", "雨", "Rain", "mdi:weather-rainy"),
  64: w("大雨", "大雨", "Heavy Rain", "mdi:weather-pouring"),
  65: w("雷暴", "雷暴", "Thunderstorms", "mdi:weather-lightning-rainy"),
  70: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  71: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  72: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  73: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  74: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  75: w("天色良好", "天色良好", "Fine", "mdi:weather-night"),
  76: w("大致多雲", "大致多云", "Mainly Cloudy", "mdi:weather-night-partly-cloudy"),
  77: w("天色大致良好", "天色大致良好", "Mainly Fine", "mdi:weather-night"),
  80: w("大風", "大风", "Windy", "mdi:weather-windy"),
  81: w("乾燥", "干燥", "Dry", "mdi:water-off"),
  82: w("潮濕", "潮湿", "Humid", "mdi:water-percent"),
  83: w("霧", "雾", "Fog", "mdi:weather-fog"),
  84: w("薄霧", "薄雾", "Mist", "mdi:weather-fog"),
  85: w("煙霞", "烟霞", "Haze", "mdi:weather-hazy"),
  90: w("熱", "热", "Hot", "mdi:thermometer-high"),
  91: w("暖", "暖", "Warm", "mdi:thermometer"),
  92: w("涼", "凉", "Cool", "mdi:thermometer-low"),
  93: w("冷", "冷", "Cold", "mdi:snowflake-thermometer"),
};

// rhrread is always fetched in Traditional Chinese, so station names are the Chinese ones.
export const DEFAULT_STATION = "香港天文台";

const numberOrNull = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Current weather from `weather.php?dataType=rhrread&lang=tc`. */
export function parseCurrent(rhrread, station = DEFAULT_STATION) {
  if (!rhrread || typeof rhrread !== "object") return null;
  const code = Number.parseInt(rhrread.icon?.[0], 10);
  const icon = Number.isInteger(code) ? code : null;
  const temperatures = Array.isArray(rhrread.temperature?.data) ? rhrread.temperature.data : [];
  const reading = temperatures.find((item) => item?.place === station)
    ?? temperatures.find((item) => item?.place === DEFAULT_STATION)
    ?? temperatures[0];
  return {
    icon,
    iconUrl: weatherIconUrl(icon),
    temperature: numberOrNull(reading?.value),
    humidity: numberOrNull(rhrread.humidity?.data?.[0]?.value),
    updateTime: rhrread.updateTime ?? null,
  };
}

/** Station names in a `rhrread` response, for the editor. */
export const stationNames = (rhrread) =>
  (Array.isArray(rhrread?.temperature?.data) ? rhrread.temperature.data : [])
    .map((item) => item?.place)
    .filter((place) => typeof place === "string" && place);
