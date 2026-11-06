import { MAPS, MAP, MAP_ID } from '../shared/layout.js';

const $ = (id) => document.getElementById(id);
const CHARACTERS = ['Dana', 'Eli', 'Maya', 'Porter', 'Vale', 'Member A'];

export function createMenu({ game, enter, openMenu, applyStyle, setQuality }) {
  const entry = $('entry'), name = $('name'), play = $('play'), start = $('start'), resume = $('resume');
  let phase = 'lobby', players = [], previewChoice = null, member = false;
  try { name.value = localStorage.getItem('bs.name') || ''; } catch {}

  const cards = Object.entries(MAPS).map(([id, map]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-card';
    card.dataset.map = id;
    card.innerHTML = `<img src="./assets/ui/map_${id}.jpg" width="640" height="360" alt="">
      <span class="map-caption"><strong>${map.name}</strong><small>${map.sub}</small></span>`;
    card.addEventListener('click', () => {
      if (!member) previewChoice = id;
      game.setMap(id);
      renderMap();
    });
    $('maps').append(card);
    return card;
  });
  $('map-count').textContent = `${cards.length} MAPAS`;

  const seats = CHARACTERS.map((character, slot) => {
    const seat = document.createElement('li');
    seat.innerHTML = `<span class="seat-number">${String(slot + 1).padStart(2, '0')}</span>
      <div><strong class="seat-player"></strong><span class="seat-character">${character}</span></div>
      <span class="seat-tag" hidden></span>`;
    $('lobby').append(seat);
    return { seat, playerName: seat.querySelector('.seat-player'), tag: seat.querySelector('.seat-tag') };
  });

  const running = () => phase !== 'lobby' && phase !== 'end';
  function renderMap() {
    for (const card of cards) {
      card.setAttribute('aria-pressed', String(card.dataset.map === MAP_ID));
      card.disabled = member && running();
    }
    $('selection').textContent = member && running()
      ? `${MAP.name} · seleção bloqueada durante a partida`
      : `${MAP.name} selecionado`;
  }

  function renderRoom() {
    entry.hidden = member;
    $('room').hidden = !member;
    start.hidden = running();
    resume.hidden = !running();
    if (!member) return;
    resume.textContent = game.me.spectator ? 'ASSISTIR À PARTIDA' : 'VOLTAR À PARTIDA';
    for (const [slot, { seat, playerName, tag }] of seats.entries()) {
      const player = players.find(p => p.slot === slot);
      const ownSlot = player?.id === game.me.id;
      seat.className = player ? (ownSlot ? 'seat mine' : 'seat') : 'seat free';
      playerName.textContent = player?.bot ? player.name.replace(/^BOT\s+/, '') : player?.name || 'Lugar livre';
      playerName.title = playerName.textContent;
      tag.hidden = !player?.bot && !ownSlot;
      tag.textContent = player?.bot ? 'BOT' : ownSlot ? 'TU' : '';
    }
    const occupied = players.filter(p => p.slot < seats.length).length;
    $('room-count').textContent = `${occupied} / ${seats.length} LUGARES`;
    $('room-status').textContent = running() ? 'Partida a decorrer'
      : game.me.spectator ? 'A aguardar um lugar na sala.'
      : seats.length > occupied ? 'Os bots ocupam os lugares livres ao começar.' : 'Sala pronta.';
  }

  function connection(status) {
    $('net').dataset.state = status;
    $('net').textContent = status === 'online' ? 'SERVIDOR LIGADO' : 'SERVIDOR INDISPONÍVEL';
    play.disabled = false;
    if (status === 'offline') {
      member = false;
      phase = 'lobby';
      play.textContent = 'EXPLORAR EM MODO LIVRE';
      openMenu();
      renderRoom();
      renderMap();
    }
  }

  function joined() {
    member = true;
    if (previewChoice) game.setMap(previewChoice);
    previewChoice = null;
  }

  function lobby(message) {
    phase = message.phase;
    players = message.players;
    renderRoom();
    renderMap();
  }

  function matchStart() {
    $('result').hidden = true;
    if (!game.me.spectator) enter(false);
  }

  function matchEnd({ winner, roles }) {
    phase = 'end';
    $('endTitle').textContent = winner === 'operatives' ? 'Os Operativos venceram' : 'Os Echoes venceram';
    $('result-map').textContent = MAP.name;
    $('result').querySelector('details').open = false;
    $('result-roles').replaceChildren(...roles.map(({ name, role, st }) => {
      const item = document.createElement('li');
      item.className = role;
      const outcome = st === 3 ? ' · evacuou' : st === 2 ? ' · morreu' : '';
      item.textContent = `${name} · ${role === 'echo' ? 'Echo' : 'Operativo'}${outcome}`;
      return item;
    }));
    $('result').hidden = false;
    renderRoom();
    renderMap();
    openMenu();
    $('endTitle').tabIndex = -1;
    $('endTitle').focus();
  }

  entry.addEventListener('submit', (event) => {
    event.preventDefault();
    const playerName = name.value.trim() || 'Jogador';
    try { localStorage.setItem('bs.name', playerName); } catch {}
    if (game.online) { play.disabled = true; game.join(playerName); }
    else enter(true);
  });
  start.addEventListener('click', () => {
    game.start();
    if (!game.me.spectator) enter(true);
  });
  resume.addEventListener('click', () => enter(true));
  $('visual').addEventListener('change', (event) => applyStyle(event.target.value === 'normal'));
  $('quality').addEventListener('change', (event) => setQuality(Number(event.target.value)));
  renderMap();
  return { connection, joined, lobby, matchStart, matchEnd };
}
