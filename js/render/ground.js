const GROUND_Y_OFFSET = 140;

const CAR_COLORS = [
  '#c0392b', '#e74c3c', '#2ecc71', '#3498db', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#34495e'
];

const TRAFFIC_LIGHT_POSITIONS = [0.15, 0.5, 0.85];
const STREETLIGHT_COUNT = 8;
const TREE_COUNT = 10;

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function getNightAmount(state) {
  const dp = state.dayPhase;
  if (dp === 'night') return 1;
  if (dp === 'dusk') return 0.6;
  if (dp === 'dawn') return 0.3;
  return 0;
}

function createCar(canvasW, lane) {
  const dir = lane === 0 ? 1 : -1;
  const speed = 60 + Math.random() * 80;
  const w = 40 + Math.random() * 15;
  let x;
  if (dir === 1) {
    x = -w - Math.random() * canvasW * 0.5;
  } else {
    x = canvasW + Math.random() * canvasW * 0.5;
  }
  return {
    x,
    speed,
    dir,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    w,
    lane
  };
}

export function initGround(state, canvasW) {
  state.cars = [];
  for (let i = 0; i < 6; i++) {
    state.cars.push(createCar(canvasW, i % 2));
  }
}

export function updateGround(state, dt, canvasW) {
  for (const car of state.cars) {
    car.x += car.speed * car.dir * dt;
    if (car.dir === 1 && car.x > canvasW + 60) {
      car.x = -car.w - 30;
    } else if (car.dir === -1 && car.x < -car.w - 60) {
      car.x = canvasW + 30;
    }
  }
}

