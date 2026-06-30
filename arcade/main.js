import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const games = [
  {
    name: 'CLUEDO', url: '../clue/index.html', color: '#c4a35a', neon: 0xc4a35a,
    img: '../clue/img/intro-mansion.png',
    genre: 'Mystery', controls: 'Click to move \u00b7 Make suggestions \u00b7 Accuse!'
  },
  {
    name: 'SUPER MARIO BROS', url: '../mariobros/index.html', color: '#e52521', neon: 0xe52521,
    img: '../mariobros/img/header-mario.png',
    genre: 'Platformer', controls: 'Arrow/WASD \u00b7 Space/Up to jump'
  },
  {
    name: 'TETRIS', url: '../tetris/index.html', color: '#00bcd4', neon: 0x00bcd4,
    img: '../tetris/img/header-tetris.png',
    genre: 'Puzzle', controls: 'Arrow keys \u00b7 Space hard drop \u00b7 P pause'
  },
  {
    name: 'SILENT THRILL', url: '../silenthrill/index.html', color: '#8bc34a', neon: 0x8bc34a,
    img: '../silenthrill/img/header-silent.png',
    genre: '3D Horror', controls: 'WASD \u00b7 Mouse look \u00b7 F flashlight'
  },
  {
    name: 'THEME PARK', url: '../themepark/index.html', color: '#ff9800', neon: 0xff9800,
    img: '../themepark/img/header-themepark.png',
    genre: 'Tycoon', controls: 'Click build \u00b7 Right-click remove \u00b7 Space pause'
  },
  {
    name: 'WHACK-A-MOLE', url: '../whackamole/index.html', color: '#e91e63', neon: 0xe91e63,
    img: '../whackamole/img/header-whack.png',
    genre: 'Arcade', controls: 'Click the moles!'
  },
  {
    name: 'ZORK', url: '../zork/index.html', color: '#4caf50', neon: 0x4caf50,
    img: '../zork/img/header-zork.png',
    genre: 'Interactive Fiction', controls: 'Type commands \u00b7 n/s/e/w/u/d'
  },
  {
    name: 'PIXEL FISHING', url: '../fishing/index.html', color: '#2E86AB', neon: 0x2e86ab,
    img: '../fishing/img/header-fishing.png',
    genre: 'Arcade / Fishing', controls: 'Tap to cast \u00b7 Buy lures \u00b7 Reel em in!'
  },
  {
    name: "KAREN'S COOKBOOK", url: '../karenscookbook/index.html', color: '#d97736', neon: 0xd97736,
    img: '../karenscookbook/img/header-karen.png',
    genre: 'Cooking', controls: 'Browse recipes \u00b7 Watch Karen videos'
  }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08081a);
scene.fog = new THREE.FogExp2(0x0a0a20, 0.016);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.7, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.15, 0.1
);
composer.addPass(bloom);

const controls = new PointerLockControls(camera, document.body);

function createCrtScreen(game) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, 512, 320);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve) => {
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const sr = Math.min(472 / iw, 280 / ih);
      const sw = iw * sr, sh = ih * sr;
      const sx = (512 - sw) / 2, sy = (320 - sh) / 2 + 10;

      ctx.drawImage(img, 0, 0, iw, ih, sx, sy, sw, sh);

      const imgData = ctx.getImageData(0, 0, 512, 320);
      const d = imgData.data;
      for (let y = 0; y < 320; y++) {
        for (let x = 0; x < 512; x++) {
          const i = (y * 512 + x) * 4;
          if (x < 20 || x >= 492 || y < 10 || y >= 310) continue;
          if (y % 4 === 0 || y % 4 === 1) {
            d[i] = d[i] * 0.6 | 0;
            d[i + 1] = d[i + 1] * 0.6 | 0;
            d[i + 2] = d[i + 2] * 0.6 | 0;
          }
          if (x % 2 === 0) {
            const t = d[i];
            d[i] = d[i + 1];
            d[i + 1] = t;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      for (let y = 10; y < 310; y += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(20, y, 472, 1);
      }

      for (let y = 10; y < 310; y += 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(20, y, 472, 1);
      }

      const vig = ctx.createRadialGradient(256, 165, 100, 256, 165, 320);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(0.5, 'rgba(0,0,0,0)');
      vig.addColorStop(0.85, 'rgba(0,0,0,0.2)');
      vig.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, 512, 320);

      const color = game.color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = color + '99';
      ctx.lineWidth = 3;
      ctx.strokeRect(11, 11, 490, 298);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.fillText(game.name, 256, 35);
      ctx.shadowBlur = 0;

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(`\u25b3 ${game.genre} \u25b3`, 256, 62);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#8899aa';
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(game.controls, 256, 299);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.globalAlpha = 0.85;
      ctx.fillText('\u25b8 CLICK TO PLAY \u25c2', 256, 277);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      resolve(canvas);
    };

    img.onerror = () => {
      resolve(createFallbackCanvas(game));
    };

    img.src = game.img;
  });
}

