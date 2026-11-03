import assert from "node:assert/strict";
import { test } from "node:test";

import { MIN_INTERVAL_MS, Poller, endpointUrl } from "../dist/hkweather-poller.js";

// A clock, timers and a page whose visibility the tests control.
function harness(responses = {}) {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  const visibility = new Set();
  const page = {
    hidden: false,
    addEventListener: (_type, listener) => visibility.add(listener),
    removeEventListener: (_type, listener) => visibility.delete(listener),
  };
  const calls = [];
  const fetchFn = async (url, { signal } = {}) => {
    calls.push(url);
    const type = new URL(url).searchParams.get("dataType");
    const response = responses[type];
    if (response === "hang") {
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    if (response instanceof Error) throw response;
    if (response === undefined) return { ok: false, status: 500 };
    return { ok: true, json: async () => response };
  };
  const poller = new Poller({
    fetchFn,
    page,
    now: () => now,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => timers.delete(id),
  });
  const advance = async (ms) => {
    const target = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
      await flush();
    }
    now = target;
  };
  const setHidden = async (hidden) => {
    page.hidden = hidden;
    for (const listener of visibility) listener();
    await flush();
  };
  return { poller, calls, advance, setHidden, responses, timers, visibility };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const types = (calls) => calls.map((url) => new URL(url).searchParams.get("dataType"));

test("endpoint URLs ask HKO for Traditional Chinese", () => {
  assert.equal(endpointUrl("warnsum"),
    "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc");
});

test("a subscriber gets data right away and both badges share one request per endpoint", async () => {
  const h = harness({ warnsum: { WHOT: {} }, warningInfo: {}, rhrread: { icon: [50] } });
  const seen = [];
  h.poller.subscribe(["warnsum", "warningInfo"], 300000, (state) => seen.push(state));
  h.poller.subscribe(["rhrread", "warnsum"], 300000, () => {});
  await flush();
  assert.deepEqual(types(h.calls).sort(), ["rhrread", "warningInfo", "warnsum"]);
  const last = seen.at(-1);
  assert.deepEqual(last.data.warnsum, { WHOT: {} });
  assert.equal(last.failed.size, 0);
});

test("it polls at the shortest interval asked for, but never below one minute", async () => {
  const h = harness({ warnsum: {} });
  h.poller.subscribe(["warnsum"], 10000, () => {});
  await flush();
  assert.equal(h.calls.length, 1);
  await h.advance(MIN_INTERVAL_MS - 1);
  assert.equal(h.calls.length, 1);
  await h.advance(1);
  assert.equal(h.calls.length, 2);
});

test("polling pauses while the page is hidden and refreshes on return", async () => {
  const h = harness({ warnsum: {} });
  h.poller.subscribe(["warnsum"], 300000, () => {});
  await flush();
  await h.setHidden(true);
  await h.advance(3600000);
  assert.equal(h.calls.length, 1);
  await h.setHidden(false);
  assert.equal(h.calls.length, 2);
});

test("coming back within a minute of the last fetch does not fetch again", async () => {
  const h = harness({ warnsum: {} });
  h.poller.subscribe(["warnsum"], 300000, () => {});
  await flush();
  await h.setHidden(true);
  await h.advance(30000);
  await h.setHidden(false);
  assert.equal(h.calls.length, 1);
});

test("a failed endpoint keeps its last good data and is flagged; the others still update", async () => {
  const h = harness({ warnsum: { WHOT: {} }, rhrread: { icon: [50] } });
  let state;
  h.poller.subscribe(["warnsum", "rhrread"], 300000, (s) => (state = s));
  await flush();
  h.responses.warnsum = new Error("network");
  h.responses.rhrread = { icon: [60] };
  await h.advance(300000);
  assert.deepEqual(state.data.warnsum, { WHOT: {} });
  assert.deepEqual(state.data.rhrread, { icon: [60] });
  assert.deepEqual([...state.failed], ["warnsum"]);
  assert.equal(state.updated.warnsum, 0);
  assert.equal(state.updated.rhrread, 300000);
});

test("a request that hangs is aborted after 15 seconds", async () => {
  const h = harness({ warnsum: "hang" });
  let state;
  h.poller.subscribe(["warnsum"], 300000, (s) => (state = s));
  await flush();
  assert.equal(state, undefined);
  await h.advance(15000);
  assert.deepEqual([...state.failed], ["warnsum"]);
});

test("a non-JSON or HTTP error response counts as a failure", async () => {
  const h = harness({});
  let state;
  h.poller.subscribe(["rhrread"], 300000, (s) => (state = s));
  await flush();
  assert.deepEqual([...state.failed], ["rhrread"]);
  assert.equal(state.data.rhrread, undefined);
});

test("the last subscriber leaving stops the timer and the visibility listener", async () => {
  const h = harness({ warnsum: {} });
  const leave = h.poller.subscribe(["warnsum"], 300000, () => {});
  await flush();
  leave();
  assert.equal(h.timers.size, 0);
  assert.equal(h.visibility.size, 0);
  await h.advance(3600000);
  assert.equal(h.calls.length, 1);
});

test("a late subscriber gets the cached state without a new request", async () => {
  const h = harness({ warnsum: { WHOT: {} } });
  h.poller.subscribe(["warnsum"], 300000, () => {});
  await flush();
  let state;
  h.poller.subscribe(["warnsum"], 300000, (s) => (state = s));
  assert.deepEqual(state.data.warnsum, { WHOT: {} });
  await flush();
  assert.equal(h.calls.length, 1);
});
