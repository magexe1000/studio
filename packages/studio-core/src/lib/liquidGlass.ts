/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Liquid-Glass Manager — faithful port of shuding/liquid-glass
 * (https://github.com/shuding/liquid-glass, MIT © Shu Ding 2025) adapted
 * to attach to existing nav elements instead of a draggable floating pill.
 *
 * Why this works on mobile Chrome where the previous stacked
 * `backdrop-filter` + `filter:url()` approach didn't:
 *
 *   1. Single combined property:
 *        `backdrop-filter: url(#id) blur(...) saturate(...)`
 *      Stacking `backdrop-filter` on one element and `filter:url()` on
 *      another is *not* reliably composed by Chrome Android — the SVG
 *      displacement map gets dropped and you see only the blur. Shuding
 *      puts everything in one declaration and it actually composites.
 *
 *   2. Per-element <filter> with `filterUnits="userSpaceOnUse"` and
 *      explicit pixel-sized width/height matching the nav. This gives
 *      `<feDisplacementMap scale="..">` a meaningful coordinate system.
 *
 *   3. `feImage` uses `xlink:href` set via `setAttributeNS()`. Chrome
 *      Android silently ignores plain `href` on `<feImage>` inside SVG
 *      filters — `xlink:href` is the only attribute it honours.
 *
 *   4. Displacement map regenerated on every ResizeObserver tick so the
 *      lens always matches the actual nav rect. The fixed 300×80 map we
 *      had before couldn't possibly match a 90vw bottom nav.
 *
 *   5. `scale` value is derived from the rendered map's `maxScale`, not
 *      a hand-tuned constant — this is what shuding does and it auto-
 *      adjusts to the element size.
 *
 * Extensions on top of shuding's core (NOT in his original):
 *   • Chromatic aberration: we compose THREE displacement maps with
 *     slightly different scales for R, G, B and screen-blend them. This
 *     produces the rim RGB-fringe seen in rdev/liquid-glass-react and
 *     Kyant0/AndroidLiquidGlass.
 *   • Scroll-driven specular streak: `--lg-shine-x` CSS var animated by
 *     `useLiquidGlassNav`'s scroll handler.
 */

const STYLE_ID     = 'liquid-glass-style';
const TARGET_CLASS = 'liquidGL-nav';
const XLINK_NS     = 'http://www.w3.org/1999/xlink';
const SVG_NS       = 'http://www.w3.org/2000/svg';

/* ───────────────────── Capability probes ─────────────────────────────────── */

function isNativePlatform(): boolean {
  try { return !!(window as any).Capacitor?.isNativePlatform?.(); }
  catch { return false; }
}
function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

let _platformSupportedCache: boolean | null = null;
export function liquidGlassPlatformSupported(): boolean {
  if (_platformSupportedCache !== null) return _platformSupportedCache;
  if (typeof window === 'undefined' || typeof document === 'undefined') return (_platformSupportedCache = false);
  // Note: reduced-motion only suppresses the scroll-shine animation in the hook,
  // not the glass visual itself — so we deliberately do NOT gate on prefersReducedMotion here.
  try {
    const ok = CSS.supports('backdrop-filter', 'blur(1px)') ||
               CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    return (_platformSupportedCache = ok);
  } catch { return (_platformSupportedCache = false); }
}

/* ───────────────────── shuding's fragment shader ─────────────────────────── */

function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function roundedRectSDF(x: number, y: number, w: number, h: number, r: number): number {
  const qx = Math.abs(x) - w + r;
  const qy = Math.abs(y) - h + r;
  return Math.min(Math.max(qx, qy), 0)
       + Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
       - r;
}

/**
 * shuding's `fragment` callback verbatim. Returns the (u, v) sample
 * coordinate to read for each output pixel — the difference between
 * (input pixel) and (returned coord) is the displacement vector.
 */
function fragment(uvX: number, uvY: number): { x: number; y: number } {
  const ix = uvX - 0.5;
  const iy = uvY - 0.5;
  const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
  const displacement   = smoothStep(0.8, 0, distanceToEdge - 0.15);
  const scaled         = smoothStep(0, 1, displacement);
  return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 };
}

/* ───────────────────── Per-element Shader ───────────────────────────────── */

