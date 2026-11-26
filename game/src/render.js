// Ember Run: Ashfall Rescue — renderer: pseudo-3D chase view over a dusk
// archipelago under an erupting volcano: ashfall, lava flows, rescue
// beacons, power-ups, the aircraft, cockpit instruments and HUD.
// All art is drawn in code; no external assets, no network.
import {
  COURSE, PALETTE, VIEW, FONT, GAME_NAME, GAME_SHORT, GAME_TAGLINE, SORTIES,
} from './config.js';
import { sortieIndex, gustNow } from './world.js';

const CX = VIEW.width / 2;

function project(cam, px, py, pz) {
  const depth = pz - cam.z;
  if (depth < 8) return null;
  const scale = VIEW.focal / depth;
  return {
    x: CX + (px - cam.x) * scale,
    y: VIEW.horizon - (py - cam.y) * scale,
    s: scale,
    depth,
  };
}

function islandGroundHeight(course, x, z) {
  let h = 0;
  for (const isl of course.islands) {
    if (z >= isl.z0 && z <= isl.z1 && Math.abs(x - isl.x) <= isl.halfW) h = Math.max(h, isl.h);
  }
  return h;
}

function drawLabel(ctx, cam, x, y, z, text, queue) {
  // Labels are queued and flushed after the rings, so ring strokes and
  // beacons never paint over the text.
  queue.push({ x, y, z, text });
}

