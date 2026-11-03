// Hong Kong Observatory badges and card for Home Assistant.
// custom:hkweather-weather-badge   current weather icon and description
// custom:hkweather-warnings-badge  warnings in force, in HKO website order
// custom:hkweather-card            both in one card, for views without a badge row

export const VERSION = "0.1.0";

// HA serves /local files with a month-long cache, so pass this file's ?v= on to every import.
const version = new URL(import.meta.url).search;
const { resolveLanguage } = await import(`./hkweather-i18n.js${version}`);
const { normalizeConfig, warningsBadgeView, weatherBadgeView, cardView } =
  await import(`./hkweather-view.js${version}`);
const { sharedPoller } = await import(`./hkweather-poller.js${version}`);

const BADGE_STYLE = `
  :host { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ha-space-2, 8px); }
  :host([hidden]) { display: none; }
  .disc {
    width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: none;
    display: flex; align-items: center; justify-content: center;
  }
  /* The whole official icon stays visible: scaled to 70%, never cropped to fill the circle. */
  .disc img { width: 70%; height: 70%; display: block; }
  .dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .stale { opacity: 0.55; }
`;

const CARD_STYLE = `
  :host { display: block; }
  ha-card { padding: 12px 16px 8px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 48px; }
  .current { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .primary, .secondary { white-space: nowrap; }
  .current img { width: 48px; height: 48px; flex: none; }
  .current ha-icon { --mdc-icon-size: 40px; flex: none; color: var(--state-icon-color); }
  .primary { font-size: var(--ha-font-size-l, 16px); font-weight: var(--ha-font-weight-medium, 500); color: var(--primary-text-color); }
  .secondary { font-size: var(--ha-font-size-s, 12px); color: var(--secondary-text-color); }
  .warnings { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-inline-start: auto; justify-content: flex-end; }
  .disc {
    width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex: none;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--divider-color, #e0e0e0); box-sizing: border-box;
  }
  .disc img { width: 70%; height: 70%; display: block; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; box-sizing: border-box;
    border-radius: 16px; border: 1px solid var(--divider-color, #e0e0e0);
    font-size: var(--ha-font-size-s, 12px); color: var(--primary-text-color);
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .none { font-size: var(--ha-font-size-s, 12px); color: var(--secondary-text-color); }
  .footer { margin-top: 6px; font-size: var(--ha-font-size-xs, 10px); color: var(--secondary-text-color); text-align: end; }
  .stale { opacity: 0.7; }
`;

const BaseElement = globalThis.HTMLElement ?? class {};

class HkweatherBase extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._broken = new Set();
    this._lang = "tc";
    this._html = null;
    this._unsubscribe = null;
    // HA's hui-badge takes a hidden badge out of the page unless this is set, and then it
    // would never hear about new warnings. With it set, the badge stays connected and tells
    // hui-badge when to show it again through badge-visibility-changed.
    this.connectedWhileHidden = true;
    this.addEventListener("click", () => this._tap());
  }

  setConfig(config) {
    this._config = normalizeConfig(config, this.constructor.kind);
    this._lang = resolveLanguage(this._config.language, this._hass);
    this._html = null;
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
      this._subscribe();
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // hass changes on every state update in HA; only the language matters here.
    const lang = resolveLanguage(this._config?.language, hass);
    if (lang !== this._lang) {
      this._lang = lang;
      this._render();
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this._subscribe();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  _subscribe() {
    if (this._unsubscribe || !this._config) return;
    this._unsubscribe = sharedPoller.subscribe(
      this.constructor.endpoints(this._config),
      this._config.refresh_minutes * 60 * 1000,
      (state) => {
        this._state = state;
        this._render();
      },
    );
  }

  _actionable() {
    const action = this._config?.tap_action?.action;
    return Boolean(action && action !== "none");
  }

  _tap() {
    if (!this._actionable()) return;
    this.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { config: { tap_action: this._config.tap_action }, action: "tap" },
    }));
  }

  _render() {
    if (!this._config) return;
    const { hidden, html } = this.view();
    if (this.hidden !== hidden) {
      this.hidden = hidden;
      this.dispatchEvent(new Event("badge-visibility-changed"));
    }
    if (html === this._html) return;
    this._html = html;
    this.shadowRoot.innerHTML = `<style>${this.constructor.style}</style>${html}`;
    for (const badge of this.shadowRoot.querySelectorAll?.("ha-badge") ?? []) {
      badge.iconOnly = badge.hasAttribute("icon-only");
      badge.type = this._actionable() ? "button" : "badge";
    }
    // An icon that fails to load (HKO renamed it, or it is offline) falls back to our own badge.
    for (const img of this.shadowRoot.querySelectorAll?.("img") ?? []) {
      img.addEventListener("error", () => {
        this._broken.add(img.getAttribute("src"));
        this._render();
      }, { once: true });
    }
  }
}

class HkweatherWeatherBadge extends HkweatherBase {
  static kind = "weather";
  static style = BADGE_STYLE;
  static endpoints = () => ["rhrread"];
  static getStubConfig = () => ({});
  view() {
    return weatherBadgeView(this._config, this._state, this._lang, this._broken);
  }
}

class HkweatherWarningsBadge extends HkweatherBase {
  static kind = "warnings";
  static style = BADGE_STYLE;
  static endpoints = () => ["warnsum", "warningInfo"];
  static getStubConfig = () => ({ show_empty: true });
  view() {
    return warningsBadgeView(this._config, this._state, this._lang, Date.now(), this._broken);
  }
}

class HkweatherCard extends HkweatherBase {
  static kind = "card";
  static style = CARD_STYLE;
  static endpoints = (config) => [
    ...(config.show_weather ? ["rhrread"] : []),
    ...(config.show_warnings ? ["warnsum", "warningInfo"] : []),
  ];
  static getStubConfig = () => ({});
  getCardSize() {
    return 1;
  }
  view() {
    return { hidden: false, html: cardView(this._config, this._state, this._lang, Date.now(), this._broken) };
  }
}

export const ELEMENTS = {
  "hkweather-weather-badge": HkweatherWeatherBadge,
  "hkweather-warnings-badge": HkweatherWarningsBadge,
  "hkweather-card": HkweatherCard,
};

if (globalThis.customElements) {
  for (const [name, element] of Object.entries(ELEMENTS)) {
    if (!customElements.get(name)) customElements.define(name, element);
  }
  const register = (list, entry) => {
    if (!list.some((item) => item.type === entry.type)) list.push(entry);
  };
  window.customBadges = window.customBadges || [];
  register(window.customBadges, {
    type: "hkweather-weather-badge",
    name: "天文台天氣 HKO Weather",
    description: "香港天文台現時天氣圖示 / Current weather icon from the Hong Kong Observatory",
    preview: true,
  });
  register(window.customBadges, {
    type: "hkweather-warnings-badge",
    name: "天文台警告 HKO Warnings",
    description: "生效中的天氣警告 / Weather warnings in force",
    preview: true,
  });
  window.customCards = window.customCards || [];
  register(window.customCards, {
    type: "hkweather-card",
    name: "天文台天氣 HKO Weather",
    description: "現時天氣及生效中的警告 / Current weather and warnings in force",
    preview: true,
  });
  console.info(`%c HKWEATHER %c ${VERSION} `, "color:#fff;background:#00519b", "color:#00519b");
}