interface Shader {
  filterId: string;
  svg: SVGSVGElement;
  feImageR: SVGFEImageElement;
  feImageG: SVGFEImageElement;
  feImageB: SVGFEImageElement;
  feDispR:  SVGFEDisplacementMapElement;
  feDispG:  SVGFEDisplacementMapElement;
  feDispB:  SVGFEDisplacementMapElement;
  filter:   SVGFilterElement;
  canvas:   HTMLCanvasElement;
  ctx:      CanvasRenderingContext2D;
  ro:       ResizeObserver;
  width:    number;
  height:   number;
  /** Inline styles captured BEFORE we mutated them, restored on destroy. */
  styleSnapshot: {
    backdropFilter: string;
    backdropFilterPriority: string;
    webkitBackdropFilter: string;
    webkitBackdropFilterPriority: string;
  };
}

const _shaders = new WeakMap<HTMLElement, Shader>();
let _idCounter = 0;
function nextFilterId(): string { return `lgshader-${++_idCounter}`; }

/**
 * Generate the displacement map PNG for the given dimensions and write it
 * into the three feImage elements (R, G, B channels of the chromatic
 * aberration triple). Also sets the matching `scale` on each
 * feDisplacementMap, derived from the data exactly as shuding does.
 */
function regenerateMap(s: Shader, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  s.width = width;
  s.height = height;
  s.canvas.width = width;
  s.canvas.height = height;

  const w = width, h = height;
  const data = new Uint8ClampedArray(w * h * 4);
  let maxScale = 0;
  const raw: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);
    const pos = fragment(x / w, y / h);
    const dx = pos.x * w - x;
    const dy = pos.y * h - y;
    if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
    if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
    raw.push(dx, dy);
  }
  // Shuding's exact scaling — divide by 2 so the encoded values stay
  // within the 0..255 range with headroom for the 0.5 bias.
  maxScale *= 0.5;
  if (maxScale === 0) maxScale = 1;

  let idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = (raw[idx++] / maxScale + 0.5) * 255;
    data[i + 1] = (raw[idx++] / maxScale + 0.5) * 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
  s.ctx.putImageData(new ImageData(data, w, h), 0, 0);
  const dataURL = s.canvas.toDataURL();

  // Update filter region.
  s.filter.setAttribute('x', '0');
  s.filter.setAttribute('y', '0');
  s.filter.setAttribute('width',  String(w));
  s.filter.setAttribute('height', String(h));

  for (const fe of [s.feImageR, s.feImageG, s.feImageB]) {
    fe.setAttribute('width',  String(w));
    fe.setAttribute('height', String(h));
    // CRITICAL: xlink:href via setAttributeNS — plain 'href' is silently
    // ignored by Chrome Android in <feImage>.
    fe.setAttributeNS(XLINK_NS, 'xlink:href', dataURL);
    // Belt-and-braces — newer browsers accept both.
    fe.setAttribute('href', dataURL);
  }

  // Chromatic aberration: R is displaced slightly more than G, B slightly
  // less. Scale derived from data so it auto-tunes to element size.
  const baseScale = maxScale; // shuding uses this directly (canvasDPI = 1)
  s.feDispR.setAttribute('scale', String(baseScale * 1.06));
  s.feDispG.setAttribute('scale', String(baseScale));
  s.feDispB.setAttribute('scale', String(baseScale * 0.94));
}

