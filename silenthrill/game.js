import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const WORLD_SIZE = 60;
const TREE_COUNT = 40;
const GRAVE_COUNT = 25;
const GHOST_COUNT = 5;
const PLAYER_HEIGHT = 1.7;
const MOVE_SPEED = 5;
const GHOST_DETECT_RANGE = 14;
const GHOST_CHASE_SPEED = 4;
const GHOST_PATROL_SPEED = 1.2;
const GHOST_DAMAGE = 12;
const GHOST_ATTACK_COOLDOWN = 2;
const FLASHLIGHT_DRAIN = 6;
const FLASHLIGHT_RECHARGE = 3;
const HEARTBEAT_THRESHOLD = 40;
const FOOTSTEP_INTERVAL = 0.45;

// ===== AUDIO SYSTEM =====
class AudioSystem {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.ready = false;
  }

  async init() {
    this.music = this._create('audio/bgm.mp3', 0.25, true);
    this.sounds.footstep = this._create('audio/footstep.mp3', 0.5);
    this.sounds.heartbeat = this._create('audio/heartbeat.mp3', 0.5);
    this.sounds.scare = this._create('audio/scare.mp3', 0.7);
    this.sounds.whisper = this._create('audio/whisper.mp3', 0.35);

    try {
      await Promise.all([
        this._preload(this.music),
        ...Object.values(this.sounds).map(s => this._preload(s))
      ]);
    } catch (e) {
      console.warn('Audio load issues:', e);
    }
    this.ready = true;
  }

  _create(src, vol, loop = false) {
    const a = new Audio(src);
    a.volume = vol;
    a.loop = loop;
    return a;
  }

  _preload(a) {
    return new Promise((resolve) => {
      if (a.readyState >= 2) { resolve(); return; }
      a.addEventListener('canplaythrough', resolve, { once: true });
      a.addEventListener('error', resolve, { once: true });
      a.load();
    });
  }

  startMusic() {
    if (this.music) {
      this.music.currentTime = 0;
      this.music.play().catch(() => {});
    }
  }

  stopMusic() {
    if (this.music) { this.music.pause(); this.music.currentTime = 0; }
  }

  play(name) {
    const s = this.sounds[name];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  startLoop(name) {
    const s = this.sounds[name];
    if (s && !s.loop) {
      s.loop = true;
      s.currentTime = 10;
      s.play().catch(() => {});
    }
  }

  stopLoop(name) {
    const s = this.sounds[name];
    if (s) {
      s.loop = false;
      s.pause();
      s.currentTime = 0;
    }
  }
}

// ===== WORLD =====
function createGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14140a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const b = Math.floor(Math.random() * 25) + 8;
    ctx.fillStyle = `rgb(${b},${b+4},${b-2})`;
    ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);
  return tex;
}

function createTree(x, z) {
  const g = new THREE.Group();
  const trunkH = 1.5 + Math.random();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.2, trunkH, 5),
    new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const crownR = 0.8 + Math.random() * 0.8;
  const crownH = 1.5 + Math.random() * 1.5;
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(crownR, crownH, 5),
    new THREE.MeshStandardMaterial({ color: 0x0a120a, roughness: 0.95 })
  );
  foliage.position.y = trunkH + crownH * 0.4;
  foliage.rotation.y = Math.random() * Math.PI;
  g.add(foliage);
  g.position.set(x, 0, z);
  return g;
}

function createGrave(x, z) {
  const g = new THREE.Group();
  const h = 0.4 + Math.random() * 0.5;
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, h, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95, metalness: 0.1 })
  );
  stone.position.y = h / 2;
  stone.rotation.y = Math.random() * Math.PI * 2;
  stone.rotation.z = (Math.random() - 0.5) * 0.08;
  g.add(stone);
  g.position.set(x, 0, z);
  return g;
}

function createGhostMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshPhongMaterial({
      color: 0x8899bb,
      emissive: 0x445577,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.1
    })
  );
  body.scale.set(0.8, 1.2, 0.6);
  body.position.y = 0.8;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshPhongMaterial({
      color: 0xaabbdd,
      emissive: 0x556699,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1
    })
  );
  head.position.y = 1.4;
  head.scale.set(0.7, 0.8, 0.6);
  g.add(head);
  const glow = new THREE.PointLight(0x6688bb, 0.5, 6);
  glow.position.y = 1.2;
  g.add(glow);
  return g;
}

// ===== GHOST =====
class Ghost {
  constructor(scene, x, z) {
    this.mesh = createGhostMesh();
    this.patrolCenter = new THREE.Vector3(x, 0, z);
    this.position = new THREE.Vector3(x, 0, z);
    this.target = null;
    this.state = 'patrolling';
    this.attackTimer = 0;
    this.floatOffset = Math.random() * Math.PI * 2;
    this.speed = GHOST_PATROL_SPEED + Math.random() * 0.5;
    this.chaseSpeed = GHOST_CHASE_SPEED + Math.random() * 0.8;
    this.detectRange = GHOST_DETECT_RANGE + Math.random() * 3;
    this.baseY = 0.1 + Math.random() * 0.2;
    this.mesh.position.set(x, this.baseY, z);
    this._pickTarget();
    scene.add(this.mesh);
  }

  _pickTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 5 + 2;
    this.target = new THREE.Vector3(
      this.patrolCenter.x + Math.cos(a) * r,
      0,
      this.patrolCenter.z + Math.sin(a) * r
    );
  }

  update(playerPos, delta, time) {
    const dist = this.position.distanceTo(playerPos);
    this.attackTimer = Math.max(0, this.attackTimer - delta);

    const dir = new THREE.Vector3();
    let moving = false;

    if (dist < this.detectRange) {
      dir.subVectors(playerPos, this.position);
      dir.y = 0;
      dir.normalize();
      const speed = this.chaseSpeed * (dist > 6 ? 1 : 0.6);
      this.position.add(dir.clone().multiplyScalar(speed * delta));
      this.state = 'chasing';
      moving = true;
      const intensity = Math.min(1, 1 - (dist / this.detectRange));
      this.mesh.children.forEach(c => {
        if (c.material && c.material.emissiveIntensity !== undefined) {
          c.material.emissiveIntensity = 0.3 + intensity * 0.7;
        }
      });
      const glow = this.mesh.children.find(c => c instanceof THREE.PointLight);
      if (glow) glow.intensity = 0.5 + intensity * 1.5;
    } else {
      if (!this.target || this.position.distanceTo(this.target) < 1) {
        this._pickTarget();
      }
      dir.subVectors(this.target, this.position);
      dir.y = 0;
      dir.normalize();
      this.position.add(dir.clone().multiplyScalar(this.speed * delta));
      this.state = 'patrolling';
      moving = true;
      this.mesh.children.forEach(c => {
        if (c.material && c.material.emissiveIntensity !== undefined) {
          c.material.emissiveIntensity = 0.3;
        }
      });
      const glow = this.mesh.children.find(c => c instanceof THREE.PointLight);
      if (glow) glow.intensity = 0.5;
    }

    if (moving) {
      const bob = Math.sin(time * 3 + this.floatOffset) * 0.15;
      this.mesh.position.x = this.position.x;
      this.mesh.position.z = this.position.z;
      this.mesh.position.y = this.baseY + Math.abs(bob);
    }
  }

  canAttack() {
    return this.attackTimer <= 0;
  }

  resetAttack() {
    this.attackTimer = GHOST_ATTACK_COOLDOWN;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

// ===== GAME =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.018);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, PLAYER_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.prepend(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const clock = new THREE.Clock();
const audio = new AudioSystem();

// Lighting
const ambient = new THREE.AmbientLight(0x111122, 0.15);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0x3344aa, 0.25);
moonLight.position.set(30, 40, -30);
scene.add(moonLight);

