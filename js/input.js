// ═══════════════════════════════════════════
//  INPUT — Wippa Sky v2
// ═══════════════════════════════════════════

import { screenToCell } from './state.js';
import { canBuild, buildFloor, demolishFloor } from './grid.js';
import { scrollBy, setZoom, goToFloor, getCameraClamp } from './camera.js';
import { showInfoPanel, closeInfoPanel, addLog, showToast, closeWeeklyReport } from './hud.js';
import { saveGame } from './save.js';
import { FLOOR_TYPES } from './constants.js';
import { spawnSimsForCell } from './sims.js';

let isDragging = false;
let dragStartY = 0;
let dragStartCamY = 0;
let rightDragStartY = 0;
let rightDragStartCamY = 0;
let isRightDragging = false;
let spaceHeld = false;
let spaceDragStartY = 0;
let spaceDragStartCamY = 0;

export function initInput(state, canvas, minimapCanvas) {
  canvas.addEventListener('mousedown', e => handleMouseDown(e, state, canvas));
  canvas.addEventListener('mousemove', e => handleMouseMove(e, state, canvas));
  canvas.addEventListener('mouseup', e => handleMouseUp(e, state, canvas));
  canvas.addEventListener('wheel', e => handleWheel(e, state, canvas), { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  minimapCanvas.addEventListener('mousedown', e => handleMinimapMouseDown(e, state, minimapCanvas));
  minimapCanvas.addEventListener('mousemove', e => handleMinimapMouseMove(e, state, minimapCanvas));
  minimapCanvas.addEventListener('mouseup', e => handleMinimapMouseUp(e, state, minimapCanvas));

  document.addEventListener('keydown', e => handleKeyDown(e, state));
  document.addEventListener('keyup', e => handleKeyUp(e, state));
  window.addEventListener('resize', () => {
    state.canvasW = window.innerWidth;
    state.canvasH = window.innerHeight;
  });
}

function handleMouseDown(e, state, canvas) {
  if (e.button === 0) {
    if (spaceHeld || state.selectedTool === 'select') {
      isDragging = true;
      dragStartY = e.clientY;
      dragStartCamY = state.cameraY;
    }
  } else if (e.button === 2 || e.button === 1) {
    isRightDragging = true;
    rightDragStartY = e.clientY;
    rightDragStartCamY = state.cameraY;
    e.preventDefault();
  }
}

function handleMouseMove(e, state, canvas) {
  if (isRightDragging) {
    const dy = rightDragStartY - e.clientY;
    state.cameraY = rightDragStartCamY + dy;
    clampCamera(state);
    return;
  }
  if (isDragging && (spaceHeld || state.selectedTool === 'select')) {
    const dy = dragStartY - e.clientY;
    state.cameraY = dragStartCamY + dy;
    clampCamera(state);
    return;
  }
  state.hoveredCell = screenToCell(state, e.clientX, e.clientY, state.canvasH, 140);

  const edgeThreshold = 40;
  if (state.selectedTool !== 'select' && state.selectedTool !== 'demolish') {
    if (e.clientY < edgeThreshold) {
      state._edgePan = -2;
    } else if (e.clientY > state.canvasH - edgeThreshold) {
      state._edgePan = 2;
    } else {
      state._edgePan = 0;
    }
  } else {
    state._edgePan = 0;
  }
}

function handleMouseUp(e, state, canvas) {
  if (isRightDragging) {
    isRightDragging = false;
    return;
  }
  if (isDragging) {
    isDragging = false;
    if (Math.abs(e.clientY - dragStartY) < 5) {
      handleClick(state, e.clientX, e.clientY);
    }
  }
  state._edgePan = 0;
}

function handleClick(state, sx, sy) {
  const cell = screenToCell(state, sx, sy, state.canvasH, 140);
  if (!cell) return;
  const { row, col } = cell;

  if (state.selectedTool === 'select') {
    showInfoPanel(state, row, col);
  } else if (state.selectedTool === 'demolish') {
    const result = demolishFloor(state, row, col);
    if (result) {
      addLog(state, `💥 Demolished floor ${row < 0 ? 'B' + Math.abs(row) : 'F' + (row + 1)}. Refunded $${(result.refund / 1000).toFixed(0)}k`, 'expense');
    }
  } else {
    if (canBuild(state, row, col, state.selectedTool)) {
      const success = buildFloor(state, row, col, state.selectedTool);
      if (success) {
        addLog(state, `${FLOOR_TYPES[state.selectedTool].icon} Built ${FLOOR_TYPES[state.selectedTool].name} on ${row < 0 ? 'B' + Math.abs(row) : 'F' + (row + 1)}`, 'info');
        if (state.selectedTool !== 'elevator' && state.selectedTool !== 'lobby') {
          spawnSimsForCell(state, row, col, state.selectedTool);
        }
      }
    }
  }
}

function handleWheel(e, state, canvas) {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(state, state.zoom + zoomDelta);
  } else {
    state.cameraY += e.deltaY * 0.8;
    clampCamera(state);
  }
}

let minimapDragging = false;

function handleMinimapMouseDown(e, state, minimapCanvas) {
  minimapDragging = true;
  navigateMinimap(e, state, minimapCanvas);
}

function handleMinimapMouseMove(e, state, minimapCanvas) {
  if (minimapDragging) navigateMinimap(e, state, minimapCanvas);
}

function handleMinimapMouseUp(e, state, minimapCanvas) {
  minimapDragging = false;
}

function navigateMinimap(e, state, minimapCanvas) {
  const rect = minimapCanvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / minimapCanvas.height;
  const highest = state.highestFloor + 2;
  const lowest = Math.min(state.basementDepth - 2, -2);
  const totalFloors = highest - lowest;
  state._targetCameraY = (1 - ratio) * totalFloors * 40 * state.zoom - state.canvasH / 2;
  clampCamera(state);
}

function handleKeyDown(e, state) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); spaceHeld = true; }
  if (e.key === 'Escape') { closeInfoPanel(); closeWeeklyReport(); }
  if (e.key === 'h' || e.key === 'H') {
    state.moodOverlay = !state.moodOverlay;
    state.settings.showMoodOverlay = state.moodOverlay;
    showToast(state.moodOverlay ? 'Mood overlay ON' : 'Mood overlay OFF', 'info');
  }
  if (e.key === '1') document.querySelector('[data-tool="office"]')?.click();
  if (e.key === '2') document.querySelector('[data-tool="residence"]')?.click();
  if (e.key === '3') document.querySelector('[data-tool="hotel"]')?.click();
  if (e.key === '4') document.querySelector('[data-tool="shop"]')?.click();
  if (e.key === '5') document.querySelector('[data-tool="restaurant"]')?.click();
  if (e.key === '6') document.querySelector('[data-tool="cinema"]')?.click();
  if (e.key === '7') document.querySelector('[data-tool="park"]')?.click();
  if (e.key === '8') document.querySelector('[data-tool="spa"]')?.click();
  if (e.key === 'e' || e.key === 'E') document.querySelector('[data-tool="elevator"]')?.click();
  if (e.key === 'd' || e.key === 'Delete') document.querySelector('[data-tool="demolish"]')?.click();
  if (e.key === 's' || e.key === 'S') document.querySelector('[data-tool="select"]')?.click();
  if (e.key === 'ArrowUp') { e.preventDefault(); scrollBy(state, -80); }
  if (e.key === 'ArrowDown') { e.preventDefault(); scrollBy(state, 80); }
  if (e.key === 'PageUp') { e.preventDefault(); scrollBy(state, -80 * 5); }
  if (e.key === 'PageDown') { e.preventDefault(); scrollBy(state, 80 * 5); }
  if (e.key === 'Home') { e.preventDefault(); goToFloor(state, 0); }
  if (e.key === 'End') { e.preventDefault(); goToFloor(state, state.highestFloor + 5); }
}

function handleKeyUp(e, state) {
  if (e.key === ' ') spaceHeld = false;
}

function clampCamera(state) {
  const clamp = getCameraClamp(state);
  state.cameraY = Math.max(clamp.minCamY, Math.min(clamp.maxCamY, state.cameraY));
}
