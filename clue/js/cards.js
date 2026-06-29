const SUSPECTS = [
  { id: 'scarlett', name: 'Miss Scarlett', color: '#cc2222', img: 'img/scarlett.png' },
  { id: 'mustard', name: 'Colonel Mustard', color: '#c4a35a', img: 'img/mustard.png' },
  { id: 'white', name: 'Mrs White', color: '#cccccc', img: 'img/white.png' },
  { id: 'green', name: 'Mr Green', color: '#2d7a2d', img: 'img/green.png' },
  { id: 'plum', name: 'Professor Plum', color: '#5a2d7a', img: 'img/plum.png' },
  { id: 'peacock', name: 'Mrs Peacock', color: '#1a5a8a', img: 'img/peacock.png' },
];

const WEAPONS = [
  { id: 'candlestick', name: 'Candlestick', img: 'img/candlestick.png' },
  { id: 'dagger', name: 'Dagger', img: 'img/dagger.png' },
  { id: 'pipe', name: 'Lead Pipe', img: 'img/pipe.png' },
  { id: 'revolver', name: 'Revolver', img: 'img/revolver.png' },
  { id: 'rope', name: 'Rope', img: 'img/rope.png' },
  { id: 'wrench', name: 'Wrench', img: 'img/wrench.png' },
];

const ROOMS = [
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', img: 'img/kitchen.png' },
  { id: 'ballroom', name: 'Ballroom', icon: '💃', img: 'img/ballroom.png' },
  { id: 'conservatory', name: 'Conservatory', icon: '🌿', img: 'img/conservatory.png' },
  { id: 'dining', name: 'Dining Room', icon: '🍽️', img: 'img/dining.png' },
  { id: 'cellar', name: 'Cellar', icon: '🍷', img: 'img/cellar.png' },
  { id: 'library', name: 'Library', icon: '📚', img: 'img/library.png' },
  { id: 'hall', name: 'Hall', icon: '🚪', img: 'img/hall.png' },
  { id: 'lounge', name: 'Lounge', icon: '🛋️', img: 'img/lounge.png' },
  { id: 'study', name: 'Study', icon: '📖', img: 'img/study.png' },
];

let cardInstances = null;

function createCardInstances() {
  if (cardInstances) return cardInstances;
  cardInstances = {
    suspects: SUSPECTS.map(s => ({ ...s, type: 'suspect' })),
    weapons: WEAPONS.map(w => ({ ...w, type: 'weapon' })),
    rooms: ROOMS.map(r => ({ ...r, type: 'room' })),
  };
  return cardInstances;
}

function buildDeck() {
  const deck = [
    ...SUSPECTS.map(s => ({ id: s.id, name: s.name, type: 'suspect' })),
    ...WEAPONS.map(w => ({ id: w.id, name: w.name, type: 'weapon' })),
    ...ROOMS.map(r => ({ id: r.id, name: r.name, type: 'room' })),
  ];
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealCards(numPlayers) {
  const deck = shuffle(buildDeck());
  const hands = Array.from({ length: numPlayers }, () => []);
  let idx = 0;
  for (const card of deck) {
    hands[idx % numPlayers].push(card);
    idx++;
  }
  return hands;
}

function findSuspect(id) {
  return SUSPECTS.find(s => s.id === id);
}

function findWeapon(id) {
  return WEAPONS.find(w => w.id === id);
}

function findRoom(id) {
  return ROOMS.find(r => r.id === id);
}

function findCard(id, type) {
  if (type === 'suspect') return findSuspect(id);
  if (type === 'weapon') return findWeapon(id);
  if (type === 'room') return findRoom(id);
  return null;
}

export {
  SUSPECTS,
  WEAPONS,
  ROOMS,
  createCardInstances,
  buildDeck,
  shuffle,
  dealCards,
  findSuspect,
  findWeapon,
  findRoom,
  findCard,
};
