// One shared poller for every badge and card on the page, so two badges never fetch the same
// HKO endpoint twice. It pauses while the page is hidden and refreshes when it comes back.

const API = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
export const MIN_INTERVAL_MS = 60 * 1000;
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 15 * 1000;

// Station names and warning text are only used in Chinese, so one language is enough.
export const endpointUrl = (type) => `${API}?dataType=${encodeURIComponent(type)}&lang=tc`;

export class Poller {
  constructor({
    fetchFn = (...args) => globalThis.fetch(...args),
    page = globalThis.document,
    now = () => Date.now(),
    setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer = (id) => globalThis.clearTimeout(id),
  } = {}) {
    Object.assign(this, { fetchFn, page, now, setTimer, clearTimer });
    this.subscribers = new Set();
    this.data = {};
    this.updated = {};
    this.failed = new Set();
    this.lastFetch = -Infinity;
    this.timer = null;
    this.inFlight = null;
    this.batch = null;
    this.onVisibility = () => {
      if (this.page?.hidden) {
        this.stopTimer();
      } else if (this.now() - this.lastFetch >= MIN_INTERVAL_MS) {
        this.refresh();
      } else {
        this.schedule();
      }
    };
  }

  /** Returns an unsubscribe function. The listener gets the shared state after each round. */
  subscribe(endpoints, intervalMs, listener) {
    const subscriber = { endpoints: new Set(endpoints), intervalMs, listener };
    const first = this.subscribers.size === 0;
    this.subscribers.add(subscriber);
    if (first) this.page?.addEventListener?.("visibilitychange", this.onVisibility);

    const pending = this.batch ?? new Set();
    const missing = [...subscriber.endpoints].filter((type) => !(type in this.updated) && !pending.has(type));
    if (first) {
      this.refresh();
    } else if (missing.length) {
      // Fetch only what this badge needs that nobody has fetched yet; the round stays on time.
      Promise.resolve(this.inFlight).then(() => this.refresh(missing));
    } else if (!this.inFlight) {
      listener(this.state());
    }
    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) {
        this.stopTimer();
        this.page?.removeEventListener?.("visibilitychange", this.onVisibility);
      }
    };
  }

  state() {
    return { data: this.data, updated: this.updated, failed: this.failed };
  }

  interval() {
    const asked = Math.min(...[...this.subscribers].map((s) => s.intervalMs || DEFAULT_INTERVAL_MS));
    return Math.max(MIN_INTERVAL_MS, asked);
  }

  stopTimer() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  schedule() {
    this.stopTimer();
    if (this.subscribers.size === 0 || this.page?.hidden) return;
    const wait = Math.max(0, this.lastFetch + this.interval() - this.now());
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.refresh();
    }, wait);
  }

  async fetchOne(type) {
    const controller = new AbortController();
    const timeout = this.setTimer(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchFn(endpointUrl(type), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.data[type] = await response.json();
      this.updated[type] = this.now();
      this.failed.delete(type);
    } catch {
      // Keep the last good data; the badges show it as out of date.
      this.failed.add(type);
      if (!(type in this.updated)) this.updated[type] = null;
    } finally {
      this.clearTimer(timeout);
    }
  }

  /** Fetches every endpoint any subscriber needs, or only `only` without restarting the round. */
  refresh(only) {
    if (this.inFlight) return this.inFlight;
    const types = new Set(only ?? []);
    if (!only) for (const subscriber of this.subscribers) for (const type of subscriber.endpoints) types.add(type);
    if (types.size === 0) return Promise.resolve();
    if (!only) {
      this.stopTimer();
      this.lastFetch = this.now();
    }
    this.batch = types;
    this.inFlight = Promise.all([...types].map((type) => this.fetchOne(type))).then(() => {
      this.inFlight = null;
      this.batch = null;
      const state = this.state();
      for (const subscriber of this.subscribers) subscriber.listener(state);
      this.schedule();
    });
    return this.inFlight;
  }
}

export const sharedPoller = new Poller();