function createShader(host: HTMLElement): Shader {
  const filterId = nextFilterId();

  // Hidden canvas used to bake the displacement map.
  const canvas = document.createElement('canvas');
  canvas.style.display = 'none';
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('liquidGlass: 2D canvas unsupported');

  // SVG with the per-element filter.
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter') as SVGFilterElement;
  filter.setAttribute('id', filterId);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  // Three feImage / feDisplacementMap pairs for R, G, B chromatic split.
  const mkImage = (idSuffix: string) => {
    const fe = document.createElementNS(SVG_NS, 'feImage') as SVGFEImageElement;
    fe.setAttribute('id', `${filterId}_${idSuffix}`);
    fe.setAttribute('result', `MAP_${idSuffix}`);
    return fe;
  };
  const mkDisp = (mapSuffix: string, channel: 'R' | 'G' | 'B', srcResult: string) => {
    const fe = document.createElementNS(SVG_NS, 'feDisplacementMap') as SVGFEDisplacementMapElement;
    fe.setAttribute('in', 'SourceGraphic');
    fe.setAttribute('in2', `MAP_${mapSuffix}`);
    fe.setAttribute('xChannelSelector', 'R');
    fe.setAttribute('yChannelSelector', 'G');
    fe.setAttribute('result', `DISP_${channel}`);
    return fe;
  };
  const mkChannelMatrix = (channel: 'R' | 'G' | 'B') => {
    const fe = document.createElementNS(SVG_NS, 'feColorMatrix');
    fe.setAttribute('in', `DISP_${channel}`);
    fe.setAttribute('type', 'matrix');
    const m =
      channel === 'R' ? '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' :
      channel === 'G' ? '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' :
                        '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';
    fe.setAttribute('values', m);
    fe.setAttribute('result', `CH_${channel}`);
    return fe;
  };

  const feImageR = mkImage('R');
  const feImageG = mkImage('G');
  const feImageB = mkImage('B');
  const feDispR  = mkDisp('R', 'R', 'SourceGraphic');
  const feDispG  = mkDisp('G', 'G', 'SourceGraphic');
  const feDispB  = mkDisp('B', 'B', 'SourceGraphic');
  const matR = mkChannelMatrix('R');
  const matG = mkChannelMatrix('G');
  const matB = mkChannelMatrix('B');

  const blendGB = document.createElementNS(SVG_NS, 'feBlend');
  blendGB.setAttribute('in', 'CH_G');
  blendGB.setAttribute('in2', 'CH_B');
  blendGB.setAttribute('mode', 'screen');
  blendGB.setAttribute('result', 'GB');

  const blendRGB = document.createElementNS(SVG_NS, 'feBlend');
  blendRGB.setAttribute('in', 'CH_R');
  blendRGB.setAttribute('in2', 'GB');
  blendRGB.setAttribute('mode', 'screen');

  filter.append(feImageR, feImageG, feImageB,
                feDispR,  feDispG,  feDispB,
                matR, matG, matB, blendGB, blendRGB);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);

  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    if (r.width !== shader.width || r.height !== shader.height) {
      regenerateMap(shader, Math.round(r.width), Math.round(r.height));
    }
  });

  // Snapshot inline styles BEFORE mutating, so destroyShader() can faithfully
  // restore whatever the host element had set (including !important flags).
  const styleSnapshot = {
    backdropFilter:               host.style.getPropertyValue('backdrop-filter'),
    backdropFilterPriority:       host.style.getPropertyPriority('backdrop-filter'),
    webkitBackdropFilter:         host.style.getPropertyValue('-webkit-backdrop-filter'),
    webkitBackdropFilterPriority: host.style.getPropertyPriority('-webkit-backdrop-filter'),
  };

  const shader: Shader = {
    filterId, svg, filter,
    feImageR, feImageG, feImageB,
    feDispR,  feDispG,  feDispB,
    canvas, ctx, ro,
    width: 0, height: 0,
    styleSnapshot,
  };

  ro.observe(host);
  // Initial render — synchronous so first paint already shows the lens.
  const r0 = host.getBoundingClientRect();
  regenerateMap(shader, Math.round(r0.width) || 200, Math.round(r0.height) || 60);

  // Apply the combined backdrop-filter.
  // url() displacement works in Safari; Chrome applies only the standard filter fns.
  // No extra blur — keep the lens effect clear; tint alone provides readability.
  const value = `url(#${filterId}) saturate(1.8) brightness(1.05) contrast(1.06)`;
  host.style.setProperty('backdrop-filter', value, 'important');
  host.style.setProperty('-webkit-backdrop-filter', value, 'important');

  return shader;
}

function destroyShader(host: HTMLElement): void {
  const s = _shaders.get(host);
  if (!s) return;
  try { s.ro.disconnect(); } catch { /* swallow */ }
  try { s.svg.remove(); } catch { /* swallow */ }
  try { s.canvas.remove(); } catch { /* swallow */ }
  // Restore inline styles to their pre-tag state (preserves both value and
  // !important flag). An empty captured value means the property wasn't
  // inline before, so we just clear it.
  const snap = s.styleSnapshot;
  host.style.removeProperty('backdrop-filter');
  if (snap.backdropFilter) {
    host.style.setProperty('backdrop-filter', snap.backdropFilter, snap.backdropFilterPriority);
  }
  host.style.removeProperty('-webkit-backdrop-filter');
  if (snap.webkitBackdropFilter) {
    host.style.setProperty('-webkit-backdrop-filter', snap.webkitBackdropFilter, snap.webkitBackdropFilterPriority);
  }
  // Clear the scroll-shine var the hook may have written.
  host.style.removeProperty('--lg-shine-x');
  _shaders.delete(host);
}

/* ───────────────────── Shared cosmetic styles ───────────────────────────── */