// Flickering lights
const flickerLights = [];
for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(0xff8844, 0.6, 10);
  const angle = (i / 3) * Math.PI * 2;
  const r = 15 + Math.random() * 5;
  light.position.set(Math.cos(angle) * r, 2 + Math.random(), Math.sin(angle) * r);
  scene.add(light);
  flickerLights.push({ light, baseIntensity: 0.3 + Math.random() * 0.4, offset: Math.random() * 100 });
}

// Flashlight
const flashlight = new THREE.SpotLight(0xffeedd, 30, 25, Math.PI / 5, 0.6, 1.5);
flashlight.target.position.set(0, 0, -5);
flashlight.position.set(0, -0.1, 0.3);
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

const flashAmbient = new THREE.SpotLight(0xffeecc, 8, 12, Math.PI / 3, 0.6, 1.5);
flashAmbient.target.position.set(0, 0, -5);
flashAmbient.position.set(0, -0.1, 0.3);
camera.add(flashAmbient);
camera.add(flashAmbient.target);

// World objects
const obstacles = [];

function buildWorld() {
  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ map: createGroundTexture(), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  // Boundary walls (invisible, for collision)
  const wallHalf = WORLD_SIZE / 2 - 1;

  // Trees
  for (let i = 0; i < TREE_COUNT; i++) {
    let x, z, valid;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * (WORLD_SIZE - 6);
      z = (Math.random() - 0.5) * (WORLD_SIZE - 6);
      valid = Math.abs(x) > 3 || Math.abs(z) > 3;
      if (valid) {
        for (const o of obstacles) {
          if (o.distanceTo(new THREE.Vector3(x, 0, z)) < 2) { valid = false; break; }
        }
      }
      attempts++;
    } while (!valid && attempts < 20);
    const tree = createTree(x, z);
    scene.add(tree);
    obstacles.push(new THREE.Vector3(x, 0, z));
  }

  // Graves
  for (let i = 0; i < GRAVE_COUNT; i++) {
    let x, z, valid;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * (WORLD_SIZE - 10);
      z = (Math.random() - 0.5) * (WORLD_SIZE - 10);
      valid = Math.abs(x) > 4 || Math.abs(z) > 4;
      if (valid) {
        for (const o of obstacles) {
          if (o.distanceTo(new THREE.Vector3(x, 0, z)) < 1.5) { valid = false; break; }
        }
      }
      attempts++;
    } while (!valid && attempts < 20);
    const grave = createGrave(x, z);
    scene.add(grave);
    obstacles.push(new THREE.Vector3(x, 0, z));
  }

  // Fence posts / atmosphere
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const r = WORLD_SIZE / 2 - 0.5;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
    );
    post.position.set(Math.cos(angle) * r, 0.6, Math.sin(angle) * r);
    scene.add(post);
  }

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x445566 })
  );
  moon.position.set(25, 35, -35);
  scene.add(moon);
}

// Player state
const keys = { w: false, a: false, s: false, d: false };
let flashlightOn = true;
let flashBattery = 100;
let playerHealth = 100;
let survivalTime = 0;
let footstepTimer = 0;
let whisperTimer = 0;
let isMoving = false;
let gameState = 'loading';
let ghosts = [];

// DOM refs
const blocker = document.getElementById('blocker');
const hud = document.getElementById('hud');
const gameOver = document.getElementById('gameOver');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');
const timerEl = document.getElementById('timer');
const flashFill = document.getElementById('flashlight-fill');
const messageEl = document.getElementById('message');
const finalTime = document.getElementById('finalTime');
const deathMsg = document.getElementById('deathMessage');
const loadingStatus = document.getElementById('loadingStatus');
const crosshair = document.getElementById('crosshair');

function spawnGhosts() {
  for (const g of ghosts) g.dispose(scene);
  ghosts = [];
  for (let i = 0; i < GHOST_COUNT; i++) {
    let x, z, valid;
    let attempts = 0;
    do {
      const angle = (i / GHOST_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const r = 12 + Math.random() * 8;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      valid = Math.abs(x) > 5 || Math.abs(z) > 5;
      attempts++;
    } while (!valid && attempts < 10);
    ghosts.push(new Ghost(scene, x, z));
  }
}

function showMessage(text, duration = 2500) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  clearTimeout(messageEl._timeout);
  messageEl._timeout = setTimeout(() => messageEl.classList.remove('show'), duration);
}

