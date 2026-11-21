// Shadow Bell: everything the player sees, painted on one canvas. Night
// colours, moonlight floor, amber vision cones that hug the walls (each cone
// is raycast, so a crate or a wall really cuts it short), and a HUD that
// always tells you how close you are to being seen.
import {
  TILE, COLS, ROWS, HUD_H, VIEW_W, VIEW_H, GUARD_SIGHT_RANGE,
  GUARD_HALF_ANGLE,
} from './config.js';
import { tileCenter } from './levels.js';
import { solidAtPixel, highestSuspicion, anyGuardAlerted } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_CLEAR = 'level-clear';
export const SCREEN_GAME_OVER = 'game-over';
export const SCREEN_WIN = 'win';

const FLOOR_A = '#20294a';
const FLOOR_B = '#1c2542';
const WALL_TOP = '#55638f';
const WALL_FACE = '#333e63';

function conePolygon(world, guard) {
  // Cast a fan of rays; each stops at the first wall or crate it meets,
  // so the cone ends where the guard's sight really ends.
  const points = [{ x: guard.x, y: guard.y }];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const angle = guard.angle - GUARD_HALF_ANGLE + (2 * GUARD_HALF_ANGLE * i) / steps;
    let reach = GUARD_SIGHT_RANGE;
    for (let d = 8; d <= GUARD_SIGHT_RANGE; d += 8) {
      const x = guard.x + Math.cos(angle) * d;
      const y = guard.y + Math.sin(angle) * d;
      if (solidAtPixel(world, x, y)) { reach = d; break; }
    }
    points.push({ x: guard.x + Math.cos(angle) * reach, y: guard.y + Math.sin(angle) * reach });
  }
  return points;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function drawFloor(world) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.fillStyle = (col + row) % 2 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(col * TILE, HUD_H + row * TILE, TILE, TILE);
      }
    }
    // Moonlight pools: soft pale circles that say "open ground, be careful".
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#cdd8ff';
    for (const [cx, cy] of [[280, 240], [840, 420], [560, 560]]) {
      ctx.beginPath();
      ctx.arc(cx, HUD_H + cy, 150, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWallsAndCover(world) {
    world.solidSet.forEach((key) => {
      const [col, row] = key.split(',').map(Number);
      const x = col * TILE;
      const y = HUD_H + row * TILE;
      const isCrate = world.crateSet && world.crateSet.has(key);
      if (isCrate) {
        ctx.fillStyle = '#6b4a2b';
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.strokeStyle = '#8a6238';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + TILE - 5, y + TILE - 5);
        ctx.moveTo(x + TILE - 5, y + 5);
        ctx.lineTo(x + 5, y + TILE - 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = WALL_FACE;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y + 8, TILE, 4);
      }
    });
    world.bushSet.forEach((key) => {
      const [col, row] = key.split(',').map(Number);
      const cx = col * TILE + TILE / 2;
      const cy = HUD_H + row * TILE + TILE / 2;
      ctx.fillStyle = '#1e4d2c';
      for (const [ox, oy, r] of [[-12, -8, 16], [10, -10, 15], [0, 8, 17], [-4, 0, 18]]) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2f6b3e';
      for (const [ox, oy] of [[-14, -6], [8, -12], [2, 10], [-2, -2]]) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawShard(world, shard, time) {
    const center = tileCenter(shard.col, shard.row);
    const cy = HUD_H + center.y;
    const bob = Math.sin(time * 2.4 + shard.col) * 3;
    const glow = 0.55 + Math.sin(time * 3 + shard.row) * 0.2;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(center.x, cy + bob, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A little bell: dome, skirt, clapper.
    ctx.fillStyle = '#ffcf4d';
    ctx.beginPath();
    ctx.arc(center.x, cy + bob - 2, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(center.x - 11, cy + bob - 2, 22, 4);
    ctx.beginPath();
    ctx.arc(center.x, cy + bob + 6, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9a8';
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', center.x, cy + bob - 16);
  }

  function drawExit(world, time) {
    const center = tileCenter(world.exit.x, world.exit.y);
    const cy = HUD_H + center.y;
    const open = world.exitOpen;
    const pulse = open ? 0.75 + Math.sin(time * 4) * 0.25 : 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = open ? '#3ddc84' : '#5a6b8a';
    ctx.beginPath();
    ctx.arc(center.x, cy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = open ? '#0d3b26' : '#2c3550';
    ctx.beginPath();
    ctx.arc(center.x, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = open ? '#3ddc84' : '#7c8aa8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, cy, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = open ? '#7dffa8' : '#93a2c2';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : '🔒', center.x, cy + 1);
    ctx.textBaseline = 'alphabetic';
    if (!open) {
      const left = world.shards.filter((s) => !s.taken).length;
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${left} bell${left === 1 ? '' : 's'} to wake`, center.x, cy + 32);
    }
  }

  function drawCone(world, guard) {
    const points = conePolygon(world, guard);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, HUD_H + points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, HUD_H + points[i].y);
    ctx.closePath();
    const alerted = guard.alerted || guard.suspicion >= 100;
    const suspicious = guard.suspicion > 35;
    ctx.fillStyle = alerted
      ? 'rgba(255, 70, 70, 0.42)'
      : suspicious ? 'rgba(255, 140, 50, 0.38)' : 'rgba(255, 183, 77, 0.34)';
    ctx.fill();
    // A bright rim, so the cone reads as light spilling from the guard.
    ctx.strokeStyle = alerted
      ? 'rgba(255, 120, 120, 0.6)'
      : 'rgba(255, 214, 120, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawGuard(world, guard, time) {
    const cy = HUD_H + guard.y;
    const alerted = guard.alerted;
    ctx.save();
    // Body: a watchman in a crimson coat, facing where he looks.
    ctx.fillStyle = alerted ? '#e03131' : '#c24545';
    ctx.beginPath();
    ctx.arc(guard.x, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d2a2a';
    ctx.beginPath();
    ctx.arc(guard.x, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(guard.x, cy);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 20, cy + Math.sin(guard.angle) * 20);
    ctx.stroke();
    // Suspicion: a "?" while unsure, a "!" once the chase is on.
    if (guard.suspicion > 12 || alerted) {
      ctx.fillStyle = alerted ? '#ff5252' : '#ffb020';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(alerted ? '!' : '?', guard.x, cy - 24);
    }
    // A thin ring shows how sure this guard is.
    if (guard.suspicion > 2 && guard.suspicion < 100) {
      ctx.strokeStyle = 'rgba(255, 176, 32, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, cy, 21, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(world, time) {
    const player = world.player;
    const cy = HUD_H + player.y;
    const blink = world.graceLeft > 0 && Math.floor(time * 8) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    // Hooded shadow in a deep indigo cloak, with the little bell at its belt.
    ctx.fillStyle = '#6d5df0';
    ctx.beginPath();
    ctx.arc(player.x, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241d4d';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 4, cy + Math.sin(player.angle) * 4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(player.x - Math.cos(player.angle) * 8, cy - Math.sin(player.angle) * 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.hidden) {
      ctx.fillStyle = '#7dffa8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', player.x, cy - 22);
    }
    if (world.clickTarget) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(world.clickTarget.x, HUD_H + world.clickTarget.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(world, view) {
    ctx.fillStyle = '#12172a';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = '#2c3550';
    ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Level ${world.levelIndex + 1} · ${world.levelName}`, 16, HUD_H / 2 - 10);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#9aa7c9';
    ctx.fillText(world.levelHint, 16, HUD_H / 2 + 12);
    // Shards, lives, score, suspicion — right side, left to right.
    const taken = world.shards.filter((s) => s.taken).length;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'right';
    ctx.fillText(`◆ ${taken}/${world.shards.length}`, VIEW_W - 330, HUD_H / 2);
    ctx.fillStyle = '#ff6b81';
    ctx.fillText('♥'.repeat(Math.max(0, world.lives)) || '—', VIEW_W - 250, HUD_H / 2);
    ctx.fillStyle = '#e8ecf8';
    ctx.fillText(`Score ${world.score}`, VIEW_W - 150, HUD_H / 2);
    const suspicion = Math.round(highestSuspicion(world));
    const alerted = anyGuardAlerted(world);
    ctx.textAlign = 'left';
    ctx.fillStyle = alerted ? '#ff5252' : suspicion > 35 ? '#ffb020' : '#7c8aa8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(alerted ? 'SPOTTED!' : suspicion > 35 ? 'SUSPICIOUS' : 'UNSEEN', VIEW_W - 130, HUD_H / 2 - 11);
    ctx.fillStyle = '#2c3550';
    ctx.fillRect(VIEW_W - 130, HUD_H / 2 + 2, 110, 8);
    ctx.fillStyle = alerted ? '#ff5252' : suspicion > 35 ? '#ffb020' : '#3ddc84';
    ctx.fillRect(VIEW_W - 130, HUD_H / 2 + 2, Math.round(110 * (suspicion / 100)), 8);
    ctx.textBaseline = 'alphabetic';
    if (view.muted) {
      ctx.fillStyle = '#9aa7c9';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('muted (M)', VIEW_W - 16, HUD_H - 8);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 22, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 4 + i * 28);
    });
  }

  function draw(world, view, time) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#12172a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawFloor(world);
    for (const guard of world.guards) drawCone(world, guard);
    drawWallsAndCover(world);
    for (const shard of world.shards) {
      if (!shard.taken) drawShard(world, shard, time);
    }
    drawExit(world, time);
    for (const guard of world.guards) drawGuard(world, guard, time);
    drawPlayer(world, time);
    drawHud(world, view);

    if (view.screen === SCREEN_TITLE) {
      overlay('SHADOW BELL', [
        'A silent thief. Three moon bells. One way out — unseen.',
        'WASD / arrows to move · Shift to run (loud!) · Click to walk there',
        'Bushes hide you · Crates block their sight · Fill the suspicion ring and they chase',
        'Collect all 3 bells to wake the exit, then slip out.',
        '',
        'Press Enter or click to begin  ·  P pauses  ·  M mutes',
      ], '#ffd76a');
    } else if (view.screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Take a breath. The patrols wait for no one — except now.', 'Press P or Enter to keep sneaking.'], '#9aa7c9');
    } else if (view.screen === SCREEN_LEVEL_CLEAR) {
      overlay('LEVEL CLEAR', [
        `${world.levelName} — slipped through unseen.`,
        `Score ${world.score}  ·  Best ${view.best}`,
        'Press Enter for the next level.',
      ], '#3ddc84');
    } else if (view.screen === SCREEN_GAME_OVER) {
      overlay('CAUGHT', [
        'The watch caught you in the lamplight.',
        `Score ${world.score}  ·  Best ${view.best}`,
        'Press Enter to try the gallery again.',
      ], '#ff5252');
    } else if (view.screen === SCREEN_WIN) {
      overlay('THE BELLS ARE YOURS', [
        'All three galleries, all three bells — and no one ever saw you.',
        `Final score ${world.score}  ·  Best ${view.best}`,
        'Press Enter to play again.',
      ], '#ffd76a');
    }
  }

  return { draw };
}
