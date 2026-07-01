import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ===== TUNING =====
const WORLD_R = 33;              // playable radius (circular fence)
const TREE_COUNT = 46;
const GRAVE_COUNT = 30;
const SOUL_COUNT = 7;
const BATTERY_COUNT = 5;
const GHOST_BASE_COUNT = 4;
const GHOST_MAX_COUNT = 8;
const PLAYER_HEIGHT = 1.7;
const MOVE_SPEED = 4.3;
const SPRINT_SPEED = 7.5;
const STAMINA_DRAIN = 22;
const STAMINA_REGEN = 14;
const GHOST_ATTACK_RANGE = 1.5;
const GHOST_DAMAGE = 12;
const GHOST_ATTACK_COOLDOWN = 2.2;
const FLASHLIGHT_DRAIN = 4.5;
const FLASHLIGHT_RECHARGE = 6;
const BATTERY_REFILL = 50;
const BEAM_RANGE = 16;
const BEAM_COS = Math.cos(0.5); // ~28 degrees half-angle
const BURN_TIME = 1.6;          // seconds of beam to banish a wraith
const FOOTSTEP_INTERVAL = 0.45;
const HEALTH_REGEN_DELAY = 8;
const HEALTH_REGEN_RATE = 1.5;

// ===== AUDIO (mp3 assets) =====
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

  play(name, volume = null) {
    const s = this.sounds[name];
    if (!s) return;
    if (volume !== null) s.volume = volume;
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  startLoop(name) {
    const s = this.sounds[name];
    if (s && !s.loop) {
      s.loop = true;
      s.currentTime = 0;
      s.play().catch(() => {});
    }
  }

  stopLoop(name) {
    const s = this.sounds[name];
    if (s && s.loop) {
      s.loop = false;
      s.pause();
      s.currentTime = 0;
    }
  }
}

// ===== SYNTHESIZED SFX (WebAudio) =====
class Sfx {
  constructor() { this.ctx = null; }

  ensure() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* no WebAudio */ }
    return !!this.ctx;
  }

  _noiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // brownish noise: integrate white noise
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  soulChime() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.7);
      g.gain.setValueAtTime(0.12 - i * 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.ctx.destination);
      o.start(t + i * 0.06);
      o.stop(t + 1);
    });
  }

  batteryClick() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(520, t);
    o.frequency.setValueAtTime(780, t + 0.07);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }

  burnHiss() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  banish() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.9);
    this.burnHiss();
  }

  thunder() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  gateOpen() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.linearRampToValueAtTime(90, t + 1.2);
    o.frequency.linearRampToValueAtTime(48, t + 2.2);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 2.5);
  }
}

// ===== TEXTURES =====
function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const glowTexture = createGlowTexture();

// ===== WORLD OBJECT FACTORIES =====
const barkMat = new THREE.MeshStandardMaterial({ color: 0x1d150d, roughness: 0.95 });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3f4240, roughness: 0.95, metalness: 0.05 });
const mossStoneMat = new THREE.MeshStandardMaterial({ color: 0x37413a, roughness: 0.95 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7, metalness: 0.6 });

function createDeadTree(x, z) {
  const g = new THREE.Group();
  const trunkH = 3 + Math.random() * 2.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.28, trunkH, 6), barkMat);
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (Math.random() - 0.5) * 0.22;
  trunk.castShadow = true;
  g.add(trunk);
  // crooked branches
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branchCount; i++) {
    const len = 1 + Math.random() * 1.4;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, len, 5), barkMat);
    const h = trunkH * (0.5 + Math.random() * 0.45);
    const ang = Math.random() * Math.PI * 2;
    branch.position.set(Math.cos(ang) * 0.15, h, Math.sin(ang) * 0.15);
    branch.rotation.z = Math.cos(ang) * (0.7 + Math.random() * 0.6);
    branch.rotation.x = -Math.sin(ang) * (0.7 + Math.random() * 0.6);
    branch.translateY(len / 2);
    branch.castShadow = true;
    g.add(branch);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

function createGrave(x, z) {
  const g = new THREE.Group();
  const mat = Math.random() < 0.4 ? mossStoneMat : stoneMat;
  const kind = Math.random();
  if (kind < 0.4) {
    // plain slab
    const h = 0.5 + Math.random() * 0.5;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.12), mat);
    stone.position.y = h / 2;
    stone.castShadow = true;
    g.add(stone);
  } else if (kind < 0.7) {
    // rounded-top headstone
    const h = 0.5 + Math.random() * 0.4;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.12), mat);
    stone.position.y = h / 2;
    stone.castShadow = true;
    g.add(stone);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.12, 12, 1, false, 0, Math.PI), mat);
    top.rotation.z = Math.PI / 2;
    top.rotation.y = Math.PI / 2;
    top.position.y = h;
    top.castShadow = true;
    g.add(top);
  } else {
    // cross
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.1), mat);
    post.position.y = 0.55;
    post.castShadow = true;
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.1), mat);
    arm.position.y = 0.8;
    arm.castShadow = true;
    g.add(arm);
  }
  // dirt mound
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x191410, roughness: 1 })
  );
  mound.scale.set(0.8, 0.18, 1.4);
  mound.position.z = 0.75;
  g.add(mound);

  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.rotation.z = (Math.random() - 0.5) * 0.12;
  return g;
}

