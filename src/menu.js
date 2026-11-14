import { t, translateText, getLanguage, setLanguage } from './i18n.js';
import { MAPS, MAP, MAP_ID } from '../shared/layout.js';
import { PHASES, RULES } from '../shared/rules.js';

const $ = (id) => document.getElementById(id);
const CHARACTERS = ['Dana', 'Eli', 'Maya', 'Porter', 'Vale', 'Member A'];


const clock = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const guideCopy = {
  'pt-PT': {
    title: 'Como jogar', back: 'Voltar ao menu', language: 'Idioma do guia',
    tabs: ['Resumo', 'Operativos', 'Echoes', 'Dia e noite', 'Controlos', 'Vitória'],
    titles: ['Não confies em todos', 'Liga três transmissores e prepara a fuga', 'Alimenta-te sem levantar suspeitas', 'A primeira noite chega aos cinco minutos', 'Um alvo, uma ação', 'A tua equipa vence contigo'],
    intro: '<p>Seis jogadores estão presos. Quatro são Operativos. Dois são Echoes que fingem ser humanos. Observa o comportamento dos outros e decide em quem confiar.</p><ol><li>Ativa os três transmissores.</li><li>Explora durante cinco minutos antes da primeira caçada.</li><li>Sobrevive às noites e evacua na fase final.</li></ol><p>Os lugares livres podem ser preenchidos por bots identificados na sala.</p>',
    operatives: `<ol><li>Aponta para uma célula de energia e carrega em E para a recolher. Levas uma de cada vez. R larga-a para um aliado.</li><li>Instala-a no transmissor da zona e mantém E para reparar. Sozinho demora ${RULES.repairTime} s, com ajuda demora ${RULES.cooperativeRepairTime} s.</li><li>Fica atento aos outros. Cada novo dia abre outra zona; as anteriores continuam acessíveis.</li><li>Usa o sinalizador para atrasar monstros. Mantém E num aliado abatido durante ${RULES.reviveTime} s para o reanimar.</li></ol><p>As armas ficam disponíveis na primeira noite. A partir daí, os tiros também ferem aliados.</p>`,
    echoes: `<p>Conheces o teu parceiro. Ajuda a equipa a acreditar que és humano enquanto procuras fontes de sangue discretas no cenário.</p><ul><li>Mantém E numa fonte durante ${RULES.bloodTime} s para absorver sangue. Cada fonte só pode ser drenada uma vez.</li><li>Precisas de ${RULES.transformThreshold} de energia para te transformares durante a noite. F permite uma transformação por noite e gasta ${RULES.transformCost} de energia.</li><li>A forma monstruosa consome energia. Podes voltar à forma humana com F, mas só poderás transformar-te novamente noutra noite.</li><li>Usa a garra com clique. Para executar um abatido, mantém E durante ${RULES.executeTime} s. Dano ou um sinalizador podem interromper-te.</li></ul><p>Esperar parado durante o primeiro dia dá cerca de ${Math.round(PHASES.find(p => p.id === 'day1').duration * RULES.passiveEnergy)} de energia. Procura sangue antes da primeira noite.</p>`,
    day: '<p>Há 20 segundos de preparação antes de o relógio começar. Reparar preserva o tempo para explorar. Cada fase avança pelo relógio.</p>',
    phaseNames: ['Dia 1 · Exploração segura', 'Noite 1 · Primeira caçada', 'Dia 2 · Abre a zona 2', 'Noite 2 · Segunda caçada', 'Dia 3 · Abre a zona 3', 'Caçada final · Extração'],
    dayEnd: `<p>Na caçada final, a extração aquece durante ${RULES.extractWarmup} s. Abre quando os três transmissores estiverem ativos. Um Operativo de pé permanece ${RULES.extractTime} s na área para evacuar.</p>`,
    controls: [
      ['WASD / rato / roda', 'Mover / olhar / aproximar a câmara'], ['Shift / C / Espaço', 'Correr / agachar / saltar'],
      ['E', 'Aponta e interage. Mantém para reparar, reanimar, drenar ou executar.'], ['R', 'Largar a célula de energia'],
      ['Clique / Q / G', 'Disparar ou garra / kit médico / sinalizador'], ['F', 'Transformar ou regressar à forma humana (Echo)'],
      ['Z (premir)', 'Falar por proximidade. Ativa o microfone nas definições.'], ['Enter / T', 'Texto de proximidade / texto privado Echo'],
      ['1–4 / Esc', 'Qualidade / menu'],
    ],
    controlsEnd: '<p>Andar agachado é silencioso. Os sons e as vozes indicam direção e distância. Podes regular o áudio e silenciar jogadores na sala.</p>',
    victory: '<p><strong>Operativos</strong> vencem se pelo menos um evacuar na fase final com os três transmissores ativos. Também vencem ao eliminar definitivamente os dois Echoes depois de começar a primeira noite.</p><p><strong>Echoes</strong> vencem ao eliminar todos os Operativos sem evacuação, ou ao terminar a caçada final sem ninguém evacuado.</p><p>Ficar abatido dá uma oportunidade de salvamento. Um aliado pode reanimar-te; se morreres, acompanhas o resto da partida como espetador.</p>',
  },
  en: {
    title: 'How to play', back: 'Back to menu', language: 'Guide language',
    tabs: ['Summary', 'Operatives', 'Echoes', 'Day & night', 'Controls', 'Victory'],
    titles: ['Choose your allies carefully', 'Power three transmitters and prepare to leave', 'Feed without drawing attention', 'The first hunt starts after five minutes', 'One target, one action', 'Help your team survive'],
    intro: '<p>Six players are trapped together. Four are Operatives. Two are Echoes pretending to be human. Watch what people do and decide who to trust.</p><ol><li>Activate all three transmitters.</li><li>Explore for five minutes before the first hunt.</li><li>Survive the nights and evacuate in the final hunt.</li></ol><p>Empty seats can be filled by bots labelled in the room.</p>',
    operatives: `<ol><li>Aim at an energy cell and press E to take it. Carry one at a time. Press R to drop it for a teammate.</li><li>Install it at the sector transmitter, then hold E to repair. It takes ${RULES.repairTime} s alone or ${RULES.cooperativeRepairTime} s with help.</li><li>Watch the other players. Each new day opens another sector; earlier sectors remain accessible.</li><li>Use a flare to delay monsters. Hold E on a downed ally for ${RULES.reviveTime} s to revive them.</li></ol><p>Weapons become available on the first night. From then on, shots can also hurt teammates.</p>`,
    echoes: `<p>You know your partner. Blend in with the team while looking for discreet blood sources around the map.</p><ul><li>Hold E at a source for ${RULES.bloodTime} s to drain it. Each source can be used once per match.</li><li>You need ${RULES.transformThreshold} energy to transform at night. F allows one transformation per night and spends ${RULES.transformCost} energy.</li><li>Monster form drains energy. Press F to return to human form; you must wait for another night to transform again.</li><li>Click to strike. Hold E for ${RULES.executeTime} s to execute a downed player. Damage or a flare can interrupt you.</li></ul><p>Waiting through the first day gives roughly ${Math.round(PHASES.find(p => p.id === 'day1').duration * RULES.passiveEnergy)} energy. Find blood before the first hunt.</p>`,
    day: '<p>A 20-second preparation comes before the match clock. Repairing gives you time to explore. Phases advance on a fixed clock.</p>',
    phaseNames: ['Day 1 · Safe exploration', 'Night 1 · First hunt', 'Day 2 · Sector 2 opens', 'Night 2 · Second hunt', 'Day 3 · Sector 3 opens', 'Final hunt · Extraction'],
    dayEnd: `<p>Extraction needs ${RULES.extractWarmup} s to warm up during the final hunt and opens once all three transmitters are active. An Operative on their feet must remain in the area for ${RULES.extractTime} s to evacuate.</p>`,
    controls: [
      ['WASD / mouse / wheel', 'Move / look / zoom camera'], ['Shift / C / Space', 'Sprint / crouch / jump'],
      ['E', 'Aim and interact. Hold to repair, revive, drain or execute.'], ['R', 'Drop the energy cell'],
      ['Click / Q / G', 'Fire or claw / medical kit / flare'], ['F', 'Transform or return to human form (Echo)'],
      ['Z (hold)', 'Proximity voice. Enable your microphone in settings.'], ['Enter / T', 'Proximity text / private Echo text'],
      ['1–4 / Esc', 'Quality / menu'],
    ],
    controlsEnd: '<p>Crouched footsteps are silent. Sounds and voices have direction and distance. Adjust the mix in settings and mute individual players in the room.</p>',
    victory: '<p><strong>Operatives</strong> win if at least one evacuates in the final hunt with all three transmitters active. They also win by permanently eliminating both Echoes once the first night has begun.</p><p><strong>Echoes</strong> win if all Operatives die without an evacuation, or if the final hunt ends before anyone escapes.</p><p>A downed player can still be saved. An ally can revive you; after death, you watch the remaining match as a spectator.</p>',
  },
};

