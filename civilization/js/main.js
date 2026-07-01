const CivMain = {
  init() {
    CivAudio.init();
    CivMap.init();

    const saved = localStorage.getItem('microCivSave');
    if (saved) {
      document.getElementById('continue-btn').style.display = 'inline-block';
    }

    CivUI.init();

    if (G.initialized) {
      CivUI.update();
      CivMap.render();
    } else if (saved) {
      document.getElementById('selection-info').textContent = 'Welcome back! Click Continue or start a New Game.';
    } else {
      this.newGame();
    }
  },

  newGame() {
    G.newGame();
    if (G.players[0].units.length > 0) {
      const firstUnit = G.players[0].units[0];
      G.selectedUnit = firstUnit;
      G.selectedTile = { q: firstUnit.q, r: firstUnit.r };
    }
    CivUI.update();
    CivMap.render();
  },

  continueGame() {
    if (G.loadGame()) {
      CivMap.recomputeHexCache();
      CivUI.update();
      CivMap.render();
      G.addLog('Game loaded successfully.', 'log-success');
      CivUI.update();
      CivMap.render();
    } else {
      G.addLog('Failed to load save data.', 'log-combat');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => CivMain.init());
