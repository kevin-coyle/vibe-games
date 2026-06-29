import { SUSPECTS, WEAPONS, ROOMS } from './cards.js';
import { Board } from './board.js';

class AIPlayer {
  constructor(player, notebooks) {
    this.player = player;
    this.notebooks = notebooks;
    this.targetRoom = null;
  }

  chooseMove(validMoves) {
    const knownRooms = this.getKnownCards('room');
    const unknownMoves = validMoves.filter(r => !knownRooms.includes(r));
    if (unknownMoves.length > 0) {
      return unknownMoves[Math.floor(Math.random() * unknownMoves.length)];
    }
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  chooseSuggestion(currentRoom) {
    const knownSuspects = this.getKnownCards('suspect');
    const knownWeapons = this.getKnownCards('weapon');

    const unknownSuspects = SUSPECTS.filter(s => !knownSuspects.includes(s.id));
    const unknownWeapons = WEAPONS.filter(w => !knownWeapons.includes(w.id));

    const suspect = unknownSuspects.length > 0
      ? unknownSuspects[Math.floor(Math.random() * unknownSuspects.length)]
      : SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)];

    const weapon = unknownWeapons.length > 0
      ? unknownWeapons[Math.floor(Math.random() * unknownWeapons.length)]
      : WEAPONS[Math.floor(Math.random() * WEAPONS.length)];

    return { suspect: suspect.id, weapon: weapon.id, room: currentRoom };
  }

  shouldAccuse(knownSuspects, knownWeapons, knownRooms) {
    const unknownSuspects = SUSPECTS.filter(s => !knownSuspects.includes(s.id));
    const unknownWeapons = WEAPONS.filter(w => !knownWeapons.includes(w.id));
    const unknownRooms = ROOMS.filter(r => !knownRooms.includes(r.id));

    if (unknownSuspects.length === 1 && unknownWeapons.length === 1 && unknownRooms.length === 1) {
      return {
        suspect: unknownSuspects[0].id,
        weapon: unknownWeapons[0].id,
        room: unknownRooms[0].id,
        should: true,
      };
    }

    if (unknownSuspects.length === 1 && unknownWeapons.length === 1 && unknownRooms.length <= 2) {
      return {
        suspect: unknownSuspects[0].id,
        weapon: unknownWeapons[0].id,
        room: unknownRooms[Math.floor(Math.random() * unknownRooms.length)].id,
        should: true,
      };
    }

    return { should: false };
  }

  getKnownCards(type) {
    const notebook = this.notebooks[this.player.id];
    if (!notebook) return [];
    return Object.entries(notebook)
      .filter(([, v]) => v === 'crossed')
      .map(([key]) => {
        const parts = key.split(':');
        if (parts[0] === type) return parts[1];
        return null;
      })
      .filter(Boolean);
  }

  chooseEvidence(suggestions, hand) {
    const matches = hand.filter(c =>
      suggestions.suspect === c.id || suggestions.weapon === c.id || suggestions.room === c.id
    );
    if (matches.length === 0) return null;
    return matches[0];
  }

  shouldMakeSuggestion() {
    return Math.random() < 0.6;
  }
}

export { AIPlayer };