export function createMenu({ game, enter, openMenu, setQuality }) {
  const entry = $('entry'), name = $('name'), play = $('play'), start = $('start'), resume = $('resume');
  let onlineStatus='connecting';
  let host=0;
  let phase = 'lobby', players = [], previewChoice = null, member = false;
  try { name.value = localStorage.getItem('bs.name') || ''; } catch {}

  const guide = $('guide'), matchMenu = $('match-menu'), guideOpen = $('how-to-play');
  const language = $('guide-language'), tabs = $('guide-tabs'), pages = $('guide-pages');
  let guideTab = 0, previousFocus = null;
  try {
    language.value = getLanguage();
    $('tips-enable').checked = localStorage.getItem('bs.tips') !== 'off';
  } catch {}
  $('tips-enable').addEventListener('change', event => {
    try { localStorage.setItem('bs.tips', event.target.checked ? 'on' : 'off'); } catch {}
  });

  function selectGuideTab(index, focus = false) {
    guideTab = index;
    [...tabs.children].forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      pages.children[i].hidden = i !== index;
    });
    if (focus) tabs.children[index].focus();
  }

  function renderGuide() {
    const copy = guideCopy[language.value];
    guide.lang = language.value;
    $('guide-heading').textContent = copy.title;
    $('guide-close').textContent = copy.back;
    $('guide-language-label').textContent = copy.language;
    let elapsed = 0;
    const timeline = PHASES.filter(phase => phase.id !== 'prep').map((phase, i) => {
      const start = elapsed;
      elapsed += phase.duration;
      return `<dt>${clock(start)}–${clock(elapsed)}</dt><dd>${copy.phaseNames[i]}</dd>`;
    }).join('');
    const controlRows = copy.controls.map(([key, action]) => `<dt>${key}</dt><dd>${action}</dd>`).join('');
    const sections = [
      copy.intro, copy.operatives, copy.echoes,
      copy.day + `<dl class="guide-timeline">${timeline}</dl>` + copy.dayEnd,
      `<dl class="controls">${controlRows}</dl>` + copy.controlsEnd,
      copy.victory,
    ];
    tabs.replaceChildren();
    pages.replaceChildren();
    copy.tabs.forEach((label, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.id = `guide-tab-${i}`; button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `guide-page-${i}`);
      button.textContent = label;
      button.addEventListener('click', () => selectGuideTab(i));
      const panel = document.createElement('section');
      panel.className = 'guide-panel'; panel.id = `guide-page-${i}`; panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id); panel.tabIndex = 0;
      panel.innerHTML = `<h3>${copy.titles[i]}</h3>${sections[i]}`;
      tabs.append(button); pages.append(panel);
    });
    selectGuideTab(guideTab);
  }

  function showGuide(index) {
    previousFocus = document.activeElement;
    guide.hidden = false; matchMenu.hidden = true;
    $('menu').classList.add('showing-guide');
    guideOpen.setAttribute('aria-expanded', 'true');
    if (index !== undefined) selectGuideTab(index);
    $('guide-heading').tabIndex = -1;
    $('guide-heading').focus();
    guide.scrollIntoView({ block: 'nearest' });
  }

  function closeGuide(restoreFocus = true) {
    guide.hidden = true; matchMenu.hidden = false;
    $('menu').classList.remove('showing-guide');
    guideOpen.setAttribute('aria-expanded', 'false');
    if (restoreFocus) previousFocus?.focus();
  }

  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.children.length - 1
      : (guideTab + (event.key === 'ArrowRight' ? 1 : -1) + tabs.children.length) % tabs.children.length;
    selectGuideTab(next, true);
  });
  guideOpen.addEventListener('click', () => guide.hidden ? showGuide(0) : closeGuide());
  $('guide-controls').addEventListener('click', () => showGuide(4));
  $('guide-close').addEventListener('click', () => closeGuide());
  guide.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGuide(); }
  });
  language.addEventListener('change', () => {
    setLanguage(language.value);
  });
  renderGuide();

  const cards = Object.entries(MAPS).map(([id, map]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-card';
    card.dataset.map = id;
    card.innerHTML = `<img src="./assets/ui/map_${id}.jpg" width="640" height="360" alt="">
      <span class="map-caption"><strong>${translateText(map.name)}</strong><small>${translateText(map.sub)}</small></span>`;
    card.addEventListener('click', () => {
      if (!member) previewChoice = id;
      game.setMap(id);
      renderMap();
    });
    $('maps').append(card);
    return card;
  });
  $('map-count').textContent = t('{count} MAPS', {count:cards.length});

  const seats = CHARACTERS.map((character, slot) => {
    const seat = document.createElement('li');
    seat.innerHTML = `<span class="seat-number">${String(slot + 1).padStart(2, '0')}</span>
      <div><strong class="seat-player"></strong><span class="seat-character">${character}</span></div>
      <span class="seat-tag" hidden></span>
      <button class="seat-audio" type="button" aria-pressed="false" hidden>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path d="m16 9 6 6m0-6-6 6"/>
        </svg>
      </button>`;
    $('lobby').append(seat);
    const mute = seat.querySelector('.seat-audio');
    mute.addEventListener('click', () => {
      const muted = mute.getAttribute('aria-pressed') !== 'true';
      mute.setAttribute('aria-pressed', String(muted));
      const player = players.find(p => p.slot === slot);
      if (!player) return;
      mute.title = t(muted ? 'Unmute {name}' : 'Mute {name}', {name:player.name});
      mute.setAttribute('aria-label', mute.title);
      window.dispatchEvent(new CustomEvent('voice-mute', { detail: { id: player.id, muted } }));
    });
    return { seat, playerName: seat.querySelector('.seat-player'), tag: seat.querySelector('.seat-tag'), mute };
  });

  const running = () => phase !== 'lobby' && phase !== 'end';
  function renderMap() {
    for (const card of cards) {
      card.setAttribute('aria-pressed', String(card.dataset.map === MAP_ID));
      card.disabled = member && (running() || host !== game.me.id);
    }
    $('selection').textContent = member && running()
      ? t('{map} · selection locked during the match',{map:translateText(MAP.name)})
      : t('{map} selected',{map:translateText(MAP.name)});
  }

  function renderRoom() {
    entry.hidden = member;
    $('room').hidden = !member;
    start.hidden = running();
    resume.hidden = !running();
    if (!member) return;
    resume.textContent = game.me.spectator ? t("WATCH MATCH") : t("RETURN TO MATCH");
    for (const [slot, { seat, playerName, tag, mute }] of seats.entries()) {
      const player = players.find(p => p.slot === slot);
      const ownSlot = player?.id === game.me.id;
      seat.className = player ? (ownSlot ? 'seat mine' : 'seat') : 'seat free';
      playerName.textContent = player?.bot ? player.name.replace(/^BOT\s+/, '') : player?.name || t("Empty seat");
      playerName.title = playerName.textContent;
      tag.hidden = !player?.bot && !ownSlot;
      tag.textContent = player?.bot ? 'BOT' : ownSlot ? t("YOU") : '';
      mute.hidden = !player || player.bot || ownSlot;
      if (mute.dataset.player !== String(player?.id)) {
        mute.dataset.player = String(player?.id);
        mute.setAttribute('aria-pressed', 'false');
      }
      mute.title = t(mute.getAttribute('aria-pressed') === 'true' ? 'Unmute {name}' : 'Mute {name}',{name:player?.name || ''});
      mute.setAttribute('aria-label', mute.title);
    }
    const occupied = players.filter(p => p.slot < seats.length).length;
    $('room-count').textContent = t('{count} / {total} SEATS',{count:occupied,total:seats.length});
    $('room-status').textContent = running() ? t("Match in progress")
      : game.me.spectator ? t("Waiting for a seat in the room.")
      : seats.length > occupied ? t("Bots fill empty seats when the match starts.") : t("Room ready.");
  }

  function connection(status) {
    onlineStatus=status;
    $('net').dataset.state = status;
    $('net').textContent = status === 'online' ? t("SERVER ONLINE") : t("SERVER UNAVAILABLE");
    play.disabled = status === 'connecting';
    play.textContent = status === 'offline' ? t('EXPLORE IN FREE ROAM') : t('JOIN ROOM');
    if (status === 'offline') {
      member = false;
      phase = 'lobby';
      play.textContent = t("EXPLORE IN FREE ROAM");
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
    phase = message.phase; host=message.host??game.me.id;
    players = message.players;
    renderRoom();
    renderMap();
  }

  function matchStart() {
    closeGuide(false);
    $('result').hidden = true;
    if (!game.me.spectator) enter(false);
  }

  function matchEnd({ winner }) {
    phase = 'end';
    closeGuide(false);
    $('endTitle').textContent = winner === 'operatives' ? t("The Operatives won") : t("The Echoes won");
    $('result-map').textContent = translateText(MAP.name);
    $('result').hidden = false;
    renderRoom();
    renderMap();
    openMenu();
    $('endTitle').tabIndex = -1;
    $('endTitle').focus();
  }

  entry.addEventListener('submit', (event) => {
    event.preventDefault();
    const playerName = name.value.trim() || t("Player");
    try { localStorage.setItem('bs.name', playerName); } catch {}
    if (game.online) { play.disabled = true; game.join(playerName); }
    else enter(true);
  });
  start.addEventListener('click', () => {
    game.start();
    if (!game.me.spectator) enter(true);
  });
  resume.addEventListener('click', () => enter(true));
  $('quality').addEventListener('change', (event) => setQuality(Number(event.target.value)));
  renderMap();
  window.addEventListener('language-change', () => {
    language.value = getLanguage(); renderGuide(); renderMap(); renderRoom();
    $('map-count').textContent = t('{count} MAPS', {count:cards.length});
    for (const card of cards) {
      const map=MAPS[card.dataset.map];
      card.querySelector('strong').textContent=translateText(map.name);
      card.querySelector('small').textContent=translateText(map.sub);
    }
    connection(onlineStatus);
  });
  return { connection, joined, lobby, matchStart, matchEnd };
}