function createMausoleum(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3, 3.4), stoneMat);
  body.position.y = 1.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 4), mossStoneMat);
  roof.position.y = 3.7;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  // doorway (black void)
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 2),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  door.position.set(0, 1, 1.71);
  g.add(door);
  // columns
  for (const side of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.6, 8), stoneMat);
    col.position.set(side * 1.5, 1.3, 1.85);
    col.castShadow = true;
    g.add(col);
  }
  g.position.set(x, 0, z);
  return g;
}

// ===== GHOST SHADER =====
const ghostVertexShader = `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vY;
void main() {
  vec3 pos = position;
  float sway = sin(uTime * 2.0 + position.y * 3.0) * 0.05;
  float tatter = smoothstep(0.7, 0.0, position.y)
    * sin(uTime * 5.0 + position.x * 9.0 + position.z * 7.0) * 0.13;
  pos.x += sway + tatter;
  pos.z += cos(uTime * 1.7 + position.y * 2.5) * 0.05 + tatter * 0.7;
  vY = position.y;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const ghostFragmentShader = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vY;
void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.0);
  float bodyFade = smoothstep(0.0, 0.55, vY);
  float alpha = (0.12 + fresnel * 0.9) * bodyFade * 0.85 * uOpacity;
  vec3 col = uColor * (0.5 + fresnel * 1.6) * uIntensity;
  gl_FragColor = vec4(col, alpha);
}
`;

function createGhostGeometry() {
  const profile = [
    [0.00, 0.52],
    [0.15, 0.44],
    [0.45, 0.35],
    [0.80, 0.31],
    [1.05, 0.34],
    [1.25, 0.28],
    [1.35, 0.24],
    [1.50, 0.29],
    [1.65, 0.23],
    [1.78, 0.09],
    [1.82, 0.001],
  ];
  const pts = profile.map(([y, r]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 20);
}

const ghostGeometry = createGhostGeometry();

class Ghost {
  constructor(scene, playerPos) {
    this.scene = scene;
    this.uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x7fa0cc) },
      uIntensity: { value: 0.7 },
      uOpacity: { value: 0 },
    };
    const bodyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: ghostVertexShader,
      fragmentShader: ghostFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Group();
    this.body = new THREE.Mesh(ghostGeometry, bodyMat);
    this.mesh.add(this.body);

    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x99bbee });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), this.eyeMat);
      eye.position.set(side * 0.1, 1.52, 0.24);
      this.mesh.add(eye);
    }

    this.glow = new THREE.PointLight(0x6688bb, 2, 8, 1.6);
    this.glow.position.y = 1.2;
    this.mesh.add(this.glow);

    this.position = new THREE.Vector3();
    this.target = null;
    this.state = 'patrol';
    this.attackTimer = 0;
    this.burn = 0;
    this.fade = 0;          // 0..1 spawn fade-in
    this.banishT = -1;      // >=0 while dissolving
    this.floatOffset = Math.random() * Math.PI * 2;
    this.patrolSpeed = 1.1 + Math.random() * 0.5;
    this.facing = Math.random() * Math.PI * 2;

    scene.add(this.mesh);
    this.respawn(playerPos);
  }

  respawn(playerPos) {
    let x, z;
    let attempts = 0;
    do {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * (WORLD_R - 13);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      attempts++;
    } while (playerPos && Math.hypot(x - playerPos.x, z - playerPos.z) < 15 && attempts < 30);
    this.position.set(x, 0, z);
    this.patrolCenter = new THREE.Vector3(x, 0, z);
    this.state = 'patrol';
    this.burn = 0;
    this.fade = 0;
    this.banishT = -1;
    this._pickTarget();
  }

  _pickTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 6 + 2;
    this.target = new THREE.Vector3(
      this.patrolCenter.x + Math.cos(a) * r,
      0,
      this.patrolCenter.z + Math.sin(a) * r
    );
  }

  update(playerPos, camForward, beamActive, delta, time, difficulty, onBanish) {
    this.uniforms.uTime.value = time + this.floatOffset;
    this.attackTimer = Math.max(0, this.attackTimer - delta);

    // dissolving after banish
    if (this.banishT >= 0) {
      this.banishT += delta;
      this.uniforms.uOpacity.value = Math.max(0, 1 - this.banishT / 0.7);
      this.glow.intensity = Math.max(0, 4 * (1 - this.banishT / 0.7));
      this.mesh.position.y += delta * 1.5; // rise as it dissolves
      if (this.banishT > 0.9) this.respawn(playerPos);
      return;
    }

    this.fade = Math.min(1, this.fade + delta / 1.5);
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // flashlight beam check
    const dirToGhost = new THREE.Vector3(
      this.position.x - playerPos.x, 0, this.position.z - playerPos.z
    ).normalize();
    const flatForward = new THREE.Vector3(camForward.x, 0, camForward.z).normalize();
    const inBeam = beamActive && dist < BEAM_RANGE && flatForward.dot(dirToGhost) > BEAM_COS;

    if (inBeam) {
      this.burn += delta;
      if (this.burn >= BURN_TIME) {
        this.banishT = 0;
        onBanish(this);
        return;
      }
    } else {
      this.burn = Math.max(0, this.burn - delta * 0.7);
    }

    const detectRange = 12 + difficulty * 1.2;
    const chaseSpeed = (3.0 + difficulty * 0.3) * (inBeam ? 0.12 : 1);

    const dir = new THREE.Vector3();
    if (dist < detectRange) {
      this.state = 'chase';
      dir.copy(toPlayer).normalize();
      this.position.addScaledVector(dir, chaseSpeed * delta);
    } else {
      this.state = 'patrol';
      if (!this.target || this.position.distanceTo(this.target) < 1) this._pickTarget();
      dir.subVectors(this.target, this.position);
      dir.y = 0;
      dir.normalize();
      this.position.addScaledVector(dir, this.patrolSpeed * (inBeam ? 0.12 : 1) * delta);
    }

    // keep inside the fence
    const rad = Math.hypot(this.position.x, this.position.z);
    if (rad > WORLD_R - 1) {
      this.position.multiplyScalar((WORLD_R - 1) / rad);
    }

    // visuals
    const chaseHeat = this.state === 'chase' ? Math.min(1, 1 - dist / detectRange) : 0;
    const burnHeat = this.burn / BURN_TIME;
    this.uniforms.uIntensity.value = 0.7 + chaseHeat * 0.9 + burnHeat * 1.6;
    this.uniforms.uOpacity.value = this.fade;
    // hue climbs blue -> violet -> blood red as it closes in (avoids green)
    const hue = (0.6 + chaseHeat * 0.4) % 1;
    this.uniforms.uColor.value.setHSL(hue, 0.45 + chaseHeat * 0.35, 0.6 + burnHeat * 0.3);
    this.eyeMat.color.setHSL(hue, 0.9, 0.6 + chaseHeat * 0.3);
    this.glow.intensity = (2 + chaseHeat * 4 + burnHeat * 3) * this.fade;
    this.glow.color.copy(this.uniforms.uColor.value);

    // face movement direction
    const targetFacing = Math.atan2(dir.x, dir.z);
    let d = targetFacing - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, delta * 5);
    this.mesh.rotation.y = this.facing;

    const bob = Math.sin(time * 2.4 + this.floatOffset) * 0.12;
    this.mesh.position.set(this.position.x, 0.15 + Math.abs(bob), this.position.z);
  }

  canAttack() { return this.attackTimer <= 0 && this.banishT < 0 && this.fade > 0.5; }
  resetAttack() { this.attackTimer = GHOST_ATTACK_COOLDOWN; }
  dispose() { this.scene.remove(this.mesh); }
}

