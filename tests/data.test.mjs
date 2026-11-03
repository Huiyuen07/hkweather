import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  GROUP_ORDER,
  WARNINGS,
  WEATHER,
  parseCurrent,
  parseWarnings,
  warningIconUrl,
  weatherIconUrl,
} from "../dist/hkweather-data.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-09-24T12:00:00+08:00");
const codes = (list) => list.map((warning) => warning.code);

test("no warnings in force gives an empty list", () => {
  assert.deepEqual(parseWarnings(fixture("warnsum-none"), fixture("warninginfo-none"), NOW), []);
  assert.deepEqual(parseWarnings(undefined, undefined, NOW), []);
});

test("a single warning is returned with its official icon", () => {
  const [rain] = parseWarnings(fixture("warnsum-single"), {}, NOW);
  assert.equal(rain.code, "WRAINA");
  assert.equal(rain.icon, "https://www.hko.gov.hk/en/wxinfo/dailywx/images/raina.gif");
  assert.equal(rain.names.tc, "黃色暴雨警告信號");
  assert.equal(rain.issueTime, "2026-09-24T11:15:00+08:00");
});

test("warnings follow the order of the HKO website", () => {
  // menu.js getWarningIconList(): TC, rain, landslip, thunderstorm, NNT flooding, monsoon,
  // frost, fire, cold, hot, tsunami. Pre-no. 8 sits right after the TC signal.
  const list = parseWarnings(fixture("warnsum-all"), fixture("warninginfo-pre8"), NOW);
  assert.deepEqual(codes(list), [
    "TC8NE", "WTCPRE8", "WRAINR", "WL", "WTS", "WFNTSA", "WMSGNL",
    "WFROST", "WFIREY", "WCOLD", "WHOT", "WTMW",
  ]);
});

test("the group order matches the HKO website", () => {
  assert.deepEqual(GROUP_ORDER, [
    "WTCSGNL", "WTCPRE8", "WRAIN", "WL", "WTS", "WFNTSA", "WMSGNL",
    "WFROST", "WFIRE", "WCOLD", "WHOT", "WTMW",
  ]);
});

test("cancelled warnings and the CANCEL signal code are left out", () => {
  assert.deepEqual(codes(parseWarnings(fixture("warnsum-cancel"), {}, NOW)), ["WTS"]);
});

test("a thunderstorm warning past its expiry time is left out", () => {
  const warnsum = { WTS: { code: "WTS", actionCode: "EXTEND", expireTime: "2026-09-24T11:30:00+08:00" } };
  assert.deepEqual(parseWarnings(warnsum, {}, NOW), []);
  assert.equal(parseWarnings(warnsum, {}, Date.parse("2026-09-24T11:00:00+08:00")).length, 1);
});

test("the pre-no. 8 announcement only comes from warningInfo and has no icon", () => {
  const list = parseWarnings(fixture("warnsum-tc3"), fixture("warninginfo-pre8"), NOW);
  assert.deepEqual(codes(list), ["TC3", "WTCPRE8"]);
  assert.equal(list[1].icon, null);
  assert.equal(list[1].names.tc, "預警八號特別報告");
});

test("an unknown warning code still shows, using the API name, after the known ones", () => {
  const warnsum = {
    WNEW: { name: "新警告 <b>", code: "WNEW", actionCode: "ISSUE" },
    WHOT: { code: "WHOT", actionCode: "ISSUE" },
  };
  const list = parseWarnings(warnsum, {}, NOW);
  assert.deepEqual(codes(list), ["WHOT", "WNEW"]);
  assert.equal(list[1].icon, null);
  assert.equal(list[1].names.tc, "新警告 <b>");
  assert.equal(list[1].short.en, "新警告 <b>");
});

test("every code production handled has an official icon, name and short label", () => {
  const production = [
    "WFIREY", "WFIRER", "WFROST", "WHOT", "WCOLD", "WMSGNL", "WRAINA", "WRAINR", "WRAINB",
    "WFNTSA", "WL", "TC1", "TC3", "TC8NE", "TC8SE", "TC8NW", "TC8SW", "TC9", "TC10", "WTMW", "WTS",
  ];
  for (const code of production) {
    const warning = WARNINGS[code];
    assert.ok(warning, code);
    assert.match(warningIconUrl(warning.file), /^https:\/\/www\.hko\.gov\.hk\/en\/wxinfo\/dailywx\/images\/[a-z0-9-]+\.gif$/);
    for (const lang of ["tc", "sc", "en"]) {
      assert.ok(warning.names[lang], `${code} ${lang}`);
      assert.ok(warning.short[lang], `${code} ${lang}`);
    }
    assert.match(warning.color, /^#[0-9A-F]{6}$/);
  }
  assert.equal(WARNINGS.WTS.background, "#FFBD00");
  assert.equal(WARNINGS.WHOT.background, "#FFFFFF");
});

test("icon file names map from API codes", () => {
  const files = Object.fromEntries(Object.entries(WARNINGS).map(([code, value]) => [code, value.file]));
  assert.equal(files.WHOT, "vhot");
  assert.equal(files.WMSGNL, "sms");
  assert.equal(files.WFNTSA, "ntfl");
  assert.equal(files.WL, "landslip");
  assert.equal(files.WTMW, "tsunami-warn");
  assert.equal(files.TC8SW, "tc8sw");
  assert.equal(files.WTCPRE8, null);
});

test("every official weather icon code has a caption in three languages", () => {
  const official = [50, 51, 52, 53, 54, 60, 61, 62, 63, 64, 65, 70, 71, 72, 73, 74, 75, 76, 77,
                    80, 81, 82, 83, 84, 85, 90, 91, 92, 93];
  assert.deepEqual(Object.keys(WEATHER).map(Number), official);
  for (const code of official) {
    for (const lang of ["tc", "sc", "en"]) assert.ok(WEATHER[code][lang], `${code} ${lang}`);
    assert.match(WEATHER[code].mdi, /^mdi:/);
  }
  // Production showed "涼  # 修正重複…" because # is not a comment in Jinja.
  assert.equal(WEATHER[92].tc, "涼");
  assert.equal(WEATHER[93].tc, "冷");
  assert.equal(WEATHER[72].tc, "天色良好");
});

test("parseCurrent reads the icon, the chosen station and humidity", () => {
  const current = parseCurrent(fixture("rhrread"), "黃竹坑");
  assert.equal(current.icon, 76);
  assert.equal(current.iconUrl, weatherIconUrl(76));
  assert.equal(current.iconUrl, "https://www.hko.gov.hk/images/HKOWxIconOutline/pic76.png");
  assert.equal(current.temperature, 27);
  assert.equal(current.humidity, 83);
  assert.equal(current.updateTime, "2026-11-04T00:02:00+08:00");
});

test("parseCurrent falls back to the Hong Kong Observatory station", () => {
  const rhrread = fixture("rhrread");
  assert.equal(parseCurrent(rhrread, "不存在").temperature, 26);
  assert.equal(parseCurrent(rhrread).temperature, 26);
});

test("parseCurrent copes with missing parts", () => {
  assert.equal(parseCurrent(undefined), null);
  const current = parseCurrent({ icon: [] });
  assert.equal(current.icon, null);
  assert.equal(current.iconUrl, null);
  assert.equal(current.temperature, null);
  assert.equal(current.humidity, null);
});
