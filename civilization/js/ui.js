const CivUI = {
  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
    document.getElementById('new-game-btn').addEventListener('click', () => this.showNewGameModal());
    document.getElementById('save-btn').addEventListener('click', () => G.saveGame());
    document.getElementById('continue-btn').addEventListener('click', () => CivMain.continueGame());
    document.getElementById('mute-btn').addEventListener('click', () => CivAudio.toggleMute());

    document.getElementById('cmd-found-city').addEventListener('click', () => this.foundCityAction());
    document.getElementById('cmd-fortify').addEventListener('click', () => this.fortifyAction());
    document.getElementById('cmd-wake').addEventListener('click', () => this.wakeAction());
    document.getElementById('cmd-skip').addEventListener('click', () => this.skipAction());

    document.getElementById('production-select').addEventListener('change', (e) => this.onProductionChange(e));
    document.getElementById('research-select').addEventListener('change', (e) => this.onResearchChange(e));

    document.getElementById('victory-ok-btn').addEventListener('click', () => {
      document.getElementById('victory-modal').style.display = 'none';
    });

    document.getElementById('newgame-confirm-btn').addEventListener('click', () => {
      document.getElementById('newgame-modal').style.display = 'none';
      CivMain.newGame();
    });
    document.getElementById('newgame-cancel-btn').addEventListener('click', () => {
      document.getElementById('newgame-modal').style.display = 'none';
    });

    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  },

  handleKeyDown(e) {
    if (document.getElementById('victory-modal').style.display !== 'none') return;
    if (document.getElementById('newgame-modal').style.display !== 'none') {
      if (e.key === 'Escape') document.getElementById('newgame-modal').style.display = 'none';
      return;
    }

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.endTurn();
        break;
      case 'Escape':
        G.selectedTile = null;
        G.selectedUnit = null;
        G.selectedCity = null;
        G.movementRange = [];
        G.canFoundCity = false;
        this.update();
        CivMap.render();
        break;
      case 'f':
      case 'F':
        this.foundCityAction();
        break;
      case 'm':
      case 'M':
        this.toggleMovementRange();
        break;
    }
  },

  handleCanvasClick(e) {
    if (G.gameOver) return;

    const rect = CivMap.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hex = CivMap.pixelToHex(x, y);
    const tile = G.getTile(hex.q, hex.r);
    if (!tile) return;

    G.selectedTile = hex;

    const city = G.getCityAt(hex.q, hex.r);
    const unit = G.getUnitAt(hex.q, hex.r);

    if (G.selectedUnit && G.selectedUnit.owner === 0) {
        const rangeEntry = G.movementRange.find(r => r.q === hex.q && r.r === hex.r);
      if (rangeEntry) {
        const enemyUnit = G.getUnitAt(hex.q, hex.r);
        const enemyCity = G.getCityAt(hex.q, hex.r);
        if (enemyUnit && enemyUnit.owner !== 0) {
          CivUnits.resolveCombat(G.selectedUnit, enemyUnit);
        } else if (enemyCity && enemyCity.owner !== 0) {
          CivUnits.attackCity(G.selectedUnit, enemyCity);
        } else {
          CivUnits.moveUnit(G.selectedUnit, hex.q, hex.r, rangeEntry.cost);
        }
        G.movementRange = [];
        if (G.selectedUnit && G.selectedUnit.moves > 0) {
          G.movementRange = CivUnits.getMovementRange(G.selectedUnit);
        }
        if (G.selectedUnit && G.selectedUnit.moves <= 0) {
          G.selectedUnit = null;
          G.movementRange = [];
        }
        CivMap.refreshVisibility();
        this.update();
        CivMap.render();
        return;
      }
    }

    if (unit && unit.owner === 0) {
      if (G.selectedUnit && G.selectedUnit.id === unit.id) {
        G.selectedUnit = null;
        if (city && city.owner === 0) {
          G.selectedCity = city;
          G.movementRange = [];
          G.canFoundCity = false;
        }
      } else if (unit.moves > 0 && !unit.fortified) {
        G.selectedUnit = unit;
        G.selectedCity = null;
        G.movementRange = CivUnits.getMovementRange(unit);
        G.canFoundCity = unit.type === 'settler' && CivCities.canFound(unit);
      } else if (city && city.owner === 0) {
        G.selectedCity = city;
        G.selectedUnit = null;
        G.movementRange = [];
        G.canFoundCity = false;
      } else {
        G.selectedUnit = unit;
        G.movementRange = [];
        G.canFoundCity = false;
      }
      CivAudio.play('click');
    } else if (city && city.owner === 0) {
      G.selectedCity = city;
      G.selectedUnit = null;
      G.movementRange = [];
      G.canFoundCity = false;
      CivAudio.play('click');
    } else {
      G.selectedUnit = null;
      G.selectedCity = null;
      G.movementRange = [];
      G.canFoundCity = false;
    }

    this.update();
    CivMap.render();
  },

  endTurn() {
    if (G.gameOver) return;
    if (G.currentPlayer !== 0) return;

    CivAudio.play('turn');

    CivCities.processAllCities(G.players[0]);
    CivTech.processResearch(G.players[0]);
    CivUnits.healUnits(G.players[0]);

    if (G.checkVictory()) {
      this.update();
      CivMap.render();
      return;
    }

    CivAI.takeTurn();

    if (G.checkVictory()) {
      this.update();
      CivMap.render();
      return;
    }

    CivUnits.resetMoves(G.players[0]);

    G.currentPlayer = 0;
    G.turn++;
    G.selectedUnit = null;
    G.selectedCity = null;
    G.movementRange = [];
    G.canFoundCity = false;

    CivMap.refreshVisibility();
    this.update();
    CivMap.render();
  },

  foundCityAction() {
    const unit = G.selectedUnit;
    if (!unit || unit.type !== 'settler' || unit.owner !== 0) return;
    if (!CivCities.canFound(unit)) {
      G.addLog('Cannot found city here. Need open land, not near another city.', 'log-combat');
      this.update();
      return;
    }
    CivCities.foundCity(unit);
    G.movementRange = [];
    G.canFoundCity = false;
    this.update();
    CivMap.render();
  },

  fortifyAction() {
    const unit = G.selectedUnit;
    if (!unit || unit.owner !== 0) return;
    unit.fortified = true;
    unit.moves = 0;
    G.selectedUnit = null;
    G.movementRange = [];
    G.canFoundCity = false;
    G.addLog('Unit fortified.', 'log-info');
    this.update();
    CivMap.render();
  },

  wakeAction() {
    const unit = G.selectedUnit;
    if (!unit || unit.owner !== 0) return;
    unit.fortified = false;
    G.addLog('Unit awakened.', 'log-info');
    this.update();
    CivMap.render();
  },

  skipAction() {
    const unit = G.selectedUnit;
    if (!unit || unit.owner !== 0) return;
    unit.moves = 0;
    G.selectedUnit = null;
    G.movementRange = [];
    G.canFoundCity = false;
    this.update();
    CivMap.render();
  },

  toggleMovementRange() {
    if (!G.selectedUnit || G.selectedUnit.owner !== 0) return;
    if (G.movementRange.length > 0) {
      G.movementRange = [];
    } else {
      G.movementRange = CivUnits.getMovementRange(G.selectedUnit);
    }
    CivMap.render();
  },

  onProductionChange(e) {
    const val = e.target.value;
    if (!val || !G.selectedCity) return;
    const [type, id] = val.split(':');
    CivCities.setProduction(G.selectedCity, type, id);
    this.update();
    CivMap.render();
  },

  onResearchChange(e) {
    const val = e.target.value;
    if (!val) return;
    const player = G.players[0];
    if (player.researching) {
      G.addLog('Research already in progress.', 'log-info');
      return;
    }
    CivTech.startResearch(player, val);
    this.update();
    CivMap.render();
  },

  update() {
    const p = G.players[0];
    const isPlayerTurn = !G.gameOver && G.currentPlayer === 0;

    document.getElementById('turn-number').textContent = G.turn;
    document.getElementById('gold-amount').textContent = Math.floor(p.gold);
    document.getElementById('science-amount').textContent = p.science;
    document.getElementById('science-target').textContent = TECH_TREE[p.researching]?.cost || '--';

    const techName = p.researching ? TECH_TREE[p.researching].name : 'None';
    document.getElementById('current-research').textContent = techName;
    document.getElementById('score-value').textContent = G.getScore(p);
    document.getElementById('total-population').textContent = p.cities.reduce((s, c) => s + c.population, 0);

    document.getElementById('continue-btn').style.display = localStorage.getItem('microCivSave') ? 'inline-block' : 'none';

    this.updateSelection();
    this.updateUnitCommands();
    this.updateCityPanel();
    this.updateResearchPanel();
    this.updateEventLog();
  },

  updateSelection() {
    const info = document.getElementById('selection-info');
    const terrainInfo = document.getElementById('terrain-info');

    if (G.selectedTile) {
      const tile = G.getTile(G.selectedTile.q, G.selectedTile.r);
      if (!tile || !tile.explored[0]) {
        info.textContent = 'Unexplored territory';
        terrainInfo.textContent = '';
        return;
      }

      if (!tile.visible[0]) {
        info.innerHTML = `<b>${G.selectedTile.q}, ${G.selectedTile.r}</b> (explored)`;
        terrainInfo.textContent = 'No longer visible';
        return;
      }

      const t = TERRAINS[tile.terrain] || TERRAINS.grassland;
      const unit = G.getUnitAt(G.selectedTile.q, G.selectedTile.r);
      const city = G.getCityAt(G.selectedTile.q, G.selectedTile.r);
      info.innerHTML = `<b>${G.selectedTile.q}, ${G.selectedTile.r}</b>`;
      terrainInfo.innerHTML =
        `${t.name} | Food: ${t.food} Prod: ${t.prod} Gold: ${t.gold}`;
      if (city) {
        const owner = G.getPlayer(city.owner);
        terrainInfo.innerHTML += `<br>🏙 ${city.name} (${owner.name}) Pop: ${city.population}`;
      }
      if (unit) {
        const owner = G.getPlayer(unit.owner);
        const ud = UNIT_TYPES[unit.type];
        terrainInfo.innerHTML +=
          `<br>${unit.type === 'settler' ? '🏠' : unit.type === 'scout' ? '🔍' : unit.type === 'warrior' ? '⚔' : '🏹'} ${ud.name} (${owner.name}) HP: ${Math.ceil(unit.hp)}`;
      }
      return;
    }

    info.textContent = 'Click a tile, unit, or city';
    terrainInfo.textContent = '';
  },

  updateUnitCommands() {
    const panel = document.getElementById('unit-commands');
    const info = document.getElementById('unit-info');
    const unit = G.selectedUnit;

    if (unit && unit.owner === 0 && !G.gameOver && G.currentPlayer === 0) {
      panel.style.display = 'block';
      const ud = UNIT_TYPES[unit.type];
      info.innerHTML = `${ud.name} | HP: ${Math.ceil(unit.hp)}/${unit.maxHp} | Moves: ${unit.moves}/${unit.maxMoves}`;
      if (unit.fortified) info.innerHTML += ' | FORTIFIED';

      document.getElementById('cmd-found-city').style.display = unit.type === 'settler' ? 'inline-block' : 'none';
      document.getElementById('cmd-fortify').style.display = !unit.fortified && unit.moves > 0 ? 'inline-block' : 'none';
      document.getElementById('cmd-wake').style.display = unit.fortified ? 'inline-block' : 'none';
      document.getElementById('cmd-skip').style.display = unit.moves > 0 ? 'inline-block' : 'none';
    } else {
      panel.style.display = 'none';
    }
  },

  updateCityPanel() {
    const panel = document.getElementById('city-panel');
    const city = G.selectedCity;

    if (city && city.owner === 0 && !G.gameOver) {
      panel.style.display = 'block';
      document.getElementById('city-name').textContent = city.name;
      document.getElementById('city-pop').textContent = `Pop: ${city.population}`;

      const yields = CivCities.getYields(city, G.getPlayer(0));
      document.getElementById('city-food').textContent = city.food;
      document.getElementById('city-food-target').textContent = city.foodToGrow;
      document.getElementById('city-prod').textContent = city.production;
      const prodTarget = city.productionTarget;
      let prodCost = 0;
      if (prodTarget) {
        const def = prodTarget.type === 'unit' ? UNIT_TYPES[prodTarget.id] : BUILDING_TYPES[prodTarget.id];
        if (def) prodCost = def.cost;
      }
      document.getElementById('city-prod-target').textContent = prodCost || 0;

      const fillW = prodCost > 0 ? Math.min(100, (city.production / prodCost) * 100) : 0;
      document.getElementById('city-progress-fill').style.width = fillW + '%';

      const bInfo = document.getElementById('city-building-info');
      if (city.buildings.length > 0) {
        bInfo.textContent = 'Buildings: ' + city.buildings.map(id => BUILDING_TYPES[id]?.name || id).join(', ');
      } else {
        bInfo.textContent = 'No buildings yet.';
      }

      const buildingsList = document.getElementById('city-buildings');
      buildingsList.textContent = yields.food > 0 ? `Yields: ${yields.food}f ${yields.prod}p ${yields.gold}g` : '';

      const select = document.getElementById('production-select');
      const currentVal = select.value;
      const options = CivCities.getProductionOptions(city);
      select.innerHTML = '<option value="">-- Select Production --</option>' +
        options.map(o => {
          const sel = city.productionTarget && city.productionTarget.type === o.type && city.productionTarget.id === o.id ? ' selected' : '';
          return `<option value="${o.type}:${o.id}"${sel}>${o.name} (${o.cost})</option>`;
        }).join('');
    } else {
      panel.style.display = 'none';
    }
  },

  updateResearchPanel() {
    const p = G.players[0];
    const info = document.getElementById('research-info');
    const select = document.getElementById('research-select');

    const fillW = p.researching ? Math.min(100, (p.researchProgress / (TECH_TREE[p.researching]?.cost || 1)) * 100) : 0;
    document.getElementById('research-progress-fill').style.width = fillW + '%';

    if (p.researching) {
      const tech = TECH_TREE[p.researching];
      info.textContent = `${tech.name} (${p.researchProgress}/${tech.cost}) +${p.sciencePerTurn}/turn`;
    } else {
      const researched = p.techs.length;
      const total = Object.keys(TECH_TREE).length;
      info.textContent = `Researched ${researched}/${total} technologies`;
    }

    const currentVal = select.value;
    const available = CivTech.getAvailableTechs(p);
    select.innerHTML = '<option value="">-- Select Research --</option>' +
      (p.researching ? `<option value="${p.researching}" selected>${TECH_TREE[p.researching].name} (in progress)</option>` : '') +
      available.map(t => {
        const sel = !p.researching && t.id === p.researching ? ' selected' : '';
        return `<option value="${t.id}"${sel}>${t.name} (${t.cost})</option>`;
      }).join('');
    select.value = currentVal;
  },

  updateEventLog() {
    const container = document.getElementById('log-entries');
    container.innerHTML = G.log.map(e => `<div class="log-entry ${e.cls}">[T${e.turn}] ${e.msg}</div>`).join('');
  },

  showVictory(type, winner) {
    const modal = document.getElementById('victory-modal');
    const title = document.getElementById('victory-title');
    const msg = document.getElementById('victory-message');

    const winnerName = winner === 0 ? 'You' : 'Rome (AI)';
    const typeNames = { conquest: 'Conquest', technology: 'Technology', score: 'Score' };

    title.textContent = `${typeNames[type] || ''} Victory!`;
    msg.textContent = `${winnerName} win${winner === 0 ? '' : 's'} by ${typeNames[type] || type}!`;
    modal.style.display = 'flex';
  },

  showNewGameModal() {
    document.getElementById('newgame-modal').style.display = 'flex';
  },
};
