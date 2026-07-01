const MAP_W = 20;
const MAP_H = 14;
const HEX_SIZE = 30;
const SCORE_VICTORY_TURN = 100;

const TERRAINS = {
  grassland: { food: 2, prod: 1, gold: 1, move: 1, name: 'Grassland', defense: 0 },
  forest:    { food: 1, prod: 2, gold: 1, move: 2, name: 'Forest', defense: 0.25 },
  hills:     { food: 1, prod: 2, gold: 1, move: 2, name: 'Hills', defense: 0.25 },
  mountain:  { food: 0, prod: 1, gold: 0, move: -1, name: 'Mountains', defense: 0.5 },
  water:     { food: 1, prod: 0, gold: 2, move: -1, name: 'Water', defense: 0 },
  desert:    { food: 0, prod: 1, gold: 1, move: 2, name: 'Desert', defense: 0 },
};

const UNIT_TYPES = {
  settler: { cost: 80, strength: 0, moves: 2, tech: null, name: 'Settler' },
  scout:   { cost: 30, strength: 5, moves: 3, tech: null, name: 'Scout' },
  warrior: { cost: 50, strength: 8, moves: 2, tech: null, name: 'Warrior' },
  archer:  { cost: 70, strength: 6, moves: 2, tech: 'archery', name: 'Archer', ranged: true },
};

const BUILDING_TYPES = {
  granary:  { cost: 60, food: 2, prod: 0, gold: 0, defense: 0, tech: 'agriculture', name: 'Granary' },
  monument: { cost: 40, food: 0, prod: 0, gold: 2, defense: 0, tech: 'writing', name: 'Monument' },
  workshop: { cost: 80, food: 0, prod: 2, gold: 0, defense: 2, tech: 'mining', name: 'Workshop' },
};

const TECH_TREE = {
  agriculture: { cost: 20, name: 'Agriculture', prereq: null, unlocks: ['granary'] },
  mining:      { cost: 30, name: 'Mining', prereq: null, unlocks: ['workshop'] },
  archery:     { cost: 40, name: 'Archery', prereq: 'agriculture', unlocks: ['archer'] },
  writing:     { cost: 50, name: 'Writing', prereq: null, unlocks: ['monument'] },
  engineering: { cost: 70, name: 'Engineering', prereq: 'mining', unlocks: [] },
};

const CITY_NAMES = [
  ['Washington','New York','Boston','Philadelphia','Chicago','Atlanta','Dallas','Seattle','Denver','Phoenix'],
  ['Rome','Antium','Cumae','Neapolis','Ravenna','Arretium','Mediolanum','Genoa','Pompeii','Florence'],
];

