// Shadow Bell: keyboard and mouse. WASD or arrows move, Shift runs (loud),
// a mouse click sets a walk target, Enter confirms, P pauses, M mutes.
// The game reads this plain state every frame; nothing here moves anything.
import { HUD_H } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';

export function createInput(canvas, hooks) {
  const input = {
    up: false, down: false, left: false, right: false, run: false,
  };
  const keys = new Set();

  function refresh() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    refresh();
    if (event.code === 'Enter' || event.code === 'Space') hooks.onAction(ACTION_CONFIRM);
    if (event.code === 'KeyP' || event.code === 'Escape') hooks.onAction(ACTION_PAUSE);
    if (event.code === 'KeyM') hooks.onAction(ACTION_MUTE);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    refresh();
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    hooks.onClick(x, y - HUD_H);
  }

  function onBlur() {
    keys.clear();
    refresh();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  return input;
}