let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Semi-transparent tint + very subtle frosting.
  // The dark tint (≈ 45% opaque) makes background text slightly harder to read
  // without overwhelming the displacement-lens refraction effect.
  // The blur in the backdrop-filter above does most of the frosting work;
  // the tint stops the nav from being fully transparent on busy backgrounds.
  style.textContent = `
.${TARGET_CLASS} {
  background: rgba(14,14,18,0.45) !important;
  border: 1px solid rgba(255,255,255,0.48) !important;
  box-shadow:
    0 16px 56px rgba(0,0,0,0.52),
    0 2px 12px rgba(0,0,0,0.30),
    inset 0 2px 0 rgba(255,255,255,0.78),
    inset 0 -1px 0 rgba(255,255,255,0.12) !important;
  isolation: isolate;
}
@media (prefers-color-scheme: light) {
  .${TARGET_CLASS} {
    background: rgba(255,255,255,0.40) !important;
    border: 1px solid rgba(0,0,0,0.12) !important;
    box-shadow:
      0 16px 56px rgba(0,0,0,0.18),
      0 2px 10px rgba(0,0,0,0.10),
      inset 0 2px 0 rgba(255,255,255,0.96),
      inset 0 -1px 0 rgba(0,0,0,0.05) !important;
  }
}
html.light .${TARGET_CLASS},
:root.light .${TARGET_CLASS},
.light .${TARGET_CLASS} {
  background: rgba(255,255,255,0.40) !important;
  border: 1px solid rgba(0,0,0,0.12) !important;
  box-shadow:
    0 16px 56px rgba(0,0,0,0.18),
    0 2px 10px rgba(0,0,0,0.10),
    inset 0 2px 0 rgba(255,255,255,0.96),
    inset 0 -1px 0 rgba(0,0,0,0.05) !important;
}`;
  document.head.appendChild(style);
}

function removeStyles(): void {
  if (!_stylesInjected) return;
  _stylesInjected = false;
  document.getElementById(STYLE_ID)?.remove();
}

/* ───────────────────── Public manager API ────────────────────────────────── */

let _enabled = false;
const _taggedEls = new Set<HTMLElement>();

export function enableLiquidGlass(): void {
  if (_enabled) return;
  if (!liquidGlassPlatformSupported()) return;
  injectStyles();
  _enabled = true;
}

export function disableLiquidGlass(): void {
  _enabled = false;
  for (const el of _taggedEls) {
    el.classList.remove(TARGET_CLASS);
    destroyShader(el);
  }
  _taggedEls.clear();
  removeStyles();
}

export function tagLiquidTarget(el: HTMLElement | null): void {
  if (!el || !_enabled) return;
  if (_shaders.has(el)) return;
  // Transactional: build the shader FIRST. Only commit class + set membership
  // after success, so a thrown createShader() can't leave the element in a
  // half-tagged state (class on, no shader, no map regeneration on resize).
  let shader: Shader;
  try {
    shader = createShader(el);
  } catch (e) {
    console.warn('[liquidGlass] failed to create shader', e);
    return;
  }
  _shaders.set(el, shader);
  _taggedEls.add(el);
  el.classList.add(TARGET_CLASS);
}

export function untagLiquidTarget(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove(TARGET_CLASS);
  _taggedEls.delete(el);
  destroyShader(el);
}

/** No-op kept for API compatibility. */
export function scheduleRefresh(_delay = 0): void { /* no-op */ }
export function isLiquidGlassEnabled(): boolean { return _enabled; }

/* ───────────────────── Debug overlay ─────────────────────────────────────── */

const DEBUG_STYLE_ID = 'liquid-glass-debug-style';
function paintDebugOverlay(on: boolean): void {
  document.getElementById(DEBUG_STYLE_ID)?.remove();
  if (!on) { console.log('[liquidGlass] debug OFF'); return; }
  const style = document.createElement('style');
  style.id = DEBUG_STYLE_ID;
  style.textContent = `.${TARGET_CLASS}{outline:2px dashed #ff2b88!important;outline-offset:2px!important;}`;
  document.head.appendChild(style);
  console.group('[liquidGlass] debug ON');
  console.log({ enabled: _enabled, tagged: _taggedEls.size, platformOk: liquidGlassPlatformSupported() });
  for (const el of _taggedEls) {
    const s = _shaders.get(el);
    const cs = getComputedStyle(el);
    console.log(el, {
      filterId: s?.filterId, mapSize: s ? `${s.width}x${s.height}` : 'n/a',
      backdropFilter: cs.backdropFilter || (cs as any).webkitBackdropFilter,
      rect: el.getBoundingClientRect(),
    });
  }
  console.groupEnd();
}
if (typeof window !== 'undefined') {
  (window as any).__lgDebug = paintDebugOverlay;
  try {
    if (new URLSearchParams(window.location.search).get('lgDebug') === '1') {
      setTimeout(() => paintDebugOverlay(true), 100);
    }
  } catch { /* swallow */ }
}