// ===== SCENE =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x02030a, 0.02);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, PLAYER_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const clock = new THREE.Clock();
const audio = new AudioSystem();
const sfx = new Sfx();

// ===== POST-PROCESSING =====
const FilmVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDamage: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDamage;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float grain = (rand(vUv * vec2(1131.0, 733.0) + fract(uTime) * 91.0) - 0.5) * 0.06;
      col.rgb += grain;
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.78, 0.28, length(d));
      col.rgb *= mix(0.18, 1.0, vig);
      col.rgb = mix(col.rgb, vec3(0.35, 0.0, 0.0), uDamage * (1.0 - vig * 0.6));
      gl_FragColor = col;
    }`,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.7
);
composer.addPass(bloomPass);
const filmPass = new ShaderPass(FilmVignetteShader);
composer.addPass(filmPass);

// ===== LIGHTING =====
// three r162 uses physically-based light units, so intensities are large
const FLASH_INTENSITY = 120;
const FLASH_WIDE_INTENSITY = 26;

const ambient = new THREE.AmbientLight(0x1c2440, 1.5);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0x3a4a8a, 0.9);
moonLight.position.set(30, 40, -30);
scene.add(moonLight);

const lightningLight = new THREE.HemisphereLight(0xaabbff, 0x223344, 0);
scene.add(lightningLight);

// flickering lanterns near graves
const flickerLights = [];
for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(0xff8844, 3, 13, 1.8);
  const angle = (i / 3) * Math.PI * 2 + 0.6;
  const r = 14 + Math.random() * 6;
  light.position.set(Math.cos(angle) * r, 2 + Math.random(), Math.sin(angle) * r);
  scene.add(light);
  // small lantern glow sprite
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xff9955, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.set(1.4, 1.4, 1);
  sprite.position.copy(light.position);
  scene.add(sprite);
  flickerLights.push({ light, sprite, baseIntensity: 2.2 + Math.random() * 1.8, offset: Math.random() * 100 });
}

// flashlight
const flashlight = new THREE.SpotLight(0xffeedd, FLASH_INTENSITY, 32, Math.PI / 5, 0.5, 1.1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 30;
flashlight.shadow.bias = -0.003;
flashlight.target.position.set(0, 0, -5);
flashlight.position.set(0, -0.1, 0.3);
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

const flashAmbient = new THREE.SpotLight(0xffeecc, FLASH_WIDE_INTENSITY, 16, Math.PI / 3, 0.6, 1.2);
flashAmbient.target.position.set(0, 0, -5);
flashAmbient.position.set(0, -0.1, 0.3);
camera.add(flashAmbient);
camera.add(flashAmbient.target);

// ===== WORLD BUILD =====
const colliders = []; // {x, z, r}
const GATE_POS = new THREE.Vector3(0, 0, -(WORLD_R - 0.5));
let gateBeacon = null;
let gateDoors = null;
let gateControllers = []; // {obj, closedY, openY} — door pivots to animate
let gateProgress = 0;

const texLoader = new THREE.TextureLoader();
function loadTiled(url, repeats, srgb = false) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeats, repeats);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function placeClear(minR, maxR, spacing, extraAvoid = []) {
  let x, z, valid;
  let attempts = 0;
  do {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    x = Math.cos(a) * r;
    z = Math.sin(a) * r;
    valid = true;
    for (const o of colliders) {
      if (Math.hypot(x - o.x, z - o.z) < spacing + o.r) { valid = false; break; }
    }
    if (valid) {
      for (const p of extraAvoid) {
        if (Math.hypot(x - p.x, z - p.z) < p.r) { valid = false; break; }
      }
    }
    attempts++;
  } while (!valid && attempts < 40);
  return { x, z };
}

function buildWorld() {
  // ground — rocky terrain PBR scan, darkened for night
  const GROUND_REPEAT = 9;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_R + 6, 48),
    new THREE.MeshStandardMaterial({
      map: loadTiled('textures/ground_diff.jpg', GROUND_REPEAT, true),
      normalMap: loadTiled('textures/ground_normal.png', GROUND_REPEAT),
      roughnessMap: loadTiled('textures/ground_rough.jpg', GROUND_REPEAT),
      color: 0x77726a,
      roughness: 1,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // mausoleum landmark
  const mauso = createMausoleum(-13, -13);
  mauso.rotation.y = Math.PI / 4;
  scene.add(mauso);
  colliders.push({ x: -13, z: -13, r: 2.9 });

  // dead trees
  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = placeClear(4, WORLD_R - 2, 1.6, [{ x: GATE_POS.x, z: GATE_POS.z, r: 4 }]);
    scene.add(createDeadTree(x, z));
    colliders.push({ x, z, r: 0.32 });
  }

  // graves
  for (let i = 0; i < GRAVE_COUNT; i++) {
    const { x, z } = placeClear(4, WORLD_R - 3, 1.3, [{ x: GATE_POS.x, z: GATE_POS.z, r: 4 }]);
    scene.add(createGrave(x, z));
    colliders.push({ x, z, r: 0.3 });
  }

  // iron fence: posts + two rail rings
  const gateAngle = Math.atan2(GATE_POS.z, GATE_POS.x);
  const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.6, 5);
  const tipGeo = new THREE.ConeGeometry(0.07, 0.18, 5);
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    let dA = Math.abs(angle - (gateAngle + Math.PI * 2) % (Math.PI * 2));
    dA = Math.min(dA, Math.PI * 2 - dA);
    if (dA < 0.09) continue; // gap for the gate
    const r = WORLD_R;
    const post = new THREE.Mesh(postGeo, ironMat);
    post.position.set(Math.cos(angle) * r, 0.8, Math.sin(angle) * r);
    scene.add(post);
    const tip = new THREE.Mesh(tipGeo, ironMat);
    tip.position.set(Math.cos(angle) * r, 1.68, Math.sin(angle) * r);
    scene.add(tip);
  }
  for (const railY of [0.55, 1.3]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(WORLD_R, 0.03, 5, 96), ironMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = railY;
    scene.add(rail);
  }

  // gate: two pillars + arch + doors
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 0.6), stoneMat);
    pillar.position.set(GATE_POS.x + side * 1.9, 1.7, GATE_POS.z);
    pillar.castShadow = true;
    scene.add(pillar);
    colliders.push({ x: pillar.position.x, z: pillar.position.z, r: 0.5 });
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f4240, roughness: 0.9 })
    );
    orb.position.set(pillar.position.x, 3.6, pillar.position.z);
    scene.add(orb);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 0.45), ironMat);
  arch.position.set(GATE_POS.x, 3.2, GATE_POS.z);
  scene.add(arch);

  // procedural gate doors (fallback if the scanned model fails to load)
  gateDoors = new THREE.Group();
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    for (let b = 0; b < 6; b++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.9, 5), ironMat);
      bar.position.set(side * (0.25 + b * 0.25), 1.45, 0);
      door.add(bar);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.06), ironMat);
    cross.position.set(side * 0.85, 2.2, 0);
    door.add(cross);
    const cross2 = cross.clone();
    cross2.position.y = 0.6;
    door.add(cross2);
    gateDoors.add(door);
  }
  gateDoors.position.copy(GATE_POS);
  scene.add(gateDoors);
  gateControllers = [
    { obj: gateDoors.children[0], closedY: 0, openY: -1.5 },
    { obj: gateDoors.children[1], closedY: 0, openY: 1.5 },
  ];

  // photoscanned iron gate (Poly Haven), doors re-hinged so they can swing
  new GLTFLoader().load('models/iron_gate.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    const pivots = [];
    for (const name of ['large_iron_gate_left_door', 'large_iron_gate_right_door']) {
      const door = model.getObjectByName(name);
      if (!door) continue;
      const box = new THREE.Box3().setFromObject(door);
      const hingeX = Math.abs(box.min.x) > Math.abs(box.max.x) ? box.min.x : box.max.x;
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, door.position.y, door.position.z);
      door.parent.add(pivot);
      door.position.x -= hingeX;
      pivot.add(door);
      // swing outward (away from the graveyard)
      pivots.push({ obj: pivot, closedY: 0, openY: hingeX < 0 ? 1.9 : -1.9 });
    }
    model.scale.setScalar(1.05);
    model.position.copy(GATE_POS);
    scene.add(model);
    scene.remove(gateDoors);
    gateDoors = model;
    gateControllers = pivots;
  }, undefined, (err) => {
    console.warn('Gate model failed to load, using procedural gate', err);
  });

  // beacon light column at the gate (hidden until unlocked)
  gateBeacon = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x77eeff, transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  column.position.y = 15;
  gateBeacon.add(column);
  const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x88eeff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beaconGlow.scale.set(5, 5, 1);
  beaconGlow.position.y = 1.6;
  gateBeacon.add(beaconGlow);
  gateBeacon.position.copy(GATE_POS);
  gateBeacon.visible = false;
  scene.add(gateBeacon);

  // moon + halo
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x8f9fc0, fog: false })
  );
  moon.position.set(45, 55, -70);
  scene.add(moon);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x6677aa, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonHalo.scale.set(30, 30, 1);
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const elev = Math.random() * Math.PI * 0.45 + 0.08;
    const r = 150;
    starPos.push(
      Math.cos(a) * Math.cos(elev) * r,
      Math.sin(elev) * r,
      Math.sin(a) * Math.cos(elev) * r
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x99aacc, size: 1.4, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.7,
  }));
  scene.add(stars);
}

// ===== GROUND FOG =====
const fogSprites = [];
function buildGroundFog() {
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0x334055, transparent: true,
      opacity: 0.05 + Math.random() * 0.05, depthWrite: false,
    }));
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * WORLD_R;
    const scale = 9 + Math.random() * 9;
    s.scale.set(scale, scale * 0.45, 1);
    s.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    scene.add(s);
    fogSprites.push({
      sprite: s, baseX: s.position.x, baseZ: s.position.z,
      speed: 0.1 + Math.random() * 0.25, offset: Math.random() * Math.PI * 2,
    });
  }
}

// ===== COLLECTIBLES =====
const souls = [];
const batteries = [];

function createSoul(x, z) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xbfffff })
  );
  g.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x66ddff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(1.6, 1.6, 1);
  g.add(halo);
  g.position.set(x, 1, z);
  scene.add(g);
  return { group: g, halo, x, z, collected: false, offset: Math.random() * Math.PI * 2 };
}

function createBattery(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10),
    new THREE.MeshStandardMaterial({
      color: 0x224422, emissive: 0x33ff66, emissiveIntensity: 0.7, roughness: 0.4,
    })
  );
  g.add(body);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x44ff77, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(0.9, 0.9, 1);
  g.add(halo);
  g.position.set(x, 0.35, z);
  scene.add(g);
  return { group: g, halo, x, z, collected: false, offset: Math.random() * Math.PI * 2 };
}

function spawnCollectibles() {
  for (const s of souls) scene.remove(s.group);
  for (const b of batteries) scene.remove(b.group);
  souls.length = 0;
  batteries.length = 0;

  const placed = [{ x: 0, z: 0, r: 6 }]; // keep clear of spawn
  for (let i = 0; i < SOUL_COUNT; i++) {
    const { x, z } = placeClear(6, WORLD_R - 3, 0.8, placed.map(p => ({ ...p, r: Math.max(p.r, 7) })));
    souls.push(createSoul(x, z));
    placed.push({ x, z, r: 7 });
  }
  for (let i = 0; i < BATTERY_COUNT; i++) {
    const { x, z } = placeClear(5, WORLD_R - 3, 0.8, placed.map(p => ({ ...p, r: 4 })));
    batteries.push(createBattery(x, z));
    placed.push({ x, z, r: 4 });
  }
}

// ===== STATE =====
const keys = { w: false, a: false, s: false, d: false, shift: false };
let flashlightOn = true;
let flashBattery = 100;
let playerHealth = 100;
let stamina = 100;
let sprintLocked = false;
let survivalTime = 0;
let footstepTimer = 0;
let whisperTimer = 0;
let lastDamageTime = -100;
let damagePulse = 0;
let bobPhase = 0;
let gameState = 'loading';
let ghosts = [];
let soulsCollected = 0;
let banishedCount = 0;
let gateOpen = false;
let lightningTimer = 14 + Math.random() * 20;
let lightningPhase = -1;
let thunderQueued = false;

// ===== DOM =====
const $ = id => document.getElementById(id);
const blocker = $('blocker');
const pauseEl = $('pause');
const hud = $('hud');
const gameOverEl = $('gameOver');
const winScreen = $('winScreen');
const startBtn = $('startBtn');
const restartBtn = $('restartBtn');
const winRestartBtn = $('winRestartBtn');
const healthFill = $('health-fill');
const healthText = $('health-text');
const timerEl = $('timer');
const staminaFill = $('stamina-fill');
const flashFill = $('flashlight-fill');
const messageEl = $('message');
const soulsText = $('soulsText');
const objectiveEl = $('objective');
const finalTime = $('finalTime');
const finalSouls = $('finalSouls');
const deathMsg = $('deathMessage');
const winTimeEl = $('winTime');
const winBanishedEl = $('winBanished');
const winBestEl = $('winBest');
const bestTimeEl = $('bestTime');
const loadingStatus = $('loadingStatus');
const crosshair = $('crosshair');

function fmtTime(t) {
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showBestTime() {
  const best = localStorage.getItem('silentThrillBest');
  bestTimeEl.textContent = best ? `Best escape: ${fmtTime(parseFloat(best))}` : '';
}

function showMessage(text, duration = 2500) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  clearTimeout(messageEl._timeout);
  messageEl._timeout = setTimeout(() => messageEl.classList.remove('show'), duration);
}

// ===== GHOSTS =====
function targetGhostCount() {
  return Math.min(GHOST_MAX_COUNT, GHOST_BASE_COUNT + Math.floor(soulsCollected / 2));
}

function spawnGhosts() {
  for (const g of ghosts) g.dispose();
  ghosts = [];
  for (let i = 0; i < targetGhostCount(); i++) {
    ghosts.push(new Ghost(scene, camera.position));
  }
}

function onBanish(ghost) {
  banishedCount++;
  sfx.banish();
  showMessage('Wraith banished!', 1500);
}

// ===== PLAYER =====
function checkCollision(pos) {
  if (Math.hypot(pos.x, pos.z) > WORLD_R - 0.7) return true;
  for (const o of colliders) {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const rr = o.r + 0.35;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

function updatePlayer(delta, time) {
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

  const isMoving = moveVec.lengthSq() > 0;

  // sprint with hysteresis so it doesn't stutter at 0 stamina
  if (stamina <= 0) sprintLocked = true;
  if (stamina > 25) sprintLocked = false;
  const sprinting = keys.shift && isMoving && !sprintLocked;
  if (sprinting) {
    stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
  } else {
    stamina = Math.min(100, stamina + STAMINA_REGEN * delta);
  }
  const speed = sprinting ? SPRINT_SPEED : MOVE_SPEED;

  if (isMoving) {
    moveVec.normalize().multiplyScalar(speed * delta);
    const newPos = camera.position.clone().add(moveVec);
    if (!checkCollision(newPos)) {
      camera.position.x = newPos.x;
      camera.position.z = newPos.z;
    } else {
      const attemptX = camera.position.clone();
      attemptX.x += moveVec.x;
      const attemptZ = camera.position.clone();
      attemptZ.z += moveVec.z;
      if (!checkCollision(attemptX)) camera.position.x = attemptX.x;
      if (!checkCollision(attemptZ)) camera.position.z = attemptZ.z;
    }
  }

  // head bob
  if (isMoving) {
    bobPhase += delta * speed * 1.7;
    camera.position.y = PLAYER_HEIGHT + Math.sin(bobPhase) * 0.045;
  } else {
    camera.position.y += (PLAYER_HEIGHT - camera.position.y) * Math.min(1, delta * 6);
  }

  // footsteps
  if (isMoving) {
    footstepTimer -= delta;
    if (footstepTimer <= 0) {
      audio.play('footstep', sprinting ? 0.6 : 0.45);
      footstepTimer = sprinting ? 0.3 : FOOTSTEP_INTERVAL;
    }
  } else {
    footstepTimer = 0;
  }

  // flashlight battery
  if (flashlightOn && flashBattery > 0) {
    flashBattery = Math.max(0, flashBattery - FLASHLIGHT_DRAIN * delta);
    if (flashBattery <= 0) {
      flashlightOn = false;
      showMessage('Flashlight dead — find a battery');
    }
  } else if (!flashlightOn && flashBattery < 100) {
    flashBattery = Math.min(100, flashBattery + FLASHLIGHT_RECHARGE * delta);
  }

  flashlight.visible = flashlightOn;
  flashAmbient.visible = flashlightOn;

  if (flashlightOn) {
    const flicker = flashBattery < 20 ? 0.65 + Math.random() * 0.35 : 1;
    const sway = Math.sin(bobPhase * 0.5) * 0.02;
    flashlight.intensity = FLASH_INTENSITY * flicker;
    flashAmbient.intensity = FLASH_WIDE_INTENSITY * flicker;
    flashlight.target.position.x = sway;
    flashAmbient.target.position.x = sway;
  }

  // slow health regen when out of danger
  if (time - lastDamageTime > HEALTH_REGEN_DELAY && playerHealth > 0) {
    playerHealth = Math.min(100, playerHealth + HEALTH_REGEN_RATE * delta);
  }

  // collect souls
  for (const s of souls) {
    if (s.collected) continue;
    if (Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < 1.6) {
      s.collected = true;
      scene.remove(s.group);
      soulsCollected++;
      sfx.soulChime();
      if (soulsCollected >= SOUL_COUNT) {
        openGate();
      } else {
        showMessage(`Soul gathered  (${soulsCollected} / ${SOUL_COUNT})`, 2200);
        // the graveyard grows angrier
        while (ghosts.length < targetGhostCount()) {
          ghosts.push(new Ghost(scene, camera.position));
        }
      }
    }
  }

  // collect batteries
  for (const b of batteries) {
    if (b.collected) continue;
    if (Math.hypot(camera.position.x - b.x, camera.position.z - b.z) < 1.3) {
      b.collected = true;
      scene.remove(b.group);
      flashBattery = Math.min(100, flashBattery + BATTERY_REFILL);
      sfx.batteryClick();
      showMessage('Battery collected  (+50%)', 1800);
    }
  }

  // escape through gate
  if (gateOpen && camera.position.distanceTo(GATE_POS) < 3) {
    winHandler();
  }
}

function openGate() {
  gateOpen = true;
  gateBeacon.visible = true;
  sfx.gateOpen();
  showMessage('All souls gathered — the gate is open. RUN.', 4000);
  objectiveEl.textContent = 'Escape through the gate — follow the light';
}

function updateGate(delta) {
  if (!gateOpen || gateProgress >= 1) return;
  gateProgress = Math.min(1, gateProgress + delta / 2.5);
  const e = 1 - Math.pow(1 - gateProgress, 3); // ease-out
  for (const c of gateControllers) {
    c.obj.rotation.y = c.closedY + (c.openY - c.closedY) * e;
  }
}

// ===== UPDATES =====
function updateGhosts(delta, time) {
  const playerPos = camera.position;
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  const beamActive = flashlightOn && flashBattery > 0;

  let nearest = Infinity;
  for (const ghost of ghosts) {
    ghost.update(playerPos, camForward, beamActive, delta, time, soulsCollected, onBanish);
    if (ghost.banishT >= 0) continue;
    // horizontal distance — ghost.position.y is 0 while the camera sits at eye height
    const dist = Math.hypot(ghost.position.x - playerPos.x, ghost.position.z - playerPos.z);
    nearest = Math.min(nearest, dist);
    if (dist < GHOST_ATTACK_RANGE && ghost.canAttack()) {
      playerHealth = Math.max(0, playerHealth - GHOST_DAMAGE);
      lastDamageTime = time;
      damagePulse = 0.8;
      ghost.resetAttack();
      audio.play('scare');
      showMessage('The cold passes through you...', 1400);
    }
  }
  return nearest;
}

function updateLights(time) {
  for (const fl of flickerLights) {
    const flicker = Math.sin(time * 3 + fl.offset) * 0.3 + Math.sin(time * 7.3 + fl.offset * 2) * 0.15;
    fl.light.intensity = fl.baseIntensity * (0.6 + Math.abs(flicker) * 0.9);
    fl.sprite.material.opacity = 0.2 + Math.abs(flicker) * 0.3;
  }
}

function updateLightning(delta) {
  if (lightningPhase < 0) {
    lightningTimer -= delta;
    if (lightningTimer <= 0) {
      lightningPhase = 0;
      thunderQueued = true;
      lightningTimer = 18 + Math.random() * 26;
    }
    return;
  }
  lightningPhase += delta;
  const t = lightningPhase;
  // double-strike envelope
  const L = Math.max(
    Math.exp(-t * 18),
    0.55 * Math.exp(-Math.pow(t - 0.22, 2) * 300)
  ) * (t < 0.6 ? 1 : 0);
  lightningLight.intensity = L * 5;
  scene.background.setRGB(0.02 * L * 8, 0.025 * L * 8, 0.045 * L * 8);
  scene.fog.color.setRGB(
    0.008 + 0.1 * L, 0.012 + 0.12 * L, 0.04 + 0.2 * L
  );
  if (thunderQueued && t > 0.9 + Math.random() * 0.4) {
    thunderQueued = false;
    sfx.thunder();
  }
  if (t > 2.2) {
    lightningPhase = -1;
    lightningLight.intensity = 0;
    scene.background.setHex(0x000000);
    scene.fog.color.setHex(0x02030a);
  }
}

function updateFog(delta, time) {
  for (const f of fogSprites) {
    f.sprite.position.x = f.baseX + Math.sin(time * f.speed + f.offset) * 2.5;
    f.sprite.position.z = f.baseZ + Math.cos(time * f.speed * 0.7 + f.offset) * 2.5;
  }
  // fog thins slightly once the gate opens so the beacon reads
  const targetDensity = gateOpen ? 0.013 : 0.02;
  scene.fog.density += (targetDensity - scene.fog.density) * Math.min(1, delta);
}

function updateCollectibles(time) {
  for (const s of souls) {
    if (s.collected) continue;
    s.group.position.y = 1 + Math.sin(time * 1.8 + s.offset) * 0.18;
    s.halo.material.opacity = 0.6 + Math.sin(time * 3.1 + s.offset) * 0.25;
  }
  for (const b of batteries) {
    if (b.collected) continue;
    b.group.rotation.y = time * 1.2 + b.offset;
    b.halo.material.opacity = 0.3 + Math.sin(time * 2.4 + b.offset) * 0.12;
  }
}

function updateAudio(delta, nearestGhost) {
  if (nearestGhost < 9 || playerHealth < 35) {
    audio.startLoop('heartbeat');
  } else {
    audio.stopLoop('heartbeat');
  }

  whisperTimer -= delta;
  if (whisperTimer <= 0) {
    if (nearestGhost < 11) {
      audio.play('whisper', Math.min(0.5, Math.max(0.12, 1 - nearestGhost / 12)));
      whisperTimer = 4 + Math.random() * 6;
    } else if (Math.random() < 0.25) {
      audio.play('whisper', 0.15);
      whisperTimer = 10 + Math.random() * 12;
    } else {
      whisperTimer = 6 + Math.random() * 8;
    }
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

  staminaFill.style.width = `${stamina}%`;
  staminaFill.style.opacity = sprintLocked ? '0.4' : '1';

  flashFill.style.width = `${flashBattery}%`;
  flashFill.style.background = flashBattery < 20
    ? 'linear-gradient(90deg, #882200, #cc4400)'
    : 'linear-gradient(90deg, #664400, #cc8800)';

  timerEl.textContent = fmtTime(survivalTime);
  soulsText.textContent = `${soulsCollected} / ${SOUL_COUNT}`;
  crosshair.style.opacity = flashlightOn ? '1' : '0.2';
}

// ===== MAIN LOOP =====
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (gameState === 'playing') {
    survivalTime += delta;
    updatePlayer(delta, time);
    const nearestGhost = updateGhosts(delta, time);
    updateLights(time);
    updateLightning(delta);
    updateFog(delta, time);
    updateGate(delta);
    updateCollectibles(time);
    updateAudio(delta, nearestGhost);
    updateHUD();

    damagePulse = Math.max(0, damagePulse - delta * 1.1);
    const lowHealthPulse = playerHealth < 25
      ? (0.12 + Math.sin(time * 4) * 0.06) : 0;
    filmPass.uniforms.uDamage.value = Math.min(1, damagePulse + lowHealthPulse);

    if (playerHealth <= 0 && gameState === 'playing') {
      gameOverHandler();
    }
  } else if (gameState === 'menu' || gameState === 'loading') {
    // slow menu orbit
    const a = time * 0.06;
    camera.position.set(Math.sin(a) * 12, 3.4, Math.cos(a) * 12);
    camera.lookAt(0, 1.2, 0);
    updateLights(time);
    updateLightning(delta);
    updateFog(delta, time);
    updateCollectibles(time);
    for (const ghost of ghosts) {
      ghost.update(new THREE.Vector3(999, 0, 999), new THREE.Vector3(0, 0, 1), false, delta, time, 0, () => {});
    }
    filmPass.uniforms.uDamage.value = 0;
  }

  filmPass.uniforms.uTime.value = time;
  composer.render();
}

// ===== STATE TRANSITIONS =====
function gameOverHandler() {
  gameState = 'dead';
  audio.stopMusic();
  audio.stopLoop('heartbeat');
  controls.unlock();

  const messages = [
    'The darkness consumed you...',
    'You became one with the fog...',
    'The wraiths claimed another soul...',
    'Silence... at last...'
  ];
  deathMsg.textContent = messages[Math.floor(Math.random() * messages.length)];
  finalTime.textContent = fmtTime(survivalTime);
  finalSouls.textContent = `${soulsCollected} / ${SOUL_COUNT}`;

  gameOverEl.classList.remove('hidden');
  hud.classList.remove('visible');
}

function winHandler() {
  gameState = 'won';
  audio.stopMusic();
  audio.stopLoop('heartbeat');
  controls.unlock();
  sfx.soulChime();

  winTimeEl.textContent = fmtTime(survivalTime);
  winBanishedEl.textContent = banishedCount;

  const prev = localStorage.getItem('silentThrillBest');
  if (!prev || survivalTime < parseFloat(prev)) {
    localStorage.setItem('silentThrillBest', String(survivalTime));
    winBestEl.textContent = 'New best time!';
  } else {
    winBestEl.textContent = `Best: ${fmtTime(parseFloat(prev))}`;
  }

  winScreen.classList.remove('hidden');
  hud.classList.remove('visible');
}

function startGame() {
  gameState = 'playing';
  blocker.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hud.classList.add('visible');
  camera.position.set(0, PLAYER_HEIGHT, 0);
  camera.lookAt(0, PLAYER_HEIGHT, -10);
  controls.lock();
  sfx.ensure();
  audio.startMusic();
  whisperTimer = 5;
  showMessage(`Find the ${SOUL_COUNT} lost souls. Your light is your weapon.`, 4500);
}

function resetGame() {
  gameOverEl.classList.add('hidden');
  winScreen.classList.add('hidden');
  pauseEl.classList.add('hidden');
  blocker.classList.remove('hidden');
  hud.classList.remove('visible');

  playerHealth = 100;
  stamina = 100;
  survivalTime = 0;
  flashBattery = 100;
  flashlightOn = true;
  footstepTimer = 0;
  whisperTimer = 0;
  soulsCollected = 0;
  banishedCount = 0;
  gateOpen = false;
  damagePulse = 0;
  lastDamageTime = -100;
  gateBeacon.visible = false;
  gateProgress = 0;
  for (const c of gateControllers) c.obj.rotation.y = c.closedY;
  objectiveEl.textContent = 'Find the lost souls';
  camera.position.set(0, PLAYER_HEIGHT, 0);
  controls.unlock();

  spawnCollectibles();
  spawnGhosts();
  updateHUD();
  showBestTime();
  audio.stopMusic();
  audio.stopLoop('heartbeat');
  gameState = 'menu';
  startBtn.textContent = 'ENTER THE DARKNESS';
  startBtn.disabled = false;
}

// ===== EVENTS =====
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (k === 'f' && gameState === 'playing') {
    if (!flashlightOn && flashBattery <= 2) {
      showMessage('Battery is dead', 900);
    } else {
      flashlightOn = !flashlightOn;
    }
  }
  if (k === 'r' && (gameState === 'dead' || gameState === 'won')) resetGame();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && gameState === 'playing') {
    gameState = 'paused';
    pauseEl.classList.remove('hidden');
  }
});

pauseEl.addEventListener('click', () => {
  if (gameState === 'paused') {
    gameState = 'playing';
    pauseEl.classList.add('hidden');
    controls.lock();
  }
});

startBtn.addEventListener('click', () => {
  if (gameState === 'menu') startGame();
});
restartBtn.addEventListener('click', resetGame);
winRestartBtn.addEventListener('click', resetGame);

// debug/testing handle (harmless in production)
window.__st = {
  camera, controls, keys,
  get state() { return gameState; },
  set state(v) { gameState = v; },
  get souls() { return souls; },
  get ghosts() { return ghosts; },
  get health() { return playerHealth; },
  get battery() { return flashBattery; },
  get soulsCollected() { return soulsCollected; },
  get banished() { return banishedCount; },
  startGame, resetGame,
};

// ===== INIT =====
async function init() {
  loadingStatus.textContent = 'Building the graveyard...';
  buildWorld();
  buildGroundFog();

  loadingStatus.textContent = 'Scattering the lost souls...';
  spawnCollectibles();

  loadingStatus.textContent = 'Summoning the wraiths...';
  spawnGhosts();

  loadingStatus.textContent = 'Loading audio...';
  await audio.init();

  loadingStatus.textContent = '';
  startBtn.textContent = 'ENTER THE DARKNESS';
  startBtn.disabled = false;
  showBestTime();
  gameState = 'menu';

  gameLoop();
  updateHUD();
}

init();
