const SAVE_KEY = 'cluedo_save';

import { SUSPECTS, WEAPONS, ROOMS, dealCards, findSuspect, findWeapon, findRoom, findCard } from './cards.js';

function findCardImg(id, type) {
  if (type === 'suspect') return SUSPECTS.find(s => s.id === id)?.img;
  if (type === 'weapon') return WEAPONS.find(w => w.id === id)?.img;
  if (type === 'room') return ROOMS.find(r => r.id === id)?.img;
  return null;
}

function findCardType(id) {
  if (SUSPECTS.some(s => s.id === id)) return 'suspect';
  if (WEAPONS.some(w => w.id === id)) return 'weapon';
  if (ROOMS.some(r => r.id === id)) return 'room';
  return 'unknown';
}
import { Board } from './board.js';
import { AIPlayer } from './ai.js';
import { IntroPlayer } from './intro.js';

const STARTING_ROOMS = {
  scarlett: 'hall',
  mustard: 'dining',
  white: 'kitchen',
  green: 'conservatory',
  plum: 'study',
  peacock: 'lounge',
};

class Game {
  constructor() {
    this.players = [];
    this.humanPlayer = null;
    this.currentPlayerIndex = 0;
    this.murderFile = null;
    this.phase = 'start';
    this.diceValue = 0;
    this.hasMoved = false;
    this.hasSuggested = false;
    this.board = null;
    this.aiPlayers = {};
    this.notebooks = {};
    this.gameLog = [];
  }

  init() {
    this.renderCharacterSelect();
    this.setupStartButton();
    this.board = new Board(document.getElementById('game-board'));
    this.board.setRoomClickHandler((roomId) => this.handleRoomClick(roomId));

    document.getElementById('roll-dice-btn').addEventListener('click', () => this.rollDice());
    document.getElementById('suggest-btn').addEventListener('click', () => this.openSuggestionModal());
    document.getElementById('accuse-btn').addEventListener('click', () => this.openAccusationModal());
    document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('how-to-play-btn').addEventListener('click', () => this.showHowToPlay());
    document.getElementById('help-btn').addEventListener('click', () => this.showHowToPlay());
    document.getElementById('resume-game-btn').addEventListener('click', () => this.resumeGame());

    const intro = new IntroPlayer(() => {
      document.getElementById('start-screen').classList.remove('hidden');
      if (Game.hasSavedGame()) {
        document.getElementById('resume-game-btn').classList.remove('hidden');
      }
    });
    setTimeout(() => intro.play(), 300);
  }

