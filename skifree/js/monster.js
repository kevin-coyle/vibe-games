import {
  MONSTER_BASE_SPEED, MONSTER_CHASE_SPEED,
  MONSTER_SPAWN_DISTANCE, CANVAS_WIDTH
} from './constants.js';

export class Monster {
  constructor(startY) {
    this.x = CANVAS_WIDTH / 2;
    this.y = startY;
    this.speed = MONSTER_BASE_SPEED;
    this.active = false;
    this.catchRange = 30;
    this.wavePhase = 0;
  }

  activate(y) {
    this.active = true;
    this.y = y;
  }

  update(targetX, targetY, dt) {
    if (!this.active) return;

    this.wavePhase += 0.05 * (dt / 16);

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const speed = dist > 300 ? MONSTER_BASE_SPEED : MONSTER_CHASE_SPEED;
      const moveFactor = speed * (dt / 16);
      this.x += (dx / dist) * moveFactor;
      this.y += (dy / dist) * moveFactor;
    }

    const wobble = Math.sin(this.wavePhase) * 0.3;
    this.x += wobble * (dt / 16);
  }

  caughtSkier(skierX, skierY) {
    if (!this.active) return false;
    const dx = this.x - skierX;
    const dy = this.y - skierY;
    return Math.sqrt(dx * dx + dy * dy) < this.catchRange + 15;
  }

  getScreenY(cameraY) {
    return this.y - cameraY;
  }
}
