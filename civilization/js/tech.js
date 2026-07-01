const CivTech = {
  getAvailableTechs(player) {
    return Object.entries(TECH_TREE).filter(([id, t]) => {
      if (player.techs.includes(id)) return false;
      if (t.prereq && !player.techs.includes(t.prereq)) return false;
      return true;
    }).map(([id, t]) => ({ id, ...t }));
  },

  startResearch(player, techId) {
    const tech = TECH_TREE[techId];
    if (!tech) return false;
    if (player.techs.includes(techId)) return false;
    if (tech.prereq && !player.techs.includes(tech.prereq)) return false;

    player.researching = techId;
    player.researchProgress = 0;
    G.addLog(`Researching ${tech.name}...`, 'log-tech');
    return true;
  },

  processResearch(player) {
    if (!player.researching) return;

    player.researchProgress += player.sciencePerTurn;
    const tech = TECH_TREE[player.researching];

    if (player.researchProgress >= tech.cost) {
      player.researchProgress = 0;
      player.techs.push(player.researching);
      const techName = tech.name;
      G.addLog(`Technology discovered: ${techName}!`, 'log-tech');
      CivAudio.play('tech');

      if (player.researching === 'engineering') {
        CivUnits.applyEngineeringBonus(player);
      }

      player.researching = null;

      const available = this.getAvailableTechs(player);
      if (available.length > 0) {
        if (!player.isHuman) {
          this.startResearch(player, available[0].id);
        } else {
          G.addLog('Choose a new technology to research.', 'log-tech');
        }
      }
    }
  },
};
