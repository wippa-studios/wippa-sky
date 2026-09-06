// ═══════════════════════════════════════════
//  SPRITES — Wippa Sky v2
// ═══════════════════════════════════════════

import { CELL_W, CELL_H, FLOOR_TYPES, COLORS } from './constants.js';

const CACHE_SIZE_LIMIT = 500;

export function initSpriteCache(state) {
  state.spriteCache = new Map();
  state._spriteCacheHits = 0;
  state._spriteCacheMisses = 0;
}

export function getCellSprite(state, type, isNight, zoomBucket) {
  const key = `${type}-${isNight ? 'n' : 'd'}-${zoomBucket}`;
  let entry = state.spriteCache.get(key);
  if (entry) {
    state._spriteCacheHits++;
    return entry;
  }
  state._spriteCacheMisses++;
  entry = renderCellSprite(type, isNight, zoomBucket);
  if (state.spriteCache.size > CACHE_SIZE_LIMIT) {
    const firstKey = state.spriteCache.keys().next().value;
    state.spriteCache.delete(firstKey);
  }
  state.spriteCache.set(key, entry);
  return entry;
}

function renderCellSprite(type, isNight, zoomBucket) {
  const w = Math.round(CELL_W * zoomBucket);
  const h = Math.round(CELL_H * zoomBucket);
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d');

  const colors = COLORS.building[type] || '#475569';
  const dk = COLORS.buildingDark[type] || '#334155';
  const lt = COLORS.buildingLight[type] || '#64748b';

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, lt);
  grad.addColorStop(0.16, colors);
  grad.addColorStop(0.72, dk);
  grad.addColorStop(1, 'rgba(4,13,27,.85)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(3,10,22,.42)';
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, h - 6, 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(3, 3, w - 6, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(3, h - 4.5, w - 6, 1.5);

  const reflection = ctx.createLinearGradient(0, 0, w, h);
  reflection.addColorStop(0, 'rgba(218,255,255,.14)');
  reflection.addColorStop(0.22, 'rgba(255,255,255,0)');
  reflection.addColorStop(0.6, 'rgba(70,214,228,.045)');
  reflection.addColorStop(1, 'rgba(2,10,24,.2)');
  ctx.fillStyle = reflection;
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = 'rgba(192,243,242,.11)';
  ctx.fillRect(1, 1, 1.2, h - 2);
  ctx.fillRect(w - 2.2, 1, 1.2, h - 2);
  ctx.fillStyle = 'rgba(218,251,249,.08)';
  ctx.fillRect(w * 0.5, 3, 1, h - 6);

  return { canvas: offscreen, w, h };
}

export function invalidateSpriteCache(state) {
  if (state.spriteCache) state.spriteCache.clear();
}

export function getSpriteCacheStats(state) {
  const total = state._spriteCacheHits + state._spriteCacheMisses;
  return {
    hits: state._spriteCacheHits,
    misses: state._spriteCacheMisses,
    hitRate: total > 0 ? state._spriteCacheHits / total : 1,
    size: state.spriteCache ? state.spriteCache.size : 0,
  };
}
