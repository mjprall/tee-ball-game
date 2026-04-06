'use strict';

// ═══════════════════════════════════════════════════════════════
// Player definitions
//   x, y     – SVG coordinates for the player icon centre
//   throwTo  – correct base to throw to: '1st' | '2nd' | '3rd' | 'home'
//
// Rule set (expand here to add more scenarios):
//   Outfield (LF, CF, RF)  → throw to 2nd (cut-off relay)
//   Infield  (P, C, 1B, 2B, 3B, SS) → throw to 1st (primary out)
// ═══════════════════════════════════════════════════════════════
const PLAYERS = [
  { id: 'P',  name: 'Pitcher',          x: 200, y: 250, throwTo: '1st' },
  { id: 'C',  name: 'Catcher',          x: 200, y: 392, throwTo: '1st' },
  { id: '1B', name: 'First Baseman',    x: 328, y: 250, throwTo: '1st' },
  { id: '2B', name: 'Second Baseman',   x: 262, y: 202, throwTo: '1st' },
  { id: '3B', name: 'Third Baseman',    x: 72,  y: 250, throwTo: '1st' },
  { id: 'SS', name: 'Shortstop',        x: 148, y: 208, throwTo: '1st' },
  { id: 'LF', name: 'Left Fielder',     x: 106, y: 140, throwTo: '2nd' },
  { id: 'CF', name: 'Center Fielder',   x: 200, y: 110, throwTo: '2nd' },
  { id: 'RF', name: 'Right Fielder',    x: 294, y: 140, throwTo: '2nd' },
];

// Ball spawn positions per fielder – multiple points each.
// Each point is (a) inside the SVG fair-territory arc, (b) at least 35 px
// from the player's circle centre (player r=22 + ball r=12 + 1 px margin)
// so the ball is always clearly visible and never hidden behind a player icon.
// Add more points here to expand variety.
const BALL_ZONES = {
  'P':  [{ x: 178, y: 218 }, { x: 222, y: 218 }, { x: 183, y: 283 }],
  'C':  [{ x: 200, y: 350 }, { x: 190, y: 340 }, { x: 210, y: 340 }],
  '1B': [{ x: 295, y: 222 }, { x: 300, y: 218 }, { x: 290, y: 263 }],
  '2B': [{ x: 235, y: 177 }, { x: 285, y: 232 }, { x: 242, y: 232 }],
  '3B': [{ x: 100, y: 228 }, { x: 104, y: 265 }, { x: 108, y: 263 }],
  'SS': [{ x: 120, y: 185 }, { x: 168, y: 238 }, { x: 115, y: 226 }],
  'LF': [{ x: 75,  y: 120 }, { x: 70,  y: 130 }, { x: 130, y: 110 }],
  'CF': [{ x: 165, y: 100 }, { x: 235, y: 100 }, { x: 200, y: 148 }],
  'RF': [{ x: 265, y: 120 }, { x: 325, y: 120 }, { x: 325, y: 165 }],
};

const BASE_NAMES = {
  '1st':  '1st Base',
  '2nd':  '2nd Base',
  '3rd':  '3rd Base',
  'home': 'Home Plate',
};

// ───────────────────────────────────────────────────────────────
// Game state
// ───────────────────────────────────────────────────────────────
const state = {
  phase: 'field',          // 'field' | 'throw' | 'celebrate'
  correctPlayer: null,     // the PLAYERS entry for this round
  score: 0,
  autoTimer: null,         // setTimeout handle for auto-advance
};

// ───────────────────────────────────────────────────────────────
// SVG helper
// ───────────────────────────────────────────────────────────────
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// ───────────────────────────────────────────────────────────────
// Build dynamic SVG elements (ball + players)
// ───────────────────────────────────────────────────────────────
function buildDynamicElements() {
  const svg = document.getElementById('field-svg');

  // ── Ball group (appended first so players render above it) ──
  const ballG = svgEl('g', { id: 'ball-group' });
  ballG.appendChild(svgEl('circle', {
    r: '12', fill: '#fffde7', stroke: '#c0392b', 'stroke-width': '2.5',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
  }));
  // Simple baseball-stitch decoration
  ballG.appendChild(svgEl('path', {
    d: 'M -5,-7 C -3,-3 -3,3 -5,7',
    stroke: '#c0392b', 'stroke-width': '1.5', fill: 'none', 'stroke-linecap': 'round',
  }));
  ballG.appendChild(svgEl('path', {
    d: 'M 5,-7 C 3,-3 3,3 5,7',
    stroke: '#c0392b', 'stroke-width': '1.5', fill: 'none', 'stroke-linecap': 'round',
  }));
  svg.appendChild(ballG);

  // ── Player circles ──
  PLAYERS.forEach(player => {
    const g = svgEl('g', {
      id: `player-${player.id}`,
      role: 'button',
      'aria-label': player.name,
      tabindex: '0',
    });
    g.classList.add('player-group');

    // Larger invisible hit area for easy touch
    g.appendChild(svgEl('circle', {
      cx: player.x, cy: player.y, r: '30',
      class: 'player-hit-area',
    }));

    // Visible coloured circle
    g.appendChild(svgEl('circle', {
      cx: player.x, cy: player.y, r: '22',
      class: 'player-circle',
    }));

    // Position abbreviation label
    const label = svgEl('text', {
      x: player.x, y: player.y + 5,
      'text-anchor': 'middle',
      class: 'player-label',
    });
    label.textContent = player.id;
    g.appendChild(label);

    g.addEventListener('click', () => handlePlayerClick(player.id));
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent Space from scrolling the page
        handlePlayerClick(player.id);
      }
    });

    svg.appendChild(g);
  });
}

