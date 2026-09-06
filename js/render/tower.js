// tower.js — renders tower cells, interiors, facade effects, crane
// Pure ES module. Canvas 2D context passed as parameter.

import { FLOOR_TYPES, COLORS, mulberry32, CELL_W, CELL_H, GROUND_Y_OFFSET } from '../constants.js';
import { drawElevatorCar } from '../elevators.js';
import { drawSims as drawSimsExt } from '../sims.js';

const DEPTH_EXTRUDE = 6;

function isNightPhase(phase) {
  return phase === 'night' || phase === 'dusk';
}

function dayAlpha(phase) {
  if (phase === 'day') return 1;
  if (phase === 'dawn') return 0.6;
  if (phase === 'dusk') return 0.55;
  return 0.25;
}

function canBuild(state, row, col) {
  const gridRow = state.grid.get(row);
  if (gridRow && gridRow[col]) return false;
  if (col < 0 || col >= state.cols) return false;
  const tool = state.selectedTool;
  if (!tool || tool === 'demolish' || tool === 'inspect') return false;
  if (row < 0) {
    const depth = state.basementDepth || 0;
    if (-row > depth) return false;
  }
  return true;
}

function cellCost(state, row, col) {
  const tool = state.selectedTool;
  if (!tool) return null;
  const floorDef = FLOOR_TYPES[tool];
  if (!floorDef) return null;
  return floorDef.cost || 500;
}

function getMoodTint(tenants, row, col) {
  if (!tenants || tenants.length === 0) return null;
    const cellTenants = tenants.filter(t => t.floor === row && t.col === col);
  if (cellTenants.length === 0) return null;
  const mean = cellTenants.reduce((s, t) => s + (t.mood || 0.5), 0) / cellTenants.length;
  const r = Math.round(255 * (1 - mean));
  const g = Math.round(255 * mean);
  return `rgba(${r},${g},40,0.35)`;
}

