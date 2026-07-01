const CivMap = {
  canvas: null,
  ctx: null,
  hexCorners: {},

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    const w = this.mapWidth();
    const h = this.mapHeight();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
  },

  mapWidth() {
    return HEX_SIZE * Math.sqrt(3) * (MAP_W + 0.5) + HEX_SIZE;
  },

  mapHeight() {
    return HEX_SIZE * 1.5 * MAP_H + HEX_SIZE / 2;
  },

  hexToPixel(q, r) {
    const x = HEX_SIZE * Math.sqrt(3) * (q + 0.5 * (r % 2));
    const y = HEX_SIZE * 1.5 * r;
    return { x: x + HEX_SIZE, y: y + HEX_SIZE * 0.75 };
  },

  pixelToHex(px, py) {
    let best = { q: 0, r: 0 };
    let bestDist = Infinity;
    for (let q = 0; q < MAP_W; q++) {
      for (let r = 0; r < MAP_H; r++) {
        const p = this.hexToPixel(q, r);
        const d = (p.x - px) ** 2 + (p.y - py) ** 2;
        if (d < bestDist) { bestDist = d; best = { q, r }; }
      }
    }
    return best;
  },

  getNeighbors(q, r) {
    const dirs = r % 2 === 0
      ? [[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]]
      : [[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]];
    const out = [];
    for (const [dq, dr] of dirs) {
      const nq = q + dq, nr = r + dr;
      if (nq >= 0 && nq < MAP_W && nr >= 0 && nr < MAP_H) out.push({ q: nq, r: nr });
    }
    return out;
  },

  hexDistance(q1, r1, q2, r2) {
    const dq = q2 - q1;
    const dr = r2 - r1;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq - dr)) / 2;
  },

  hexCornersArray(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.hexCorners[key]) return this.hexCorners[key];
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 90);
      corners.push({
        x: cx + HEX_SIZE * Math.cos(angle),
        y: cy + HEX_SIZE * Math.sin(angle)
      });
    }
    this.hexCorners[key] = corners;
    return corners;
  },

  hash(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) / 2147483647;
  },

  smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = this.hash(ix, iy);
    const n10 = this.hash(ix + 1, iy);
    const n01 = this.hash(ix, iy + 1);
    const n11 = this.hash(ix + 1, iy + 1);
    return n00 + (n10 - n00) * sx + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
  },

  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let value = 0, amp = 1, freq = 1, maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      value += amp * this.smoothNoise(x * freq, y * freq);
      maxVal += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return value / maxVal;
  },

  generate() {
    G.map = [];
    const seed = Math.random() * 1000;
    const height = [];

    for (let q = 0; q < MAP_W; q++) {
      height[q] = [];
      for (let r = 0; r < MAP_H; r++) {
        const continent = this.fbm(
          q / MAP_W * 1.1 + seed, r / MAP_H * 1.1 + seed,
          3, 2.0, 0.65
        );
        const detail = this.fbm(
          q / MAP_W * 2.5 + seed + 4.7, r / MAP_H * 2.5 + seed + 4.7,
          2, 2.0, 0.5
        );
        height[q][r] = continent * 0.75 + detail * 0.25;
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      const copy = height.map(row => [...row]);
      for (let q = 0; q < MAP_W; q++) {
        for (let r = 0; r < MAP_H; r++) {
          let sum = copy[q][r], count = 1;
          for (const n of this.getNeighbors(q, r)) {
            sum += copy[n.q][n.r];
            count++;
          }
          height[q][r] = sum / count;
        }
      }
    }

    let hMin = Infinity, hMax = -Infinity;
    for (let q = 0; q < MAP_W; q++)
      for (let r = 0; r < MAP_H; r++) {
        if (height[q][r] < hMin) hMin = height[q][r];
        if (height[q][r] > hMax) hMax = height[q][r];
      }
    const hRange = hMax - hMin;
    if (hRange > 0) {
      for (let q = 0; q < MAP_W; q++)
        for (let r = 0; r < MAP_H; r++)
          height[q][r] = (height[q][r] - hMin) / hRange;
    }

    for (let q = 0; q < MAP_W; q++) {
      G.map[q] = [];
      for (let r = 0; r < MAP_H; r++) {
        const h = height[q][r];
        let terrain;
        if (h < 0.27) terrain = 'water';
        else if (h < 0.38) terrain = 'grassland';
        else if (h < 0.55) terrain = 'forest';
        else if (h < 0.70) terrain = 'hills';
        else if (h < 0.85) terrain = 'desert';
        else terrain = 'mountain';

        G.map[q][r] = {
          q, r, terrain,
          explored: [false, false],
          visible: [false, false],
          improvement: null,
        };
      }
    }

    this.removeSmallFeatures();
    this.removeSingletons();
  },

  removeSmallFeatures() {
    const w = MAP_W, h = MAP_H;
    const visited = Array.from({length: w}, () => Array(h).fill(0));
    for (let q = 0; q < w; q++) {
      for (let r = 0; r < h; r++) {
        if (visited[q][r]) continue;
        if (G.map[q][r].terrain !== 'water') continue;
        const tiles = [];
        const stack = [[q, r]];
        visited[q][r] = 1;
        while (stack.length) {
          const [cq, cr] = stack.pop();
          tiles.push([cq, cr]);
          for (const n of this.getNeighbors(cq, cr)) {
            if (!visited[n.q][n.r] && G.map[n.q][n.r].terrain === 'water') {
              visited[n.q][n.r] = 1;
              stack.push([n.q, n.r]);
            }
          }
        }
        if (tiles.length < 5) {
          for (const [wq, wr] of tiles) G.map[wq][wr].terrain = 'grassland';
        }
      }
    }
    const visited2 = Array.from({length: w}, () => Array(h).fill(0));
    for (let q = 0; q < w; q++) {
      for (let r = 0; r < h; r++) {
        if (visited2[q][r]) continue;
        if (G.map[q][r].terrain === 'water') continue;
        const tiles = [];
        const stack = [[q, r]];
        visited2[q][r] = 1;
        while (stack.length) {
          const [cq, cr] = stack.pop();
          tiles.push([cq, cr]);
          for (const n of this.getNeighbors(cq, cr)) {
            if (!visited2[n.q][n.r] && G.map[n.q][n.r].terrain !== 'water') {
              visited2[n.q][n.r] = 1;
              stack.push([n.q, n.r]);
            }
          }
        }
        if (tiles.length < 4) {
          for (const [wq, wr] of tiles) G.map[wq][wr].terrain = 'water';
        }
      }
    }
  },

  removeSingletons() {
    for (let q = 0; q < MAP_W; q++) {
      for (let r = 0; r < MAP_H; r++) {
        const t = G.map[q][r];
        if (t.terrain === 'mountain') {
          let count = 0;
          for (const n of this.getNeighbors(q, r)) {
            if (G.map[n.q][n.r].terrain === 'mountain') count++;
          }
          if (count === 0) t.terrain = 'hills';
        }
        if (t.terrain === 'water') {
          let count = 0;
          for (const n of this.getNeighbors(q, r)) {
            if (G.map[n.q][n.r].terrain === 'water') count++;
          }
          if (count === 0) t.terrain = 'grassland';
        }
      }
    }
  },

  findLandTileNear(centerQ, centerR, avoidQ = null, avoidR = null) {
    const queue = [{ q: centerQ, r: centerR }];
    const visited = new Set();
    while (queue.length > 0) {
      const { q, r } = queue.shift();
      const key = `${q},${r}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const tile = G.getTile(q, r);
      if (!tile) continue;
      if (tile.terrain !== 'water' && tile.terrain !== 'mountain' && !(q === avoidQ && r === avoidR)) return { q, r };
      if (queue.length > 200) break;
      for (const n of this.getNeighbors(q, r)) {
        if (!visited.has(`${n.q},${n.r}`)) queue.push(n);
      }
    }
    return { q: centerQ, r: centerR };
  },

  placePlayers() {
    const p1pos = this.findLandTileNear(2, Math.floor(MAP_H / 2));
    const warriorPos = this.findLandTileNear(p1pos.q + 1, p1pos.r, p1pos.q, p1pos.r);
    const p2pos = this.findLandTileNear(MAP_W - 3, Math.floor(MAP_H / 2));

    const p1 = G.players[0];
    const p2 = G.players[1];

    p1.units.push({
      id: G.nextUnitId(), type: 'settler', owner: 0,
      q: p1pos.q, r: p1pos.r, moves: 2, maxMoves: 2,
      hp: 100, maxHp: 100, fortified: false,
    });
    p1.units.push({
      id: G.nextUnitId(), type: 'warrior', owner: 0,
      q: warriorPos.q, r: warriorPos.r, moves: 2, maxMoves: 2,
      hp: 100, maxHp: 100, fortified: false,
    });

    const aiWarriorPos = this.findLandTileNear(p2pos.q - 1, p2pos.r, p2pos.q, p2pos.r);
    p2.units.push({
      id: G.nextUnitId(), type: 'settler', owner: 1,
      q: p2pos.q, r: p2pos.r, moves: 2, maxMoves: 2,
      hp: 100, maxHp: 100, fortified: false,
    });
    p2.units.push({
      id: G.nextUnitId(), type: 'warrior', owner: 1,
      q: aiWarriorPos.q, r: aiWarriorPos.r, moves: 2, maxMoves: 2,
      hp: 100, maxHp: 100, fortified: false,
    });
  },

  updateVisibility(q, r, playerId, range) {
    const visited = new Set();
    const queue = [{ q, r, dist: 0 }];
    while (queue.length > 0) {
      const { q: cq, r: cr, dist } = queue.shift();
      const key = `${cq},${cr}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const tile = G.getTile(cq, cr);
      if (!tile) continue;
      tile.explored[playerId] = true;
      if (dist <= range) {
        tile.visible[playerId] = true;
        if (dist < range) {
          for (const n of this.getNeighbors(cq, cr)) {
            const nt = G.getTile(n.q, n.r);
            if (nt && nt.terrain !== 'mountain') {
              if (!visited.has(`${n.q},${n.r}`)) queue.push({ q: n.q, r: n.r, dist: dist + 1 });
            } else if (nt) {
              if (!visited.has(`${n.q},${n.r}`)) queue.push({ q: n.q, r: n.r, dist: dist + 2 });
            }
          }
        }
      }
    }
  },

  refreshVisibility() {
    for (const tile of G.map.flat()) {
      tile.visible = [false, false];
    }
    for (const p of G.players) {
      for (const u of p.units) {
        this.updateVisibility(u.q, u.r, p.id, 2);
      }
      for (const c of p.cities) {
        this.updateVisibility(c.q, c.r, p.id, 2);
      }
    }
  },

  render() {
    const ctx = this.ctx;
    const w = this.mapWidth();
    const h = this.mapHeight();
    ctx.clearRect(0, 0, w, h);

    const terrainColors = {
      grassland: '#5a9e3e',
      forest: '#2d6e1e',
      hills: '#8a7a4a',
      mountain: '#7a7a8a',
      water: '#2a6a9e',
      desert: '#c8b060',
    };

    const terrainLight = {
      grassland: '#7cc860',
      forest: '#4a9e32',
      hills: '#a8945c',
      mountain: '#9696a8',
      water: '#4a8ec0',
      desert: '#dcc878',
    };

    for (let q = 0; q < MAP_W; q++) {
      for (let r = 0; r < MAP_H; r++) {
        const tile = G.getTile(q, r);
        if (!tile) continue;
        const p = this.hexToPixel(q, r);
        const corners = this.hexCornersArray(p.x, p.y);

        const isExplored = tile.explored[0];
        const isVisible = tile.visible[0];

        if (!isExplored) {
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
          ctx.closePath();
          ctx.fillStyle = '#0a0a1a';
          ctx.fill();
          ctx.strokeStyle = '#1a1a2a';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          continue;
        }

        const baseColor = terrainColors[tile.terrain] || '#5a9e3e';
        const lightColor = terrainLight[tile.terrain] || '#7cc860';

        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();

        const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, HEX_SIZE);
        grad.addColorStop(0, lightColor);
        grad.addColorStop(1, baseColor);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        this.drawTerrainDetail(ctx, tile, p.x, p.y);

        if (!isVisible) {
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fill();
        }
      }
    }

    this.renderCities(ctx);
    this.renderUnits(ctx);
    this.renderSelection(ctx);
    this.renderMovementRange(ctx);
  },

  drawTerrainDetail(ctx, tile, cx, cy) {
    const s = HEX_SIZE;
    switch (tile.terrain) {
      case 'forest':
        for (let i = 0; i < 3; i++) {
          const tx = cx + (i - 1) * s * 0.3;
          const ty = cy + (i % 2 === 0 ? -2 : 4);
          ctx.beginPath();
          ctx.moveTo(tx, ty - 8);
          ctx.lineTo(tx - 5, ty + 2);
          ctx.lineTo(tx + 5, ty + 2);
          ctx.closePath();
          ctx.fillStyle = '#1a6a1a';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        break;

      case 'hills':
        ctx.beginPath();
        ctx.arc(cx - 5, cy + 3, 6, 0, Math.PI, false);
        ctx.strokeStyle = '#6a5a3a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 1, 5, 0, Math.PI, false);
        ctx.stroke();
        break;

      case 'mountain': {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx - 8, cy + 6);
        ctx.lineTo(cx + 8, cy + 6);
        ctx.closePath();
        ctx.fillStyle = '#5a5a6a';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 10);
        ctx.lineTo(cx - 5, cy - 3);
        ctx.lineTo(cx + 1, cy - 3);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        break;
      }

      case 'water':
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(cx - 6 + i * 12, cy - 3 + i * 6, 5, 0.2, Math.PI - 0.2);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        break;

      case 'desert':
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = 'rgba(180,150,80,0.3)';
          ctx.beginPath();
          ctx.arc(cx - 6 + (i % 3) * 6, cy - 4 + Math.floor(i / 3) * 8, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }
  },

  renderUnits(ctx) {
    for (const p of G.players) {
      for (const u of p.units) {
        const tile = G.getTile(u.q, u.r);
        if (!tile || !tile.visible[0]) continue;

        const pos = this.hexToPixel(u.q, u.r);
        const isSelected = G.selectedUnit && G.selectedUnit.id === u.id;
        const isEnemy = u.owner !== 0;

        const colors = {
          settler: { fill: '#8B4513', stroke: '#5a2d0a', icon: '#DEB887' },
          scout: { fill: '#2E7D32', stroke: '#1a4d1a', icon: '#81C784' },
          warrior: { fill: '#C62828', stroke: '#8a1a1a', icon: '#EF9A9A' },
          archer: { fill: '#6A1B9A', stroke: '#3a0a5a', icon: '#CE93D8' },
        };

        if (isEnemy) {
          const c = colors[u.type];
          c.fill = '#4a3a3a';
          c.stroke = '#2a1a1a';
          c.icon = '#8a6a6a';
        }

        const c = colors[u.type];
        const s = HEX_SIZE * 0.65;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, s + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, s, 0, Math.PI * 2);
        ctx.fillStyle = c.fill;
        ctx.fill();
        ctx.strokeStyle = c.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `${s}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const icons = { settler: '🏠', scout: '🔍', warrior: '⚔', archer: '🏹' };
        ctx.font = `${s * 1.2}px serif`;
        ctx.fillText(icons[u.type] || '?', pos.x, pos.y);

        if (u.hp < u.maxHp) {
          ctx.fillStyle = '#f44336';
          ctx.font = '8px sans-serif';
          ctx.fillText(`${Math.ceil(u.hp)}`, pos.x + s * 0.5, pos.y - s * 0.5);
        }

        if (u.fortified) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = '8px sans-serif';
          ctx.fillText('⛌', pos.x, pos.y - s - 4);
        }
      }
    }
  },

  renderCities(ctx) {
    for (const p of G.players) {
      for (const c of p.cities) {
        const tile = G.getTile(c.q, c.r);
        if (!tile || !tile.visible[0]) continue;

        const pos = this.hexToPixel(c.q, c.r);
        const isSelected = G.selectedCity && G.selectedCity.id === c.id;
        const isEnemy = c.owner !== 0;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, HEX_SIZE * 0.7 + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const fillColor = isEnemy ? '#5a3030' : '#305a8a';

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1.5;

        const bx = pos.x - 10, by = pos.y - 10;
        ctx.fillRect(bx, by + 4, 8, 12);
        ctx.fillRect(bx + 6, by - 2, 8, 18);
        ctx.fillRect(bx + 12, by + 4, 8, 12);
        ctx.strokeRect(bx, by + 4, 8, 12);
        ctx.strokeRect(bx + 6, by - 2, 8, 18);
        ctx.strokeRect(bx + 12, by + 4, 8, 12);

        ctx.fillStyle = '#ffd700';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(c.population, pos.x, pos.y - 13);

        ctx.fillStyle = '#fff';
        ctx.font = '7px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(c.name.substring(0, 6), pos.x, pos.y + 12);
      }
    }
  },

  renderSelection(ctx) {
    if (!G.selectedTile) return;
    const { q, r } = G.selectedTile;
    const pos = this.hexToPixel(q, r);
    const corners = this.hexCornersArray(pos.x, pos.y);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  renderMovementRange(ctx) {
    if (!G.movementRange || G.movementRange.length === 0) return;
    for (const { q, r, cost } of G.movementRange) {
      if (G.getUnitAt(q, r) && !(G.selectedUnit && G.selectedUnit.q === q && G.selectedUnit.r === r)) continue;
      const pos = this.hexToPixel(q, r);
      const alpha = 0.4 - cost * 0.1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, HEX_SIZE * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 200, 100, ${Math.max(0.1, alpha)})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 200, 100, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },

  recomputeHexCache() {
    this.hexCorners = {};
  },

  centerOnStart() {
    G.selectedUnit = G.players[0].units[0];
  }
};
