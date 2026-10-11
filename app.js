import { Runner, WORLD, PHYSICS, LEVEL_NAMES, SPACING_DELTAS, heightToLevel } from './game.js';
import { OUTCOMES, NOISE_LEVELS, idealDistribution } from './quantum.js';
import { Renderer } from './renderer.js';

const $ = id => document.getElementById(id);
const padded = value => String(value).padStart(5, '0');
const descriptions = [
  'Grounded. Interference keeps the next pattern predictable.',
  'A little phase noise. The world starts to lose its rhythm.',
  'Less interference. More ways for the terrain to surprise you.',
  'Strong phase noise. Predictable patterns are slipping away.',
  'Fully dephased ideal model. All four outcomes are equally likely.',
];

export function createApp() {
  let table = null;
  function viewportWidth() {
    return Math.min(WORLD.width, Math.max(480, Math.round($('game').getBoundingClientRect().width * 1.35)));
  }
  $('game').width = viewportWidth();
  let game = new Runner({ levels: NOISE_LEVELS.map(p => ({ probabilities: idealDistribution(p) })) }, 2026, $('game').width);
  const renderer = new Renderer($('game'));
  let highScore = 0;
  let inspectHeight = 0;
  let accumulator = 0;
  let lastTime = null;
  let lastTelemetry = 0;
  let lastState = 'ready';
  let metadata = {};

  const columns = OUTCOMES.map((outcome, index) => {
    const column = document.createElement('div');
    column.className = 'histogram-column';
    column.innerHTML = `<div class="bar-value">—</div><div class="bar-area"><div class="bar-ideal"></div><div class="bar-measured"></div></div><div class="bar-label">${outcome}</div><div class="bar-delta">${index ? `${Math.round(SPACING_DELTAS[index] * 100)}% gap` : 'normal'}</div>`;
    $('histogram').append(column);
    return column;
  });

  function announce(message) { $('announcement').textContent = message; }

  function telemetry() {
    const running = game.state === 'running';
    const height = running || game.state === 'over' ? game.height : inspectHeight;
    const level = heightToLevel(height);
    $('level-name').textContent = LEVEL_NAMES[level];
    $('noise-value').textContent = `p = ${NOISE_LEVELS[level].toFixed(3)}`;
    $('atmosphere-copy').textContent = descriptions[level];
    $('altitude-label').textContent = `${Math.round(height)} px`;
    $('explore').disabled = running || !table;
    if (running) $('explore').value = Math.min(160, Math.round(height));
    [...$('noise-track').children].forEach((segment, i) => segment.classList.toggle('active', i <= level));
    $('score').textContent = padded(game.score);
    $('high-score').textContent = padded(Math.max(highScore, game.score));
    $('speed').textContent = `${(game.speed / PHYSICS.initialSpeed).toFixed(2)}×`;
    $('world-state').textContent = table ? `WORLD / ${LEVEL_NAMES[level]}` : 'WORLD / INITIALIZING';
    $('seed').disabled = running || game.state === 'paused';
    const selected = game.lastMeasurement;
    if (table) {
      const values = table.levels[level];
      columns.forEach((column, i) => {
        column.querySelector('.bar-value').textContent = `${(values.probabilities[i] * 100).toFixed(1)}%`;
        column.querySelector('.bar-measured').style.height = `${values.probabilities[i] * 100}%`;
        column.querySelector('.bar-ideal').style.height = `${values.ideal[i] * 100}%`;
        column.classList.toggle('selected', Boolean(selected && selected.level === level && selected.outcome === i));
      });
      $('histogram').setAttribute('aria-label', `Noise p ${values.p}: ${OUTCOMES.map((o, i) => `${o}, ${(values.probabilities[i] * 100).toFixed(1)} percent`).join('; ')}. Dashed bars show ideal channel reference.`);
    }
    $('selected-outcome').textContent = `|${OUTCOMES[selected?.outcome ?? 0]}⟩`;
    $('delta-value').textContent = selected?.outcome ? `${Math.round(SPACING_DELTAS[selected.outcome] * 100)}% FUTURE GAP` : 'NORMAL GAP';
    $('delta-description').textContent = selected ? `Sampled in ${LEVEL_NAMES[selected.level]}` : 'Waiting for your first jump';
    $('event-log').replaceChildren();
    if (game.events.length === 0) $('event-log').textContent = 'YOUR JUMPS WILL APPEAR HERE';
    game.events.slice(0, 3).forEach((event, i) => {
      const row = document.createElement('div');
      if (i === 0) row.className = 'recent';
      row.textContent = `${event.time.toFixed(1).padStart(5)}s  ${LEVEL_NAMES[event.level].padEnd(6)} → ${OUTCOMES[event.outcome]}  ${Math.round(SPACING_DELTAS[event.outcome] * 100)}%`;
      $('event-log').append(row);
    });
    $('pause-hint').hidden = game.state !== 'paused';
    $('pause').disabled = !table || !['running', 'paused'].includes(game.state);
    $('pause').textContent = game.state === 'paused' ? 'RESUME' : 'PAUSE';
  }

  function start() {
    if (!table) return;
    if (!['ready', 'over'].includes(game.state)) return;
    const rawSeed = Number($('seed').value);
    if (!Number.isInteger(rawSeed) || rawSeed < 0 || rawSeed > 4294967295) {
      $('seed').focus();
      announce('World seed must be a whole number from zero to 4294967295.');
      return;
    }
    game.seed = rawSeed;
    game.reset();
    game.start();
    accumulator = 0;
    lastTime = null;
    lastState = 'running';
    $('game-overlay').hidden = true;
    $('game').focus({ preventScroll: true });
    announce('Run started. Hold space or up arrow to jump higher. P pauses.');
    telemetry();
  }

  function togglePause() {
    if (game.state === 'running') {
      game.pause();
      inspectHeight = game.height;
      $('explore').value = Math.round(inspectHeight);
      announce('Paused. Explore the altitude slider or press P to resume.');
    } else if (game.state === 'paused') {
      game.resume();
      announce('Run resumed.');
    }
    accumulator = 0;
    lastTime = null;
    telemetry();
  }

  function gameOver() {
    highScore = Math.max(highScore, game.score);
    $('game-overlay').hidden = false;
    $('overlay-kicker').textContent = 'THE WORLD OUTRAN YOU';
    $('overlay-title').textContent = 'Game over.';
    $('overlay-copy').textContent = `Score ${game.score} · ${game.bonus / 100} diamonds · ${(game.speed / PHYSICS.initialSpeed).toFixed(2)}× speed. Same circuit. Another chance.`;
    $('play').textContent = 'RUN AGAIN ↻';
    announce(`Game over. Score ${game.score}. Press space or Run Again to restart.`);
    telemetry();
  }

  $('play').addEventListener('click', start);
  $('pause').addEventListener('click', togglePause);
  $('explore').addEventListener('input', () => { inspectHeight = Number($('explore').value); telemetry(); });
  const isFormTarget = target => target instanceof Element && Boolean(target.closest('input, textarea, select, button, summary, a'));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const editing = event.target instanceof Element && event.target.closest('input, textarea, select');
    if (!editing && (event.code === 'KeyP' || event.code === 'Escape')) {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }
    if (isFormTarget(event.target)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'KeyP', 'Escape'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      if (game.state === 'ready' || game.state === 'over') start();
      game.jump();
    } else if (event.code === 'ArrowDown') game.duckHeld = true;
  });
  document.addEventListener('keyup', event => {
    if (event.code === 'Space' || event.code === 'ArrowUp') game.releaseJump();
    if (event.code === 'ArrowDown') game.duckHeld = false;
  });

  function bindHold(element, press, release) {
    element.addEventListener('pointerdown', event => {
      if (!table || element.disabled || event.button > 0) return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      press();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => element.addEventListener(type, release));
    if (element.tagName === 'BUTTON') {
      element.addEventListener('keydown', event => {
        if (event.code !== 'Space' && event.code !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat && !element.disabled) press();
      });
      element.addEventListener('keyup', event => {
        if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(); }
      });
      element.addEventListener('blur', release);
    }
  }
  bindHold($('touch-jump'), () => { start(); game.jump(); }, () => game.releaseJump());
  bindHold($('game'), () => { start(); game.jump(); }, () => game.releaseJump());
  bindHold($('touch-duck'), () => { game.duckHeld = true; }, () => { game.duckHeld = false; });
  function autoPause() { if (game.state === 'running') togglePause(); }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('resize', () => {
    $('game').width = viewportWidth();
    game.viewportWidth = $('game').width;
  });

  $('export').addEventListener('click', () => {
    if (!table) return;
    const payload = { project: 'Coherence Runner', ...metadata, table,
      spacingDeltas: SPACING_DELTAS, worldSeed: game.seed,
      note: 'Measured marginals from one startup circuit. Gameplay uses classical cached sampling.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'coherence-runner-experiment.json';
    document.body.append(link);
    link.click();
    link.remove();
    // The download starts synchronously; revocation on a later task is safe.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function frame(now) {
    const elapsed = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    accumulator += elapsed;
    while (accumulator >= 1 / 120) {
      game.update(1 / 120);
      accumulator -= 1 / 120;
    }
    if (game.state === 'over' && lastState !== 'over') gameOver();
    lastState = game.state;
    renderer.draw(game, inspectHeight);
    if (now - lastTelemetry > 80) { telemetry(); lastTelemetry = now; }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
  telemetry();

  return {
    ready(resultTable, runMetadata) {
      table = resultTable;
      metadata = { ...runMetadata, completedAt: new Date().toISOString() };
      game = new Runner(table, 2026, $('game').width);
      $('status-dot').className = 'status-dot ready';
      $('experiment-status').textContent = 'QUANTUM WORLD READY';
      $('experiment-detail').textContent = `${table.qubits} qubits · ${table.shots.toLocaleString()} shots · 1 circuit`;
      $('sample-count').textContent = `${table.shots.toLocaleString()} SHOTS / LEVEL`;
      $('overlay-kicker').textContent = 'NO SIGNAL? NO PROBLEM. YOUR WORLD IS CACHED.';
      $('overlay-title').textContent = 'A little dino. A quantum atmosphere.';
      $('overlay-copy').textContent = 'Clear the cacti. Hold to jump higher. Collect diamonds—but disturb the rhythm.';
      $('play').textContent = 'START RUN →';
      for (const id of ['play', 'touch-jump', 'touch-duck', 'export']) $(id).disabled = false;
      $('run-metadata').textContent = `${metadata.backend} · ${table.shots} shots per altitude · one ${table.qubits}-qubit circuit · ${metadata.durationSeconds.toFixed(2)} seconds. No backend calls on replay.`;
      announce('Quantum world ready. Press Start Run or space to play.');
      telemetry();
    },
    fail(error) {
      $('status-dot').className = 'status-dot error';
      $('experiment-status').textContent = 'EXPERIMENT COULD NOT RUN';
      $('overlay-kicker').textContent = 'NO SYNTHETIC RESULTS HAVE BEEN SUBSTITUTED';
      $('overlay-title').textContent = 'The atmosphere needs another try.';
      $('overlay-copy').textContent = 'On Qollab, press Stop, then Run and choose a free simulator. Remote jobs may take longer.';
      $('play').textContent = 'STOP / RUN TO RETRY';
      $('experiment-detail').textContent = String(error.message || error);
      announce(`Experiment failed: ${error.message || error}. Stop and run again to retry.`);
      console.error(error);
    },
  };
}