export function drawTower(ctx, state) {
  const { grid, cols, zoom, cameraY, canvasW, canvasH, dayPhase, tick } = state;
  const groundY = canvasH - GROUND_Y_OFFSET;
  const towerW = cols * CELL_W * zoom;
  const towerLeft = (canvasW - towerW) / 2;
  const baseY = groundY;
  const isNight = isNightPhase(dayPhase);
  const alpha = dayAlpha(dayPhase);

  ctx.save();
  ctx.globalAlpha = alpha;

  // --- exterior glow ---
  const glowGrad = ctx.createLinearGradient(towerLeft - 60, baseY - 800 * zoom, towerLeft + towerW + 60, baseY);
  glowGrad.addColorStop(0, 'rgba(120,200,255,0.08)');
  glowGrad.addColorStop(0.5, 'rgba(180,220,255,0.04)');
  glowGrad.addColorStop(1, 'rgba(100,180,255,0.06)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(towerLeft - 80, baseY - 900 * zoom, towerW + 160, 950 * zoom);

  // --- glass silhouette shell ---
  drawGlassShell(ctx, towerLeft, baseY, towerW, zoom, isNight, tick);

  // --- visible rows ---
  const highestRow = state.highestFloor || 50;
  const lowestRow = -(state.basementDepth || 0);
  const camY = cameraY || 0;

  for (let row = lowestRow; row <= highestRow; row++) {
    const cellY = baseY - (row + 1) * CELL_H * zoom + camY;
    if (cellY > canvasH + 80 || cellY < -80 - CELL_H * zoom) continue;

    const gridRow = grid.get(row);
    const cellCount = gridRow ? gridRow.length : 0;

    for (let col = 0; col < cols; col++) {
      const cellX = towerLeft + col * CELL_W * zoom;
      const cellW = CELL_W * zoom;
      const cellH = CELL_H * zoom;
      const cell = gridRow ? gridRow[col] : null;

      // --- hover ghost preview (FIX v1 bug: check BEFORE skipping empty cells) ---
      const hovered = state.hoveredCell;
      if (hovered && hovered.row === row && hovered.col === col && !cell) {
        if (canBuild(state, row, col)) {
          ctx.globalAlpha = alpha * 0.45;
          ctx.fillStyle = 'rgba(60,220,100,0.5)';
          ctx.fillRect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
          ctx.strokeStyle = 'rgba(60,220,100,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
          ctx.globalAlpha = alpha;
        } else {
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillStyle = 'rgba(220,60,60,0.45)';
          ctx.fillRect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
          ctx.strokeStyle = 'rgba(220,60,60,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
          ctx.globalAlpha = alpha;
        }
        // cost tooltip near cursor
        const cost = cellCost(state, row, col);
        if (cost !== null) {
          drawCostTooltip(ctx, cellX + cellW / 2, cellY - 12, cost, canBuild(state, row, col));
        }
      }

      if (!cell) continue;

      // --- depth block (3D extrusion) ---
      const depthOff = DEPTH_EXTRUDE * zoom;
      const typeDef = FLOOR_TYPES[cell.type];
      const buildingColor = COLORS.building[cell.type] || '#556';
      const buildingLight = COLORS.buildingLight[cell.type] || '#779';
      const buildingDark = COLORS.buildingDark[cell.type] || '#334';

      // side depth
      ctx.fillStyle = buildingDark;
      ctx.beginPath();
      ctx.moveTo(cellX + cellW, cellY);
      ctx.lineTo(cellX + cellW + depthOff, cellY - depthOff);
      ctx.lineTo(cellX + cellW + depthOff, cellY + cellH - depthOff);
      ctx.lineTo(cellX + cellW, cellY + cellH);
      ctx.closePath();
      ctx.fill();

      // bottom depth
      ctx.fillStyle = buildingDark;
      ctx.beginPath();
      ctx.moveTo(cellX, cellY + cellH);
      ctx.lineTo(cellX + depthOff, cellY + cellH - depthOff);
      ctx.lineTo(cellX + cellW + depthOff, cellY + cellH - depthOff);
      ctx.lineTo(cellX + cellW, cellY + cellH);
      ctx.closePath();
      ctx.fill();

      // --- gradient fill ---
      const fillGrad = ctx.createLinearGradient(cellX, cellY, cellX + cellW, cellY + cellH);
      fillGrad.addColorStop(0, buildingColor);
      fillGrad.addColorStop(0.5, buildingLight);
      fillGrad.addColorStop(1, buildingColor);
      ctx.fillStyle = fillGrad;
      ctx.fillRect(cellX, cellY, cellW, cellH);

      // --- interior dark background ---
      ctx.fillStyle = isNight ? 'rgba(10,12,25,0.85)' : 'rgba(15,18,30,0.65)';
      ctx.fillRect(cellX + 3, cellY + 3, cellW - 6, cellH - 6);

      // --- ceiling / floor lines ---
      ctx.strokeStyle = buildingLight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cellX, cellY);
      ctx.lineTo(cellX + cellW, cellY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cellX, cellY + cellH);
      ctx.lineTo(cellX + cellW, cellY + cellH);
      ctx.stroke();

      // --- interior details ---
      drawFloorInterior(ctx, cell.type, cellX + 3, cellY + 3, cellW - 6, cellH - 6, isNight, row, col);

      // --- reflection ---
      const reflGrad = ctx.createLinearGradient(cellX, cellY, cellX, cellY + cellH);
      reflGrad.addColorStop(0, 'rgba(200,230,255,0.18)');
      reflGrad.addColorStop(0.4, 'rgba(200,230,255,0.04)');
      reflGrad.addColorStop(1, 'rgba(200,230,255,0)');
      ctx.fillStyle = reflGrad;
      ctx.fillRect(cellX, cellY, cellW, cellH * 0.5);

      // --- mullions (window dividers) ---
      if (cell.type !== 'elevator' && cell.type !== 'service') {
        ctx.strokeStyle = 'rgba(160,190,220,0.35)';
        ctx.lineWidth = 1;
        const seg = cellW / 4;
        for (let m = 1; m < 4; m++) {
          ctx.beginPath();
          ctx.moveTo(cellX + seg * m, cellY);
          ctx.lineTo(cellX + seg * m, cellY + cellH);
          ctx.stroke();
        }
        // horizontal mullion
        ctx.beginPath();
        ctx.moveTo(cellX, cellY + cellH * 0.5);
        ctx.lineTo(cellX + cellW, cellY + cellH * 0.5);
        ctx.stroke();
      }

      // --- night window glow ---
      if (isNight) {
        ctx.fillStyle = 'rgba(255,220,120,0.12)';
        ctx.fillRect(cellX + 4, cellY + 4, cellW - 8, cellH - 8);
        // individual lit windows
        const rng = mulberry32(row * 1000 + col * 7 + 1);
        for (let wi = 0; wi < 3; wi++) {
          const wx = cellX + 6 + rng() * (cellW - 16);
          const wy = cellY + 6 + rng() * (cellH - 16);
          const ww = 6 + rng() * 8;
          const wh = 5 + rng() * 6;
          ctx.fillStyle = `rgba(255,210,100,${0.25 + rng() * 0.3})`;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }

      // --- mood overlay ---
      if (state.moodOverlay) {
        const tint = getMoodTint(state.tenants, row, col);
        if (tint) {
          ctx.fillStyle = tint;
          ctx.fillRect(cellX, cellY, cellW, cellH);
        }
      }

      // --- hover highlight on existing cell ---
      if (hovered && hovered.row === row && hovered.col === col && cell) {
        ctx.strokeStyle = 'rgba(100,200,255,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX + 1, cellY + 1, cellW - 2, cellH - 2);
      }
    }

    // --- floor labels every 5 floors on col 0 ---
    if (row % 5 === 0) {
      const labelY = baseY - row * CELL_H * zoom + camY + CELL_H * zoom * 0.5;
      const labelX = towerLeft - 50;
      if (labelY > -20 && labelY < canvasH + 20) {
        ctx.fillStyle = isNight ? 'rgba(180,200,220,0.5)' : 'rgba(80,100,120,0.5)';
        ctx.font = `${10 * zoom}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(String(row), labelX, labelY + 3);
      }
    }
  }

  ctx.globalAlpha = 1;

  // --- vertical edge lights ---
  drawEdgeLights(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, canvasH, camY);

  // --- moving sheen highlight ---
  drawSheen(ctx, towerLeft, baseY, towerW, zoom, tick, canvasH, camY);

  // --- luminous crown at top ---
  drawCrown(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, highestRow, camY);

  // --- construction crane ---
  drawCrane(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, highestRow, camY, state);

  // --- elevator cars ---
  if (state.elevatorCars) {
    drawElevatorCars(ctx, state, towerLeft, baseY, zoom, camY, canvasH);
  }

  // --- tenants ---
  if (state.tenants && typeof drawSimsExt === 'function') {
    drawSimsExt(ctx, state);
  }

  // --- particles ---
  if (state.particles) {
    drawParticles(ctx, state.particles, towerLeft, baseY, zoom, camY);
  }

  // --- drifting motes ---
  drawMotes(ctx, towerLeft, baseY, towerW, zoom, tick, canvasH, camY, isNight);

  ctx.restore();
}

// ===========================================================================
// Glass silhouette shell
// ===========================================================================
function drawGlassShell(ctx, towerLeft, baseY, towerW, zoom, isNight, tick) {
  const shellTop = baseY - 300 * zoom;
  const grad = ctx.createLinearGradient(towerLeft, shellTop, towerLeft + towerW, baseY);
  if (isNight) {
    grad.addColorStop(0, 'rgba(20,30,60,0.6)');
    grad.addColorStop(0.5, 'rgba(30,50,80,0.4)');
    grad.addColorStop(1, 'rgba(15,25,50,0.5)');
  } else {
    grad.addColorStop(0, 'rgba(120,180,220,0.3)');
    grad.addColorStop(0.5, 'rgba(160,200,240,0.15)');
    grad.addColorStop(1, 'rgba(100,160,200,0.25)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(towerLeft, shellTop, towerW, baseY - shellTop);

  // shadow at base
  const shadowGrad = ctx.createLinearGradient(towerLeft, baseY - 30, towerLeft, baseY + 20);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(towerLeft - 40, baseY - 30, towerW + 80, 50);
}

// ===========================================================================
// Edge lights
// ===========================================================================
function drawEdgeLights(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, canvasH, camY) {
  if (!isNight) return;
  const pulse = 0.3 + Math.sin(tick * 0.02) * 0.15;
  ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
  ctx.lineWidth = 2 * zoom;
  const edgeTop = baseY - 300 * zoom + camY;
  ctx.beginPath();
  ctx.moveTo(towerLeft, Math.max(edgeTop, -20));
  ctx.lineTo(towerLeft, baseY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(towerLeft + towerW, Math.max(edgeTop, -20));
  ctx.lineTo(towerLeft + towerW, baseY);
  ctx.stroke();

  // corner dots
  const dotR = 3 * zoom;
  ctx.fillStyle = `rgba(150,220,255,${pulse + 0.2})`;
  ctx.beginPath();
  ctx.arc(towerLeft, Math.max(edgeTop, -20), dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(towerLeft + towerW, Math.max(edgeTop, -20), dotR, 0, Math.PI * 2);
  ctx.fill();
}

// ===========================================================================
// Moving sheen highlight
// ===========================================================================
function drawSheen(ctx, towerLeft, baseY, towerW, zoom, tick, canvasH, camY) {
  const sheenY = baseY - ((tick * 1.2) % 400) * zoom + camY;
  const sheenH = 40 * zoom;
  if (sheenY > canvasH + 50 || sheenY + sheenH < -50) return;
  const sheenGrad = ctx.createLinearGradient(towerLeft, sheenY, towerLeft, sheenY + sheenH);
  sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
  sheenGrad.addColorStop(0.4, 'rgba(255,255,255,0.06)');
  sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  sheenGrad.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(towerLeft, sheenY, towerW, sheenH);
}

// ===========================================================================
// Luminous crown at top
// ===========================================================================
function drawCrown(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, highestRow, camY) {
  const crownY = baseY - (highestRow + 2) * CELL_H * zoom + camY;
  const crownH = 30 * zoom;
  const pulse = isNight ? 0.5 + Math.sin(tick * 0.03) * 0.2 : 0.3;

  const crownGrad = ctx.createLinearGradient(towerLeft, crownY, towerLeft + towerW, crownY + crownH);
  crownGrad.addColorStop(0, `rgba(100,180,255,${pulse * 0.3})`);
  crownGrad.addColorStop(0.5, `rgba(150,220,255,${pulse})`);
  crownGrad.addColorStop(1, `rgba(100,180,255,${pulse * 0.3})`);
  ctx.fillStyle = crownGrad;
  ctx.fillRect(towerLeft, crownY, towerW, crownH);

  // crown glow
  const glowGrad = ctx.createRadialGradient(
    towerLeft + towerW / 2, crownY, 0,
    towerLeft + towerW / 2, crownY, towerW * 0.6
  );
  glowGrad.addColorStop(0, `rgba(150,220,255,${pulse * 0.25})`);
  glowGrad.addColorStop(1, 'rgba(150,220,255,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(towerLeft - towerW * 0.3, crownY - 40 * zoom, towerW * 1.6, 80 * zoom);

  // beacon light
  if (isNight) {
    const beaconX = towerLeft + towerW / 2;
    const beaconR = 4 * zoom;
    const beaconPulse = 0.6 + Math.sin(tick * 0.05) * 0.3;
    ctx.fillStyle = `rgba(255,80,80,${beaconPulse})`;
    ctx.beginPath();
    ctx.arc(beaconX, crownY, beaconR, 0, Math.PI * 2);
    ctx.fill();
    // beacon glow
    const bGlow = ctx.createRadialGradient(beaconX, crownY, 0, beaconX, crownY, 30 * zoom);
    bGlow.addColorStop(0, `rgba(255,80,80,${beaconPulse * 0.3})`);
    bGlow.addColorStop(1, 'rgba(255,80,80,0)');
    ctx.fillStyle = bGlow;
    ctx.beginPath();
    ctx.arc(beaconX, crownY, 30 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===========================================================================
// Construction crane
// ===========================================================================
function drawCrane(ctx, towerLeft, baseY, towerW, zoom, isNight, tick, highestRow, camY, state) {
  if (!state.highestFloor || state.highestFloor < 3) return;

  const craneBaseRow = highestRow + 1;
  const craneX = towerLeft + towerW - 20 * zoom;
  const craneY = baseY - craneBaseRow * CELL_H * zoom + camY;
  const armLen = 120 * zoom;
  const armSway = Math.sin(tick * 0.015) * 8 * zoom;

  ctx.strokeStyle = isNight ? 'rgba(255,200,50,0.7)' : 'rgba(200,160,40,0.8)';
  ctx.lineWidth = 2.5 * zoom;
  ctx.lineCap = 'round';

  // vertical mast
  ctx.beginPath();
  ctx.moveTo(craneX, craneY + 10 * zoom);
  ctx.lineTo(craneX, craneY - 50 * zoom);
  ctx.stroke();

  // horizontal arm
  ctx.beginPath();
  ctx.moveTo(craneX, craneY - 50 * zoom);
  ctx.lineTo(craneX - armLen + armSway, craneY - 50 * zoom);
  ctx.stroke();

  // counterweight arm
  ctx.beginPath();
  ctx.moveTo(craneX, craneY - 50 * zoom);
  ctx.lineTo(craneX + 30 * zoom, craneY - 45 * zoom);
  ctx.stroke();

  // counterweight
  ctx.fillStyle = isNight ? 'rgba(180,120,30,0.8)' : 'rgba(140,100,30,0.9)';
  ctx.fillRect(craneX + 22 * zoom, craneY - 48 * zoom, 16 * zoom, 10 * zoom);

  // cable
  const cableX = craneX - armLen + armSway;
  const cableLen = 40 * zoom + Math.sin(tick * 0.025) * 5 * zoom;
  ctx.strokeStyle = isNight ? 'rgba(200,180,100,0.5)' : 'rgba(150,140,80,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cableX, craneY - 50 * zoom);
  ctx.lineTo(cableX, craneY - 50 * zoom + cableLen);
  ctx.stroke();

  // hook / load
  ctx.fillStyle = isNight ? 'rgba(220,180,60,0.8)' : 'rgba(180,150,50,0.9)';
  ctx.beginPath();
  ctx.arc(cableX, craneY - 50 * zoom + cableLen + 4 * zoom, 4 * zoom, 0, Math.PI * 2);
  ctx.fill();

  // warning light on crane tip
  if (isNight) {
    const wPulse = 0.4 + Math.sin(tick * 0.06) * 0.3;
    ctx.fillStyle = `rgba(255,50,50,${wPulse})`;
    ctx.beginPath();
    ctx.arc(craneX, craneY - 54 * zoom, 3 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===========================================================================
// Elevator cars
// ===========================================================================
function drawElevatorCars(ctx, state, towerLeft, baseY, zoom, camY, canvasH) {
  const isNight = state.dayPhase === 'night' || state.dayPhase === 'dusk';
  for (const car of state.elevatorCars) {
    const shaft = state.elevators.find(e => e.id === car.elevatorId);
    if (!shaft) continue;
    drawElevatorCar(ctx, car, shaft, state, isNight);
  }
}

// ===========================================================================
// Particles
// ===========================================================================
function drawParticles(ctx, particles, towerLeft, baseY, zoom, camY) {
  if (!particles) return;
  particles.forEach(p => {
    const px = towerLeft + p.x * zoom;
    const py = baseY - p.y * zoom + camY;
    const size = (p.size || 2) * zoom;
    ctx.globalAlpha = p.alpha || 0.6;
    ctx.fillStyle = p.color || 'rgba(200,220,255,0.6)';
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ===========================================================================
// Drifting motes
// ===========================================================================
function drawMotes(ctx, towerLeft, baseY, towerW, zoom, tick, canvasH, camY, isNight) {
  const moteCount = 12;
  for (let i = 0; i < moteCount; i++) {
    const rng = mulberry32(i * 31337 + 42);
    const baseX = rng() * towerW;
    const baseYOff = rng() * 500;
    const speed = 0.2 + rng() * 0.4;
    const drift = Math.sin(tick * 0.008 * speed + i * 2.1) * 20;
    const mx = towerLeft + baseX + drift;
    const my = baseY - baseYOff * zoom + camY + Math.sin(tick * 0.005 + i) * 10;
    if (my < -20 || my > canvasH + 20) continue;
    const alpha = isNight ? 0.15 + Math.sin(tick * 0.01 + i) * 0.1 : 0.08 + Math.sin(tick * 0.01 + i) * 0.05;
    const size = (1 + rng()) * zoom;
    ctx.fillStyle = isNight
      ? `rgba(180,210,255,${alpha})`
      : `rgba(200,220,240,${alpha})`;
    ctx.beginPath();
    ctx.arc(mx, my, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===========================================================================
// Cost tooltip
// ===========================================================================
function drawCostTooltip(ctx, x, y, cost, allowed) {
  const text = `$${cost}`;
  ctx.font = '11px monospace';
  const tw = ctx.measureText(text).width;
  const pad = 4;
  const tipW = tw + pad * 2;
  const tipH = 16;
  const tipX = x - tipW / 2;
  const tipY = y - tipH;

  ctx.fillStyle = allowed ? 'rgba(20,40,20,0.85)' : 'rgba(50,15,15,0.85)';
  ctx.beginPath();
  ctx.roundRect(tipX, tipY, tipW, tipH, 3);
  ctx.fill();

  ctx.strokeStyle = allowed ? 'rgba(60,180,80,0.7)' : 'rgba(200,60,60,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tipX, tipY, tipW, tipH, 3);
  ctx.stroke();

  ctx.fillStyle = allowed ? 'rgba(120,255,140,0.9)' : 'rgba(255,120,120,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, tipY + tipH / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ===========================================================================
// drawFloorInterior — detailed per-type interior rendering
// ===========================================================================
export function drawFloorInterior(ctx, type, x, y, w, h, isNight, row, col) {
  const rng = mulberry32(row * 10000 + col * 13 + (type ? type.charCodeAt(0) : 0));
  const lightAlpha = isNight ? 0.7 : 0.4;

  switch (type) {
    case 'office':
      drawOfficeInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'residence':
      drawResidenceInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'hotel':
      drawHotelInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'shop':
      drawShopInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'restaurant':
      drawRestaurantInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'cinema':
      drawCinemaInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'park':
      drawParkInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'spa':
      drawSpaInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'elevator':
      drawElevatorInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'lobby':
      drawLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'skyLobby':
      drawSkyLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'parking':
      drawParkingInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'service':
      drawServiceInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'basementLobby':
      drawBasementLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    case 'subway':
      drawSubwayInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
    default:
      drawDefaultInterior(ctx, x, y, w, h, isNight, rng, lightAlpha);
      break;
  }

  // underground cells: ceiling lights instead of windows
  if (row < 0) {
    drawUndergroundCeilingLight(ctx, x, y, w, isNight, rng);
  }
}

// --- Office ---
function drawOfficeInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  // floor
  ctx.fillStyle = isNight ? 'rgba(30,35,50,0.4)' : 'rgba(40,45,60,0.3)';
  ctx.fillRect(x, y, w, h);

  // desks
  const deskCount = 2 + Math.floor(rng() * 2);
  const deskW = w / (deskCount + 1);
  for (let i = 0; i < deskCount; i++) {
    const dx = x + deskW * (i + 0.3);
    const dy = y + h * 0.5;
    const dw = deskW * 0.6;
    const dh = h * 0.2;

    // desk surface
    ctx.fillStyle = isNight ? 'rgba(70,60,50,0.7)' : 'rgba(90,80,65,0.6)';
    ctx.fillRect(dx, dy, dw, dh);
    // desk edge highlight
    ctx.fillStyle = 'rgba(140,120,90,0.3)';
    ctx.fillRect(dx, dy, dw, 1);

    // monitor
    const monW = dw * 0.45;
    const monH = dh * 0.7;
    const monX = dx + (dw - monW) / 2;
    const monY = dy - monH - 2;
    ctx.fillStyle = isNight ? 'rgba(30,35,50,0.9)' : 'rgba(25,30,45,0.8)';
    ctx.fillRect(monX, monY, monW, monH);
    // screen glow
    const glow = isNight ? 0.25 : 0.12;
    ctx.fillStyle = `rgba(100,180,255,${glow})`;
    ctx.fillRect(monX + 1, monY + 1, monW - 2, monH - 2);
    // screen content lines
    if (monW > 6) {
      ctx.fillStyle = `rgba(140,200,255,${glow * 0.6})`;
      for (let l = 0; l < 3; l++) {
        const lw = monW * (0.3 + rng() * 0.4);
        ctx.fillRect(monX + 2, monY + 2 + l * 3, lw, 1);
      }
    }
    // monitor stand
    ctx.fillStyle = 'rgba(50,50,60,0.6)';
    ctx.fillRect(monX + monW * 0.35, monY + monH, monW * 0.3, 2);

    // chair
    ctx.fillStyle = 'rgba(40,40,55,0.5)';
    ctx.fillRect(dx + dw * 0.35, dy + dh + 1, dw * 0.3, dh * 0.4);
  }

  // ceiling light
  if (isNight) {
    ctx.fillStyle = `rgba(255,230,180,${lightAlpha * 0.15})`;
    ctx.fillRect(x + w * 0.2, y, w * 0.6, 3);
  }

  // person silhouette
  if (rng() > 0.5) {
    const px = x + w * (0.2 + rng() * 0.6);
    const py = y + h * 0.4;
    ctx.fillStyle = `rgba(60,60,80,${isNight ? 0.4 : 0.25})`;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 1.5, py + 2, 3, 5);
  }
}

// --- Residence ---
function drawResidenceInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  // floor
  ctx.fillStyle = isNight ? 'rgba(35,30,25,0.35)' : 'rgba(45,40,35,0.25)';
  ctx.fillRect(x, y, w, h);

  // bed
  const bedW = w * 0.5;
  const bedH = h * 0.35;
  const bedX = x + w * 0.05;
  const bedY = y + h * 0.5;
  // bed frame
  ctx.fillStyle = isNight ? 'rgba(60,50,40,0.6)' : 'rgba(80,70,55,0.5)';
  ctx.fillRect(bedX, bedY, bedW, bedH);
  // mattress
  ctx.fillStyle = isNight ? 'rgba(180,175,165,0.5)' : 'rgba(200,195,185,0.4)';
  ctx.fillRect(bedX + 2, bedY + 1, bedW - 4, bedH - 3);
  // pillow
  ctx.fillStyle = isNight ? 'rgba(220,215,200,0.5)' : 'rgba(235,230,220,0.4)';
  ctx.fillRect(bedX + 3, bedY + 2, bedW * 0.25, bedH * 0.4);
  // blanket fold line
  ctx.strokeStyle = `rgba(150,140,130,${lightAlpha * 0.4})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(bedX + 4, bedY + bedH * 0.5);
  ctx.lineTo(bedX + bedW - 4, bedY + bedH * 0.5);
  ctx.stroke();

  // nightstand
  const nsX = bedX + bedW + 4;
  const nsW = w * 0.12;
  ctx.fillStyle = isNight ? 'rgba(55,48,38,0.6)' : 'rgba(75,65,50,0.5)';
  ctx.fillRect(nsX, bedY + 2, nsW, bedH - 4);
  // lamp
  ctx.fillStyle = `rgba(255,230,150,${isNight ? 0.5 : 0.2})`;
  ctx.fillRect(nsX + nsW * 0.3, bedY - 2, nsW * 0.4, 4);
  if (isNight) {
    ctx.fillStyle = 'rgba(255,230,150,0.08)';
    ctx.beginPath();
    ctx.arc(nsX + nsW * 0.5, bedY, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // rug
  ctx.fillStyle = `rgba(140,80,60,${isNight ? 0.2 : 0.15})`;
  ctx.fillRect(x + w * 0.3, y + h * 0.85, w * 0.4, h * 0.1);

  // window curtain hint
  ctx.fillStyle = `rgba(100,90,80,${isNight ? 0.2 : 0.15})`;
  ctx.fillRect(x + w - 6, y + 2, 4, h * 0.4);
  ctx.fillRect(x + w - 12, y + 2, 4, h * 0.35);
}

// --- Hotel ---
function drawHotelInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(25,30,40,0.35)' : 'rgba(35,40,50,0.25)';
  ctx.fillRect(x, y, w, h);

  // large bed
  const bedW = w * 0.55;
  const bedH = h * 0.38;
  const bedX = x + w * 0.05;
  const bedY = y + h * 0.45;
  ctx.fillStyle = isNight ? 'rgba(50,50,60,0.6)' : 'rgba(70,70,80,0.5)';
  ctx.fillRect(bedX, bedY, bedW, bedH);
  // white sheets
  ctx.fillStyle = isNight ? 'rgba(230,230,240,0.45)' : 'rgba(245,245,250,0.4)';
  ctx.fillRect(bedX + 2, bedY + 1, bedW - 4, bedH - 3);
  // pillows (two)
  ctx.fillStyle = isNight ? 'rgba(240,240,245,0.5)' : 'rgba(250,250,252,0.45)';
  ctx.fillRect(bedX + 4, bedY + 2, bedW * 0.2, bedH * 0.35);
  ctx.fillRect(bedX + 4 + bedW * 0.22, bedY + 2, bedW * 0.2, bedH * 0.35);
  // fold
  ctx.strokeStyle = `rgba(180,180,190,${lightAlpha * 0.3})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(bedX + 4, bedY + bedH * 0.45);
  ctx.lineTo(bedX + bedW - 4, bedY + bedH * 0.45);
  ctx.stroke();

  // side table + phone
  const stX = bedX + bedW + 4;
  ctx.fillStyle = isNight ? 'rgba(50,45,40,0.55)' : 'rgba(65,60,55,0.45)';
  ctx.fillRect(stX, bedY + 4, w * 0.1, bedH - 8);
  // phone
  ctx.fillStyle = 'rgba(40,40,45,0.5)';
  ctx.fillRect(stX + 2, bedY + 5, 4, 3);

  // wardrobe
  const warX = x + w * 0.7;
  const warW = w * 0.25;
  ctx.fillStyle = isNight ? 'rgba(45,40,35,0.5)' : 'rgba(60,55,48,0.4)';
  ctx.fillRect(warX, y + 2, warW, h * 0.35);
  // door handle
  ctx.fillStyle = 'rgba(180,170,140,0.4)';
  ctx.fillRect(warX + warW * 0.45, y + h * 0.15, 2, 4);

  // carpet
  ctx.fillStyle = `rgba(100,60,60,${isNight ? 0.15 : 0.1})`;
  ctx.fillRect(x + w * 0.15, y + h * 0.85, w * 0.6, h * 0.1);
}

// --- Shop ---
function drawShopInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(35,32,40,0.35)' : 'rgba(45,42,50,0.25)';
  ctx.fillRect(x, y, w, h);

  // shelves
  const shelfCount = 2 + Math.floor(rng() * 2);
  for (let s = 0; s < shelfCount; s++) {
    const sx = x + w * (0.05 + s * 0.3);
    const sw = w * 0.25;
    const sh = h * 0.55;
    const sy = y + 2;

    // shelf back
    ctx.fillStyle = isNight ? 'rgba(60,55,50,0.5)' : 'rgba(75,70,65,0.4)';
    ctx.fillRect(sx, sy, sw, sh);

    // shelf boards
    const boardCount = 3;
    for (let b = 0; b < boardCount; b++) {
      const by = sy + sh * (b + 1) / (boardCount + 1);
      ctx.fillStyle = isNight ? 'rgba(80,70,60,0.5)' : 'rgba(100,90,75,0.4)';
      ctx.fillRect(sx, by, sw, 2);

      // items on shelf
      const itemCount = 2 + Math.floor(rng() * 3);
      for (let it = 0; it < itemCount; it++) {
        const ix = sx + 2 + (sw - 4) * it / itemCount;
        const iw = (sw - 4) / itemCount - 1;
        const ih = 3 + rng() * 5;
        const colors = ['rgba(180,80,80,0.5)', 'rgba(80,140,180,0.5)', 'rgba(180,160,80,0.5)', 'rgba(100,160,100,0.5)'];
        ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
        ctx.fillRect(ix, by - ih, iw, ih);
      }
    }
  }

  // counter
  const cX = x + w * 0.05;
  const cY = y + h * 0.75;
  ctx.fillStyle = isNight ? 'rgba(55,50,45,0.6)' : 'rgba(70,65,58,0.5)';
  ctx.fillRect(cX, cY, w * 0.9, h * 0.15);
  // cash register
  ctx.fillStyle = 'rgba(40,40,50,0.5)';
  ctx.fillRect(cX + 4, cY - 3, 6, 5);
}

// --- Restaurant ---
function drawRestaurantInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(30,25,20,0.4)' : 'rgba(40,35,28,0.3)';
  ctx.fillRect(x, y, w, h);

  // tables
  const tableCount = 2;
  for (let t = 0; t < tableCount; t++) {
    const tx = x + w * (0.1 + t * 0.45);
    const ty = y + h * 0.45;
    const tw = w * 0.25;
    const th = h * 0.08;

    // table top
    ctx.fillStyle = isNight ? 'rgba(90,70,50,0.6)' : 'rgba(110,85,60,0.5)';
    ctx.fillRect(tx, ty, tw, th);
    // table edge
    ctx.fillStyle = 'rgba(70,55,40,0.4)';
    ctx.fillRect(tx, ty + th, tw, 1);
    // leg
    ctx.fillStyle = 'rgba(60,50,38,0.5)';
    ctx.fillRect(tx + tw * 0.45, ty + th, tw * 0.1, h * 0.2);

    // plate
    ctx.fillStyle = `rgba(220,215,210,${isNight ? 0.4 : 0.3})`;
    ctx.beginPath();
    ctx.ellipse(tx + tw * 0.5, ty - 1, tw * 0.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // chair
    ctx.fillStyle = 'rgba(50,45,35,0.45)';
    ctx.fillRect(tx + tw * 0.2, ty + th + h * 0.2, tw * 0.2, h * 0.12);
    ctx.fillRect(tx + tw * 0.6, ty + th + h * 0.2, tw * 0.2, h * 0.12);
  }

  // hanging light
  if (isNight) {
    for (let t = 0; t < tableCount; t++) {
      const lx = x + w * (0.22 + t * 0.45);
      const ly = y + 2;
      ctx.fillStyle = `rgba(255,200,100,${lightAlpha * 0.2})`;
      ctx.fillRect(lx - 1, ly, 2, 6);
      ctx.fillStyle = `rgba(255,210,120,0.12)`;
      ctx.beginPath();
      ctx.arc(lx, ly + 8, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // person at table
  if (rng() > 0.4) {
    const ptable = Math.floor(rng() * tableCount);
    const px = x + w * (0.2 + ptable * 0.45) + w * 0.12;
    const py = y + h * 0.38;
    ctx.fillStyle = `rgba(55,50,65,${isNight ? 0.35 : 0.25})`;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 1, py + 2, 2, 4);
  }
}

// --- Cinema ---
function drawCinemaInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(15,12,20,0.6)' : 'rgba(25,20,30,0.45)';
  ctx.fillRect(x, y, w, h);

  // screen
  const scW = w * 0.7;
  const scH = h * 0.35;
  const scX = x + (w - scW) / 2;
  const scY = y + 3;
  ctx.fillStyle = isNight ? 'rgba(180,200,230,0.25)' : 'rgba(160,180,210,0.18)';
  ctx.fillRect(scX, scY, scW, scH);
  // screen glow
  if (isNight) {
    ctx.fillStyle = 'rgba(180,200,240,0.06)';
    ctx.fillRect(scX - 5, scY - 2, scW + 10, scH + 4);
  }

  // rows of seats
  const rows = 2;
  for (let r = 0; r < rows; r++) {
    const seatY = y + h * 0.5 + r * h * 0.22;
    const seatCount = 4 + Math.floor(rng() * 2);
    for (let s = 0; s < seatCount; s++) {
      const sx = x + w * (0.05 + s * 0.15);
      const sw = w * 0.1;
      const sh = h * 0.12;
      // seat back
      ctx.fillStyle = isNight ? 'rgba(80,20,20,0.5)' : 'rgba(100,30,30,0.4)';
      ctx.fillRect(sx, seatY, sw, sh * 0.5);
      // seat bottom
      ctx.fillStyle = isNight ? 'rgba(70,18,18,0.5)' : 'rgba(90,28,28,0.4)';
      ctx.fillRect(sx, seatY + sh * 0.5, sw, sh * 0.5);
      // occupied?
      if (rng() > 0.4) {
        ctx.fillStyle = `rgba(40,35,50,${isNight ? 0.4 : 0.3})`;
        ctx.beginPath();
        ctx.arc(sx + sw * 0.5, seatY + sh * 0.2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // projector beam
  if (isNight) {
    ctx.strokeStyle = 'rgba(200,210,240,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h);
    ctx.lineTo(scX, scY + scH * 0.5);
    ctx.stroke();
  }
}

// --- Park ---
function drawParkInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  // grass
  ctx.fillStyle = isNight ? 'rgba(25,50,25,0.4)' : 'rgba(40,80,40,0.3)';
  ctx.fillRect(x, y, w, h);

  // path
  ctx.fillStyle = isNight ? 'rgba(80,75,65,0.35)' : 'rgba(100,95,85,0.3)';
  ctx.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.15);
  // path edge
  ctx.strokeStyle = `rgba(70,65,55,${lightAlpha * 0.3})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.7);
  ctx.lineTo(x + w * 0.9, y + h * 0.7);
  ctx.stroke();

  // tree
  const treeX = x + w * 0.25;
  const treeY = y + h * 0.35;
  // trunk
  ctx.fillStyle = isNight ? 'rgba(60,40,25,0.5)' : 'rgba(80,55,35,0.4)';
  ctx.fillRect(treeX - 1.5, treeY + 4, 3, h * 0.25);
  // canopy
  ctx.fillStyle = isNight ? 'rgba(30,70,30,0.5)' : 'rgba(50,100,50,0.4)';
  ctx.beginPath();
  ctx.arc(treeX, treeY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isNight ? 'rgba(25,60,25,0.4)' : 'rgba(40,90,40,0.35)';
  ctx.beginPath();
  ctx.arc(treeX - 4, treeY + 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(treeX + 4, treeY + 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // second smaller tree
  if (rng() > 0.3) {
    const t2x = x + w * 0.7;
    const t2y = y + h * 0.3;
    ctx.fillStyle = isNight ? 'rgba(60,40,25,0.4)' : 'rgba(80,55,35,0.35)';
    ctx.fillRect(t2x - 1, t2y + 3, 2, h * 0.18);
    ctx.fillStyle = isNight ? 'rgba(28,65,28,0.45)' : 'rgba(45,95,45,0.35)';
    ctx.beginPath();
    ctx.arc(t2x, t2y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // bench
  const benchX = x + w * 0.55;
  const benchY = y + h * 0.58;
  ctx.fillStyle = isNight ? 'rgba(70,50,30,0.5)' : 'rgba(90,65,40,0.4)';
  ctx.fillRect(benchX, benchY, 12, 3);
  ctx.fillRect(benchX + 1, benchY + 3, 2, 3);
  ctx.fillRect(benchX + 9, benchY + 3, 2, 3);

  // flowers
  if (rng() > 0.5) {
    const fColors = ['rgba(220,80,80,0.4)', 'rgba(220,180,60,0.4)', 'rgba(180,80,180,0.4)'];
    for (let f = 0; f < 3; f++) {
      const fx = x + w * (0.4 + rng() * 0.2);
      const fy = y + h * (0.5 + rng() * 0.15);
      ctx.fillStyle = fColors[Math.floor(rng() * fColors.length)];
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- Spa ---
function drawSpaInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(20,30,40,0.4)' : 'rgba(30,45,55,0.3)';
  ctx.fillRect(x, y, w, h);

  // pool
  const poolX = x + w * 0.05;
  const poolY = y + h * 0.45;
  const poolW = w * 0.9;
  const poolH = h * 0.4;
  ctx.fillStyle = isNight ? 'rgba(40,100,140,0.4)' : 'rgba(60,130,170,0.3)';
  ctx.beginPath();
  ctx.roundRect(poolX, poolY, poolW, poolH, 4);
  ctx.fill();
  // water shimmer
  ctx.fillStyle = `rgba(100,180,220,${isNight ? 0.15 : 0.1})`;
  for (let w2 = 0; w2 < 4; w2++) {
    const wx = poolX + poolW * (0.15 + w2 * 0.2);
    ctx.fillRect(wx, poolY + poolH * 0.3, poolW * 0.12, 1);
  }

  // towels
  const towX = x + w * 0.05;
  ctx.fillStyle = isNight ? 'rgba(220,220,230,0.35)' : 'rgba(240,240,245,0.3)';
  ctx.fillRect(towX, y + 3, 8, 5);
  ctx.fillRect(towX + 10, y + 3, 8, 5);

  // candles
  if (isNight) {
    for (let c = 0; c < 2; c++) {
      const cx = x + w * (0.15 + c * 0.7);
      const cy = y + h * 0.2;
      ctx.fillStyle = 'rgba(200,180,140,0.4)';
      ctx.fillRect(cx - 1, cy, 2, 4);
      ctx.fillStyle = `rgba(255,200,80,${0.3 + Math.sin(rng() * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // plant
  const plX = x + w * 0.85;
  const plY = y + h * 0.2;
  ctx.fillStyle = isNight ? 'rgba(50,35,25,0.5)' : 'rgba(65,48,32,0.4)';
  ctx.fillRect(plX - 3, plY + 3, 6, 5);
  ctx.fillStyle = isNight ? 'rgba(30,70,30,0.5)' : 'rgba(45,90,45,0.4)';
  ctx.beginPath();
  ctx.arc(plX, plY, 5, 0, Math.PI * 2);
  ctx.fill();
}

// --- Elevator ---
function drawElevatorInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(30,30,38,0.6)' : 'rgba(40,40,50,0.5)';
  ctx.fillRect(x, y, w, h);

  // shaft walls
  ctx.strokeStyle = `rgba(80,80,95,${lightAlpha * 0.5})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // door center line
  ctx.strokeStyle = `rgba(100,100,120,${lightAlpha * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + 2);
  ctx.lineTo(x + w * 0.5, y + h - 2);
  ctx.stroke();

  // door rails
  ctx.strokeStyle = `rgba(70,70,85,${lightAlpha * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.stroke();

  // floor indicator
  ctx.fillStyle = `rgba(100,120,140,${lightAlpha * 0.3})`;
  ctx.fillRect(x + w * 0.35, y + 3, w * 0.3, 4);
}

// --- Lobby ---
function drawLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(28,25,22,0.35)' : 'rgba(38,35,30,0.25)';
  ctx.fillRect(x, y, w, h);

  // floor pattern (tiles)
  ctx.strokeStyle = `rgba(80,75,65,${lightAlpha * 0.2})`;
  ctx.lineWidth = 0.5;
  const tileSize = 8;
  for (let tx = x; tx < x + w; tx += tileSize) {
    ctx.beginPath();
    ctx.moveTo(tx, y + h * 0.6);
    ctx.lineTo(tx, y + h);
    ctx.stroke();
  }
  for (let ty = y + h * 0.6; ty < y + h; ty += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, ty);
    ctx.lineTo(x + w, ty);
    ctx.stroke();
  }

  // reception desk
  const rdX = x + w * 0.1;
  const rdY = y + h * 0.4;
  const rdW = w * 0.5;
  const rdH = h * 0.15;
  ctx.fillStyle = isNight ? 'rgba(65,55,42,0.55)' : 'rgba(85,72,55,0.45)';
  ctx.beginPath();
  ctx.roundRect(rdX, rdY, rdW, rdH, 2);
  ctx.fill();
  // desk top
  ctx.fillStyle = isNight ? 'rgba(55,48,38,0.5)' : 'rgba(72,62,48,0.4)';
  ctx.fillRect(rdX, rdY, rdW, 2);

  // receptionist
  if (rng() > 0.3) {
    const rx = rdX + rdW * 0.4;
    const ry = rdY - 5;
    ctx.fillStyle = `rgba(50,45,60,${isNight ? 0.35 : 0.25})`;
    ctx.beginPath();
    ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(rx - 1.5, ry + 2, 3, 5);
  }

  // plants
  const plX = x + w * 0.8;
  ctx.fillStyle = isNight ? 'rgba(45,35,28,0.5)' : 'rgba(60,48,35,0.4)';
  ctx.fillRect(plX - 4, y + h * 0.55, 8, 6);
  ctx.fillStyle = isNight ? 'rgba(28,65,28,0.5)' : 'rgba(42,88,42,0.4)';
  ctx.beginPath();
  ctx.arc(plX, y + h * 0.48, 7, 0, Math.PI * 2);
  ctx.fill();

  // chandelier hint
  if (isNight) {
    ctx.fillStyle = `rgba(255,220,140,${lightAlpha * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + 4, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Sky Lobby ---
function drawSkyLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(20,25,35,0.35)' : 'rgba(30,38,48,0.25)';
  ctx.fillRect(x, y, w, h);

  // panoramic windows
  ctx.fillStyle = isNight
    ? 'rgba(15,20,40,0.5)'
    : 'rgba(140,190,230,0.15)';
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.35);
  // window frames
  ctx.strokeStyle = `rgba(100,120,140,${lightAlpha * 0.3})`;
  ctx.lineWidth = 0.5;
  for (let wf = 0; wf < 3; wf++) {
    const wfx = x + 2 + (w - 4) * (wf + 1) / 4;
    ctx.beginPath();
    ctx.moveTo(wfx, y + 2);
    ctx.lineTo(wfx, y + 2 + h * 0.35);
    ctx.stroke();
  }
  // stars if night
  if (isNight) {
    for (let s = 0; s < 4; s++) {
      const sx = x + 4 + rng() * (w - 8);
      const sy = y + 4 + rng() * (h * 0.3);
      ctx.fillStyle = `rgba(255,255,240,${0.3 + rng() * 0.3})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // lounge seating
  const seatX = x + w * 0.1;
  const seatY = y + h * 0.55;
  ctx.fillStyle = isNight ? 'rgba(50,45,55,0.5)' : 'rgba(65,60,70,0.4)';
  ctx.beginPath();
  ctx.roundRect(seatX, seatY, w * 0.35, h * 0.2, 3);
  ctx.fill();
  // seat cushion
  ctx.fillStyle = isNight ? 'rgba(60,50,70,0.4)' : 'rgba(78,68,85,0.35)';
  ctx.fillRect(seatX + 2, seatY + 2, w * 0.35 - 4, h * 0.12);

  // coffee table
  const ctX = x + w * 0.5;
  const ctY = y + h * 0.6;
  ctx.fillStyle = isNight ? 'rgba(70,60,50,0.5)' : 'rgba(88,75,60,0.4)';
  ctx.fillRect(ctX, ctY, w * 0.2, h * 0.08);
  // items on table
  ctx.fillStyle = `rgba(180,170,160,${isNight ? 0.3 : 0.2})`;
  ctx.fillRect(ctX + 3, ctY + 1, 4, 3);

  // plant
  const plX2 = x + w * 0.85;
  ctx.fillStyle = isNight ? 'rgba(40,32,25,0.45)' : 'rgba(55,45,32,0.4)';
  ctx.fillRect(plX2 - 4, y + h * 0.55, 8, 7);
  ctx.fillStyle = isNight ? 'rgba(25,60,25,0.5)' : 'rgba(40,85,40,0.4)';
  ctx.beginPath();
  ctx.arc(plX2, y + h * 0.48, 6, 0, Math.PI * 2);
  ctx.fill();
}

// --- Parking ---
function drawParkingInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(25,25,28,0.5)' : 'rgba(35,35,38,0.4)';
  ctx.fillRect(x, y, w, h);

  // parking lines
  ctx.strokeStyle = `rgba(200,200,180,${lightAlpha * 0.25})`;
  ctx.lineWidth = 1;
  const spotW = w / 3;
  for (let p = 0; p < 3; p++) {
    const px = x + spotW * p;
    ctx.beginPath();
    ctx.moveTo(px + spotW * 0.5, y + h * 0.2);
    ctx.lineTo(px + spotW * 0.5, y + h * 0.8);
    ctx.stroke();
  }

  // car silhouettes
  if (rng() > 0.4) {
    const carSpot = Math.floor(rng() * 3);
    const cx = x + spotW * carSpot + spotW * 0.15;
    const cy = y + h * 0.3;
    const cw = spotW * 0.7;
    const ch = h * 0.4;
    // body
    ctx.fillStyle = isNight ? 'rgba(50,55,70,0.5)' : 'rgba(70,75,90,0.4)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 3);
    ctx.fill();
    // windows
    ctx.fillStyle = isNight ? 'rgba(30,40,60,0.4)' : 'rgba(50,65,85,0.3)';
    ctx.fillRect(cx + cw * 0.15, cy + 2, cw * 0.3, ch * 0.35);
    ctx.fillRect(cx + cw * 0.55, cy + 2, cw * 0.3, ch * 0.35);
    // headlights
    ctx.fillStyle = `rgba(255,240,180,${isNight ? 0.2 : 0.1})`;
    ctx.fillRect(cx + cw - 1, cy + ch * 0.3, 2, 2);
    ctx.fillRect(cx + cw - 1, cy + ch * 0.6, 2, 2);
  }

  // column
  const colX = x + w * 0.5 - 2;
  ctx.fillStyle = 'rgba(60,60,65,0.4)';
  ctx.fillRect(colX, y, 4, h);
}

// --- Service ---
function drawServiceInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(22,22,25,0.55)' : 'rgba(32,32,35,0.45)';
  ctx.fillRect(x, y, w, h);

  // pipes
  ctx.strokeStyle = `rgba(80,80,90,${lightAlpha * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + 2);
  ctx.lineTo(x + w * 0.2, y + h - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, y + 2);
  ctx.lineTo(x + w * 0.6, y + h - 2);
  ctx.stroke();
  // horizontal pipe
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h * 0.3);
  ctx.lineTo(x + w - 2, y + h * 0.3);
  ctx.stroke();

  // junction box
  ctx.fillStyle = 'rgba(50,50,55,0.5)';
  ctx.fillRect(x + w * 0.35, y + h * 0.15, w * 0.2, h * 0.2);
  // indicator light
  ctx.fillStyle = `rgba(80,200,80,${isNight ? 0.4 : 0.25})`;
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.22, 2, 0, Math.PI * 2);
  ctx.fill();

  // vent
  ctx.fillStyle = 'rgba(45,45,50,0.5)';
  ctx.fillRect(x + w * 0.7, y + h * 0.1, w * 0.2, h * 0.25);
  ctx.strokeStyle = `rgba(60,60,68,${lightAlpha * 0.3})`;
  ctx.lineWidth = 0.5;
  for (let v = 0; v < 4; v++) {
    const vy = y + h * 0.12 + v * 3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.72, vy);
    ctx.lineTo(x + w * 0.88, vy);
    ctx.stroke();
  }

  // warning stripe
  ctx.fillStyle = `rgba(200,180,40,${isNight ? 0.2 : 0.15})`;
  ctx.fillRect(x, y + h - 4, w, 3);
}

// --- Basement Lobby ---
function drawBasementLobbyInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(22,22,28,0.5)' : 'rgba(32,32,38,0.4)';
  ctx.fillRect(x, y, w, h);

  // overhead fluorescent lights
  ctx.fillStyle = `rgba(200,210,220,${lightAlpha * 0.12})`;
  ctx.fillRect(x + w * 0.1, y, w * 0.8, 3);
  if (isNight) {
    ctx.fillStyle = 'rgba(200,210,220,0.04)';
    ctx.fillRect(x + w * 0.05, y + 3, w * 0.9, 8);
  }

  // tile floor
  ctx.strokeStyle = `rgba(60,60,70,${lightAlpha * 0.15})`;
  ctx.lineWidth = 0.5;
  const bTile = 6;
  for (let bx = x; bx < x + w; bx += bTile) {
    ctx.beginPath();
    ctx.moveTo(bx, y + h * 0.7);
    ctx.lineTo(bx, y + h);
    ctx.stroke();
  }
  for (let by = y + h * 0.7; by < y + h; by += bTile) {
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x + w, by);
    ctx.stroke();
  }

  // directory sign
  const signX = x + w * 0.3;
  const signY = y + h * 0.15;
  ctx.fillStyle = isNight ? 'rgba(40,45,55,0.5)' : 'rgba(55,60,70,0.4)';
  ctx.fillRect(signX, signY, w * 0.4, h * 0.12);
  // sign text lines
  ctx.fillStyle = `rgba(160,170,180,${lightAlpha * 0.3})`;
  for (let sl = 0; sl < 2; sl++) {
    ctx.fillRect(signX + 3, signY + 2 + sl * 3, w * 0.35, 1);
  }

  // bench
  ctx.fillStyle = isNight ? 'rgba(55,50,42,0.5)' : 'rgba(72,65,55,0.4)';
  ctx.fillRect(x + w * 0.1, y + h * 0.72, w * 0.3, h * 0.1);
  ctx.fillRect(x + w * 0.1 + 2, y + h * 0.82, 2, h * 0.08);
  ctx.fillRect(x + w * 0.1 + w * 0.28, y + h * 0.82, 2, h * 0.08);
}

// --- Subway ---
function drawSubwayInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(18,18,22,0.55)' : 'rgba(28,28,32,0.45)';
  ctx.fillRect(x, y, w, h);

  // tracks
  ctx.strokeStyle = `rgba(120,115,100,${lightAlpha * 0.35})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.82);
  ctx.lineTo(x + w, y + h * 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.88);
  ctx.lineTo(x + w, y + h * 0.88);
  ctx.stroke();
  // ties
  ctx.strokeStyle = `rgba(80,70,55,${lightAlpha * 0.25})`;
  ctx.lineWidth = 1;
  for (let t = 0; t < 6; t++) {
    const tx = x + w * t / 6;
    ctx.beginPath();
    ctx.moveTo(tx, y + h * 0.8);
    ctx.lineTo(tx, y + h * 0.9);
    ctx.stroke();
  }

  // platform edge
  ctx.fillStyle = isNight ? 'rgba(60,58,50,0.5)' : 'rgba(78,75,65,0.4)';
  ctx.fillRect(x, y + h * 0.68, w, h * 0.12);
  // yellow safety line
  ctx.fillStyle = `rgba(220,200,50,${lightAlpha * 0.3})`;
  ctx.fillRect(x, y + h * 0.68, w, 2);

  // pillars
  ctx.fillStyle = 'rgba(55,55,60,0.4)';
  ctx.fillRect(x + w * 0.3, y + 3, 4, h * 0.65);
  ctx.fillRect(x + w * 0.7, y + 3, 4, h * 0.65);

  // overhead light
  ctx.fillStyle = `rgba(255,240,200,${lightAlpha * 0.1})`;
  ctx.fillRect(x + w * 0.2, y, w * 0.6, 2);

  // person waiting
  if (rng() > 0.5) {
    const px = x + w * (0.4 + rng() * 0.2);
    const py = y + h * 0.55;
    ctx.fillStyle = `rgba(50,48,55,${isNight ? 0.35 : 0.25})`;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 1, py + 2, 2, 5);
  }
}

// --- Default ---
function drawDefaultInterior(ctx, x, y, w, h, isNight, rng, lightAlpha) {
  ctx.fillStyle = isNight ? 'rgba(30,30,35,0.4)' : 'rgba(40,40,45,0.3)';
  ctx.fillRect(x, y, w, h);
}

// --- Underground ceiling light ---
function drawUndergroundCeilingLight(ctx, x, y, w, isNight, rng) {
  if (!isNight) return;
  ctx.fillStyle = 'rgba(255,240,200,0.06)';
  ctx.fillRect(x + w * 0.2, y, w * 0.6, 3);
  ctx.fillStyle = 'rgba(255,240,200,0.03)';
  ctx.fillRect(x + w * 0.1, y + 3, w * 0.8, 8);
}