  saveState() {
    if (this.phase !== 'playing' && this.phase !== 'gameover') return;
    const data = {
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      murderFile: this.murderFile,
      diceValue: this.diceValue,
      hasMoved: this.hasMoved,
      hasSuggested: this.hasSuggested,
      humanSuspectId: this.humanPlayer?.suspectId,
      gameLog: this.gameLog,
      notebooks: this.notebooks,
      players: this.players.map(p => ({
        id: p.id,
        suspectId: p.suspectId,
        name: p.name,
        color: p.color,
        img: p.img,
        isHuman: p.isHuman,
        position: p.position,
        eliminated: p.eliminated,
        cards: p.cards.map(c => ({ id: c.id, type: c.type })),
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static hasSavedGame() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  resumeGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    this.phase = data.phase;
    this.currentPlayerIndex = data.currentPlayerIndex;
    this.murderFile = data.murderFile;
    this.diceValue = data.diceValue;
    this.hasMoved = data.hasMoved;
    this.hasSuggested = data.hasSuggested;
    this.gameLog = data.gameLog;
    this.notebooks = data.notebooks;

    this.players = data.players.map(p => ({
      ...p,
      cards: p.cards.map(c => {
        const found = findCard(c.id, c.type);
        return { id: c.id, name: found ? found.name : c.id, type: c.type };
      }),
    }));
    this.humanPlayer = this.players.find(p => p.isHuman);

    this.aiPlayers = {};
    for (const player of this.players) {
      if (!player.isHuman) {
        this.aiPlayers[player.id] = new AIPlayer(player, this.notebooks);
      }
    }

    document.getElementById('start-screen').classList.add('hidden');
    this.board.render();
    this.board.updateTokens(this.players);
    this.renderPlayerCards();
    this.renderNotebook();

    for (const msg of this.gameLog) {
      this.log(msg.message, msg.type);
    }

    if (this.phase === 'playing') {
      this.startTurn();
    } else if (this.phase === 'gameover') {
      const winner = this.players.find(p => !p.eliminated) || this.players[0];
      this.showGameOverMessage(winner, false);
    }
  }

  renderCharacterSelect() {
    const container = document.getElementById('character-select');
    container.innerHTML = '';
    this.selectedChar = null;

    for (const suspect of SUSPECTS) {
      const option = document.createElement('div');
      option.className = 'char-option';
      option.dataset.id = suspect.id;
      option.innerHTML = `
        <img src="${suspect.img}" alt="${suspect.name}" loading="lazy">
        <span class="char-name">${suspect.name}</span>
      `;
      option.addEventListener('click', () => {
        container.querySelectorAll('.char-option').forEach(el => el.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedChar = suspect.id;
        this.playCharacterLine(suspect.id);
      });
      container.appendChild(option);
    }
  }

  playCharacterLine(charId) {
    const audio = new Audio(`sound/char-${charId}.mp3`);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }

  setupStartButton() {
    document.getElementById('start-game-btn').addEventListener('click', () => {
      if (!this.selectedChar) {
        this.log('Please select a character first!', 'danger');
        return;
      }
      this.startGame();
    });
  }

  startGame() {
    this.phase = 'playing';

    const deck = dealCards(6);
    const allSuspects = SUSPECTS.map(s => s.id);
    const allWeapons = WEAPONS.map(w => w.id);
    const allRooms = ROOMS.map(r => r.id);

    const murderSuspect = allSuspects[Math.floor(Math.random() * allSuspects.length)];
    const murderWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
    const murderRoom = allRooms[Math.floor(Math.random() * allRooms.length)];
    this.murderFile = { suspect: murderSuspect, weapon: murderWeapon, room: murderRoom };

    this.players = SUSPECTS.map((s, i) => ({
      id: i,
      suspectId: s.id,
      name: s.name,
      color: s.color,
      img: s.img,
      isHuman: s.id === this.selectedChar,
      position: STARTING_ROOMS[s.id],
      cards: deck[i],
      eliminated: false,
    }));

    this.humanPlayer = this.players.find(p => p.isHuman);
    this.currentPlayerIndex = 0;

    for (const player of this.players) {
      this.notebooks[player.id] = {};
      const notebook = this.notebooks[player.id];

      for (const s of SUSPECTS) {
        const has = player.cards.some(c => c.id === s.id && c.type === 'suspect');
        notebook[`suspect:${s.id}`] = has ? 'crossed' : 'unknown';
      }
      for (const w of WEAPONS) {
        const has = player.cards.some(c => c.id === w.id && c.type === 'weapon');
        notebook[`weapon:${w.id}`] = has ? 'crossed' : 'unknown';
      }
      for (const r of ROOMS) {
        const has = player.cards.some(c => c.id === r.id && c.type === 'room');
        notebook[`room:${r.id}`] = has ? 'crossed' : 'unknown';
      }
    }

    this.aiPlayers = {};
    for (const player of this.players) {
      if (!player.isHuman) {
        this.aiPlayers[player.id] = new AIPlayer(player, this.notebooks);
      }
    }

    document.getElementById('start-screen').classList.add('hidden');
    this.board.render();
    this.board.updateTokens(this.players);
    this.renderPlayerCards();
    this.renderNotebook();
    this.saveState();
    this.startTurn();
  }

  startTurn() {
    const player = this.players[this.currentPlayerIndex];
    this.hasMoved = false;
    this.hasSuggested = false;

    this.updateUI();

    if (player.eliminated) {
      this.log(`${player.name} is eliminated, skipping...`, 'info');
      this.nextTurn();
      return;
    }

    this.log(`--- ${player.name}'s turn ---`, 'info');

    if (player.isHuman) {
      document.getElementById('roll-dice-btn').disabled = false;
      document.getElementById('dice-result').textContent = '?';
      this.showActionButtons(false);
      this.board.clearHighlights();
      this.log('Roll the dice to move!', 'action');
    } else {
      document.getElementById('roll-dice-btn').disabled = true;
      this.showActionButtons(false);
      setTimeout(() => this.aiTurn(), 800);
    }
  }

  rollDice() {
    if (this.phase !== 'playing' || this.hasMoved) return;
    const player = this.players[this.currentPlayerIndex];
    if (!player.isHuman) return;

    new Audio('sound/dice-roll.mp3').play().catch(() => {});

    this.diceValue = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-result').textContent = this.diceValue;
    document.getElementById('roll-dice-btn').disabled = true;

    const rollMsg = this.diceValue === 6 ? '🎉 Rolled a 6!' : `🎲 Rolled a ${this.diceValue}`;
    this.log(rollMsg, 'action');

    const validMoves = Board.getValidMoves(player.position);
    this.board.highlightRooms(validMoves);
    this.log('Click a highlighted room to move there.', 'action');
  }

  handleRoomClick(roomId) {
    if (this.phase !== 'playing' || this.hasMoved) return;
    const player = this.players[this.currentPlayerIndex];
    if (!player.isHuman) return;

    const validMoves = Board.getValidMoves(player.position);
    if (!validMoves.includes(roomId)) return;

    this.movePlayer(this.currentPlayerIndex, roomId);
  }

  movePlayer(playerIndex, roomId) {
    const player = this.players[playerIndex];
    const oldRoom = player.position;
    player.position = roomId;
    this.hasMoved = true;

    const secretPassage = Board.getSecretPassage(roomId);
    const secretPassageFrom = Board.getSecretPassage(oldRoom);
    let moveMsg = `${player.name} moved to ${findRoom(roomId).name}`;
    if (secretPassage && secretPassageFrom === roomId) {
      moveMsg += ' (via secret passage!)';
    }
    this.log(moveMsg, 'action');

    this.board.clearHighlights();
    this.board.updateTokens(this.players, playerIndex);
    this.updateUI();

    if (player.isHuman) {
      this.showActionButtons(true);
      document.getElementById('suggest-btn').disabled = false;
      document.getElementById('accuse-btn').disabled = false;
    }
    this.saveState();
  }

  async aiTurn() {
    const player = this.players[this.currentPlayerIndex];
    if (player.eliminated) { this.nextTurn(); return; }

    const ai = this.aiPlayers[player.id];
    const validMoves = Board.getValidMoves(player.position);

    await this.sleep(600);
    this.diceValue = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-result').textContent = this.diceValue;
    this.log(`${player.name} rolled a ${this.diceValue}`, 'action');

    await this.sleep(500);
    const targetRoom = ai.chooseMove(validMoves);
    this.movePlayer(this.currentPlayerIndex, targetRoom);

    await this.sleep(500);

    const shouldSuggest = ai.shouldMakeSuggestion();
    if (shouldSuggest) {
      const suggestion = ai.chooseSuggestion(player.position);
      await this.handleSuggestion(player.id, suggestion.suspect, suggestion.weapon, suggestion.room);
    }

    await this.sleep(500);

    const knownSuspects = ai.getKnownCards('suspect');
    const knownWeapons = ai.getKnownCards('weapon');
    const knownRooms = ai.getKnownCards('room');
    const accusation = ai.shouldAccuse(knownSuspects, knownWeapons, knownRooms);
    if (accusation.should) {
      await this.handleAccusation(player.id, accusation.suspect, accusation.weapon, accusation.room);
      if (this.phase === 'gameover') return;
    }

    this.nextTurn();
  }

  async handleSuggestion(playerId, suspectId, weaponId, roomId) {
    const player = this.players[playerId];
    const suspect = findSuspect(suspectId);
    const weapon = findWeapon(weaponId);
    const room = findRoom(roomId);

    const suspectPlayer = this.players.find(p => p.suspectId === suspectId);
    if (suspectPlayer && !suspectPlayer.eliminated) {
      suspectPlayer.position = roomId;
      this.board.updateTokens(this.players, suspectPlayer.id);
    }

    this.log(`🔎 ${player.name} suggests it was ${suspect.name} in the ${room.name} with the ${weapon.name}!`, 'action');

    let evidenceFound = false;
    const playerOrder = this.getPlayerOrder(playerId);

    for (const pid of playerOrder) {
      const p = this.players[pid];
      if (p.id === playerId || p.eliminated) continue;

      let card = null;

      if (p.isHuman) {
        const matches = p.cards.filter(c =>
          c.id === suspectId || c.id === weaponId || c.id === roomId
        );
        if (matches.length > 0) {
          card = matches[0];
          evidenceFound = true;
          const shownCardId = await this.showEvidenceToHuman(p, card, player, suspectId, weaponId, roomId);
          if (shownCardId) {
            this.recordEvidence(playerId, { id: shownCardId, type: findCardType(shownCardId) });
          }
          break;
        }
      } else {
        const ai = this.aiPlayers[pid];
        if (ai) {
          card = ai.chooseEvidence(
            { suspect: suspectId, weapon: weaponId, room: roomId },
            p.cards
          );
          if (card) {
            evidenceFound = true;
            if (player.isHuman) {
              this.showEvidenceModal(p, card);
            } else {
              this.log(`${p.name} shows evidence!`, 'action');
              this.recordEvidence(playerId, card);
            }
            break;
          }
        }
      }
    }

    if (!evidenceFound) {
      this.log('No one could refute the suggestion...', 'info');
    }
    this.saveState();
    this.updateUI();
  }

  showEvidenceModal(showPlayer, card) {
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    const title = document.getElementById('modal-title');

    title.textContent = '🔎 Evidence!';
    const cardImg = findCardImg(card.id, card.type);
    body.innerHTML = `
      <p style="margin-bottom:1rem;">${showPlayer.name} shows you a card:</p>
      <div class="evidence-card">
        ${cardImg ? `<img src="${cardImg}" alt="${card.name}" style="width:60px;height:80px;object-fit:contain;">` : ''}
        <div>
          <div class="ev-label">${card.type.toUpperCase()}</div>
          <div class="ev-name">${card.name}</div>
        </div>
      </div>
    `;
    footer.innerHTML = `<button class="btn btn-primary" id="ev-ok-btn">OK</button>`;

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('ev-ok-btn').onclick = () => {
      this.closeModal();
      this.recordEvidence(this.humanPlayer.id, card);
    };
  }

  showEvidenceToHuman(showPlayer, card, suggestingPlayer, suspectId, weaponId, roomId) {
    return new Promise((resolve) => {
      const body = document.getElementById('modal-body');
      const footer = document.getElementById('modal-footer');
      const title = document.getElementById('modal-title');

      title.textContent = '🃏 Show Evidence';
      body.innerHTML = `
        <p>${suggestingPlayer.name} suggested:</p>
        <p style="margin-bottom:0.5rem;font-size:0.85rem;color:var(--text-muted);">
          Which card would you like to show?
        </p>
        <div class="select-card-grid">
          ${[suspectId, weaponId, roomId].filter(Boolean).map(cardId => {
            const c = findCard(cardId, 'suspect') || findCard(cardId, 'weapon') || findCard(cardId, 'room');
            const hasIt = showPlayer.cards.some(ca => ca.id === cardId);
            return `<div class="select-card-item ${hasIt ? '' : 'muted'}" data-card="${cardId}" data-has="${hasIt}" style="${hasIt ? 'cursor:pointer;' : 'opacity:0.4;'}">
              ${c ? c.name : cardId}
              ${hasIt ? ' ✅' : ' ❌'}
            </div>`;
          }).join('')}
        </div>
      `;
      footer.innerHTML = `<button class="btn btn-primary" id="ev-reveal-btn" disabled>Show Evidence</button>`;

      document.getElementById('modal-overlay').classList.remove('hidden');

      let selectedCardId = null;

      body.querySelectorAll('.select-card-item').forEach(el => {
        if (el.dataset.has === 'true') {
          el.addEventListener('click', () => {
            body.querySelectorAll('.select-card-item').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            selectedCardId = el.dataset.card;
            document.getElementById('ev-reveal-btn').disabled = false;
          });
        }
      });

      document.getElementById('ev-reveal-btn').onclick = () => {
        const cardToShow = showPlayer.cards.find(c => c.id === selectedCardId);
        if (cardToShow) {
          const revealImg = findCardImg(cardToShow.id, cardToShow.type);
          body.innerHTML = `
            <div class="evidence-card">
              ${revealImg ? `<img src="${revealImg}" alt="${cardToShow.name}" style="width:60px;height:80px;object-fit:contain;">` : ''}
              <div>
                <div class="ev-label">${cardToShow.type.toUpperCase()}</div>
                <div class="ev-name">${cardToShow.name}</div>
              </div>
            </div>
            <p style="margin-top:0.5rem;color:var(--text-muted);font-size:0.85rem;">
              (This card has been shown to ${suggestingPlayer.name})
            </p>
          `;
          footer.innerHTML = `<button class="btn btn-primary" id="ev-done-btn">OK</button>`;
          document.getElementById('ev-done-btn').onclick = () => {
            this.closeModal();
            this.log(`You showed ${cardToShow.name} to ${suggestingPlayer.name}`, 'info');
            resolve(cardToShow.id);
          };
        }
      };
    });
  }

  recordEvidence(playerId, card) {
    const notebook = this.notebooks[playerId];
    if (notebook) {
      notebook[`${card.type}:${card.id}`] = 'crossed';
    }
    this.renderNotebook();
    this.saveState();
  }

  openSuggestionModal() {
    if (this.phase !== 'playing' || !this.hasMoved || this.hasSuggested) return;
    const player = this.players[this.currentPlayerIndex];
    const room = player.position;

    this.openCardSelector(
      'Make a Suggestion',
      `You suggest it was... (in the ${findRoom(room).name})`,
      ['suspect', 'weapon'],
      (suspectId, weaponId) => this.handleSuggestion(this.currentPlayerIndex, suspectId, weaponId, room)
    );
  }

  openAccusationModal() {
    if (this.phase !== 'playing') return;

    this.openCardSelector(
      'Make an Accusation!',
      'Who do you accuse, with what weapon, and in which room?',
      ['suspect', 'weapon', 'room'],
      (suspectId, weaponId, roomId) => this.handleAccusation(this.currentPlayerIndex, suspectId, weaponId, roomId)
    );
  }

  openCardSelector(title, description, types, callback) {
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    const titleEl = document.getElementById('modal-title');

    titleEl.textContent = title;

    const selections = {};
    let html = `<p style="margin-bottom:1rem;color:var(--text-muted);">${description}</p>`;

    const typeLabels = { suspect: 'Suspect', weapon: 'Weapon', room: 'Room' };

    for (const type of types) {
      html += `<h4 style="margin:0.5rem 0 0.25rem;color:var(--primary);">Choose ${typeLabels[type]}</h4>`;
      html += `<div class="select-card-grid" data-type="${type}">`;
      const items = type === 'suspect' ? SUSPECTS : type === 'weapon' ? WEAPONS : ROOMS;
      for (const item of items) {
        const imgHtml = item.img ? `<img src="${item.img}" alt="${item.name}" style="width:40px;height:55px;object-fit:contain;display:block;margin:0 auto 4px;">` : '';
        html += `<div class="select-card-item" data-id="${item.id}" data-type="${type}">
          ${imgHtml}
          <span>${item.name}</span>
        </div>`;
      }
      html += `</div>`;
    }

    body.innerHTML = html;
    footer.innerHTML = `
      <button class="btn" id="selector-cancel">Cancel</button>
      <button class="btn btn-primary" id="selector-confirm" disabled>Confirm</button>
    `;

    const items = body.querySelectorAll('.select-card-item');
    items.forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type;
        const id = el.dataset.id;

        body.querySelectorAll(`.select-card-item[data-type="${type}"]`).forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selections[type] = id;

        const allSelected = types.every(t => selections[t]);
        document.getElementById('selector-confirm').disabled = !allSelected;
      });
    });

    document.getElementById('selector-cancel').onclick = () => this.closeModal();
    document.getElementById('selector-confirm').onclick = () => {
      const args = types.map(t => selections[t]);
      callback(...args);
      this.closeModal();
      if (types.length === 2) {
        this.hasSuggested = true;
        this.showActionButtons(true);
        document.getElementById('suggest-btn').disabled = true;
      }
    };

    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  async handleAccusation(playerId, suspectId, weaponId, roomId) {
    const player = this.players[playerId];
    const suspect = findSuspect(suspectId);
    const weapon = findWeapon(weaponId);
    const room = findRoom(roomId);

    const isCorrect =
      suspectId === this.murderFile.suspect &&
      weaponId === this.murderFile.weapon &&
      roomId === this.murderFile.room;

    this.log(`⚖️ ${player.name} ACCUSES ${suspect.name} with the ${weapon.name} in the ${room.name}!`, 'danger');

    if (isCorrect) {
      this.clearSave();
      this.gameOver(player, true);
    } else {
      this.log(`❌ ${player.name}'s accusation was WRONG!`, 'danger');
      player.eliminated = true;
      this.board.updateTokens(this.players);
      this.updateUI();

      const alive = this.players.filter(p => !p.eliminated);

      if (player.isHuman) {
        this.log('You have been eliminated!', 'danger');
        if (alive.length <= 1) {
          this.clearSave();
          this.gameOver(alive[0], true);
        } else {
          this.saveState();
          this.showGameOverMessage(player, false);
        }
      } else {
        this.log(`${player.name} has been eliminated!`, 'danger');
        if (alive.length === 1) {
          this.clearSave();
          this.gameOver(alive[0], true);
          return;
        }
        this.saveState();
        this.closeModal();
      }
    }
  }

  gameOver(winner, solved) {
    this.phase = 'gameover';
    this.clearSave();
    const murderSuspect = findSuspect(this.murderFile.suspect);
    const murderWeapon = findWeapon(this.murderFile.weapon);
    const murderRoom = findRoom(this.murderFile.room);

    this.log(`🏆 ${winner.name} ${solved ? 'solved the murder!' : 'wins by default!'}`, 'success');
    this.log(`The truth: ${murderSuspect.name} with the ${murderWeapon.name} in the ${murderRoom.name}!`, 'danger');

    this.showGameOverMessage(winner, solved);
  }

  showGameOverMessage(player, solved) {
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    const title = document.getElementById('modal-title');

    const murderSuspect = findSuspect(this.murderFile.suspect);
    const murderWeapon = findWeapon(this.murderFile.weapon);
    const murderRoom = findRoom(this.murderFile.room);

    title.textContent = solved && player.isHuman ? '🎉 CASE SOLVED!' : player.isHuman ? '💀 CASE FAILED' : '🏆 GAME OVER';

    body.innerHTML = `
      <div class="game-over-content">
        <div class="result-icon">${solved && player.isHuman ? '🎉' : player.isHuman ? '💀' : '🏆'}</div>
        <h2>${solved && player.isHuman ? 'You solved the mystery!' : player.isHuman ? 'You were eliminated!' : `${player.name} wins!`}</h2>
        <div class="reveal">
          <h3>The Truth</h3>
          <p style="margin:0.5rem 0;font-size:1.1rem;">
            <span style="color:#cc2222;">${murderSuspect.name}</span>
            used the
            <span style="color:#c4a35a;">${murderWeapon.name}</span>
            in the
            <span style="color:#1a5a8a;">${murderRoom.name}</span>
          </p>
        </div>
      </div>
    `;
    footer.innerHTML = `<button class="btn btn-primary" id="play-again-btn">Play Again</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('play-again-btn').onclick = () => location.reload();

    this.showActionButtons(false);
    document.getElementById('roll-dice-btn').disabled = true;
  }

  nextTurn() {
    this.board.clearHighlights();
    let next = this.currentPlayerIndex;
    let attempts = 0;
    do {
      next = (next + 1) % this.players.length;
      attempts++;
    } while (this.players[next].eliminated && attempts < this.players.length);

    this.currentPlayerIndex = next;
    this.saveState();
    this.startTurn();
  }

  endTurn() {
    if (!this.hasMoved) return;
    this.nextTurn();
  }

  getPlayerOrder(startId) {
    const order = [];
    const startIdx = this.players.findIndex(p => p.id === startId);
    for (let i = 1; i < this.players.length; i++) {
      order.push(this.players[(startIdx + i) % this.players.length].id);
    }
    return order;
  }

  renderPlayerCards() {
    const container = document.getElementById('player-cards');
    container.innerHTML = '';

    if (!this.humanPlayer) return;

    for (const card of this.humanPlayer.cards) {
      const chip = document.createElement('span');
      chip.className = `card-chip ${card.type}`;
      const cardImg = findCardImg(card.id, card.type);
      if (cardImg) {
        const img = document.createElement('img');
        img.src = cardImg;
        img.alt = card.name;
        img.style.width = '20px';
        img.style.height = '26px';
        img.style.objectFit = 'contain';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '3px';
        chip.insertBefore(img, chip.firstChild);
      }
      chip.appendChild(document.createTextNode(card.name));
      container.appendChild(chip);
    }
  }

  renderNotebook() {
    const notebook = this.notebooks[this.humanPlayer?.id];
    if (!notebook) return;

    this.renderNoteCategory('suspect-notes', notebook, 'suspect', SUSPECTS.map(s => ({ id: s.id, name: s.name })));
    this.renderNoteCategory('weapon-notes', notebook, 'weapon', WEAPONS.map(w => ({ id: w.id, name: w.name })));
    this.renderNoteCategory('room-notes', notebook, 'room', ROOMS.map(r => ({ id: r.id, name: r.name })));
  }

  renderNoteCategory(containerId, notebook, type, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (const item of items) {
      const key = `${type}:${item.id}`;
      const status = notebook[key] || 'unknown';

      const el = document.createElement('div');
      el.className = `note-item ${status === 'crossed' ? 'crossed' : ''}`;
      el.dataset.key = key;
      el.dataset.status = status;

      el.innerHTML = `
        <span class="check">${status === 'crossed' ? '✕' : status === 'known' ? '✓' : ''}</span>
        <span class="name">${item.name}</span>
      `;

      el.addEventListener('click', () => {
        const current = notebook[key];
        if (current === 'unknown') notebook[key] = 'crossed';
        else if (current === 'crossed') notebook[key] = 'unknown';
        this.renderNotebook();
      });

      container.appendChild(el);
    }
  }

  showActionButtons(show) {
    document.getElementById('action-buttons').style.display = show ? 'flex' : 'none';
  }

  updateUI() {
    const turnIndicator = document.getElementById('turn-indicator');
    const player = this.players[this.currentPlayerIndex];

    turnIndicator.innerHTML = player
      ? `<div class="turn-player-icon" style="background:${player.color}"></div>
         <span>${player.name}${player.isHuman ? ' (You)' : ''}</span>`
      : 'Waiting...';

    this.renderPlayerCards();
    this.renderNotebook();
  }

  showHowToPlay() {
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    const title = document.getElementById('modal-title');
    title.textContent = '📖 How to Play Cluedo';

    body.innerHTML = `
      <div class="how-to-play">
        <h3><span class="section-icon">🎯</span>Objective</h3>
        <p>Someone has been murdered at <span class="rule-highlight">Tudor Mansion</span>!
        Find out <span class="rule-highlight">who</span> did it, <span class="rule-highlight">with what weapon</span>,
        and <span class="rule-highlight">in which room</span>. Make a correct accusation to win!</p>

        <h3><span class="section-icon">🎲</span>On Your Turn</h3>
        <ul>
          <li><strong>1. Roll the dice</strong> to see how far you can move</li>
          <li><strong>2. Click a highlighted room</strong> to move there (you can use secret passages too!)</li>
          <li><strong>3. Make a Suggestion</strong> about who did it and what weapon they used (in the room you're in)</li>
          <li><strong>4. End your turn</strong></li>
        </ul>

        <h3><span class="section-icon">🔎</span>Making Suggestions</h3>
        <p>Suggest a <span class="rule-highlight">suspect + weapon</span>. The suggested suspect is moved to your room.
        Other players must show you one matching card if they have it. This lets you <span class="rule-highlight">eliminate possibilities</span>!</p>

        <h3><span class="section-icon">📝</span>Your Notebook</h3>
        <p>The notebook tracks cards you've seen. Click items to mark them as <span class="rule-highlight">crossed off</span>.
        Cards in your hand are already marked. Use this to deduce what's left!</p>

        <h3><span class="section-icon">⚖️</span>Making an Accusation</h3>
        <p>Accuse a <span class="rule-highlight">suspect + weapon + room</span>. If you're right, you <span class="rule-highlight">win!</span>
        If you're wrong, you're <span class="rule-highlight">eliminated</span> (but keep watching!).</p>

        <h3><span class="section-icon">🤖</span>AI Opponents</h3>
        <p>The other 5 detectives are AI-controlled. They'll move, suggest, and accuse just like you.
        Watch what they suggest to gather clues!</p>

        <h3><span class="section-icon">🔑</span>Secret Passages</h3>
        <p>Kitchen ↔ Study &amp; Conservatory ↔ Lounge have secret passages allowing instant travel between them.</p>
      </div>
    `;
    footer.innerHTML = `<button class="btn btn-primary" id="htp-close-btn">Got it!</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('htp-close-btn').onclick = () => this.closeModal();
  }

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  log(message, type = 'info') {
    const container = document.getElementById('game-messages');
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.textContent = message;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    this.gameLog.push({ message, type });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const game = new Game();
document.addEventListener('DOMContentLoaded', () => game.init());
