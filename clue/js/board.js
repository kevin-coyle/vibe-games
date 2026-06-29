import { SUSPECTS, ROOMS } from './cards.js';

const CONNECTIONS = {
  kitchen: ['ballroom', 'study'],
  ballroom: ['kitchen', 'conservatory', 'dining'],
  conservatory: ['ballroom', 'cellar'],
  dining: ['ballroom', 'cellar', 'lounge'],
  cellar: ['conservatory', 'dining', 'library'],
  library: ['cellar', 'hall'],
  hall: ['library', 'lounge', 'study'],
  lounge: ['dining', 'hall'],
  study: ['kitchen', 'hall'],
};

const SECRET_PASSAGES = {
  kitchen: 'study',
  study: 'kitchen',
  conservatory: 'lounge',
  lounge: 'conservatory',
};

const ROOM_ORDER = ['kitchen', 'ballroom', 'conservatory', 'dining', 'cellar', 'library', 'hall', 'lounge', 'study'];

const BOARD_POSITIONS = {
  kitchen: { col: 0, row: 0 },
  ballroom: { col: 1, row: 0 },
  conservatory: { col: 2, row: 0 },
  dining: { col: 0, row: 1 },
  cellar: { col: 1, row: 1 },
  library: { col: 2, row: 1 },
  hall: { col: 0, row: 2 },
  lounge: { col: 1, row: 2 },
  study: { col: 2, row: 2 },
};

class Board {
  constructor(container) {
    this.container = container;
    this.roomElements = {};
    this.playerPositions = {};
    this.highlightedRooms = [];
  }

  render() {
    this.container.innerHTML = '';
    this.roomElements = {};

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const room = ROOM_ORDER.find(
          r => BOARD_POSITIONS[r].col === col && BOARD_POSITIONS[r].row === row
        );

        const cell = document.createElement('div');
        cell.className = 'room-cell';

        if (!room) {
          cell.classList.add('center-cell');
          cell.innerHTML = `
            <span style="font-size:2rem;">🕵️</span>
            <span class="room-name">Tudor Mansion</span>
          `;
        } else {
          const roomData = ROOMS.find(r => r.id === room);
          cell.dataset.roomId = room;
          cell.style.backgroundImage = `url(${roomData.img})`;
          cell.style.backgroundSize = 'cover';
          cell.style.backgroundPosition = 'center';
          cell.innerHTML = `
            <div class="room-label">
              <span class="room-name">${roomData.name}</span>
            </div>
            <div class="player-tokens" id="tokens-${room}"></div>
          `;

          cell.addEventListener('click', () => this.onRoomClick(room));
          this.roomElements[room] = cell;
        }

        this.container.appendChild(cell);
      }
    }

    this.renderSecretPassages();
  }

  renderSecretPassages() {
    const kitchenEl = this.roomElements['kitchen'];
    const studyEl = this.roomElements['study'];
    const conservatoryEl = this.roomElements['conservatory'];
    const loungeEl = this.roomElements['lounge'];

    if (kitchenEl && studyEl) {
      const p1 = document.createElement('div');
      p1.className = 'secret-passage';
      p1.textContent = '🔑';
      p1.style.top = '8px';
      p1.style.left = '50%';
      p1.title = 'Secret passage: Kitchen ↔ Study';
      kitchenEl.appendChild(p1);

      const p2 = document.createElement('div');
      p2.className = 'secret-passage';
      p2.textContent = '🔑';
      p2.style.bottom = '8px';
      p2.style.left = '50%';
      p2.title = 'Secret passage: Study ↔ Kitchen';
      studyEl.appendChild(p2);
    }

    if (conservatoryEl && loungeEl) {
      const p3 = document.createElement('div');
      p3.className = 'secret-passage';
      p3.textContent = '🌿';
      p3.style.bottom = '8px';
      p3.style.right = '8px';
      p3.title = 'Secret passage: Conservatory ↔ Lounge';
      conservatoryEl.appendChild(p3);

      const p4 = document.createElement('div');
      p4.className = 'secret-passage';
      p4.textContent = '🌿';
      p4.style.top = '8px';
      p4.style.right = '8px';
      p4.title = 'Secret passage: Lounge ↔ Conservatory';
      loungeEl.appendChild(p4);
    }
  }

  updateTokens(players, movingPlayerId) {
    for (const roomId of ROOM_ORDER) {
      const tokensContainer = document.getElementById(`tokens-${roomId}`);
      if (!tokensContainer) continue;
      tokensContainer.innerHTML = '';
    }

    for (const player of players) {
      if (player.eliminated) continue;
      const roomId = player.position;
      const tokensContainer = document.getElementById(`tokens-${roomId}`);
      if (!tokensContainer) continue;

      const token = document.createElement('img');
      token.className = 'player-token' + (player.isHuman ? ' human' : '');
      token.src = player.img;
      token.alt = player.name;
      token.title = player.name;
      if (movingPlayerId !== undefined && player.id === movingPlayerId) {
        token.classList.add('token-arrive');
      }
      tokensContainer.appendChild(token);
    }
  }

  highlightRooms(roomIds) {
    this.clearHighlights();
    this.highlightedRooms = roomIds;
    for (const id of roomIds) {
      const el = this.roomElements[id];
      if (el) el.classList.add('highlighted');
    }
  }

  clearHighlights() {
    for (const id of this.highlightedRooms) {
      const el = this.roomElements[id];
      if (el) el.classList.remove('highlighted');
    }
    this.highlightedRooms = [];
  }

  onRoomClick(roomId) {
    if (this.roomClickHandler) {
      this.roomClickHandler(roomId);
    }
  }

  setRoomClickHandler(handler) {
    this.roomClickHandler = handler;
  }

  static getConnections(roomId) {
    return CONNECTIONS[roomId] || [];
  }

  static getSecretPassage(roomId) {
    return SECRET_PASSAGES[roomId] || null;
  }

  static getValidMoves(roomId) {
    const moves = [...(CONNECTIONS[roomId] || [])];
    const secret = SECRET_PASSAGES[roomId];
    if (secret) moves.push(secret);
    return moves;
  }
}

export { Board, CONNECTIONS, SECRET_PASSAGES, ROOM_ORDER };
