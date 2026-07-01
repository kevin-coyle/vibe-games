import { SKIER_WIDTH, SKIER_HEIGHT } from './constants.js';

export const OBSTACLE_TREE = 'tree';
export const OBSTACLE_ROCK = 'rock';
export const OBSTACLE_SLALOM = 'slalom';
export const OBSTACLE_SNOWBALL = 'snowball';

const types = [OBSTACLE_TREE, OBSTACLE_TREE, OBSTACLE_ROCK, OBSTACLE_SLALOM, OBSTACLE_SNOWBALL];

export function randomObstacleType() {
  return types[Math.floor(Math.random() * types.length)];
}

export class Obstacle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = type === OBSTACLE_SNOWBALL ? 20 : 30;
    this.height = type === OBSTACLE_ROCK ? 25 : type === OBSTACLE_SNOWBALL ? 20 : 55;
    this.hitMargin = 5;
  }

  getScreenY(cameraY) {
    return this.y - cameraY;
  }

  isOnScreen(cameraY) {
    const sy = this.getScreenY(cameraY);
    return sy > -this.height && sy < 600 + this.height;
  }

  getBounds() {
    return {
      x: this.x - this.width / 2 + this.hitMargin,
      y: this.y - this.height / 2 + this.hitMargin,
      width: this.width - this.hitMargin * 2,
      height: this.height - this.hitMargin * 2
    };
  }

  collidesWith(skier) {
    const sb = skier.getBounds();
    const ob = this.getBounds();
    return sb.x < ob.x + ob.width &&
           sb.x + sb.width > ob.x &&
           sb.y < ob.y + ob.height &&
           sb.y + sb.height > ob.y;
  }
}