// ───────────────────────────────────────────────────────────────
// Build base-selection buttons
// ───────────────────────────────────────────────────────────────
function buildBaseButtons() {
  const container = document.getElementById('base-buttons');
  [
    { id: '1st',  label: '🟫 1st Base'   },
    { id: '2nd',  label: '🟫 2nd Base'   },
    { id: '3rd',  label: '🟫 3rd Base'   },
    { id: 'home', label: '🏠 Home Plate' },
  ].forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'base-btn';
    btn.textContent = label;
    btn.dataset.base = id;
    btn.addEventListener('click', () => handleBaseClick(id));
    container.appendChild(btn);
  });
}

// ───────────────────────────────────────────────────────────────
// Round management
// ───────────────────────────────────────────────────────────────
function newRound() {
  clearTimeout(state.autoTimer);

  state.phase = 'field';
  state.correctPlayer = null;

  // Reset all player styles
  PLAYERS.forEach(p => {
    const g = document.getElementById(`player-${p.id}`);
    if (g) g.setAttribute('class', 'player-group'); // remove correct/wrong/disabled
  });

  // Pick a random player and a random ball position in their zone
  const player = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
  state.correctPlayer = player;

  const zones = BALL_ZONES[player.id];
  const pt    = zones[Math.floor(Math.random() * zones.length)];
  const jitter = 6;
  const bx = pt.x + (Math.random() * jitter * 2 - jitter);
  const by = pt.y + (Math.random() * jitter * 2 - jitter);

  placeBall(bx, by, true);
  setMessage('Tap the player who should field the ball! ⚾', 'info');

  document.getElementById('base-buttons').style.display = 'none';
  document.getElementById('next-wrap').style.display = 'none';
}

// Expose nextRound globally for the inline onclick on the button
window.nextRound = newRound;

// ───────────────────────────────────────────────────────────────
// Ball positioning
// ───────────────────────────────────────────────────────────────
function placeBall(x, y, visible) {
  const g = document.getElementById('ball-group');
  g.setAttribute('transform', `translate(${x}, ${y})`);
  g.style.display = visible ? '' : 'none';
}

// ───────────────────────────────────────────────────────────────
// Phase 1 – fielder selection
// ───────────────────────────────────────────────────────────────
function handlePlayerClick(playerID) {
  if (state.phase !== 'field') return;

  const g = document.getElementById(`player-${playerID}`);
  if (!g || g.classList.contains('disabled')) return;

  if (playerID === state.correctPlayer.id) {
    // ✅ Correct fielder
    g.classList.add('correct');
    state.phase = 'throw';

    // Disable all player circles
    PLAYERS.forEach(p => {
      const pg = document.getElementById(`player-${p.id}`);
      if (pg) pg.classList.add('disabled');
    });

    setMessage(
      `Great! ${state.correctPlayer.name} has the ball! 🌟 Which base should they throw to?`,
      'success',
    );

    document.getElementById('base-buttons').style.display = 'flex';
  } else {
    // ❌ Wrong fielder – shake then reset colour
    g.classList.add('wrong');
    setMessage("Oops! That's not the right player. Try again! 🙈", 'error');
    setTimeout(() => g.classList.remove('wrong'), 500);
  }
}

// ───────────────────────────────────────────────────────────────
// Phase 2 – base selection
// ───────────────────────────────────────────────────────────────
function handleBaseClick(base) {
  if (state.phase !== 'throw') return;

  if (base === state.correctPlayer.throwTo) {
    // ✅ Correct base
    state.score++;
    document.getElementById('score-value').textContent = state.score;
    state.phase = 'celebrate';

    const messages = [
      `🎉 Amazing! Throw to ${BASE_NAMES[base]}! You got it!`,
      `⭐ Excellent! ${BASE_NAMES[base]} is the right call!`,
      `🌟 Perfect throw to ${BASE_NAMES[base]}! Keep it up!`,
    ];
    setMessage(messages[Math.floor(Math.random() * messages.length)], 'success');

    placeBall(0, 0, false);
    document.getElementById('base-buttons').style.display = 'none';
    document.getElementById('next-wrap').style.display = 'flex';

    // Auto-advance after 3 seconds
    state.autoTimer = setTimeout(() => newRound(), 3000);
  } else {
    // ❌ Wrong base
    setMessage('Not quite – try a different base! 🤔', 'error');
  }
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function setMessage(text, type) {
  const box = document.getElementById('message-box');
  box.className = type;                             // info | success | error
  document.getElementById('message-text').textContent = text;
}

// ───────────────────────────────────────────────────────────────
// Boot
// ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildDynamicElements();
  buildBaseButtons();
  newRound();
});
