import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  cardView,
  escapeHtml,
  normalizeConfig,
  staleNote,
  warningsBadgeView,
  weatherBadgeView,
} from "../dist/hkweather-view.js";
import { formatTime, languageFromTag, resolveLanguage } from "../dist/hkweather-i18n.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-09-24T12:00:00+08:00");
const UPDATED = Date.parse("2026-09-24T11:55:00+08:00");
const state = (data, failed = []) => ({
  data,
  failed: new Set(failed),
  updated: Object.fromEntries(Object.keys(data).map((key) => [key, UPDATED])),
});
const weatherConfig = (extra = {}) => normalizeConfig({ type: "custom:hkweather-weather-badge", ...extra }, "weather");
const warningsConfig = (extra = {}) => normalizeConfig({ type: "custom:hkweather-warnings-badge", ...extra }, "warnings");
const count = (html, needle) => html.split(needle).length - 1;

test("normalizeConfig fills defaults and keeps tap_action", () => {
  const config = weatherConfig({ tap_action: { action: "navigate", navigation_path: "/x" } });
  assert.deepEqual(config.content, ["description"]);
  assert.equal(config.station, "香港天文台");
  assert.equal(config.language, "auto");
  assert.equal(config.refresh_minutes, 5);
  assert.deepEqual(config.tap_action, { action: "navigate", navigation_path: "/x" });
  assert.equal(warningsConfig().show_empty, false);
  assert.deepEqual(warningsConfig().tap_action, { action: "none" });
  assert.equal(weatherConfig({ station: "" }).station, "香港天文台");
});

test("normalizeConfig rejects settings the badges cannot use", () => {
  assert.throws(() => weatherConfig({ refresh_minutes: 0.5 }), /at least 1/);
  assert.throws(() => weatherConfig({ refresh_minutes: "x" }), /at least 1/);
  assert.throws(() => weatherConfig({ content: ["uv"] }), /content/);
  assert.throws(() => weatherConfig({ language: "jp" }), /language/);
  assert.throws(() => normalizeConfig(null, "weather"), /Invalid/);
  assert.deepEqual(weatherConfig({ content: "temperature" }).content, ["temperature"]);
});

test("nothing shows before the first fetch finishes", () => {
  assert.deepEqual(weatherBadgeView(weatherConfig(), null, "tc"), { hidden: true, html: "" });
  assert.deepEqual(warningsBadgeView(warningsConfig(), null, "tc"), { hidden: true, html: "" });
});

test("the weather badge shows the official icon and the caption, like production", () => {
  const view = weatherBadgeView(weatherConfig(), state({ rhrread: fixture("rhrread") }), "tc");
  assert.equal(view.hidden, false);
  assert.match(view.html, /<img slot="icon" src="https:\/\/www\.hko\.gov\.hk\/images\/HKOWxIconOutline\/pic76\.png"/);
  assert.match(view.html, />大致多雲<\/ha-badge>$/);
  assert.match(view.html, /title="大致多雲&#10;資料來源：香港天文台"/);
  assert.doesNotMatch(view.html, /icon-only/);
});

test("the weather badge can add temperature and humidity, in the chosen language", () => {
  const config = weatherConfig({ content: ["description", "temperature", "humidity"], station: "黃竹坑" });
  const view = weatherBadgeView(config, state({ rhrread: fixture("rhrread") }), "en");
  assert.match(view.html, />Mainly Cloudy · 27°C · Humidity 83%<\/ha-badge>$/);
});

test("an empty content list gives an icon-only weather badge", () => {
  const view = weatherBadgeView(weatherConfig({ content: [] }), state({ rhrread: fixture("rhrread") }), "tc");
  assert.match(view.html, /icon-only/);
});

test("a weather icon that failed to load is replaced by a Material Design icon", () => {
  const broken = new Set(["https://www.hko.gov.hk/images/HKOWxIconOutline/pic76.png"]);
  const view = weatherBadgeView(weatherConfig(), state({ rhrread: fixture("rhrread") }), "tc", broken);
  assert.match(view.html, /<ha-icon slot="icon" icon="mdi:weather-night-partly-cloudy">/);
  assert.doesNotMatch(view.html, /<img/);
});

test("a failed weather fetch with no earlier data shows an error badge", () => {
  const failed = { data: {}, failed: new Set(["rhrread"]), updated: { rhrread: null } };
  const view = weatherBadgeView(weatherConfig(), failed, "tc");
  assert.equal(view.hidden, false);
  assert.match(view.html, /mdi:cloud-alert/);
  assert.match(view.html, /未能取得天氣/);
});

test("a failed refresh keeps the last data, dimmed, with the time in the tooltip", () => {
  const view = weatherBadgeView(weatherConfig(), state({ rhrread: fixture("rhrread") }, ["rhrread"]), "tc");
  assert.match(view.html, /class="weather stale"/);
  assert.match(view.html, /更新失敗，顯示 11:55 的資料/);
});

test("no warnings hides the warnings badge unless show_empty is on", () => {
  const empty = state({ warnsum: {}, warningInfo: {} });
  assert.deepEqual(warningsBadgeView(warningsConfig(), empty, "tc", NOW), { hidden: true, html: "" });
  const shown = warningsBadgeView(warningsConfig({ show_empty: true }), empty, "tc", NOW);
  assert.equal(shown.hidden, false);
  assert.match(shown.html, /現時沒有警告/);
});