export function drawTrafficCar(ctx, car, cy, isNight) {
  const w = car.w;
  const h = 18;
  const x = car.x;
  const y = cy - h;
  const dir = car.dir;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (dir === -1) ctx.scale(-1, 1);
  ctx.translate(-w / 2, -h / 2);

  const bodyGrad = ctx.createLinearGradient(0, 0, 0, h);
  bodyGrad.addColorStop(0, car.color);
  bodyGrad.addColorStop(1, lerpColor(car.color, '#000000', 0.25));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(0, 4, w, h - 4, 3);
  ctx.fill();

  ctx.fillStyle = '#87CEEB';
  ctx.globalAlpha = 0.7;
  const cabX = w * 0.25;
  const cabW = w * 0.35;
  ctx.beginPath();
  ctx.roundRect(cabX, 0, cabW, 8, [2, 2, 0, 0]);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect(2, h - 4, 8, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(w - 10, h - 4, 8, 5, 2);
  ctx.fill();

  if (isNight) {
    ctx.fillStyle = '#fff9c4';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(w - 2, 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(w - 2, 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ff1744';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(2, 10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(2, 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(w - 2, 10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(2, 10, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawGround(ctx, state, canvasW, canvasH) {
  const baseY = canvasH - GROUND_Y_OFFSET;
  const nightAmt = getNightAmount(state);
  const roadTop = baseY - 32;
  const roadBottom = baseY + 28;

  if (state.basementDepth && state.basementDepth < 0) {
    const soilTop = baseY;
    const soilBottom = canvasH;
    const soilGrad = ctx.createLinearGradient(0, soilTop, 0, soilBottom);
    soilGrad.addColorStop(0, '#5D4037');
    soilGrad.addColorStop(0.15, '#4E342E');
    soilGrad.addColorStop(0.4, '#3E2723');
    soilGrad.addColorStop(0.7, '#2C1A12');
    soilGrad.addColorStop(1, '#1A0E08');
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, soilTop, canvasW, soilBottom - soilTop);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const ly = soilTop + 12 + i * 14;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      for (let px = 0; px < canvasW; px += 20) {
        ctx.lineTo(px, ly + Math.sin(px * 0.05 + i) * 2);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, soilTop, canvasW, 3);
  }

  const groundGrad = ctx.createLinearGradient(0, roadTop - 10, 0, roadBottom + 10);
  groundGrad.addColorStop(0, lerpColor('#607D8B', '#1a1a2e', nightAmt));
  groundGrad.addColorStop(1, lerpColor('#455A64', '#0d0d1a', nightAmt));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, roadTop - 10, canvasW, (roadBottom + 10) - (roadTop - 10));

  const curbH = 5;
  const curbGrad = ctx.createLinearGradient(0, roadTop - curbH, 0, roadTop);
  curbGrad.addColorStop(0, lerpColor('#9E9E9E', '#3a3a3a', nightAmt));
  curbGrad.addColorStop(1, lerpColor('#757575', '#2a2a2a', nightAmt));
  ctx.fillStyle = curbGrad;
  ctx.fillRect(0, roadTop - curbH, canvasW, curbH);

  const asphGrad = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
  asphGrad.addColorStop(0, lerpColor('#2c2c2c', '#111111', nightAmt));
  asphGrad.addColorStop(0.5, lerpColor('#3a3a3a', '#1a1a1a', nightAmt));
  asphGrad.addColorStop(1, lerpColor('#2c2c2c', '#0e0e0e', nightAmt));
  ctx.fillStyle = asphGrad;
  ctx.fillRect(0, roadTop, canvasW, roadBottom - roadTop);

  ctx.strokeStyle = lerpColor('#ffffff', '#888888', nightAmt * 0.6);
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 12]);
  const dashOffset = -(state.tick * 0.03) % 28;
  ctx.lineDashOffset = dashOffset;
  ctx.beginPath();
  ctx.moveTo(0, (roadTop + roadBottom) / 2);
  ctx.lineTo(canvasW, (roadTop + roadBottom) / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const midY = (roadTop + roadBottom) / 2;
  ctx.fillStyle = lerpColor('#ffcc00', '#997700', nightAmt * 0.5);
  const studSpacing = 40;
  for (let sx = 20; sx < canvasW; sx += studSpacing) {
    ctx.beginPath();
    ctx.arc(sx, midY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const cwBarH = 3;
  const cwGap = 6;
  const cwW = 24;
  ctx.fillStyle = lerpColor('#ffffff', '#aaaaaa', nightAmt * 0.4);
  const cwX = canvasW * 0.5 - cwW / 2;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(cwX, roadTop + 2 + i * (cwBarH + cwGap), cwW, cwBarH);
  }

  ctx.strokeStyle = lerpColor('#555555', '#222222', nightAmt * 0.6);
  ctx.lineWidth = 0.5;
  const seamCount = 8;
  for (let i = 1; i < seamCount; i++) {
    const sx = (canvasW / seamCount) * i;
    ctx.beginPath();
    ctx.moveTo(sx, roadTop - 8);
    ctx.lineTo(sx, roadBottom + 8);
    ctx.stroke();
  }

  const laneY = [roadTop + (roadBottom - roadTop) * 0.25, roadTop + (roadBottom - roadTop) * 0.75];
  for (const car of state.cars) {
    const cy = laneY[car.lane] || laneY[0];
    drawTrafficCar(ctx, car, cy, nightAmt > 0.4);
  }

  for (let i = 0; i < TRAFFIC_LIGHT_POSITIONS.length; i++) {
    const tlx = canvasW * TRAFFIC_LIGHT_POSITIONS[i];
    const poleH = 60;
    const poleBottom = roadTop - 6;
    const poleTop = poleBottom - poleH;

    ctx.strokeStyle = lerpColor('#666666', '#333333', nightAmt);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tlx, poleBottom);
    ctx.lineTo(tlx, poleTop);
    ctx.stroke();

    const armLen = 24;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tlx, poleTop);
    ctx.lineTo(tlx + armLen * (i % 2 === 0 ? 1 : -1), poleTop);
    ctx.stroke();

    const headX = tlx + armLen * (i % 2 === 0 ? 1 : -1);
    const headY = poleTop;
    const headW = 10;
    const headH = 22;
    ctx.fillStyle = lerpColor('#222222', '#111111', nightAmt);
    ctx.beginPath();
    ctx.roundRect(headX - headW / 2, headY - 2, headW, headH, 2);
    ctx.fill();

    const isGreen = (Math.floor(state.tick * 0.005) + i) % 3 === 0;
    const isYellow = !isGreen && (Math.floor(state.tick * 0.005) + i) % 3 === 1;

    const colors = ['#ff1744', '#ff9100', '#00e676'];
    const states = [
      !isGreen && !isYellow,
      isYellow,
      isGreen
    ];

    for (let j = 0; j < 3; j++) {
      const ly = headY + 2 + j * 7;
      ctx.fillStyle = states[j] ? colors[j] : '#1a1a1a';
      ctx.beginPath();
      ctx.arc(headX, ly + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      if (states[j] && nightAmt > 0.2) {
        ctx.globalAlpha = nightAmt * 0.3;
        ctx.fillStyle = colors[j];
        ctx.beginPath();
        ctx.arc(headX, ly + 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  const slSpacing = canvasW / (STREETLIGHT_COUNT + 1);
  for (let i = 1; i <= STREETLIGHT_COUNT; i++) {
    const slx = slSpacing * i;
    const slBase = roadTop - 6;
    const slH = 50 + (i % 2) * 8;
    const slTop = slBase - slH;

    ctx.strokeStyle = lerpColor('#999999', '#444444', nightAmt);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(slx, slBase);
    ctx.lineTo(slx, slTop);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(slx, slTop);
    const armDir = i % 2 === 0 ? -1 : 1;
    ctx.lineTo(slx + armDir * 10, slTop - 3);
    ctx.stroke();

    const lampX = slx + armDir * 10;
    const lampY = slTop - 3;
    ctx.fillStyle = lerpColor('#eeeeee', '#555555', nightAmt * 0.7);
    ctx.beginPath();
    ctx.arc(lampX, lampY, 3, 0, Math.PI * 2);
    ctx.fill();

    if (nightAmt > 0.2) {
      const glowGrad = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 40);
      glowGrad.addColorStop(0, `rgba(255,240,200,${nightAmt * 0.5})`);
      glowGrad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(lampX, lampY, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const treeSpacing = canvasW / (TREE_COUNT + 1);
  for (let i = 1; i <= TREE_COUNT; i++) {
    const tx = treeSpacing * i;
    const treeBase = roadTop - 8;
    const trunkH = 18 + (i % 3) * 4;
    const trunkTop = treeBase - trunkH;

    const swayAngle = state.reducedMotion ? 0 : Math.sin(state.tick * 0.001 + i * 1.3) * 0.04;

    ctx.save();
    ctx.translate(tx, treeBase);
    ctx.rotate(swayAngle);

    ctx.strokeStyle = lerpColor('#5D4037', '#3E2723', nightAmt);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -trunkH);
    ctx.stroke();

    const crownR = 10 + (i % 3) * 3;
    const crownColors = ['#2E7D32', '#388E3C', '#43A047'];
    const crownColor = crownColors[i % 3];
    const darkCrown = lerpColor(crownColor, '#1B5E20', nightAmt);

    const leafGrad = ctx.createRadialGradient(0, -trunkH - crownR * 0.3, 2, 0, -trunkH - crownR * 0.3, crownR);
    leafGrad.addColorStop(0, lerpColor(crownColor, '#1B5E20', nightAmt * 0.5));
    leafGrad.addColorStop(1, darkCrown);
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.arc(0, -trunkH - crownR * 0.3, crownR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lerpColor(crownColor, '#145214', nightAmt * 0.4);
    ctx.beginPath();
    ctx.arc(-crownR * 0.4, -trunkH - crownR * 0.1, crownR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(crownR * 0.35, -trunkH - crownR * 0.2, crownR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  const promenadeGrad = ctx.createLinearGradient(0, roadBottom, 0, roadBottom + 18);
  promenadeGrad.addColorStop(0, lerpColor('#8D6E63', '#3E2723', nightAmt));
  promenadeGrad.addColorStop(1, lerpColor('#6D4C41', '#2C1A12', nightAmt));
  ctx.fillStyle = promenadeGrad;
  ctx.fillRect(0, roadBottom, canvasW, 18);

  ctx.strokeStyle = lerpColor('#A1887F', '#4E342E', nightAmt);
  ctx.lineWidth = 0.5;
  const paveSize = 24;
  for (let px = 0; px < canvasW; px += paveSize) {
    for (let py = roadBottom; py < roadBottom + 18; py += paveSize) {
      ctx.strokeRect(px, py, paveSize, paveSize);
    }
  }

  const belowPromenade = roadBottom + 18;
  const fillGrad = ctx.createLinearGradient(0, belowPromenade, 0, canvasH);
  fillGrad.addColorStop(0, lerpColor('#5D4037', '#2C1A12', nightAmt));
  fillGrad.addColorStop(1, lerpColor('#4E342E', '#1A0E08', nightAmt));
  ctx.fillStyle = fillGrad;
  ctx.fillRect(0, belowPromenade, canvasW, canvasH - belowPromenade);
}