function flushLabels(ctx, cam, queue) {
  const drawn = [];
  for (const item of queue) {
    const p = project(cam, item.x, item.y, item.z);
    if (!p || p.y < 20 || p.y > 560 || p.s < 0.12) continue;
    const cx = Math.max(90, Math.min(VIEW.width - 90, p.x));
    let clash = false;
    for (const d of drawn) {
      if (Math.abs(d.y - p.y) < 26 && Math.abs(d.x - cx) < 170) { clash = true; break; }
    }
    if (clash) continue;
    drawn.push({ x: cx, y: p.y });
    ctx.font = `700 ${Math.max(11, Math.min(16, 13 * p.s + 8))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,16,24,0.65)';
    const w = ctx.measureText(item.text).width + 12;
    ctx.fillRect(cx - w / 2, p.y - 13, w, 18);
    ctx.fillStyle = '#ffe9c4';
    ctx.fillText(item.text, cx, p.y);
    ctx.textAlign = 'left';
  }
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// Deterministic pseudo-random from an integer seed (for stars, ash, trees).
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function render(ctx, world, screen, best) {
  const s = world.state;
  const course = world.course;
  const W = VIEW.width;
  const H = VIEW.height;
  const cam = { x: s.x, y: s.alt + 26, z: s.z - 70 };
  const labelQueue = []; // labels queued this frame, flushed after the rings

  // Dusk sky: deep violet up top, magenta, ember orange at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.horizon);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.45, PALETTE.skyMid);
  sky.addColorStop(0.85, PALETTE.skyHorizon);
  sky.addColorStop(1, PALETTE.skyEmber);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, VIEW.horizon + 2);

  // Stars fading in at the top of the dusk sky.
  for (let i = 0; i < 64; i += 1) {
    const sx = hash(i * 3 + 1) * W;
    const sy = hash(i * 7 + 2) * 150;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(s.time * 0.9 + i));
    ctx.fillStyle = `rgba(255,244,220,${(0.75 * tw).toFixed(2)})`;
    const r = hash(i * 11 + 5) < 0.12 ? 2 : 1;
    ctx.fillRect(sx, sy, r, r);
  }

  // Low ember sun, big and orange, half-sunk into the ash haze.
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,50,0.9)';
  ctx.shadowBlur = 60;
  ctx.fillStyle = 'rgba(255,178,90,0.95)';
  ctx.beginPath();
  ctx.arc(W - 200, 210, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(W - 200, 210, 84, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,150,70,0.18)';
  ctx.fill();

  // Distant ridge silhouettes on the horizon — depth the flat v1 lacked.
  ctx.fillStyle = 'rgba(58,32,66,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW.horizon);
  for (let x = 0; x <= W; x += 40) {
    ctx.lineTo(x, VIEW.horizon - 26 - 22 * Math.sin(x * 0.011 + 1.3) - 10 * Math.sin(x * 0.027));
  }
  ctx.lineTo(W, VIEW.horizon);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(88,44,74,0.6)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW.horizon);
  for (let x = 0; x <= W; x += 40) {
    ctx.lineTo(x, VIEW.horizon - 10 - 14 * Math.sin(x * 0.017 + 4.1));
  }
  ctx.lineTo(W, VIEW.horizon);
  ctx.closePath();
  ctx.fill();

  // Sea.
  const sea = ctx.createLinearGradient(0, VIEW.horizon, 0, H);
  sea.addColorStop(0, PALETTE.seaShallow);
  sea.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, VIEW.horizon, W, H - VIEW.horizon);
  // Sun glint: one soft, low shimmer band on the water under the low sun.
  const glint = ctx.createLinearGradient(W - 300, VIEW.horizon, W - 100, VIEW.horizon);
  glint.addColorStop(0, 'rgba(255,150,70,0)');
  glint.addColorStop(0.5, 'rgba(255,150,70,0.16)');
  glint.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(W - 300, VIEW.horizon + 4, 200, H - VIEW.horizon - 4);
  for (let i = 0; i < 8; i += 1) {
    const y = VIEW.horizon + 24 + i * 46;
    const wob = Math.sin(s.time * 1.1 + i * 1.7) * 10;
    ctx.fillStyle = `rgba(255,160,80,${(0.14 - i * 0.012).toFixed(2)})`;
    ctx.fillRect(W - 200 + wob - 34 - i * 3, y, 68 + i * 6, 2);
  }
  // Moving swell lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    const zz = cam.z + 120 + i * 260 + (s.z % 260);
    const p = project(cam, 0, 0, zz);
    if (!p) continue;
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(W, p.y);
    ctx.stroke();
  }

  // Clouds (far to near); ash-tinted ones drift near the volcano.
  const clouds = [...course.clouds].sort((a, b) => b.z - a.z);
  for (const c of clouds) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.y < -80 || p.y > VIEW.horizon + 40) continue;
    if (p.depth < 350) continue; // a cloud right at the camera is a wall
    const r = Math.min(120, c.r * p.s);
    if (r < 2) continue;
    ctx.fillStyle = c.ash ? PALETTE.cloudAsh : PALETTE.cloud;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.4, p.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Islands far to near: sand rim, grass top, skirt to the sea, a few trees.
  const islands = [...course.islands].sort((a, b) => b.z1 - a.z1);
  for (const isl of islands) {
    if (isl.z1 < cam.z - 50 || isl.z0 > cam.z + 4200) continue;
    const nearL = project(cam, isl.x - isl.halfW, isl.h, isl.z0);
    const nearR = project(cam, isl.x + isl.halfW, isl.h, isl.z0);
    const farL = project(cam, isl.x - isl.halfW, isl.h, isl.z1);
    const farR = project(cam, isl.x + isl.halfW, isl.h, isl.z1);
    if (!nearL || !nearR || !farL || !farR) continue;
    const top = isl.tone > 0.66 ? PALETTE.sand : isl.tone > 0.33 ? PALETTE.grass : PALETTE.grassDark;
    // Sand rim: a slightly larger, lower quad under the grass top.
    const rimL = project(cam, isl.x - isl.halfW - 14, isl.h - 6, isl.z0);
    const rimR = project(cam, isl.x + isl.halfW + 14, isl.h - 6, isl.z0);
    const rimFL = project(cam, isl.x - isl.halfW - 14, isl.h - 6, isl.z1);
    const rimFR = project(cam, isl.x + isl.halfW + 14, isl.h - 6, isl.z1);
    if (rimL && rimR && rimFL && rimFR) poly(ctx, [rimL, rimR, rimFR, rimFL], PALETTE.sand);
    poly(ctx, [nearL, nearR, farR, farL], top);
    // Front skirt down to the sea.
    const baseL = project(cam, isl.x - isl.halfW, 0, isl.z0);
    const baseR = project(cam, isl.x + isl.halfW, 0, isl.z0);
    if (baseL && baseR) poly(ctx, [nearL, nearR, baseR, baseL], shade(PALETTE.rock, 0.9));
    // A few palm-ish trees on grassy islands.
    if (top !== PALETTE.sand && !isl.runway && !isl.strip) {
      for (let t = 0; t < 3; t += 1) {
        const tx = isl.x - isl.halfW * 0.5 + t * isl.halfW * 0.45;
        const tz = isl.z0 + (isl.z1 - isl.z0) * (0.3 + t * 0.2);
        const tp = project(cam, tx, isl.h, tz);
        if (!tp || tp.y < VIEW.horizon - 10 || tp.y > 600) continue;
        const th = Math.max(4, 26 * tp.s);
        ctx.strokeStyle = '#5a4028';
        ctx.lineWidth = Math.max(1.5, 3 * tp.s);
        ctx.beginPath();
        ctx.moveTo(tp.x, tp.y);
        ctx.lineTo(tp.x + 2 * tp.s, tp.y - th);
        ctx.stroke();
        ctx.fillStyle = PALETTE.grassDark;
        ctx.beginPath();
        ctx.ellipse(tp.x + 2 * tp.s, tp.y - th, th * 0.55, th * 0.22, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Mountains far to near.
  const mountains = [...course.mountains].sort((a, b) => b.z - a.z);
  for (const m of mountains) {
    if (m.z < cam.z - 50 || m.z > cam.z + 4200) continue;
    const baseY = islandGroundHeight(course, m.x, m.z);
    const apex = project(cam, m.x, baseY + m.h, m.z);
    const left = project(cam, m.x - m.base, baseY, m.z);
    const right = project(cam, m.x + m.base, baseY, m.z);
    if (!apex || !left || !right) continue;
    // Lit flank / shadow flank: two-tone cone for depth.
    const mid = { x: apex.x, y: apex.y };
    poly(ctx, [left, mid, { x: (left.x + right.x) / 2, y: Math.max(left.y, right.y) }], shade(PALETTE.rock, 1.05));
    poly(ctx, [mid, right, { x: (left.x + right.x) / 2, y: Math.max(left.y, right.y) }], shade(PALETTE.rockDark, 1.0));
    if (m.volcano) {
      // Erupting crater: pulsing glow, lava streams down both flanks,
      // a lava pool glow at the foot that lights the nearby sea.
      const pulse = 0.75 + 0.25 * Math.sin(s.time * 3.2);
      const crater = { x: apex.x, y: apex.y + (right.y - apex.y) * 0.12 };
      const cw = Math.max(5, (right.x - left.x) * 0.055);
      const ch = Math.max(3, (right.y - apex.y) * 0.06);
      ctx.save();
      ctx.shadowColor = PALETTE.lava;
      ctx.shadowBlur = 30 * pulse;
      ctx.fillStyle = PALETTE.lavaBright;
      ctx.beginPath();
      ctx.ellipse(crater.x, crater.y, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Lava streams.
      for (let i = 0; i < 3; i += 1) {
        const fx = [-0.45, 0.05, 0.5][i];
        const topX = apex.x + (right.x - left.x) * fx * 0.25;
        const topY = apex.y + (right.y - apex.y) * 0.18;
        const botX = apex.x + (right.x - left.x) * fx * 0.62;
        const botY = apex.y + (right.y - apex.y) * (0.55 + 0.18 * i);
        ctx.strokeStyle = `rgba(255,${Math.round(110 + 60 * pulse)},31,0.95)`;
        ctx.lineWidth = Math.max(2, cw * 0.35);
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX + (botX - topX) * 0.5 + 8 * Math.sin(i * 2.4), (topY + botY) / 2, botX, botY);
        ctx.stroke();
      }
      // Lava glow on the sea at the volcano's foot.
      const foot = project(cam, m.x, 2, m.z + 120);
      if (foot && foot.y > VIEW.horizon) {
        const glow = ctx.createRadialGradient(foot.x, foot.y, 4, foot.x, foot.y, 130);
        glow.addColorStop(0, `rgba(255,110,31,${(0.5 * pulse).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(255,110,31,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(foot.x, foot.y, 130, 0, Math.PI * 2);
        ctx.fill();
      }
      // Thick drifting smoke column.
      for (let i = 0; i < 6; i += 1) {
        const drift = ((s.time * 14 + i * 46) % 200) - 40;
        ctx.fillStyle = `rgba(60,50,60,${(0.55 - i * 0.06).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(apex.x + drift * 0.45, apex.y - 24 - i * 26 - drift * 0.08, 20 + i * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      drawLabel(ctx, cam, m.x, islandGroundHeight(course, m.x, m.z) + m.h + 90, m.z, 'EMBER PEAK · 1,840 FT · ERUPTING', labelQueue);
    } else {
      const capL = { x: left.x + (apex.x - left.x) * 0.72, y: left.y + (apex.y - left.y) * 0.72 };
      const capR = { x: right.x + (apex.x - right.x) * 0.72, y: right.y + (apex.y - right.y) * 0.72 };
      poly(ctx, [capL, apex, capR], PALETTE.snow);
    }
  }

  // Intermediate strips: short runway quads on their islands, with labels.
  for (const strip of course.strips) {
    const s0 = project(cam, strip.x - strip.halfW, 26, strip.z0);
    const s1 = project(cam, strip.x + strip.halfW, 26, strip.z0);
    const s2 = project(cam, strip.x + strip.halfW, 26, strip.z1);
    const s3 = project(cam, strip.x - strip.halfW, 26, strip.z1);
    if (s0 && s1 && s2 && s3) {
      poly(ctx, [s0, s1, s2, s3], PALETTE.runway);
      if (strip.z0 - cam.z > -100 && strip.z0 - cam.z < 3200) {
        drawLabel(ctx, cam, strip.x, 60, (strip.z0 + strip.z1) / 2, `${strip.name} STRIP · REFUEL`, labelQueue);
      }
    }
  }
  drawLabel(ctx, cam, 0, 90, (COURSE.runwayZ0 + COURSE.runwayZ1) / 2, 'MERIDIAN FIELD', labelQueue);

  // Runway strip on the runway island.
  const rz0 = COURSE.runwayZ0;
  const rz1 = COURSE.runwayZ1;
  const rw = COURSE.runwayHalfWidth;
  const strip = [
    project(cam, -rw, 32, rz0), project(cam, rw, 32, rz0),
    project(cam, rw, 32, rz1), project(cam, -rw, 32, rz1),
  ];
  if (strip.every(Boolean)) {
    poly(ctx, strip, PALETTE.runway);
    ctx.fillStyle = PALETTE.runwayMark;
    for (let z = rz0 + 120; z < rz1 - 60; z += 260) {
      const a = project(cam, -3, 33, z);
      const b = project(cam, 3, 33, z + 130);
      if (a && b) ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 2, Math.abs(b.y - a.y) + 2);
    }
    for (const zt of [rz0 + 30, rz1 - 60]) {
      const a = project(cam, -rw + 4, 33, zt);
      const b = project(cam, rw - 4, 33, zt + 40);
      if (a && b) ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y) + 3);
    }
  }

  // Rescue beacons: glowing orange light columns with a pulsing ring.
  // Only the next survivor gets a text label, so the beacons never stack
  // their labels on top of each other.
  const nextRescue = world.nextRescue();
  for (const b of course.rescues) {
    if (b.taken) continue;
    const c = project(cam, b.x, b.y, b.z);
    if (!c) continue;
    const pulse = 0.7 + 0.3 * Math.sin(s.time * 4 + b.id);
    const ground = project(cam, b.x, 0, b.z);
    if (ground) {
      const grad = ctx.createLinearGradient(0, c.y, 0, ground.y);
      grad.addColorStop(0, `rgba(255,122,60,${(0.55 * pulse).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255,122,60,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(c.x - 3, c.y, 6, ground.y - c.y);
    }
    if (c.depth < 60) continue; // beacon right at the camera
    const r = Math.min(190, Math.max(4, b.r * c.s * (0.9 + 0.15 * pulse)));
    ctx.save();
    ctx.shadowColor = PALETTE.rescueGlow;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = PALETTE.rescue;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,122,60,0.14)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Survivor dot in the middle.
    ctx.fillStyle = '#ffe9c4';
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(2, r * 0.16), 0, Math.PI * 2);
    ctx.fill();
    if (b === nextRescue) drawLabel(ctx, cam, b.x, b.y + 130, b.z, `SURVIVOR ${b.id} · RESCUE`, labelQueue);
  }

  // Power-ups: floating icons on the ring line.
  for (const p of course.powerups) {
    if (p.taken) continue;
    const c = project(cam, p.x, p.y, p.z);
    if (!c) continue;
    if (c.depth < 60) continue;
    const r = Math.min(56, Math.max(5, p.r * c.s));
    const bob = Math.sin(s.time * 2.5 + p.z) * 4;
    const col = p.kind === 'fuel' ? PALETTE.fuelGreen : p.kind === 'repair' ? PALETTE.repairBlue : PALETTE.shieldBlue;
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(10,16,24,0.75)';
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = col;
    ctx.font = `800 ${Math.max(10, Math.round(r * 0.9))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.kind === 'fuel' ? 'F' : p.kind === 'repair' ? '+' : 'S', c.x, c.y + bob + r * 0.32);
    ctx.textAlign = 'left';
  }

  // Rings far to near, with a guide line down to the ground.
  const rings = [...course.rings].sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    if (ring.taken) continue;
    const c = project(cam, ring.x, ring.y, ring.z);
    if (!c) continue;
    if (c.depth < 60) continue; // a ring right at the camera is a wall
    const r = Math.min(210, Math.max(3, ring.r * c.s));
    const g = project(cam, ring.x, 0, ring.z);
    if (g) {
      ctx.strokeStyle = 'rgba(255,210,63,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = PALETTE.ringGlow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring for depth.
    ctx.strokeStyle = 'rgba(255,210,63,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,210,63,0.10)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels on top of the scene (rings and beacons never cover the text).
  flushLabels(ctx, cam, labelQueue);

  // Next-objective pointer.
  const next = world.nextObjective();
  if (next && screen === 'play') {
    const c = project(cam, next.x, next.y, next.z);
    if (c && (c.x < 60 || c.x > W - 60 || c.y < 60 || c.y > 520)) {
      const ax = Math.max(40, Math.min(W - 40, c.x));
      const ay = Math.max(50, Math.min(500, c.y));
      ctx.fillStyle = next.kind === 'rescue' ? PALETTE.rescue : PALETTE.ring;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(next.kind === 'rescue' ? `✚ RESCUE ${Math.max(0, Math.round(next.z - s.z))}m` : `◈ NEXT RING ${Math.max(0, Math.round(next.z - s.z))}m`, ax, ay - 14);
    }
  }

  // Ashfall: embers and grey ash drifting across the whole frame.
  drawAshfall(ctx, s);

  drawAircraft(ctx, s);
  drawHud(ctx, s, world, screen);
  drawPanel(ctx, s, world);
  if (screen === 'title') drawTitle(ctx, best);
  if (screen === 'paused') drawOverlay(ctx, 'PAUSED', 'Press P to resume · R to restart');
  if (screen === 'over') drawDebrief(ctx, s, best, false);
  if (screen === 'landed') drawDebrief(ctx, s, best, true);
  if (s.messageT > 0 && screen === 'play') {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(s.message, CX, 150);
    ctx.shadowBlur = 0;
  }
}

function drawAshfall(ctx, s) {
  const W = VIEW.width;
  const H = VIEW.height;
  // Glowing embers, denser near the volcano (screen centre-right).
  for (let i = 0; i < 48; i += 1) {
    const seed = i * 13.7;
    const fall = ((s.time * (22 + hash(seed) * 30) + hash(seed + 1) * H) % H);
    const sway = Math.sin(s.time * 0.8 + i) * 22 + s.wind * 0.6;
    const x = (hash(seed + 2) * (W + 120) + sway) % (W + 120) - 60;
    const hot = hash(seed + 3) < 0.55;
    ctx.fillStyle = hot
      ? `rgba(255,${Math.round(140 + 60 * hash(seed + 4))},40,${(0.5 + 0.4 * Math.sin(s.time * 3 + i)).toFixed(2)})`
      : `rgba(205,195,185,${(0.35 + 0.2 * Math.sin(s.time * 2 + i)).toFixed(2)})`;
    const r = hot ? 1.6 + hash(seed + 5) * 1.8 : 1 + hash(seed + 5) * 1.4;
    ctx.beginPath();
    ctx.arc(x, fall, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gust streaks: fast horizontal ash lines when inside a gust zone.
  if (s.gust) {
    ctx.strokeStyle = 'rgba(220,210,200,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i += 1) {
      const y = hash(i * 31) * H;
      const x0 = (hash(i * 17) * VIEW.width + s.time * 320 * (s.wind > 0 ? 1 : -1)) % VIEW.width;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + (s.wind > 0 ? 90 : -90), y + 6);
      ctx.stroke();
    }
  }
}

function drawAircraft(ctx, s) {
  const px = CX;
  const py = 468 - s.pitch * 46;
  // Contrail when pushing hard.
  if (s.throttle > 0.6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, py + 34);
    ctx.lineTo(px - s.bank * 30, py + 96);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-s.bank * 0.55);
  // Shield bubble.
  if (s.shield) {
    ctx.strokeStyle = 'rgba(122,184,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(122,184,255,0.08)';
    ctx.fill();
  }
  // Engine glow.
  if (s.throttle > 0.55) {
    const glow = ctx.createRadialGradient(0, 26, 2, 0, 26, 26 + s.throttle * 22);
    glow.addColorStop(0, 'rgba(255,180,60,0.9)');
    glow.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 26, 26 + s.throttle * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wings.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-14, 6); ctx.lineTo(-118, 34); ctx.lineTo(-112, 44); ctx.lineTo(-12, 20); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6); ctx.lineTo(118, 34); ctx.lineTo(112, 44); ctx.lineTo(12, 20); ctx.closePath();
  ctx.fill();
  // Tail.
  ctx.fillStyle = PALETTE.planeAccent;
  ctx.beginPath();
  ctx.moveTo(-8, 22); ctx.lineTo(-26, 46); ctx.lineTo(-14, 48); ctx.lineTo(0, 30); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 22); ctx.lineTo(26, 46); ctx.lineTo(14, 48); ctx.lineTo(0, 30); ctx.closePath();
  ctx.fill();
  // Fuselage.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(14, -30, 12, 8);
  ctx.quadraticCurveTo(10, 34, 0, 40);
  ctx.quadraticCurveTo(-10, 34, -12, 8);
  ctx.quadraticCurveTo(-14, -30, 0, -58);
  ctx.fill();
  // Canopy.
  ctx.fillStyle = PALETTE.planeGlass;
  ctx.beginPath();
  ctx.ellipse(0, -28, 7, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Accent stripe.
  ctx.fillStyle = PALETTE.planeAccent;
  ctx.fillRect(-12, 2, 24, 5);
  // Blinking nav lights.
  if (Math.sin(s.time * 6) > 0) {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-116, 39, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57d977';
    ctx.beginPath();
    ctx.arc(116, 39, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(ctx, s, world, screen) {
  const W = VIEW.width;
  // Glass panels behind the readouts.
  ctx.fillStyle = 'rgba(10,16,24,0.5)';
  ctx.fillRect(14, 12, 190, 96);
  ctx.fillRect(W - 244, 12, 230, 96);
  ctx.textAlign = 'left';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.fillText(`${Math.round(s.speed)} KT`, 22, 46);
  ctx.fillText(`${Math.round(s.alt)} FT`, 22, 84);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('AIRSPEED', 24, 60);
  ctx.fillText('ALTITUDE', 24, 98);
  ctx.shadowBlur = 0;

  // Compass strip.
  const hdg = Math.round(((s.heading * 180) / Math.PI) % 360 + 360) % 360;
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(CX - 170, 14, 340, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, CX, 37);
  ctx.strokeStyle = PALETTE.muted;
  ctx.beginPath();
  ctx.moveTo(CX, 48);
  ctx.lineTo(CX - 6, 58);
  ctx.lineTo(CX + 6, 58);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ring;
  ctx.fill();
  // Wind indicator under the compass — red and flashing in a gust.
  const gust = s.gust || Math.abs(s.wind) > 30;
  ctx.fillStyle = gust ? PALETTE.bad : PALETTE.text;
  ctx.font = `800 ${gust ? 15 : 13}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(gust ? `⚠ GUST ${s.wind >= 0 ? '→' : '←'} ${Math.abs(Math.round(s.wind))} KT` : `WIND ${s.wind >= 0 ? '→' : '←'} ${Math.abs(Math.round(s.wind))} KT`, CX, 76);

  // Score block with combo meter.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`${s.score}`, W - 22, 44);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`RINGS ${s.rings}/${COURSE.rings}   ✚ RESCUED ${s.rescues}/7   TIME ${Math.max(0, Math.ceil(COURSE.timeLimit - s.time))}s`, W - 22, 66);
  ctx.fillText(`LIVES ${'● '.repeat(Math.max(0, s.lives)).trim()}${s.shield ? '   ⬢ SHIELD' : ''}`, W - 22, 86);
  ctx.textAlign = 'left';
  // Combo meter under the score.
  if (s.combo > 1) {
    ctx.fillStyle = 'rgba(10,16,24,0.55)';
    ctx.fillRect(W - 244, 112, 230, 26);
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`🔥 COMBO x${s.combo}`, W - 129, 130);
    ctx.fillStyle = PALETTE.ringGlow;
    ctx.fillRect(W - 238, 134, 218 * Math.max(0, s.comboT / 7), 4);
    ctx.textAlign = 'left';
  }

  // Throttle + vertical speed, left edge.
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(22, 118, 14, 120);
  ctx.fillStyle = s.throttle > 0.85 ? PALETTE.warn : PALETTE.good;
  ctx.fillRect(22, 118 + (1 - s.throttle) * 120, 14, s.throttle * 120);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('THR', 22, 254);
  // Fuel and damage gauges with icons.
  const gauge = (y, frac, col, label) => {
    ctx.fillStyle = 'rgba(10,16,24,0.6)';
    ctx.fillRect(22, y, 150, 16);
    ctx.fillStyle = col;
    ctx.fillRect(24, y + 2, Math.max(0, 146 * frac), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(label, 180, y + 12);
  };
  gauge(264, s.fuel / 100, s.fuel < 25 ? PALETTE.bad : PALETTE.fuelGreen, `⛽ FUEL ${Math.round(s.fuel)}%`);
  gauge(286, s.damage / 100, s.damage > 60 ? PALETTE.bad : '#ff8a5c', `🔧 DMG ${Math.round(s.damage)}%`);
  // Sortie checklist with rings + rescues.
  ctx.font = `700 12px ${FONT}`;
  SORTIES.forEach((sortie, i) => {
    const done = sortieIndex(s.rings) > i;
    const current = sortieIndex(s.rings) === i;
    ctx.fillStyle = done ? PALETTE.good : current ? PALETTE.ring : PALETTE.muted;
    const ringsDone = Math.max(0, Math.min(sortie.rings, s.rings - SORTIES.slice(0, i).reduce((a, b) => a + b.rings, 0)));
    const rescDone = Math.max(0, Math.min(sortie.rescues, s.rescues - SORTIES.slice(0, i).reduce((a, b) => a + b.rescues, 0)));
    ctx.fillText(`${done ? '✓' : current ? '▶' : '·'} ${sortie.name}  ${ringsDone}/${sortie.rings}◈ ${rescDone}/${sortie.rescues}✚`, 22, 316 + i * 16);
  });
  ctx.fillStyle = s.vspeed > 0 ? PALETTE.good : s.vspeed < -30 ? PALETTE.bad : PALETTE.text;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(`VS ${s.vspeed >= 0 ? '+' : ''}${Math.round(s.vspeed)}`, 44, 150);
  if (s.speed < 72 && screen === 'play') {
    ctx.fillStyle = PALETTE.bad;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — THROTTLE UP', CX, 120);
    ctx.textAlign = 'left';
  }
}

function drawPanel(ctx, s, world) {
  const W = VIEW.width;
  const H = VIEW.height;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 606, W, H - 606);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 606, W, 3);

  // Artificial horizon.
  const hx = 120;
  const hy = 663;
  const hr = 44;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-s.bank * 0.8);
  ctx.translate(0, s.pitch * 34);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-hr, -hr, hr * 2, hr);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-hr, 0, hr * 2, hr);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, 0);
  ctx.lineTo(hr, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 14);

  // Centre: current sortie and next objective.
  const next = world.nextObjective();
  const cur = SORTIES[sortieIndex(s.rings)];
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(cur.name, CX, 640);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(
    next
      ? next.kind === 'rescue'
        ? `Rescue survivor ${Math.max(0, Math.round(next.z - s.z))} m ahead — fly through the orange beacon`
        : `Next ring ${Math.max(0, Math.round(next.z - s.z))} m ahead — F fuel · + repair · S shield`
      : 'All objectives done — land at MERIDIAN FIELD',
    CX, 664,
  );
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('Arrows / WASD fly · W/S throttle · Mouse steers · P pause · M sound', CX, 684);

  // Right: big alt / speed readouts.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(`${Math.round(s.alt)} FT`, W - 120, 652);
  ctx.fillText(`${Math.round(s.speed)} KT`, W - 120, 684);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('ALT', W - 190, 652);
  ctx.fillText('SPD', W - 190, 684);
  ctx.textAlign = 'left';
}

