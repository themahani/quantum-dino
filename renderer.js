import { WORLD, LEVEL_NAMES } from './game.js';

// Original hand-drawn pixel sprite. No Chrome assets or external images.
const DINO = [
  '            ##########  ',
  '           ############ ',
  '           ##.######### ',
  '           ############ ',
  '           ############ ',
  '           ######       ',
  '           #########    ',
  '          ####          ',
  '#        #####          ',
  '##      #######         ',
  '###    ###########      ',
  '####  ######## #        ',
  '##############          ',
  '##############          ',
  ' ############           ',
  '  ###########           ',
  '   #########            ',
  '    #######             ',
  '     ### ###            ',
  '     ##   ##            ',
  '     ##   ##            ',
  '     ###  ###           ',
];

const INK = '#55595c';
const SOFT = '#c5c8c5';
const ACCENT = '#527969';

export class Renderer {
  constructor(canvas) {
    this.context = canvas.getContext('2d');
    this.context.imageSmoothingEnabled = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  rect(x, y, width, height, color = INK) {
    this.context.fillStyle = color;
    this.context.fillRect(Math.round(x), Math.round(y), width, height);
  }

  text(text, x, y, color = SOFT, size = 9) {
    this.context.fillStyle = color;
    this.context.font = `${size}px 'Courier New', monospace`;
    this.context.fillText(text, x, y);
  }

  dino(game) {
    const x = WORLD.dinoX;
    const y = WORLD.ground - game.height - 44;
    const running = game.state === 'running' && game.height === 0;
    const phase = Math.floor(game.distance / 32) % 2;
    if (game.duckHeld && game.height === 0) {
      this.rect(x + 4, WORLD.ground - 23, 41, 14);
      this.rect(x + 38, WORLD.ground - 25, 20, 12);
      this.rect(x + 47, WORLD.ground - 23, 3, 3, '#fff');
      this.rect(x + 2, WORLD.ground - 27, 5, 10);
      this.rect(x + 10, WORLD.ground - 9, 4, phase ? 5 : 9);
      this.rect(x + 30, WORLD.ground - 9, 4, phase ? 9 : 5);
      return;
    }
    DINO.forEach((row, py) => {
      for (let px = 0; px < row.length; px += 1) {
        if (row[px] !== '#') continue;
        if (running && py > 18 && ((phase === 0 && px > 8) || (phase === 1 && px < 8))) continue;
        this.rect(x + px * 2, y + py * 2, 2, 2);
      }
    });
    if (game.state === 'over') {
      this.rect(x + 29, y + 3, 6, 6, '#fff');
      this.rect(x + 31, y + 5, 2, 2);
    }
  }

  cactus(obstacle) {
    const { x, height, width, cluster } = obstacle;
    const y = WORLD.ground - height;
    const draw = (left, h, w) => {
      const top = WORLD.ground - h;
      const trunk = Math.floor(w / 2) - 3;
      this.rect(left + trunk, top, 7, h);
      this.rect(left, top + 12, 5, Math.floor(h / 2));
      this.rect(left, top + 12 + Math.floor(h / 2) - 5, trunk, 5);
      this.rect(left + w - 5, top + 7, 5, Math.floor(h / 2));
      this.rect(left + trunk, top + 7 + Math.floor(h / 2) - 5, w - trunk, 5);
    };
    if (cluster) {
      const cactusWidth = Math.floor((width - 6) / 2);
      draw(x, height, cactusWidth);
      draw(x + width - cactusWidth, height - 6, cactusWidth);
    }
    else draw(x, height, width);
    if (obstacle.outcome) {
      this.text(['', '−10%', '−18%', '−26%'][obstacle.outcome], x - 3, y - 12, ACCENT, 9);
      this.rect(x + width / 2 - 2, y - 7, 3, 3, ACCENT);
    }
  }

  draw(game, inspectHeight = 0) {
    const ctx = this.context;
    const width = ctx.canvas.width;
    ctx.clearRect(0, 0, width, WORLD.height);
    this.rect(0, 0, width, WORLD.height, '#fff');
    const height = game.state === 'running' || game.state === 'over' ? game.height : inspectHeight;
    // Discrete atmosphere lines explain the height mapping without flashing effects.
    for (let level = 1; level < 5; level += 1) {
      const y = WORLD.ground - level * 32;
      ctx.strokeStyle = '#edf0ec';
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(width - 62, y); ctx.stroke();
      ctx.setLineDash([]);
      this.text(LEVEL_NAMES[level], width - 59, y + 3, '#a3aaa3', 8);
    }
    if (height > 0) {
      this.rect(width - 67, WORLD.ground - height, 2, height, ACCENT);
    }
    if (!this.reducedMotion) {
      for (let i = 0; i < 5; i += 1) {
        const x = ((i * 243 + 210 - game.distance * 0.13) % 1220 + 1220) % 1220 - 90;
        const y = 39 + (i % 3) * 20;
        this.rect(x, y + 8, 48, 2, '#d7d9d6');
        this.rect(x + 9, y + 1, 2, 8, '#d7d9d6');
        this.rect(x + 10, y, 19, 2, '#d7d9d6');
        this.rect(x + 29, y + 2, 2, 6, '#d7d9d6');
        this.rect(x + 31, y + 5, 10, 2, '#d7d9d6');
      }
    }
    this.rect(0, WORLD.ground, width, 1, '#8b8e89');
    for (let i = 0; i < Math.ceil(width / 15); i += 1) {
      const span = width + 70;
      const x = ((i * 79 - game.distance) % span + span) % span - 35;
      this.rect(x, WORLD.ground + 5 + (i * 17 % 19), 2 + (i % 6), 1, '#a0a49e');
    }
    game.obstacles.forEach(obstacle => this.cactus(obstacle));
    game.collectibles.forEach(item => {
      const x = Math.round(item.x);
      const y = WORLD.ground - item.height;
      this.rect(x - 2, y - 8, 4, 16, ACCENT);
      this.rect(x - 5, y - 5, 10, 10, ACCENT);
      this.rect(x - 8, y - 2, 16, 4, ACCENT);
      this.rect(x - 2, y - 2, 4, 4, '#fff');
    });
    this.dino(game);
    this.text('HIGHER ALTITUDE = HIGHER MODELED NOISE', 28, 304, '#939a93', 9);
  }
}