test("each warning is an icon-only badge with the official icon at 70% in a round frame", () => {
  const view = warningsBadgeView(warningsConfig(),
    state({ warnsum: fixture("warnsum-t8-redrain"), warningInfo: {} }), "tc", NOW);
  assert.equal(count(view.html, "<ha-badge"), 3);
  assert.equal(count(view.html, "icon-only"), 3);
  const order = [...view.html.matchAll(/images\/([a-z0-9-]+)\.gif/g)].map((m) => m[1]);
  assert.deepEqual(order, ["tc8ne", "rainr", "ts"]);
  assert.match(view.html, /<span slot="icon" class="disc" style="background:#FFBD00"><img src="[^"]+ts\.gif"/);
  assert.match(view.html, /title="八號東北烈風或暴風信號（11:15 發出）&#10;資料來源：香港天文台"/);
});

test("the pre-no. 8 announcement and broken icons use a coloured dot and short name", () => {
  const broken = new Set(["https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc3.gif"]);
  const view = warningsBadgeView(warningsConfig(),
    state({ warnsum: fixture("warnsum-tc3"), warningInfo: fixture("warninginfo-pre8") }), "tc", NOW, broken);
  assert.equal(count(view.html, 'class="warning text"'), 2);
  assert.match(view.html, /<span slot="icon" class="dot" style="background:#37474F"><\/span>三號信號<\/ha-badge>/);
  assert.match(view.html, /預警八號<\/ha-badge>$/);
});

test("show_names puts the short name next to each icon", () => {
  const view = warningsBadgeView(warningsConfig({ show_names: true }),
    state({ warnsum: fixture("warnsum-single"), warningInfo: {} }), "en", NOW);
  assert.doesNotMatch(view.html, /icon-only/);
  assert.match(view.html, /raina\.gif" alt="Amber Rainstorm Warning Signal"><\/span>Amber Rain<\/ha-badge>/);
  assert.match(view.html, /title="Amber Rainstorm Warning Signal \(issued 11:15\)&#10;/);
});

test("API text for an unknown warning is escaped", () => {
  const warnsum = { WNEW: { name: '<img src=x onerror="alert(1)">', code: "WNEW", actionCode: "ISSUE" } };
  const view = warningsBadgeView(warningsConfig(), state({ warnsum, warningInfo: {} }), "tc", NOW);
  assert.doesNotMatch(view.html, /<img src=x/);
  assert.match(view.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.equal(escapeHtml(`a&b<'">`), "a&amp;b&lt;&#39;&quot;&gt;");
});

test("a failed warnings fetch with no earlier data shows an error badge, not 'no warnings'", () => {
  const failed = { data: {}, failed: new Set(["warnsum"]), updated: { warnsum: null } };
  const view = warningsBadgeView(warningsConfig({ show_empty: true }), failed, "tc", NOW);
  assert.match(view.html, /未能取得警告/);
  assert.doesNotMatch(view.html, /現時沒有警告/);
});

test("staleNote names the oldest failed endpoint's last good time", () => {
  const s = { data: {}, failed: new Set(["warnsum", "warningInfo"]),
    updated: { warnsum: UPDATED, warningInfo: UPDATED - 600000 } };
  assert.equal(staleNote(s, ["warnsum", "warningInfo"], "en"), "Update failed, showing data from 11:45");
  assert.equal(staleNote({ ...s, updated: {} }, ["warnsum"], "tc"), "更新失敗");
  assert.equal(staleNote(s, ["rhrread"], "tc"), "");
});

test("the card shows weather, warnings in order and the HKO source line", () => {
  const config = normalizeConfig({ type: "custom:hkweather-card" }, "card");
  const html = cardView(config,
    state({ rhrread: fixture("rhrread"), warnsum: fixture("warnsum-t8-redrain"), warningInfo: {} }), "tc", NOW);
  assert.match(html, /<div class="primary">大致多雲<\/div><div class="secondary">26°C<\/div>/);
  const order = [...html.matchAll(/images\/([a-z0-9-]+)\.gif/g)].map((m) => m[1]);
  assert.deepEqual(order, ["tc8ne", "rainr", "ts"]);
  assert.match(html, /<div class="footer">資料來源：香港天文台<\/div>/);
});

test("the card can hide either half", () => {
  const config = normalizeConfig({ type: "custom:hkweather-card", show_weather: false }, "card");
  const html = cardView(config, state({ rhrread: fixture("rhrread"), warnsum: fixture("warnsum-single") }), "tc", NOW);
  assert.doesNotMatch(html, /class="current"/);
  assert.match(html, /raina\.gif/);
});

test("language follows Home Assistant when set to auto", () => {
  assert.equal(languageFromTag("zh-Hant"), "tc");
  assert.equal(languageFromTag("zh-HK"), "tc");
  assert.equal(languageFromTag("zh-Hans"), "sc");
  assert.equal(languageFromTag("zh-CN"), "sc");
  assert.equal(languageFromTag("en-GB"), "en");
  assert.equal(languageFromTag("ja"), "en");
  assert.equal(resolveLanguage("auto", { locale: { language: "zh-Hans" } }), "sc");
  assert.equal(resolveLanguage("auto", undefined), "tc");
  assert.equal(resolveLanguage("en", { locale: { language: "zh-Hant" } }), "en");
});

test("times are shown in Hong Kong time whatever the browser's zone", () => {
  assert.equal(formatTime("2026-09-24T03:15:00Z", "tc"), "11:15");
  assert.equal(formatTime("not a date", "tc"), "");
});
