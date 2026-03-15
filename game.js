const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

let SIZE = 6;
let LAYERS = 3;
const GAP = 2;
const BOARD_PADDING = 20;
const MIN_CELL = 10;

// All 26 3D directions
const DIRECTIONS = [];
for (let dLayer = -1; dLayer <= 1; dLayer++)
  for (let dRow = -1; dRow <= 1; dRow++)
    for (let dCol = -1; dCol <= 1; dCol++)
      if (dLayer !== 0 || dRow !== 0 || dCol !== 0) DIRECTIONS.push([dLayer, dRow, dCol]);

let board = [];
let currentPlayer = BLACK;
let gameOver = false;
let activeLayer = 1;
let layer_gap = 60;
let inactive_opacity = 25;
let rotateZ = 0;
let rotateX_deg = 64;

const board3d = document.getElementById('board-3d');
const axis3d = document.querySelector('.axis-3d');

const UI_OVERHEAD = 240; // title + scores + status + controls + button + gaps

function getCellSize() {
  const available = Math.min(window.innerWidth * 0.92, window.innerHeight - UI_OVERHEAD);
  return Math.max(Math.floor((available - 2 * BOARD_PADDING - (SIZE - 1) * GAP) / SIZE), MIN_CELL);
}

function inBounds(layer, row, col) {
  return layer >= 0 && layer < LAYERS && row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function initBoard() {
  board = Array.from({ length: LAYERS }, () =>
    Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY))
  );
  // Standard 4-piece center setup on each layer, alternating colours
  const mid1 = SIZE / 2 - 1, mid2 = SIZE / 2;
  for (let layer = 0; layer < LAYERS; layer++) {
    const flip = layer % 2 === 1;
    board[layer][mid1][mid1] = flip ? BLACK : WHITE;
    board[layer][mid1][mid2] = flip ? WHITE : BLACK;
    board[layer][mid2][mid1] = flip ? WHITE : BLACK;
    board[layer][mid2][mid2] = flip ? BLACK : WHITE;
  }
  currentPlayer = BLACK;
  gameOver = false;
  activeLayer = Math.floor((LAYERS - 1) / 2);
}

// 3D flip logic — traverses in all 26 directions across layers
function getFlips(b, layer, row, col, player) {
  if (b[layer][row][col] !== EMPTY) return [];
  const opponent = player === BLACK ? WHITE : BLACK;
  const flips = [];
  for (const [dLayer, dRow, dCol] of DIRECTIONS) {
    let curLayer = layer + dLayer, curRow = row + dRow, curCol = col + dCol;
    const line = [];
    while (inBounds(curLayer, curRow, curCol) && b[curLayer][curRow][curCol] === opponent) {
      line.push([curLayer, curRow, curCol]);
      curLayer += dLayer; curRow += dRow; curCol += dCol;
    }
    if (line.length > 0 && inBounds(curLayer, curRow, curCol) && b[curLayer][curRow][curCol] === player)
      flips.push(...line);
  }
  return flips;
}

// Valid moves restricted to a specific layer (placement), flips go anywhere in 3D
function getValidMovesOnLayer(b, player, layer) {
  const moves = [];
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < SIZE; col++)
      if (getFlips(b, layer, row, col, player).length > 0) moves.push([row, col]);
  return moves;
}

function hasValidMovesAnywhere(b, player) {
  for (let layer = 0; layer < LAYERS; layer++)
    if (getValidMovesOnLayer(b, player, layer).length > 0) return true;
  return false;
}

function countPieces() {
  let black = 0, white = 0;
  for (let layer = 0; layer < LAYERS; layer++)
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) {
        if (board[layer][row][col] === BLACK) black++;
        else if (board[layer][row][col] === WHITE) white++;
      }
  return { black, white };
}

function handleCellClick(row, col) {
  if (gameOver) return;
  const flips = getFlips(board, activeLayer, row, col, currentPlayer);
  if (flips.length === 0) return;

  board[activeLayer][row][col] = currentPlayer;
  for (const [flipLayer, flipRow, flipCol] of flips) board[flipLayer][flipRow][flipCol] = currentPlayer;

  const nextPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  let skippedPlayer = null;

  if (hasValidMovesAnywhere(board, nextPlayer)) {
    currentPlayer = nextPlayer;
  } else if (hasValidMovesAnywhere(board, currentPlayer)) {
    skippedPlayer = nextPlayer;
  } else {
    gameOver = true;
  }

  render();

  if (skippedPlayer !== null) {
    const name = skippedPlayer === BLACK ? 'Black' : 'White';
    document.getElementById('status').textContent = `${name} has no valid moves — turn skipped.`;
    setTimeout(() => { if (!gameOver) updateStatus(); }, 2000);
  }
}

function updateStatus() {
  const statusEl = document.getElementById('status');
  if (gameOver) {
    const { black, white } = countPieces();
    if (black > white) statusEl.textContent = `Black wins! (${black}–${white})`;
    else if (white > black) statusEl.textContent = `White wins! (${white}–${black})`;
    else statusEl.textContent = `It's a tie! (${black}–${white})`;
  } else {
    const name = currentPlayer === BLACK ? 'Black' : 'White';
    statusEl.textContent = `${name}'s turn · Layer ${activeLayer + 1}`;
  }
}

function applyTransform() {
  board3d.style.transform = `rotateX(${rotateX_deg}deg) rotateZ(${rotateZ}deg) scale(0.8)`;
  axis3d.style.transform = `rotateX(${rotateX_deg}deg) scale(0.8)`;
}

