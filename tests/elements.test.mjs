import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The elements need only a few DOM features, so these stubs stand in for a browser.
class FakeBadge {
  constructor(attrs) { this.attrs = attrs; }
  hasAttribute(name) { return this.attrs.includes(` ${name}`); }
}
globalThis.HTMLElement = class {
  constructor() { this.listeners = {}; this.events = []; }
  attachShadow() {
    const root = {
      innerHTML: "",
      querySelectorAll(selector) {
        if (selector !== "ha-badge") return [];
        return [...this.innerHTML.matchAll(/<ha-badge([^>]*)>/g)].map((m) => new FakeBadge(m[1]));
      },
    };
    this.shadowRoot = root;
    return root;
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  dispatchEvent(event) { this.events.push(event); }
};
globalThis.Event = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
globalThis.CustomEvent = class extends globalThis.Event {};
const defined = new Map();
globalThis.customElements = { define: (name, element) => defined.set(name, element), get: (name) => defined.get(name) };
globalThis.window = globalThis;
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const responses = { rhrread: fixture("rhrread"), warnsum: fixture("warnsum-t8-redrain"), warningInfo: {} };
let requests = 0;
globalThis.fetch = async (url) => {
  requests += 1;
  const type = new URL(url).searchParams.get("dataType");
  return { ok: true, json: async () => responses[type] };
};
const originalInfo = console.info;
console.info = () => {};
await import("../dist/hkweather.js");
console.info = originalInfo;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("all three elements are defined and listed in HA's badge and card pickers", () => {
  for (const name of ["hkweather-weather-badge", "hkweather-warnings-badge", "hkweather-card"]) {
    assert.ok(defined.get(name), name);
  }
  assert.deepEqual(window.customBadges.map((b) => b.type), ["hkweather-weather-badge", "hkweather-warnings-badge"]);
  assert.deepEqual(window.customCards.map((c) => c.type), ["hkweather-card"]);
});

test("badges share one fetch per endpoint and render once data arrives", async () => {
  const weather = new (defined.get("hkweather-weather-badge"))();
  const warnings = new (defined.get("hkweather-warnings-badge"))();
  weather.setConfig({ type: "custom:hkweather-weather-badge" });
  warnings.setConfig({ type: "custom:hkweather-warnings-badge",
    tap_action: { action: "navigate", navigation_path: "/lovelace/weather" } });
  weather.hass = { locale: { language: "zh-Hant" } };
  weather.connectedCallback();
  warnings.connectedCallback();
  await flush();
  await flush();
  assert.equal(requests, 3);
  assert.equal(weather.hidden, false);
  // hui-badge removes a hidden badge from the page unless it may stay connected.
  assert.equal(weather.connectedWhileHidden, true);
  assert.ok(weather.events.some((event) => event.type === "badge-visibility-changed"));
  weather.events.length = 0;
  warnings.events.length = 0;
  assert.match(weather.shadowRoot.innerHTML, /大致多雲<\/ha-badge>/);
  assert.match(warnings.shadowRoot.innerHTML, /tc8ne\.gif/);

  // Production taps the badges to open the weather view; HA handles hass-action events.
  warnings.listeners.click();
  const [event] = warnings.events;
  assert.equal(event.type, "hass-action");
  assert.equal(event.composed, true);
  assert.deepEqual(event.detail, {
    config: { tap_action: { action: "navigate", navigation_path: "/lovelace/weather" } }, action: "tap",
  });
  weather.listeners.click();
  assert.equal(weather.events.length, 0, "tap_action none does nothing");

  // A new hass object on every HA state change must not re-render or refetch.
  const html = weather.shadowRoot.innerHTML;
  weather.hass = { locale: { language: "zh-Hant" } };
  assert.equal(weather.shadowRoot.innerHTML, html);
  weather.hass = { locale: { language: "en" } };
  assert.match(weather.shadowRoot.innerHTML, /Mainly Cloudy<\/ha-badge>/);

  weather.disconnectedCallback();
  warnings.disconnectedCallback();
});

test("an invalid config throws so HA shows its config error", () => {
  const badge = new (defined.get("hkweather-weather-badge"))();
  assert.throws(() => badge.setConfig({ type: "x", refresh_minutes: 0 }), /refresh_minutes/);
});