function gradeFor(s) {
  if (s.landed && s.rescues >= 7 && s.rings >= 12) return 'S';
  if (s.landed && s.rescues >= 5) return 'A';
  if (s.landed) return 'B';
  if (s.rescues >= 4 || s.rings >= 8) return 'C';
  return 'D';
}

function drawDebrief(ctx, s, best, landed) {
  const W = VIEW.width;
  const H = VIEW.height;
  ctx.fillStyle = 'rgba(8,14,22,0.62)';
  ctx.fillRect(0, 0, W, H);
  // Panel.
  const pw = 620;
  const ph = 430;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  ctx.fillStyle = 'rgba(16,21,29,0.96)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = PALETTE.ring;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = 'center';
  ctx.fillStyle = landed ? PALETTE.good : PALETTE.bad;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(landed ? 'TOUCHDOWN — RESCUE COMPLETE' : 'FLIGHT OVER', CX, py + 58);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(landed ? s.message : `${s.crashReason} · the volcano keeps the island`, CX, py + 88);
  // Grade badge.
  const grade = gradeFor(s);
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(`GRADE ${grade}`, CX, py + 148);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(`SCORE ${s.score}`, CX, py + 192);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Best ${Math.max(best, s.score)}`, CX, py + 216);
  // Breakdown rows.
  const rows = [
    ['Rings threaded', `${s.rings}/12`, s.brk.ring],
    ['Survivors rescued', `${s.rescues}/7`, s.brk.rescue],
    ['Near misses', `${s.nearMissGiven.size}`, s.brk.nearMiss],
    ['Strips & power-ups', `${s.visitedStrips.size} strips`, s.brk.strip + s.brk.powerup],
    ['Landing + time bonus', landed ? 'landed' : '—', s.brk.landing + s.brk.time],
  ];
  ctx.textAlign = 'left';
  let y = py + 248;
  for (const [label, val, pts] of rows) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(label, px + 48, y);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(val, px + 300, y);
    ctx.fillText(`+${pts}`, px + 470, y);
    y += 26;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`Best combo x${s.bestCombo} · Fuel ${Math.round(s.fuel)}% · Damage ${Math.round(s.damage)}% · ${Math.round(s.time)}s`, CX, py + 396);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('Press R to fly again', CX, py + 418);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(8,14,22,0.42)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lavaBright;
  ctx.font = `800 72px ${FONT}`;
  ctx.shadowColor = 'rgba(255,106,31,0.8)';
  ctx.shadowBlur = 26;
  ctx.fillText(GAME_SHORT, CX, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.rescue;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('A S H F A L L   R E S C U E', CX, 196);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(GAME_TAGLINE, CX, 232);
  // Mission briefing card.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(CX - 330, 258, 660, 168);
  ctx.strokeStyle = PALETTE.ring;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(CX - 330, 258, 660, 168);
  ctx.fillStyle = PALETTE.ring;
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText('MISSION BRIEFING — 7 SURVIVORS WAIT BELOW', CX, 286);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('SORTIE 1 · KORA ATOLL — 3 rings · 2 rescues', CX, 314);
  ctx.fillText('SORTIE 2 · EMBER PEAK — 3 rings · 2 rescues · mind the lava', CX, 338);
  ctx.fillText('SORTIE 3 · ASHFALL RIDGE — 3 rings · 2 rescues · gust winds', CX, 362);
  ctx.fillText('SORTIE 4 · MERIDIAN FIELD — 3 rings · 1 rescue · land it', CX, 386);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('Chain rings and rescues for a combo up to x5 · Grab F fuel, + repair, S shield', CX, 410);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('Arrows or WASD to fly · W / S throttle · Mouse steers · P pause', CX, 458);
  ctx.fillText('3 lives · 12 rings · 7 rescues · 330 seconds · land on the strips to refuel', CX, 484);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('Press ENTER or click to fly', CX, 530);
  if (best > 0) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`Best score: ${best}`, CX, 566);
  }
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, sub) {
  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(title, CX, 300);
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(sub, CX, 344);
  ctx.textAlign = 'left';
}
