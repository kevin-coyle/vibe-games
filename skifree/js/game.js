import {
  CANVAS_WIDTH, CANVAS_HEIGHT, OBSTACLE_SPAWN_AHEAD,
  OBSTACLE_MIN_GAP, OBSTACLE_MAX_GAP, OBSTACLE_CLEAR_BEHIND,
  MONSTER_SPAWN_DISTANCE, MONSTER_RANGE
} from './constants.js';
import { Skier } from './skier.js';
import { Obstacle, randomObstacleType } from './obstacle.js';
import { Monster } from './monster.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.state = 'start';
    this.score = 0;
    this.totalDistance = 0;
    this.nextObstacleY = 0;
    this.maxObstacleY = 0;
    this.frameCount = 0;
    this.lastTime = 0;
  }

  start() {
    this.skier = new Skier();
    this.monster = new Monster(0);
    this.obstacles = [];
    this.score = 0;
    this.totalDistance = 0;
    this.state = 'playing';
    this.nextObstacleY = this.skier.y + OBSTACLE_SPAWN_AHEAD;
    this.maxObstacleY = this.skier.y + OBSTACLE_SPAWN_AHEAD;
    this.lastTime = performance.now();

    this.spawnInitialObstacles();
  }

  spawnInitialObstacles() {
    let y = this.skier.y + 300;
    while (y < this.skier.y + OBSTACLE_SPAWN_AHEAD + 400) {
      this.spawnObstacleAt(y);
      y += OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
    }
    this.nextObstacleY = y;
  }

  spawnObstacleAt(y) {
    const margin = 40;
    const x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
    const type = randomObstacleType();
    this.obstacles.push(new Obstacle(x, y, type));
  }

  spawnObstacle() {
    this.spawnObstacleAt(this.nextObstacleY);
    this.nextObstacleY += OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
  }

  update(dt) {
    if (this.state === 'start') {
      if (this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
        this.start();
      }
      return;
    }

    if (this.state === 'gameover') {
      if (this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
        this.state = 'start';
      }
      return;
    }

    this.skier.update(this.input, dt);

    this.totalDistance += this.skier.speed * (dt / 16);

    if (this.totalDistance > MONSTER_SPAWN_DISTANCE && !this.monster.active) {
      this.monster.activate(this.skier.y - MONSTER_RANGE);
    }

    this.monster.update(this.skier.x, this.skier.y, dt);

    while (this.nextObstacleY < this.skier.y + OBSTACLE_SPAWN_AHEAD) {
      this.spawnObstacle();
    }

    this.obstacles = this.obstacles.filter(o =>
      o.y > this.skier.y - OBSTACLE_CLEAR_BEHIND
    );

    if (!this.skier.jumping) {
      for (const obstacle of this.obstacles) {
        if (obstacle.collidesWith(this.skier)) {
          this.skier.crash();
          this.state = 'gameover';
          this.score = Math.floor(this.totalDistance);
          return;
        }
      }
    }

    if (this.monster.caughtSkier(this.skier.x, this.skier.y)) {
      this.skier.crash();
      this.state = 'gameover';
      this.score = Math.floor(this.totalDistance);
      return;
    }

    this.score = Math.floor(this.totalDistance);
  }

  render() {
    this.renderer.clear();

    if (this.state === 'start') {
      this.renderer.drawBackground();
      this.renderer.drawSnowflakes(16);
      this.renderer.drawStartScreen();
      return;
    }

    const cameraY = this.skier.y - CANVAS_HEIGHT / 2 + 50;

    this.renderer.drawBackground();

    const distanceMarkers = [1000, 2000, 3000, 5000, 10000];
    for (const d of distanceMarkers) {
      if (this.totalDistance >= d - 100) {
        this.renderer.drawDistanceMarker(
          cameraY + (this.totalDistance - d) + CANVAS_HEIGHT / 2 - 50,
          cameraY, `${d}m`
        );
      }
    }

    for (const obstacle of this.obstacles) {
      this.renderer.drawObstacle(obstacle, cameraY);
    }

    if (!this.skier.crashed) {
      this.renderer.drawSkier(this.skier, cameraY);
    } else {
      this.renderer.drawSkierCrashed(this.skier, cameraY);
    }

    this.renderer.drawMonster(this.monster, cameraY);

    this.renderer.drawSnowflakes(16);
    this.renderer.drawUI(this);

    if (this.state === 'gameover') {
      this.renderer.drawGameOver(this.score);
    }
  }

  loop(time) {
    const dt = Math.min(time - this.lastTime, 50);
    this.lastTime = time;

    this.update(dt);
    this.render();
    this.input.clearFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  run() {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }
}