function createFallbackCanvas(game) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const ctx = c.getContext('2d');

  const grad = ctx.createRadialGradient(256, 160, 50, 256, 160, 300);
  grad.addColorStop(0, '#0d0d2a');
  grad.addColorStop(1, '#060612');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  for (let y = 0; y < 320; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y, 512, 1);
  }

  ctx.strokeStyle = game.color + '88';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 292);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = game.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px "Courier New", monospace';
  ctx.fillText(game.name, 256, 110);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#99aabb';
  ctx.font = '17px "Courier New", monospace';
  ctx.fillText(game.genre, 256, 170);

  return c;
}

const cabMeshes = [];

function buildScene() {
  function box(w, h, d, color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: 0.7, metalness: 0.1, ...opts
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function createFloorTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d');
    const ts = 64;
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const dark = (x + y) % 2 === 0;
        ctx.fillStyle = dark ? '#0d0d28' : '#181846';
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }
    return c;
  }

  const floorTex = new THREE.CanvasTexture(createFloorTex());
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2, 2);
  floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorGridMat = new THREE.MeshBasicMaterial({
    color: 0x8844ff, transparent: true, opacity: 0.06, wireframe: false
  });
  const floorGrid = new THREE.Mesh(new THREE.PlaneGeometry(29.5, 29.5, 30, 30), floorGridMat);
  floorGrid.rotation.x = -Math.PI / 2;
  floorGrid.position.y = 0.01;
  scene.add(floorGrid);

  function addGlowLine(x1, z1, x2, z2, color) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.03), mat);
    m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(dx, dz);
    scene.add(m);
  }

  addGlowLine(-14.5, -14.5, 14.5, -14.5, 0xff00ff);
  addGlowLine(-14.5, 14.5, 14.5, 14.5, 0x00ffff);
  addGlowLine(-14.5, -14.5, -14.5, 14.5, 0xff00ff);
  addGlowLine(14.5, -14.5, 14.5, 14.5, 0x00ffff);
  addGlowLine(-14.5, 0, 14.5, 0, 0x8855ff);
  addGlowLine(0, -14.5, 0, 14.5, 0x8855ff);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x08081a, roughness: 0.9, metalness: 0.0
  });

  function makeWall(w, h, x, y, z, ry) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), wallMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  makeWall(30, 7, 0, 3.5, -15, 0);
  makeWall(30, 7, 0, 3.5, 15, 0);
  makeWall(30, 7, -15, 3.5, 0, Math.PI / 2);
  makeWall(30, 7, 15, 3.5, 0, Math.PI / 2);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x050510, roughness: 0.9 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 7;
  scene.add(ceil);

  scene.add(new THREE.AmbientLight(0x444488, 0.6));

  const dl1 = new THREE.DirectionalLight(0x8866cc, 0.5);
  dl1.position.set(8, 12, 8);
  scene.add(dl1);

  const dl2 = new THREE.DirectionalLight(0x4488ff, 0.3);
  dl2.position.set(-8, 10, -8);
  scene.add(dl2);

  function addLight(x, y, z, color, intensity = 1.5, distance = 10) {
    const pl = new THREE.PointLight(color, intensity, distance);
    pl.position.set(x, y, z);
    scene.add(pl);
    const sg = new THREE.SphereGeometry(0.08, 8, 8);
    const sm = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 3
    });
    const sphere = new THREE.Mesh(sg, sm);
    sphere.position.set(x, y, z);
    scene.add(sphere);
  }

  function addSpot(x, y, z, tx, tz, color, intensity = 2) {
    const spot = new THREE.SpotLight(color, intensity, 18, Math.PI / 5, 0.4, 1);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, 0, tz);
    scene.add(spot);
    scene.add(spot.target);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 4 })
    );
    bulb.position.set(x, y, z);
    scene.add(bulb);
  }

  addLight(0, 6.5, 0, 0x8844ff, 1.5, 14);
  addLight(-7, 6.5, -6, 0xff44aa, 2, 12);
  addLight(7, 6.5, -6, 0x44ffcc, 2, 12);
  addLight(-7, 6.5, 6, 0xffaa44, 2, 12);
  addLight(7, 6.5, 6, 0x4488ff, 2, 12);

  addSpot(-5.5, 6, -8, -3.8, -12.5, 0xff66ff, 3);
  addSpot(0, 6, -8, 0, -12.5, 0xff88ff, 3);
  addSpot(5.5, 6, -8, 3.8, -12.5, 0xff66ff, 3);
  addSpot(8, 6, -3, 12.5, -3.3, 0x88ffff, 3);
  addSpot(8, 6, 3, 12.5, 3.3, 0x88ffff, 3);
  addSpot(-5.5, 6, 8, -3.8, 12.5, 0xff8844, 3);
  addSpot(0, 6, 8, 0, 12.5, 0xffaa44, 3);
  addSpot(5.5, 6, 8, 3.8, 12.5, 0xff8844, 3);
  addSpot(-8, 6, 0, -12.5, 0, 0x44ff88, 3);

  function addNeonStrip(x, y, z, rx, ry, rz, len, color, intensity = 5) {
    const g = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity
    }));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    scene.add(mesh);

    const pl = new THREE.PointLight(color, 0.4, 8);
    pl.position.copy(mesh.position);
    scene.add(pl);
  }

  addNeonStrip(0, 6.95, -14.9, 0, 0, 0, 28, 0xff00ff, 6);
  addNeonStrip(0, 6.95, 14.9, 0, 0, 0, 28, 0x00ffff, 6);
  addNeonStrip(-14.9, 6.95, 0, 0, 0, Math.PI / 2, 28, 0xff00ff, 6);
  addNeonStrip(14.9, 6.95, 0, 0, 0, Math.PI / 2, 28, 0x00ffff, 6);

  addNeonStrip(0, 0.05, -14.7, 0, 0, 0, 28, 0xff00ff, 3);
  addNeonStrip(0, 0.05, 14.7, 0, 0, 0, 28, 0x00ffff, 3);
  addNeonStrip(-14.7, 0.05, 0, 0, 0, Math.PI / 2, 28, 0xff00ff, 3);
  addNeonStrip(14.7, 0.05, 0, 0, 0, Math.PI / 2, 28, 0x00ffff, 3);

  function createCabinet(game, screenTexture) {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d25, roughness: 0.6, metalness: 0.1
    });

    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.75), bodyMat);
    mainBody.position.y = 0.95;
    g.add(mainBody);

    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 0.8), bodyMat);
    upperBody.position.set(0, 2.2, 0);
    g.add(upperBody);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x181840, roughness: 0.4, metalness: 0.4
    });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.0, 0.04), bezelMat);
    bezel.position.set(0, 2.1, 0.41);
    g.add(bezel);

    const tex = new THREE.CanvasTexture(screenTexture);
    tex.minFilter = THREE.LinearFilter;

    const screenMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(game.color),
      emissiveIntensity: 0.2,
      emissiveMap: tex,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.9), screenMat);
    screen.position.set(0, 2.1, 0.43);
    screen.userData.isCabinet = true;
    screen.userData.url = game.url;
    g.add(screen);

    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x080818, roughness: 0.8
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.45), deckMat);
    deck.position.set(0, 1.15, 0.3);
    g.add(deck);

    const cpMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a1e, roughness: 0.7
    });
    const cpFront = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.08), cpMat);
    cpFront.position.set(0, 1.0, 0.52);
    cpFront.rotation.x = -0.3;
    g.add(cpFront);

    const marqueeMat = new THREE.MeshStandardMaterial({
      color: game.neon,
      emissive: game.neon,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.3,
    });
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 0.14), marqueeMat);
    marquee.position.set(0, 2.73, 0);
    g.add(marquee);

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x060612, roughness: 0.9
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.8), baseMat);
    base.position.y = 0.04;
    g.add(base);

    const sideCanvas = document.createElement('canvas');
    sideCanvas.width = 256; sideCanvas.height = 512;
    const sctx = sideCanvas.getContext('2d');
    sctx.fillStyle = '#080820';
    sctx.fillRect(0, 0, 256, 512);

    const stripeColors = ['#ff00ff', '#00ffff', '#ff8800', '#00ff88', '#ff4488', '#44ffcc'];
    for (let i = 0; i < 12; i++) {
      const y = i * 42 + 10;
      sctx.fillStyle = stripeColors[i % stripeColors.length];
      sctx.globalAlpha = 0.12;
      sctx.fillRect(30, y, 196, 3);
      sctx.globalAlpha = 0.06;
      sctx.fillRect(30, y + 4, 196, 1);
    }
    sctx.globalAlpha = 1;

    sctx.fillStyle = game.color + '44';
    sctx.font = 'bold 16px "Courier New", monospace';
    sctx.textAlign = 'center';
    const shortName = game.name.length > 12 ? game.name.substring(0, 12) : game.name;
    sctx.fillText(shortName, 128, 60);
    sctx.fillText(shortName, 128, 460);

    const sideTex = new THREE.CanvasTexture(sideCanvas);
    const sideMat = new THREE.MeshStandardMaterial({
      map: sideTex, roughness: 0.7, metalness: 0.1
    });

    for (let side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.55), sideMat);
      panel.position.set(side * 0.86, 1.3, 0);
      panel.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(panel);
    }

    const btnMat = new THREE.MeshStandardMaterial({
      color: game.neon, emissive: game.neon, emissiveIntensity: 0.6,
      roughness: 0.3, metalness: 0.3,
    });
    for (let i = -1; i <= 1; i += 2) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 10), btnMat);
      btn.position.set(i * 0.2, 1.21, 0.46);
      btn.rotation.x = Math.PI / 2;
      g.add(btn);
    }

    const stickMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 6), stickMat);
    stick.position.set(0, 1.21, 0.28);
    stick.rotation.x = Math.PI / 2;
    g.add(stick);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.4, metalness: 0.2 })
    );
    ball.position.set(0, 1.25, 0.34);
    g.add(ball);

    const tEdge = new THREE.MeshStandardMaterial({
      color: game.neon, emissive: game.neon, emissiveIntensity: 0.3
    });
    for (let side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 2.55, 0.01), tEdge);
      edge.position.set(side * 0.86, 1.3, 0.38);
      g.add(edge);
    }

    const cabLight = new THREE.PointLight(game.neon, 0.6, 3);
    cabLight.position.set(0, 2.8, 0);
    g.add(cabLight);

    return g;
  }

  function createBigSign() {
    const group = new THREE.Group();

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x111133, metalness: 0.5, roughness: 0.3,
        transparent: true, opacity: 0.6
      })
    );
    group.add(bg);

    const c = document.createElement('canvas');
    c.width = 1024; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 1024, 160);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 50;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 90px "Courier New", monospace';
    ctx.fillText('\u2605 ARCADE \u2605', 512, 80);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('-- PLAY THE COLLECTION --', 512, 138);

    const tex = new THREE.CanvasTexture(c);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xff00ff),
      emissiveIntensity: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), signMat);
    group.add(sign);

    const glow = new THREE.PointLight(0xff00ff, 0.8, 10);
    glow.position.set(0, 0.3, 0.5);
    group.add(glow);

    group.position.set(0, 6.0, -13.5);
    return group;
  }

  scene.add(createBigSign());

  const cabPositions = [
    { x: -3.8, z: -12.5, rot: 0 },
    { x: 0, z: -12.5, rot: 0 },
    { x: 3.8, z: -12.5, rot: 0 },
    { x: 12.5, z: -3.3, rot: -Math.PI / 2 },
    { x: 12.5, z: 3.3, rot: -Math.PI / 2 },
    { x: -3.8, z: 12.5, rot: Math.PI },
    { x: 0, z: 12.5, rot: Math.PI },
    { x: 3.8, z: 12.5, rot: Math.PI },
    { x: -12.5, z: 0, rot: Math.PI / 2 },
  ];

  games.forEach((game, i) => {
    const cab = createCabinet(game, game._screenCanvas);
    const p = cabPositions[i];
    cab.position.set(p.x, 0, p.z);
    cab.rotation.y = p.rot;
    scene.add(cab);
  });

  function createSmoke() {
    const count = 400;
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const driftAngles = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 14;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = Math.random() * 0.25 + 0.08;
      driftAngles[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const texC = document.createElement('canvas');
    texC.width = texC.height = 64;
    const tctx = texC.getContext('2d');
    const grad = tctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(200, 180, 255, 0.12)');
    grad.addColorStop(0.4, 'rgba(160, 140, 255, 0.06)');
    grad.addColorStop(1, 'rgba(100, 80, 255, 0)');
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, 64, 64);

    const mat = new THREE.PointsMaterial({
      size: 0.9,
      map: new THREE.CanvasTexture(texC),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.5,
    });

    const points = new THREE.Points(geo, mat);
    points.userData = { speeds, driftAngles, basePos: pos.slice(), time: 0 };
    return points;
  }

  scene.add(createSmoke());

  const raycaster = new THREE.Raycaster();
  const pointerVec = new THREE.Vector2(0, 0);

  function onClick(e) {
    if (controls.isLocked) {
      pointerVec.set(0, 0);
      raycaster.setFromCamera(pointerVec, camera);

      const hits = [];
      scene.traverse((child) => {
        if (child.isMesh && child.userData.isCabinet) hits.push(child);
      });

      const result = raycaster.intersectObjects(hits);
      if (result.length > 0 && result[0].object.userData.url) {
        window.open(result[0].object.userData.url, '_blank');
      }
    }
  }

  document.addEventListener('click', onClick);

  const blocker = document.getElementById('blocker');
  blocker.addEventListener('click', () => {
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    blocker.classList.add('hidden');
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('prompt').style.display = 'block';
  });

  controls.addEventListener('unlock', () => {
    blocker.classList.remove('hidden');
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('prompt').style.display = 'none';
  });

  document.getElementById('crosshair').style.display = 'none';
  document.getElementById('prompt').style.display = 'none';

  const keys = {};
  document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  const clock = new THREE.Clock();
  const signGroup = scene.children.find(c => c.type === 'Group' && c.children.length > 1 && c.children[0].material?.opacity === 0.6);

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    if (controls.isLocked) {
      const speed = 5;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const dir = new THREE.Vector3();
      dir.addScaledVector(fwd, (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0));
      dir.addScaledVector(right, (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0));
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(speed * delta);
        camera.position.add(dir);
      }
      camera.position.x = Math.max(-13, Math.min(13, camera.position.x));
      camera.position.z = Math.max(-13, Math.min(13, camera.position.z));
      camera.position.y = 1.7;
    }

    const smokeObj = scene.children.find(c => c.isPoints);
    if (smokeObj) {
      const pArr = smokeObj.geometry.attributes.position.array;
      const speeds = smokeObj.userData.speeds;
      for (let i = 0; i < pArr.length / 3; i++) {
        const da = smokeObj.userData.driftAngles[i];
        pArr[i * 3 + 1] += speeds[i] * delta;
        pArr[i * 3] += Math.sin(time * 0.15 + da) * delta * 0.06;
        pArr[i * 3 + 2] += Math.cos(time * 0.15 + da) * delta * 0.06;
        if (pArr[i * 3 + 1] > 6.8) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 14;
          pArr[i * 3] = Math.cos(angle) * radius;
          pArr[i * 3 + 1] = 0.1;
          pArr[i * 3 + 2] = Math.sin(angle) * radius;
        }
      }
      smokeObj.geometry.attributes.position.needsUpdate = true;
    }

    if (signGroup) {
      const blink = Math.sin(time * 1.8) * 0.5 + 0.5;
      const signMat = signGroup.children[1].material;
      signMat.emissiveIntensity = 0.3 + blink * 0.5;
    }

    composer.render();
    requestAnimationFrame(animate);
  }

  animate();
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

Promise.all(games.map(game => createCrtScreen(game)))
  .then(canvases => {
    games.forEach((game, i) => {
      game._screenCanvas = canvases[i];
    });
    buildScene();
  });
