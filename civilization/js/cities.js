const CivCities = {
  canFound(unit) {
    const tile = G.getTile(unit.q, unit.r);
    if (!tile) return false;
    if (tile.terrain === 'water' || tile.terrain === 'mountain') return false;
    if (G.getCityAt(unit.q, unit.r)) return false;

    for (const p of G.players) {
      for (const c of p.cities) {
        if (CivMap.hexDistance(unit.q, unit.r, c.q, c.r) < 3) return false;
      }
    }

    return true;
  },

  foundCity(unit) {
    if (!this.canFound(unit)) {
      G.addLog('Cannot found city here.', 'log-combat');
      return null;
    }

    const player = G.getPlayer(unit.owner);
    const usedNames = G.cityNamesUsed[player.id];
    const nameList = CITY_NAMES[player.id] || CITY_NAMES[0];
    let name = nameList[0];
    for (const n of nameList) {
      if (!usedNames.includes(n)) { name = n; break; }
    }
    usedNames.push(name);

    G.cityNamesUsed[player.id] = usedNames;
    player.units = player.units.filter(u => u.id !== unit.id);

    const city = {
      id: G.nextCityId(),
      name,
      owner: player.id,
      q: unit.q, r: unit.r,
      population: 1,
      food: 0,
      foodToGrow: 15,
      production: 0,
      productionTarget: null,
      productionProgress: 0,
      buildings: [],
      health: 20,
      workedTiles: [],
    };
    player.cities.push(city);

    CivMap.updateVisibility(city.q, city.r, player.id, 2);
    G.addLog(`${name} founded!`, 'log-city');
    G.selectedCity = city;
    G.selectedUnit = null;
    CivAudio.play('found');
    return city;
  },

  processCity(city) {
    const player = G.getPlayer(city.owner);
    const yields = this.getYields(city, player);

    city.food += yields.food;
    while (city.food >= city.foodToGrow) {
      city.food -= city.foodToGrow;
      city.population++;
      city.foodToGrow = 15 + city.population * 8;
      city.health = city.population * 20;
      G.addLog(`${city.name} grows to population ${city.population}!`, 'log-city');
    }

    if (city.population < 1) city.population = 1;

    city.production += yields.prod;

    if (city.productionTarget) {
      const def = city.productionTarget.type === 'unit'
        ? UNIT_TYPES[city.productionTarget.id]
        : BUILDING_TYPES[city.productionTarget.id];

      if (def && city.production >= def.cost) {
        city.production -= def.cost;
        this.completeProduction(city, player);
      }
    }

    player.science += yields.science || 0;
    player.gold += yields.gold || 0;

    if (player.isHuman) {
      const tile = G.getTile(city.q, city.r);
      if (tile) tile.visible[player.id] = true;
    }
  },

  processAllCities(player) {
    let totalScience = 0;
    for (const city of player.cities) {
      this.processCity(city);
      const yields = this.getYields(city, player);
      totalScience += yields.science || 0;
    }
    player.sciencePerTurn = Math.max(1, totalScience);
  },

  getYields(city, player) {
    let food = 2;
    let prod = 1;
    let gold = 1;
    let science = 0;

    const centerTile = G.getTile(city.q, city.r);
    if (centerTile) {
      const t = TERRAINS[centerTile.terrain] || TERRAINS.grassland;
      food = t.food;
      prod = t.prod;
      gold = t.gold;
    }

    science = 1 + Math.floor(city.population / 2);

    const worked = this.getWorkedTiles(city, player);
    for (const { q, r } of worked) {
      if (q === city.q && r === city.r) continue;
      const tile = G.getTile(q, r);
      if (!tile) continue;
      const t = TERRAINS[tile.terrain] || TERRAINS.grassland;
      food += t.food;
      prod += t.prod;
      gold += t.gold;
    }

    for (const b of city.buildings) {
      const bd = BUILDING_TYPES[b];
      if (bd) {
        food += bd.food || 0;
        prod += bd.prod || 0;
        gold += bd.gold || 0;
      }
    }

    return { food, prod, gold, science };
  },

  getWorkedTiles(city, player) {
    const radius = 1;
    const tiles = [{ q: city.q, r: city.r }];
    const candidates = [];

    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (dq === 0 && dr === 0) continue;
        const q = city.q + dq;
        const r = city.r + dr;
        const tile = G.getTile(q, r);
        if (!tile) continue;
        if (tile.terrain === 'water') continue;
        if (CivMap.hexDistance(city.q, city.r, q, r) <= radius) {
          candidates.push({ q, r, tile });
        }
      }
    }

    candidates.sort((a, b) => {
      const ta = TERRAINS[a.tile.terrain];
      const tb = TERRAINS[b.tile.terrain];
      return (tb.food + tb.prod + tb.gold) - (ta.food + ta.prod + ta.gold);
    });

    const canWork = Math.min(city.population, candidates.length);
    for (let i = 0; i < canWork; i++) {
      tiles.push({ q: candidates[i].q, r: candidates[i].r });
    }

    return tiles;
  },

  completeProduction(city, player) {
    const target = city.productionTarget;
    if (!target) return;

    if (target.type === 'unit') {
      const unit = CivUnits.createUnit(target.id, player.id, city.q, city.r);
      if (unit) {
        G.addLog(`${city.name} produces ${UNIT_TYPES[target.id].name}!`, 'log-success');
        CivAudio.play('build');
      }
    } else if (target.type === 'building') {
      if (!city.buildings.includes(target.id)) {
        city.buildings.push(target.id);
        G.addLog(`${city.name} builds ${BUILDING_TYPES[target.id].name}!`, 'log-success');
        CivAudio.play('build');
      }
    }

    city.productionTarget = null;
    city.productionProgress = 0;
    city.production = 0;

    const options = this.getProductionOptions(city);
    if (options.length > 0 && !player.isHuman) {
      this.setProduction(city, options[0].type, options[0].id);
    } else if (options.length > 0) {
      G.addLog(`${city.name}: select new production.`, 'log-info');
    }
  },

  setProduction(city, type, id) {
    const def = type === 'unit' ? UNIT_TYPES[id] : BUILDING_TYPES[id];
    if (!def) return false;

    if (type === 'building' && city.buildings.includes(id)) {
      G.addLog(`${city.name} already has ${def.name}.`, 'log-info');
      return false;
    }

    if (type === 'unit' && id === 'settler' && city.population < 2) {
      G.addLog(`${city.name} needs population 2+ to build a Settler.`, 'log-info');
      return false;
    }

    city.productionTarget = { type, id };
    city.production = 0;
    G.addLog(`${city.name} begins producing ${def.name}.`, 'log-info');
    return true;
  },

  getProductionOptions(city) {
    const player = G.getPlayer(city.owner);
    const options = [];

    options.push({ type: 'unit', id: 'scout', name: 'Scout', cost: UNIT_TYPES.scout.cost });
    options.push({ type: 'unit', id: 'warrior', name: 'Warrior', cost: UNIT_TYPES.warrior.cost });

    if (city.population >= 2) {
      options.push({ type: 'unit', id: 'settler', name: 'Settler', cost: UNIT_TYPES.settler.cost });
    }

    if (player.techs.includes('archery')) {
      options.push({ type: 'unit', id: 'archer', name: 'Archer', cost: UNIT_TYPES.archer.cost });
    }

    for (const [id, bd] of Object.entries(BUILDING_TYPES)) {
      if (city.buildings.includes(id)) continue;
      if (bd.tech && !player.techs.includes(bd.tech)) continue;
      options.push({ type: 'building', id, name: bd.name, cost: bd.cost });
    }

    return options;
  },
};