function checkCollision(pos) {
  const wallHalf = WORLD_SIZE / 2 - 0.5;
  if (Math.abs(pos.x) > wallHalf || Math.abs(pos.z) > wallHalf) return true;
  for (const obs of obstacles) {
    const dx = pos.x - obs.x;
    const dz = pos.z - obs.z;
    if (dx * dx + dz * dz < 0.7) return true;
  }
  return false;
}

function updatePlayer(delta) {
  if (!controls.isLocked) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const moveVec = new THREE.Vector3();
  if (keys.w) moveVec.add(forward);
  if (keys.s) moveVec.sub(forward);
  if (keys.a) moveVec.sub(right);
  if (keys.d) moveVec.add(right);

  isMoving = moveVec.length() > 0;
  if (isMoving) moveVec.normalize().multiplyScalar(MOVE_SPEED * delta);

  if (moveVec.length() > 0) {
    const newPos = camera.position.clone().add(moveVec);
    if (!checkCollision(newPos)) {
      camera.position.copy(newPos);
    } else {
      // Try sliding along axes
      const attemptX = new THREE.Vector3(camera.position.x + moveVec.x, camera.position.y, camera.position.z);
      const attemptZ = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z + moveVec.z);
      if (!checkCollision(attemptX)) camera.position.x = attemptX.x;
      if (!checkCollision(attemptZ)) camera.position.z = attemptZ.z;
    }
  }

  // Footstep sounds
  if (isMoving) {
    footstepTimer -= delta;
    if (footstepTimer <= 0) {
      audio.play('footstep');
      footstepTimer = FOOTSTEP_INTERVAL;
    }
  } else {
    footstepTimer = 0;
  }

  // Flashlight
  if (flashlightOn && flashBattery > 0) {
    flashBattery = Math.max(0, flashBattery - FLASHLIGHT_DRAIN * delta);
    if (flashBattery <= 0) {
      flashlightOn = false;
      showMessage('Flashlight battery depleted');
    }
  } else if (!flashlightOn && flashBattery < 100) {
    flashBattery = Math.min(100, flashBattery + FLASHLIGHT_RECHARGE * delta);
  }

  flashlight.visible = flashlightOn;
  flashAmbient.visible = flashlightOn;

  // Flashlight flicker when low
  if (flashlightOn && flashBattery < 20) {
    const flicker = 0.7 + Math.random() * 0.3;
    flashlight.intensity = 30 * flicker;
    flashAmbient.intensity = 8 * flicker;
  } else if (flashlightOn) {
    flashlight.intensity = 30;
    flashAmbient.intensity = 8;
  }
}

function updateGhosts(delta, time) {
  const playerPos = camera.position.clone();
  for (const ghost of ghosts) {
    ghost.update(playerPos, delta, time);
    const dist = ghost.position.distanceTo(playerPos);
    if (dist < 1.5 && ghost.canAttack()) {
      playerHealth = Math.max(0, playerHealth - GHOST_DAMAGE);
      ghost.resetAttack();
      audio.play('scare');
      showMessage('A ghost touched you!', 1500);
      // Screen flash
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:rgba(139,0,0,0.3);z-index:50;pointer-events:none;transition:opacity 0.5s';
      document.body.appendChild(flash);
      requestAnimationFrame(() => flash.style.opacity = '0');
      setTimeout(() => flash.remove(), 500);
    }
  }
}

function updateLights(time) {
  for (const fl of flickerLights) {
    const flicker = Math.sin(time * 3 + fl.offset) * 0.3 + Math.sin(time * 7 + fl.offset * 2) * 0.15;
    fl.light.intensity = fl.baseIntensity * (0.6 + Math.abs(flicker) * 0.8);
  }
}

