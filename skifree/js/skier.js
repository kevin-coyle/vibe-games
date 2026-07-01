import {
  CANVAS_WIDTH, SKIER_START_X, SKIER_START_Y,
  SKIER_SPEED, SKIER_TURN_SPEED, SKIER_MAX_SPEED,
  SKIER_ACCELERATION, JUMP_VELOCITY, JUMP_GRAVITY,
  SKIER_WIDTH, SKIER_HEIGHT
} from './constants.js';

export class Skier {
  constructor() {
    this.x = SKIER_START_X;
    this.y = SKIER_START_Y;
    this.speed = SKIER_SPEED;
    this.tilt = 0;
    this.jumping = false;
    this.jumpVy = 0;
    this.jumpY = 0;
    this.crashed = false;
    this.angle = 0;
  }

  update(input, dt) {
    if (this.crashed) return;

    if (this.speed < SKIER_MAX_SPEED) {
      this.speed += SKIER_ACCELERATION * dt;
    }

    const turnSpeed = SKIER_TURN_SPEED * (dt / 16);
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
      this.x -= turnSpeed;
      this.angle = Math.max(this.angle - 0.05 * (dt / 16), -0.3);
    } else if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
      this.x += turnSpeed;
      this.angle = Math.min(this.angle + 0.05 * (dt / 16), 0.3);
    } else {
      this.angle *= 0.85;
    }

    this.x = Math.max(SKIER_WIDTH, Math.min(CANVAS_WIDTH - SKIER_WIDTH, this.x));

    if (input.wasPressed('ArrowUp') || input.wasPressed('Space')) {
      if (!this.jumping) {
        this.jumping = true;
        this.jumpVy = JUMP_VELOCITY;
      }
    }

    if (this.jumping) {
      this.jumpVy += JUMP_GRAVITY * (dt / 16);
      this.jumpY += this.jumpVy * (dt / 16);
      if (this.jumpY > 0) {
        this.jumpY = 0;
        this.jumping = false;
        this.jumpVy = 0;
      }
    }

    this.y += this.speed * (dt / 16);
  }

  getScreenY(cameraY) {
    return this.y - cameraY;
  }

  getBounds() {
    return {
      x: this.x - SKIER_WIDTH / 2,
      y: this.y - SKIER_HEIGHT / 2,
      width: SKIER_WIDTH,
      height: SKIER_HEIGHT
    };
  }

  crash() {
    this.crashed = true;
  }
}
