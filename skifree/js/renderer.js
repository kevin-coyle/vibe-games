import {
  CANVAS_WIDTH, CANVAS_HEIGHT, SNOW_PARTICLE_COUNT,
  SKIER_WIDTH, SKIER_HEIGHT
} from './constants.js';
import { OBSTACLE_TREE, OBSTACLE_ROCK, OBSTACLE_SLALOM, OBSTACLE_SNOWBALL } from './obstacle.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    this.snowflakes = [];
    for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
      this.snowflakes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 0.5 + Math.random() * 1.5,
        size: 1 + Math.random() * 3,
        drift: Math.random() * 2 - 1
      });
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#c8e6f5');
    gradient.addColorStop(1, '#e8f4fd');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(200, 220, 240, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * (CANVAS_WIDTH / 12);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 20, CANVAS_HEIGHT);
      ctx.stroke();
    }
  }

  drawSnowflakes(dt) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const flake of this.snowflakes) {
      flake.y += flake.speed * (dt / 16);
      flake.x += flake.drift * (dt / 16) + Math.sin(flake.y * 0.01) * 0.5;
      if (flake.y > CANVAS_HEIGHT) {
        flake.y = -5;
        flake.x = Math.random() * CANVAS_WIDTH;
      }
      if (flake.x < 0) flake.x = CANVAS_WIDTH;
      if (flake.x > CANVAS_WIDTH) flake.x = 0;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSkier(skier, cameraY) {
    if (skier.crashed) return;
    const ctx = this.ctx;
    const sx = skier.x;
    const sy = skier.y - cameraY + skier.jumpY;

    ctx.save();
    ctx.translate(sx, sy);

    const shadowY = skier.y - cameraY;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, shadowY - sy + 25, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const tilt = skier.angle;

    ctx.save();
    ctx.rotate(tilt);

    const bodyColor = '#cc3333';
    const pantsColor = '#2255aa';
    const skinColor = '#f5d0a9';

    // Skis
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.lineTo(-2, 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(2, 35);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(-8, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.lineTo(8, 20);
    ctx.stroke();

    // Body (jacket)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-10, 8);
    ctx.lineTo(10, 8);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 3;
    const armAngle = skier.jumping ? -0.5 : 0.3;
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.lineTo(-16, -5 + Math.sin(armAngle) * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.lineTo(16, -5 + Math.cos(armAngle) * 8);
    ctx.stroke();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -16, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.arc(0, -19, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-7, -22, 14, 4);

    // Goggles
    ctx.fillStyle = '#333';
    ctx.fillRect(-6, -18, 4, 2);
    ctx.fillRect(2, -18, 4, 2);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, -19, 6, 3);
    ctx.strokeRect(1, -19, 6, 3);

    ctx.restore();
    ctx.restore();
  }

  drawSkierCrashed(skier, cameraY) {
    const ctx = this.ctx;
    const sx = skier.x;
    const sy = skier.y - cameraY;

    ctx.save();
    ctx.translate(sx, sy + 15);

    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.arc(-5, -8, 7, 0, Math.PI * 2);
    ctx.fill();

    // X eyes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-5, -7);
    ctx.moveTo(-5, -10);
    ctx.lineTo(-8, -7);
    ctx.stroke();

    // Skis splayed
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(-20, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(20, 15);
    ctx.stroke();

    ctx.restore();
  }

  drawTree(x, screenY) {
    const ctx = this.ctx;

    // Trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 3, screenY - 10, 6, 20);

    // Snow on top
    ctx.fillStyle = '#f0f8ff';
    ctx.beginPath();
    ctx.arc(x, screenY - 12, 4, 0, Math.PI * 2);
    ctx.fill();

    // Foliage layers
    const layers = [
      { y: -18, w: 30 },
      { y: -28, w: 24 },
      { y: -38, w: 16 }
    ];
    for (const layer of layers) {
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.moveTo(x, screenY + layer.y - layer.w / 2);
      ctx.lineTo(x - layer.w / 2, screenY + layer.y);
      ctx.lineTo(x + layer.w / 2, screenY + layer.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#388E3C';
      ctx.beginPath();
      ctx.moveTo(x, screenY + layer.y - layer.w / 2 + 4);
      ctx.lineTo(x - layer.w / 2 + 4, screenY + layer.y);
      ctx.lineTo(x + layer.w / 2 - 4, screenY + layer.y);
      ctx.closePath();
      ctx.fill();
    }

    // Snow on branches
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x - 8, screenY - 26, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 8, screenY - 26, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRock(x, screenY) {
    const ctx = this.ctx;
    ctx.fillStyle = '#757575';
    ctx.beginPath();
    ctx.moveTo(x - 15, screenY + 5);
    ctx.quadraticCurveTo(x - 18, screenY - 5, x - 8, screenY - 12);
    ctx.quadraticCurveTo(x, screenY - 16, x + 8, screenY - 12);
    ctx.quadraticCurveTo(x + 18, screenY - 5, x + 15, screenY + 5);
    ctx.quadraticCurveTo(x, screenY + 8, x - 15, screenY + 5);
    ctx.fill();

    ctx.fillStyle = '#9E9E9E';
    ctx.beginPath();
    ctx.arc(x - 3, screenY - 8, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, screenY - 2);
    ctx.lineTo(x + 4, screenY - 5);
    ctx.stroke();
  }

  drawSlalomPole(x, screenY) {
    const ctx = this.ctx;
    ctx.fillStyle = '#E53935';
    ctx.fillRect(x - 2, screenY - 25, 4, 30);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, screenY - 10, 4, 10);

    // Flag top
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.moveTo(x + 2, screenY - 25);
    ctx.lineTo(x + 12, screenY - 20);
    ctx.lineTo(x + 2, screenY - 15);
    ctx.closePath();
    ctx.fill();
  }

  drawSnowball(x, screenY) {
    const ctx = this.ctx;
    ctx.fillStyle = '#e8eef5';
    ctx.beginPath();
    ctx.arc(x, screenY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c0d0e0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, screenY, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x - 3, screenY - 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawObstacle(obstacle, cameraY) {
    const sy = obstacle.getScreenY(cameraY);
    if (!obstacle.isOnScreen(cameraY)) return;

    switch (obstacle.type) {
      case OBSTACLE_TREE:
        this.drawTree(obstacle.x, sy);
        break;
      case OBSTACLE_ROCK:
        this.drawRock(obstacle.x, sy);
        break;
      case OBSTACLE_SLALOM:
        this.drawSlalomPole(obstacle.x, sy);
        break;
      case OBSTACLE_SNOWBALL:
        this.drawSnowball(obstacle.x, sy);
        break;
    }
  }

  drawMonster(monster, cameraY) {
    if (!monster.active) return;
    const ctx = this.ctx;
    const sy = monster.getScreenY(cameraY);
    const sx = monster.x;

    ctx.save();
    ctx.translate(sx, sy);

    // Body
    ctx.fillStyle = '#f5f5f0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8e8e0';
    ctx.beginPath();
    ctx.ellipse(0, 5, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f5f5f0';
    ctx.beginPath();
    ctx.arc(0, -22, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-5, -24, 3, 0, Math.PI * 2);
    ctx.arc(5, -24, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -25, 1.2, 0, Math.PI * 2);
    ctx.arc(6, -25, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -17, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Arms
    const armWave = Math.sin(monster.wavePhase * 2) * 15;
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -5);
    ctx.lineTo(-28, -5 + Math.sin(armWave * 0.05) * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, -5);
    ctx.lineTo(28, -5 + Math.cos(armWave * 0.05) * 8);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(-8, 20);
    ctx.lineTo(-12, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(12, 30);
    ctx.stroke();

    ctx.restore();
  }

  drawUI(game) {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(5, 5, 180, 60);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, 180, 60);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`SCORE: ${game.score}`, 15, 28);

    ctx.font = '12px monospace';
    ctx.fillText(`DISTANCE: ${Math.floor(game.totalDistance)}m`, 15, 46);
    ctx.fillText(`SPEED: ${Math.floor(game.skier.speed * 10)} km/h`, 15, 60);

    if (game.monster.active) {
      const dx = Math.abs(game.monster.x - game.skier.x);
      const dy = game.monster.y - game.skier.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 300) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`⚠ YETI ${Math.floor(dist)}m`, CANVAS_WIDTH - 180, 28);
      }
    }
  }

  drawGameOver(score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 220);

    ctx.font = '24px monospace';
    ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, 280);

    ctx.font = '18px monospace';
    ctx.fillText('Press SPACE or ENTER to restart', CANVAS_WIDTH / 2, 350);
    ctx.textAlign = 'left';
  }

  drawStartScreen() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SKI FREE', CANVAS_WIDTH / 2, 180);

    ctx.font = '18px monospace';
    ctx.fillText('Dodge the trees! Outrun the yeti!', CANVAS_WIDTH / 2, 230);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#ccc';
    const controls = [
      '← → or A/D  —  Steer',
      '↑ or SPACE   —  Jump',
    ];
    controls.forEach((text, i) => {
      ctx.fillText(text, CANVAS_WIDTH / 2, 300 + i * 30);
    });

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('Press SPACE to Start', CANVAS_WIDTH / 2, 420);
    ctx.textAlign = 'left';
  }

  drawDistanceMarker(y, cameraY, label) {
    const sy = y - cameraY;
    if (sy < 0 || sy > CANVAS_HEIGHT) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, sy, CANVAS_WIDTH, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, CANVAS_WIDTH - 5, sy - 3);
    ctx.textAlign = 'left';
  }
}