function updateAudio(delta) {
  if (playerHealth < HEARTBEAT_THRESHOLD) {
    audio.startLoop('heartbeat');
  } else {
    audio.stopLoop('heartbeat');
  }

  // Random whispers
  whisperTimer -= delta;
  if (whisperTimer <= 0 && gameState === 'playing') {
    if (Math.random() < 0.3) {
      audio.play('whisper');
    }
    whisperTimer = 8 + Math.random() * 12;
  }
}

function updateHUD() {
  healthFill.style.width = `${playerHealth}%`;
  healthText.textContent = Math.round(playerHealth);
  if (playerHealth < 30) {
    healthFill.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
  } else if (playerHealth < 60) {
    healthFill.style.background = 'linear-gradient(90deg, #cc4400, #cc6600)';
  } else {
    healthFill.style.background = 'linear-gradient(90deg, #8b0000, #cc0000)';
  }

  flashFill.style.width = `${flashBattery}%`;
  flashFill.style.background = flashBattery < 20
    ? 'linear-gradient(90deg, #882200, #cc4400)'
    : 'linear-gradient(90deg, #664400, #cc8800)';

  const mins = Math.floor(survivalTime / 60);
  const secs = Math.floor(survivalTime % 60);
  timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  crosshair.style.opacity = flashlightOn ? '1' : '0.2';
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (gameState === 'playing') {
    survivalTime += delta;
    updatePlayer(delta);
    updateGhosts(delta, time);
    updateLights(time);
    updateAudio(delta);
    updateHUD();

    if (playerHealth <= 0) {
      gameOverHandler();
    }
  }

  renderer.render(scene, camera);
}

function gameOverHandler() {
  gameState = 'dead';
  audio.stopMusic();
  audio.stopLoop('heartbeat');
  controls.unlock();

  const messages = [
    'The darkness consumed you...',
    'You became one with the fog...',
    'The ghosts claimed another soul...',
    'Silence... at last...'
  ];
  deathMsg.textContent = messages[Math.floor(Math.random() * messages.length)];

  const mins = Math.floor(survivalTime / 60);
  const secs = Math.floor(survivalTime % 60);
  finalTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  gameOver.classList.remove('hidden');
  hud.classList.remove('visible');
}

function startGame() {
  gameState = 'playing';
  blocker.classList.add('hidden');
  hud.classList.add('visible');
  controls.lock();
  audio.startMusic();
  whisperTimer = 5;
}

function resetGame() {
  gameOver.classList.add('hidden');
  blocker.classList.remove('hidden');
  hud.classList.remove('visible');

  playerHealth = 100;
  survivalTime = 0;
  flashBattery = 100;
  flashlightOn = true;
  footstepTimer = 0;
  whisperTimer = 0;
  camera.position.set(0, PLAYER_HEIGHT, 0);
  controls.unlock();

  spawnGhosts();
  updateHUD();
  audio.stopMusic();
  audio.stopLoop('heartbeat');
  gameState = 'loading';
  document.querySelector('#instructions h1').textContent = 'SILENT THRILL';
  startBtn.textContent = 'ENTER THE DARKNESS';
  startBtn.disabled = false;
}

// ===== EVENT HANDLERS =====
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (k === 'f' && gameState === 'playing') {
    flashlightOn = !flashlightOn;
    showMessage(flashlightOn ? 'Flashlight on' : 'Flashlight off', 800);
  }
  if (k === 'r' && gameState === 'dead') resetGame();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && gameState === 'playing') {
    // Only pause if not game over
  }
});

startBtn.addEventListener('click', () => {
  if (gameState === 'loading' || gameState === 'menu') startGame();
});

restartBtn.addEventListener('click', resetGame);

// ===== INIT =====
async function init() {
  loadingStatus.textContent = 'Building the world...';
  buildWorld();

  loadingStatus.textContent = 'Summoning spirits...';
  spawnGhosts();

  loadingStatus.textContent = 'Loading audio...';
  await audio.init();

  loadingStatus.textContent = '';
  startBtn.textContent = 'ENTER THE DARKNESS';
  startBtn.disabled = false;
  gameState = 'menu';

  gameLoop();
  updateHUD();
}

init();
