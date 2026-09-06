// ═══════════════════════════════════════════
//  CAMERA — Wippa Sky v2
// ═══════════════════════════════════════════

import { CELL_W, CELL_H, GROUND_Y_OFFSET, MAX_FLOORS_ABOVE, MAX_BASEMENTS } from './constants.js';

export function initCamera(state) {
  state.canvasW = window.innerWidth;
  state.canvasH = window.innerHeight;
  state.zoom = Math.min(1, Math.max(0.62, state.canvasW / 760));
}

export function getCameraClamp(state) {
  const baseY = state.canvasH - GROUND_Y_OFFSET;
  const minCamY = -(state.basementDepth + 3) * CELL_H * state.zoom + state.canvasH * 0.3;
  const maxCamY = Math.max(0,
    (state.highestFloor + 3) * CELL_H * state.zoom - state.canvasH + GROUND_Y_OFFSET + 100
  );
  return { minCamY, maxCamY };
}

export function clampCamera(state) {
  const { minCamY, maxCamY } = getCameraClamp(state);
  state.cameraY = Math.max(minCamY, Math.min(maxCamY, state.cameraY));
}

export function smoothCamera(state, dt) {
  if (state._targetCameraY !== undefined) {
    const diff = state._targetCameraY - state.cameraY;
    state.cameraY += diff * Math.min(1, dt * 4);
    if (Math.abs(diff) < 0.5) {
      state.cameraY = state._targetCameraY;
      delete state._targetCameraY;
    }
  }
  clampCamera(state);
}

export function autoFollowBuild(state, row) {
  const towerTop = state.canvasH - GROUND_Y_OFFSET - (row + 2) * CELL_H * state.zoom + state.cameraY;
  const towerBot = state.canvasH - GROUND_Y_OFFSET - (row - 1) * CELL_H * state.zoom + state.cameraY;
  if (towerTop < 0 || towerBot > state.canvasH) {
    state._targetCameraY = Math.max(
      getCameraClamp(state).minCamY,
      Math.min(
        getCameraClamp(state).maxCamY,
        (row - 5) * CELL_H * state.zoom
      )
    );
  }
}

export function handleResize(state) {
  const prevCenterRow = Math.floor(
    (state.cameraY + state.canvasH / 2 - GROUND_Y_OFFSET) / (CELL_H * state.zoom)
  );
  state.canvasW = window.innerWidth;
  state.canvasH = window.innerHeight;
  state.zoom = Math.min(1, Math.max(0.62, state.canvasW / 760));
  state.cameraY = Math.max(0, prevCenterRow * CELL_H * state.zoom);
  clampCamera(state);
}

export function goToFloor(state, floor) {
  state._targetCameraY = Math.max(
    getCameraClamp(state).minCamY,
    Math.min(
      getCameraClamp(state).maxCamY,
      floor * CELL_H * state.zoom
    )
  );
}

export function scrollBy(state, delta) {
  state.cameraY += delta;
  clampCamera(state);
}

export function setZoom(state, newZoom) {
  state.zoom = Math.max(0.5, Math.min(1.6, newZoom));
  clampCamera(state);
}