function buildLayerEl(layer, isActive, cellSize, validSet) {
  const frameEl = document.createElement('div');
  frameEl.className = `layer-frame layer-frame-${isActive ? 'active' : 'inactive'}`;
  if (!isActive) frameEl.style.opacity = inactive_opacity / 100;
  frameEl.style.transform = `translateZ(${layer * layer_gap}px)`;
  if (layer > 0) Object.assign(frameEl.style, { position: 'absolute', top: '0', left: '0' });

  for (const side of ['top', 'bottom', 'left', 'right']) {
    const s = document.createElement('div');
    s.className = `frame-side frame-side-${side}`;
    frameEl.appendChild(s);
  }

  const boardEl = document.createElement('div');
  boardEl.className = 'board';
  boardEl.style.gridTemplateColumns = `repeat(${SIZE}, ${cellSize}px)`;
  boardEl.style.gridTemplateRows = `repeat(${SIZE}, ${cellSize}px)`;

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[layer][row][col] !== EMPTY) {
        const piece = document.createElement('div');
        piece.className = `piece ${board[layer][row][col] === BLACK ? 'black' : 'white'}`;
        cell.appendChild(piece);
      } else if (isActive && validSet.has(`${row},${col}`)) {
        cell.classList.add('valid');
        cell.addEventListener('click', () => handleCellClick(row, col));
      }
      boardEl.appendChild(cell);
    }
  }

  frameEl.appendChild(boardEl);
  return frameEl;
}

function render() {
  const containerEl = document.getElementById('board-container');
  const cellSize = getCellSize();
  const validSet = gameOver ? new Set() : new Set(
    getValidMovesOnLayer(board, currentPlayer, activeLayer).map(([row, col]) => `${row},${col}`)
  );

  containerEl.style.setProperty('--piece-size', `${Math.max(Math.floor(cellSize * 0.78), 6)}px`);
  containerEl.style.setProperty('--dot-size', `${Math.max(Math.floor(cellSize * 0.4), 3)}px`);
  containerEl.innerHTML = '';

  for (let layer = 0; layer < LAYERS; layer++)
    containerEl.appendChild(buildLayerEl(layer, layer === activeLayer, cellSize, validSet));

  const { black, white } = countPieces();
  document.getElementById('black-count').textContent = black;
  document.getElementById('white-count').textContent = white;

  const axisHeight = (LAYERS - 1) * layer_gap + 120;
  const axisLine = document.querySelector('.axis-3d-line');
  axisLine.style.height = `${axisHeight}px`;
  axisLine.style.top = `${-axisHeight / 2}px`;
  document.querySelector('.axis-3d-label').style.transform = `translateZ(${axisHeight / 2}px) translateX(-50%)`;

  updateStatus();
}

function newGame() {
  initBoard();
  render();
}

// Setup panel
document.getElementById('new-game-btn').addEventListener('click', () => {
  document.getElementById('setup-size').value = SIZE;
  document.getElementById('setup-layers').value = LAYERS;
  document.getElementById('game-panel').style.display = 'none';
  document.getElementById('setup-panel').style.display = 'flex';
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  const sizeVal = parseInt(document.getElementById('setup-size').value);
  const layersVal = parseInt(document.getElementById('setup-layers').value);
  const sizeErr = document.getElementById('setup-size-err');
  const layersErr = document.getElementById('setup-layers-err');

  let valid = true;
  if (isNaN(sizeVal) || sizeVal < 6 || sizeVal > 20 || sizeVal % 2 !== 0) {
    sizeErr.textContent = 'Must be an even number, 6–20';
    valid = false;
  } else { sizeErr.textContent = ''; }

  if (isNaN(layersVal) || layersVal < 1 || layersVal > 10) {
    layersErr.textContent = 'Must be between 1 and 10';
    valid = false;
  } else { layersErr.textContent = ''; }

  if (!valid) return;
  SIZE = sizeVal;
  LAYERS = layersVal;
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'flex';
  newGame();
});

// Binds a numeric stepper control (up/down buttons + number input) to a getter/setter
function bindControl({ inputId, upId, downId, min, max, step, get, set, onchange, errId }) {
  const input = document.getElementById(inputId);
  const errEl = errId ? document.getElementById(errId) : null;
  document.getElementById(upId).addEventListener('click', () => {
    set(Math.min(get() + step, max));
    input.value = get();
    onchange();
  });
  document.getElementById(downId).addEventListener('click', () => {
    set(Math.max(get() - step, min));
    input.value = get();
    onchange();
  });
  input.addEventListener('input', () => {
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= min && val <= max) {
      if (errEl) errEl.textContent = '';
      set(val); onchange();
    } else if (errEl) {
      errEl.textContent = `Must be ${min}–${max}`;
    }
  });
}

bindControl({ inputId: 'space-input',   upId: 'space-up',   downId: 'space-down',   min: 10, max: 200, step: 5, get: () => layer_gap,       set: v => { layer_gap = v; },       onchange: render });
bindControl({ inputId: 'opacity-input', upId: 'opacity-up', downId: 'opacity-down', min: 5,  max: 100, step: 5, get: () => inactive_opacity, set: v => { inactive_opacity = v; }, onchange: render,         errId: 'opacity-err' });
bindControl({ inputId: 'angle-input',   upId: 'angle-up',   downId: 'angle-down',   min: 0,  max: 89,  step: 1, get: () => rotateX_deg,      set: v => { rotateX_deg = v; },      onchange: applyTransform, errId: 'angle-err' });

window.addEventListener('resize', render);

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft')       { rotateZ -= 5; applyTransform(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { rotateZ += 5; applyTransform(); e.preventDefault(); }
  else if (e.key === 'ArrowUp')    { if (activeLayer < LAYERS - 1) { activeLayer++; render(); } e.preventDefault(); }
  else if (e.key === 'ArrowDown')  { if (activeLayer > 0)          { activeLayer--; render(); } e.preventDefault(); }
});
