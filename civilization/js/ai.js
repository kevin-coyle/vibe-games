const CivAI = {
  takeTurn() {
    const player = G.players[1];
    if (player.cities.length === 0 && player.units.length === 0) return;

    G.addLog('--- Rome\'s Turn ---', 'log-info');
    G.selectedUnit = null;
    G.selectedCity = null;

    CivUnits.resetMoves(player);
    this.combatMoves(player);
    this.processCities(player);
    CivTech.processResearch(player);
    if (!player.researching) this.decideResearch(player);
    this.moveUnits(player);

    CivUnits.healUnits(player);
    CivMap.refreshVisibility();
  },

  processCities(player) {
    CivCities.processAllCities(player);
    for (const city of [...player.cities]) {
      this.decideProduction(city, player);
    }
  },

  decideProduction(city, player) {
    if (city.productionTarget) return;

    const options = CivCities.getProductionOptions(city);

    if (options.length === 0) return;

    const hasSettler = player.units.some(u => u.type === 'settler');
    const cityCount = player.cities.length;

    if (cityCount < 3 && !hasSettler && city.population >= 2) {
      const settlerOpt = options.find(o => o.id === 'settler' && o.type === 'unit');
      if (settlerOpt) { CivCities.setProduction(city, 'unit', 'settler'); return; }
    }

    if (player.units.filter(u => u.type === 'warrior' || u.type === 'archer').length < cityCount * 2) {
      const bestUnit = options.find(o => o.type === 'unit' && o.id !== 'settler');
      if (bestUnit) { CivCities.setProduction(city, 'unit', bestUnit.id); return; }
    }

    if (player.units.filter(u => u.type === 'scout').length < cityCount) {
      const scoutOpt = options.find(o => o.id === 'scout' && o.type === 'unit');
      if (scoutOpt) { CivCities.setProduction(city, 'unit', 'scout'); return; }
    }

    const buildingOpt = options.find(o => o.type === 'building');
    if (buildingOpt) { CivCities.setProduction(city, 'building', buildingOpt.id); return; }

    const unitOpt = options.find(o => o.type === 'unit' && o.id === 'warrior');
    if (unitOpt) { CivCities.setProduction(city, 'unit', 'warrior'); return; }
  },

  decideResearch(player) {
    if (player.researching) return;
    const available = CivTech.getAvailableTechs(player);
    if (available.length === 0) return;

    const priority = { agriculture: 1, mining: 2, writing: 3, archery: 4, engineering: 5 };
    available.sort((a, b) => (priority[a.id] || 99) - (priority[b.id] || 99));
    CivTech.startResearch(player, available[0].id);
  },

  moveUnits(player) {
    for (const unit of [...player.units]) {
      if (unit.moves <= 0) continue;
      if (unit.type === 'settler') {
        this.moveSettler(unit, player);
      } else if (unit.type === 'scout') {
        this.moveScout(unit, player);
      } else {
        this.moveMilitary(unit, player);
      }
    }
  },

  moveSettler(unit, player) {
    const canFound = CivCities.canFound(unit);
    if (canFound) {
      CivCities.foundCity(unit);
      return;
    }

    const bestSpot = this.findBestCityLocation(unit, player);
    if (bestSpot) {
      this.moveToward(unit, bestSpot.q, bestSpot.r);
    }
  },

  findBestCityLocation(unit, player) {
    let best = null;
    let bestScore = -Infinity;
    for (let q = 0; q < MAP_W; q++) {
      for (let r = 0; r < MAP_H; r++) {
        const tile = G.getTile(q, r);
        if (!tile || tile.terrain === 'water' || tile.terrain === 'mountain') continue;
        if (G.getCityAt(q, r)) continue;

        let score = 0;
        for (const n of CivMap.getNeighbors(q, r)) {
          const nt = G.getTile(n.q, n.r);
          if (nt) {
            const t = TERRAINS[nt.terrain];
            score += (t.food * 2 + t.prod * 1.5 + t.gold);
          }
        }

        const dist = CivMap.hexDistance(unit.q, unit.r, q, r);
        if (dist < 5) score += (5 - dist) * 3;

        if (score > bestScore) {
          bestScore = score;
          best = { q, r };
        }
      }
    }
    return best;
  },

  moveScout(unit, player) {
    const unexplored = this.findUnexploredTiles(unit, player);
    if (unexplored.length > 0) {
      const target = unexplored[Math.floor(Math.random() * Math.min(3, unexplored.length))];
      this.moveToward(unit, target.q, target.r);
    } else {
      this.moveToward(unit, Math.floor(MAP_W / 2), Math.floor(MAP_H / 2));
    }
  },

  findUnexploredTiles(unit, player) {
    const unexplored = [];
    const range = 5;
    for (let q = Math.max(0, unit.q - range); q < Math.min(MAP_W, unit.q + range); q++) {
      for (let r = Math.max(0, unit.r - range); r < Math.min(MAP_H, unit.r + range); r++) {
        const tile = G.getTile(q, r);
        if (tile && !tile.explored[player.id]) {
          unexplored.push({ q, r });
        }
      }
    }
    return unexplored;
  },

  moveMilitary(unit, player) {
    const enemyCities = G.players[0].cities;
    const enemyUnits = G.players[0].units;

    if (enemyCities.length === 0 && enemyUnits.length === 0) return;

    const targets = [
      ...enemyCities.map(c => ({ q: c.q, r: c.r, priority: 3 })),
      ...enemyUnits.map(u => ({ q: u.q, r: u.r, priority: 2 })),
    ];

    if (targets.length === 0) return;

    targets.sort((a, b) => {
      const da = CivMap.hexDistance(unit.q, unit.r, a.q, a.r);
      const db = CivMap.hexDistance(unit.q, unit.r, b.q, b.r);
      return (da - a.priority * 2) - (db - b.priority * 2);
    });

    const target = targets[0];
    if (CivMap.hexDistance(unit.q, unit.r, target.q, target.r) <= 1) {
      const enemyUnit = G.getUnitAt(target.q, target.r);
      if (enemyUnit && enemyUnit.owner !== unit.owner) {
        CivUnits.resolveCombat(unit, enemyUnit);
        return;
      }
      const enemyCity = G.getCityAt(target.q, target.r);
      if (enemyCity && enemyCity.owner !== unit.owner) {
        CivUnits.attackCity(unit, enemyCity);
        return;
      }
    }

    this.moveToward(unit, target.q, target.r);
  },

  combatMoves(player) {
    for (const unit of [...player.units]) {
      if (unit.moves <= 0) continue;
      for (const n of CivMap.getNeighbors(unit.q, unit.r)) {
        const enemyUnit = G.getUnitAt(n.q, n.r);
        if (enemyUnit && enemyUnit.owner !== unit.owner) {
          CivUnits.resolveCombat(unit, enemyUnit);
          break;
        }
        const enemyCity = G.getCityAt(n.q, n.r);
        if (enemyCity && enemyCity.owner !== unit.owner) {
          CivUnits.attackCity(unit, enemyCity);
          break;
        }
      }
    }
  },

  moveToward(unit, targetQ, targetR) {
    if (unit.moves <= 0) return false;

    const range = CivUnits.getMovementRange(unit);
    let best = null;
    let bestDist = CivMap.hexDistance(unit.q, unit.r, targetQ, targetR);

    for (const r of range) {
      const d = CivMap.hexDistance(r.q, r.r, targetQ, targetR);
      const enemy = G.getUnitAt(r.q, r.r);
      if (enemy && enemy.owner !== unit.owner) {
        if (d === 0) {
          CivUnits.resolveCombat(unit, enemy);
          return true;
        }
        continue;
      }
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }

    if (best) {
      return CivUnits.moveUnit(unit, best.q, best.r, best.cost);
    }
    return false;
  },
};
