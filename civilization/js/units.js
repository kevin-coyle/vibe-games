const CivUnits = {
  createUnit(type, owner, q, r) {
    const def = UNIT_TYPES[type];
    if (!def) return null;
    const player = G.getPlayer(owner);
    const unit = {
      id: G.nextUnitId(),
      type, owner,
      q, r,
      moves: def.moves,
      maxMoves: def.moves,
      hp: 100,
      maxHp: 100,
      fortified: false,
    };
    if (player.techs.includes('engineering')) {
      unit.maxMoves++;
      unit.moves = unit.maxMoves;
    }
    player.units.push(unit);
    CivMap.updateVisibility(q, r, owner, 2);
    return unit;
  },

  getMovementRange(unit) {
    const range = [];
    const visited = new Map();
    const player = G.getPlayer(unit.owner);
    const queue = [{ q: unit.q, r: unit.r, movesLeft: unit.moves }];
    const key = `${unit.q},${unit.r}`;
    visited.set(key, unit.moves);

    while (queue.length > 0) {
      const cur = queue.shift();
      const curKey = `${cur.q},${cur.r}`;
      const mv = visited.get(curKey);
      if (cur.q !== unit.q || cur.r !== unit.r) {
        range.push({ q: cur.q, r: cur.r, cost: unit.moves - mv });
      }

      if (mv <= 0) continue;

      for (const n of CivMap.getNeighbors(cur.q, cur.r)) {
        const tile = G.getTile(n.q, n.r);
        if (!tile) continue;
        const terrain = TERRAINS[tile.terrain];
        if (terrain.move < 0) continue;

        const otherUnit = G.getUnitAt(n.q, n.r);
        if (otherUnit && otherUnit.owner === unit.owner && (otherUnit.q !== unit.q || otherUnit.r !== unit.r)) continue;

        const cost = terrain.move;
        const remaining = mv - cost;
        const nKey = `${n.q},${n.r}`;
        if (remaining >= 0 && (!visited.has(nKey) || visited.get(nKey) < remaining)) {
          visited.set(nKey, remaining);
          queue.push({ q: n.q, r: n.r, movesLeft: remaining });
        }
      }
    }

    return range;
  },

  moveUnit(unit, targetQ, targetR, cost) {
    const tile = G.getTile(targetQ, targetR);
    if (!tile) return false;

    const terrain = TERRAINS[tile.terrain];
    if (terrain.move < 0) return false;

    if (cost === undefined) {
      cost = CivMap.hexDistance(unit.q, unit.r, targetQ, targetR);
    }
    if (cost > unit.moves) return false;

    const enemyUnit = G.getUnitAt(targetQ, targetR);
    if (enemyUnit && enemyUnit.owner !== unit.owner) {
      return this.resolveCombat(unit, enemyUnit);
    }

    const enemyCity = G.getCityAt(targetQ, targetR);
    if (enemyCity && enemyCity.owner !== unit.owner) {
      return this.attackCity(unit, enemyCity);
    }

    const existingUnit = G.getUnitAt(targetQ, targetR);
    if (existingUnit && existingUnit.owner === unit.owner && (existingUnit.id !== unit.id)) return false;

    unit.moves -= cost;
    unit.q = targetQ;
    unit.r = targetR;
    unit.fortified = false;

    CivMap.updateVisibility(targetQ, targetR, unit.owner, 2);
    G.addLog(`${UNIT_TYPES[unit.type].name} moves to (${targetQ}, ${targetR}).`, 'log-info');
    CivAudio.play('move');
    return true;
  },

  resolveCombat(attacker, defender) {
    const atkDef = UNIT_TYPES[attacker.type];
    const defDef = UNIT_TYPES[defender.type];
    if (!atkDef || !defDef) return false;

    let atkStr = atkDef.strength;
    let defStr = defDef.strength;

    const defTile = G.getTile(defender.q, defender.r);
    if (defTile) {
      const terrain = TERRAINS[defTile.terrain];
      defStr += defStr * terrain.defense;
    }

    if (defender.fortified) defStr *= 1.25;

    const total = atkStr + defStr;
    let atkDamage = 30 * (atkStr / total);
    let defDamage = atkDef.ranged ? 0 : 30 * (defStr / total);

    atkDamage *= 0.85 + Math.random() * 0.3;
    defDamage *= 0.85 + Math.random() * 0.3;

    atkDamage = Math.max(5, Math.round(atkDamage));
    defDamage = Math.max(5, Math.round(defDamage));

    const aName = UNIT_TYPES[attacker.type].name;
    const dName = UNIT_TYPES[defender.type].name;
    const isPlayer = attacker.owner === 0 || defender.owner === 0;

    attacker.hp -= defDamage;
    defender.hp -= atkDamage;

    G.addLog(`${aName} attacks ${dName}! (-${atkDamage}hp / -${defDamage}hp)`, isPlayer ? 'log-combat' : 'log-info');

    const defPlayer = G.getPlayer(defender.owner);
    const atkPlayer = G.getPlayer(attacker.owner);
    const defDead = defender.hp <= 0;
    const atkDead = attacker.hp <= 0;

    if (defDead) {
      defPlayer.units = defPlayer.units.filter(u => u.id !== defender.id);
      G.addLog(`${dName} destroyed!`, 'log-combat');
    }
    if (atkDead) {
      atkPlayer.units = atkPlayer.units.filter(u => u.id !== attacker.id);
      G.addLog(`${aName} destroyed!`, 'log-combat');
      if (G.selectedUnit && G.selectedUnit.id === attacker.id) G.selectedUnit = null;
    }
    if (defDead && !atkDead) {
      attacker.q = defender.q;
      attacker.r = defender.r;
      CivMap.updateVisibility(attacker.q, attacker.r, attacker.owner, 2);
    }

    CivAudio.play('attack');
    return defDead || atkDead;
  },

  attackCity(unit, city) {
    const unitDef = UNIT_TYPES[unit.type];
    if (unitDef.strength === 0) {
      G.addLog('Settlers cannot attack!', 'log-info');
      return false;
    }

    let atkStr = unitDef.strength;
    let cityStr = 6 + city.population * 2;
    for (const b of city.buildings) {
      const bd = BUILDING_TYPES[b];
      if (bd) cityStr += bd.defense;
    }

    const terrain = TERRAINS[G.getTile(city.q, city.r)?.terrain] || TERRAINS.grassland;
    cityStr += cityStr * (terrain.defense || 0);

    const total = atkStr + cityStr;
    let atkDamage = 30 * (atkStr / total);
    let cityDamage = unitDef.ranged ? 0 : 30 * (cityStr / total);

    atkDamage *= 0.85 + Math.random() * 0.3;
    cityDamage *= 0.85 + Math.random() * 0.3;

    atkDamage = Math.max(5, Math.round(atkDamage));
    cityDamage = Math.max(5, Math.round(cityDamage));

    const cName = city.name;
    const uName = UNIT_TYPES[unit.type].name;

    unit.hp -= cityDamage;
    city.health = (city.health || city.population * 20) - atkDamage;
    G.addLog(`${uName} attacks ${cName}! (-${atkDamage} city / -${cityDamage} ${uName})`, 'log-combat');

    if (city.health <= 0) {
      city.population--;
      if (city.population <= 0) {
        const oldOwner = G.getPlayer(city.owner);
        oldOwner.cities = oldOwner.cities.filter(c => c.id !== city.id);
        const newOwner = G.getPlayer(unit.owner);
        city.owner = unit.owner;
        city.population = 1;
        city.health = 20;
        newOwner.cities.push(city);
        G.addLog(`${cName} captured!`, 'log-success');
        CivAudio.play('city');
      } else {
        city.health = city.population * 20;
        G.addLog(`${cName} population reduced to ${city.population}.`, 'log-combat');
      }
    }

    if (unit.hp <= 0) {
      const atkPlayer = G.getPlayer(unit.owner);
      atkPlayer.units = atkPlayer.units.filter(u => u.id !== unit.id);
      G.addLog(`${uName} destroyed attacking ${cName}!`, 'log-combat');
      G.selectedUnit = null;
    }

    CivAudio.play('attack');
    return true;
  },

  healUnits(player) {
    for (const u of player.units) {
      if (!u.fortified && u.moves < u.maxMoves) continue;
      if (u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + 10);
      }
    }
  },

  resetMoves(player) {
    for (const u of player.units) {
      let baseMoves = UNIT_TYPES[u.type]?.moves || 2;
      if (player.techs.includes('engineering')) baseMoves++;
      u.maxMoves = baseMoves;
      u.moves = baseMoves;
    }
  },
};