const G = {
  map: [],
  players: [],
  currentPlayer: 0,
  turn: 1,
  selectedTile: null,
  selectedUnit: null,
  selectedCity: null,
  gameOver: false,
  log: [],
  unitIdCounter: 0,
  cityIdCounter: 0,
  initialized: false,
  saved: null,
  canFoundCity: false,
  movementRange: [],
  cityNamesUsed: [[], []],

  initPlayers() {
    this.players = [
      { id: 0, name: 'You', isHuman: true, gold: 5, science: 0, sciencePerTurn: 1,
        techs: [], researching: null, researchProgress: 0, units: [], cities: [] },
      { id: 1, name: 'Rome', isHuman: false, gold: 5, science: 0, sciencePerTurn: 1,
        techs: [], researching: null, researchProgress: 0, units: [], cities: [] },
    ];
    this.currentPlayer = 0;
    this.turn = 1;
    this.gameOver = false;
    this.log = [];
    this.unitIdCounter = 0;
    this.cityIdCounter = 0;
    this.selectedTile = null;
    this.selectedUnit = null;
    this.selectedCity = null;
    this.canFoundCity = false;
    this.movementRange = [];
    this.cityNamesUsed = [[], []];
  },

  getPlayer(id) {
    return this.players[id];
  },

  getCurrentPlayer() {
    return this.players[this.currentPlayer];
  },

  getTile(q, r) {
    if (q < 0 || q >= MAP_W || r < 0 || r >= MAP_H) return null;
    return this.map[q]?.[r] || null;
  },

  getUnitAt(q, r) {
    for (const p of this.players) {
      for (const u of p.units) {
        if (u.q === q && u.r === r) return u;
      }
    }
    return null;
  },

  getCityAt(q, r) {
    for (const p of this.players) {
      for (const c of p.cities) {
        if (c.q === q && c.r === r) return c;
      }
    }
    return null;
  },

  getCityByName(name) {
    for (const p of this.players) {
      for (const c of p.cities) {
        if (c.name === name) return c;
      }
    }
    return null;
  },

  isVisibleTo(q, r, playerId) {
    const tile = this.getTile(q, r);
    return tile && tile.visible[playerId];
  },

  isExploredBy(q, r, playerId) {
    const tile = this.getTile(q, r);
    return tile && tile.explored[playerId];
  },

  addLog(msg, cls = 'log-info') {
    this.log.unshift({ msg, cls, turn: this.turn });
    if (this.log.length > 100) this.log.length = 100;
  },

  nextUnitId() {
    return this.unitIdCounter++;
  },

  nextCityId() {
    return this.cityIdCounter++;
  },

  getScore(player) {
    let score = 0;
    for (const c of player.cities) score += c.population * 10;
    score += player.techs.length * 20;
    for (const c of player.cities) {
      for (const b of c.buildings) score += 10;
    }
    score += Math.floor(player.gold / 2);
    for (const u of player.units) score += 5;
    return score;
  },

  checkVictory() {
    const p0 = this.players[0];
    const p1 = this.players[1];

    if (this.turn < 5) return false;

    if (p1.cities.length === 0 && p0.cities.length > 0) {
      this.gameOver = true;
      this.addLog('You have conquered all enemy cities!', 'log-success');
      CivUI.showVictory('conquest', 0);
      CivAudio.play('victory');
      return true;
    }
    if (p0.cities.length === 0 && p1.cities.length > 0) {
      this.gameOver = true;
      this.addLog('All your cities have been conquered!', 'log-combat');
      CivUI.showVictory('conquest', 1);
      return true;
    }
    if (p0.techs.length >= Object.keys(TECH_TREE).length) {
      this.gameOver = true;
      this.addLog('You have discovered all technologies!', 'log-success');
      CivUI.showVictory('technology', 0);
      CivAudio.play('victory');
      return true;
    }
    if (p1.techs.length >= Object.keys(TECH_TREE).length) {
      this.gameOver = true;
      this.addLog('Rome has discovered all technologies!', 'log-tech');
      CivUI.showVictory('technology', 1);
      return true;
    }
    if (this.turn >= SCORE_VICTORY_TURN) {
      this.gameOver = true;
      const s0 = this.getScore(p0);
      const s1 = this.getScore(p1);
      const winner = s0 >= s1 ? 0 : 1;
      this.addLog(`Score victory! ${winner === 0 ? 'You' : 'Rome'} wins!`, 'log-info');
      CivUI.showVictory('score', winner);
      CivAudio.play('victory');
      return true;
    }
    return false;
  },

  saveGame() {
    try {
      const state = {
        map: this.map.map(col => col.map(t => ({
          terrain: t.terrain, explored: t.explored, visible: t.visible,
          q: t.q, r: t.r, improvement: t.improvement,
        }))),
        players: this.players.map(p => ({
          id: p.id, name: p.name, isHuman: p.isHuman,
          gold: p.gold, science: p.science, sciencePerTurn: p.sciencePerTurn,
          techs: [...p.techs], researching: p.researching, researchProgress: p.researchProgress,
          units: p.units.map(u => ({ ...u })),
          cities: p.cities.map(c => ({
            ...c, workedTiles: c.workedTiles ? [...c.workedTiles] : [],
            buildings: [...c.buildings],
          })),
        })),
        currentPlayer: this.currentPlayer, turn: this.turn,
        unitIdCounter: this.unitIdCounter, cityIdCounter: this.cityIdCounter,
        cityNamesUsed: this.cityNamesUsed.map(a => [...a]),
        log: this.log.slice(0, 50),
      };
      localStorage.setItem('microCivSave', JSON.stringify(state));
      this.addLog('Game saved.', 'log-info');
      return true;
    } catch (e) {
      this.addLog('Failed to save game.', 'log-combat');
      return false;
    }
  },

  loadGame() {
    try {
      const raw = localStorage.getItem('microCivSave');
      if (!raw) return false;
      const state = JSON.parse(raw);
      this.map = state.map;
      this.players = state.players;
      this.currentPlayer = state.currentPlayer;
      this.turn = state.turn;
      this.unitIdCounter = state.unitIdCounter;
      this.cityIdCounter = state.cityIdCounter;
      this.cityNamesUsed = state.cityNamesUsed;
      this.log = state.log || [];
      this.gameOver = false;
      this.selectedTile = null;
      this.selectedUnit = null;
      this.selectedCity = null;
      this.canFoundCity = false;
      this.movementRange = [];
      this.initialized = true;

      for (const tile of this.map.flat()) {
        tile.visible = [false, false];
      }

      for (const p of this.players) {
        for (const u of p.units) {
          CivMap.updateVisibility(u.q, u.r, p.id, 2);
        }
        for (const c of p.cities) {
          CivMap.updateVisibility(c.q, c.r, p.id, 2);
        }
      }

      return true;
    } catch (e) {
      return false;
    }
  },

  newGame() {
    this.initPlayers();
    CivMap.generate();
    CivMap.placePlayers();
    this.initialized = true;
    for (const p of this.players) {
      for (const u of p.units) {
        CivMap.updateVisibility(u.q, u.r, p.id, 2);
      }
      for (const c of p.cities) {
        CivMap.updateVisibility(c.q, c.r, p.id, 2);
      }
    }
    this.selectedTile = null;
    this.selectedUnit = null;
    this.selectedCity = null;
    this.canFoundCity = false;
    this.movementRange = [];
    this.addLog('A new world awaits your civilization!', 'log-success');
    this.addLog('Found a city with your Settler to begin.', 'log-info');
    CivAudio.play('turn');
    CivUI.update();
  },
};
