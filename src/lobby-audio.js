import { t } from './i18n.js';
export const LOBBY_TRACKS = [
  { title: 'Factory Silence', file: 'lobby-factory.ogg' },
  { title: 'Autumn Forest', file: 'lobby-autumn.ogg' },
  { title: 'Autumn Forest', version: 'Alternate version', file: 'lobby-autumn-alt.ogg' },
];

export function createLobbyAudio(audio) {
  const slider = document.getElementById('volume-music');
  const nextButton = document.getElementById('music-next');
  const status = document.getElementById('music-status');
  const player = new Audio();
  player.preload = 'metadata';
  player.volume = 0;

  let waiting = false, unlocked = false, current = -1, freshTrack = false;
  let animation = 0, playRequest = 0, hoverAt = 0;
  let volume = Number(slider?.value ?? 35) / 100;
  try {
    const stored = localStorage.getItem('bs.volume.music');
    if (stored !== null && Number.isFinite(Number(stored))) volume = Math.max(0, Math.min(1, Number(stored) / 100));
  } catch {}
  audio.level('music',volume);
  if (slider) slider.value = String(Math.round(volume * 100));

  function label() {
    const track = LOBBY_TRACKS[current];
    return track ? track.title + (track.version ? ` · ${t(track.version)}` : '') : '';
  }

  function message(text) {
    if (status && status.textContent !== text) status.textContent = text;
  }

  function fade(target, done) {
    cancelAnimationFrame(animation);
    const start = performance.now(), from = player.volume;
    function frame(now) {
      const progress = Math.min(1, (now - start) / 1000);
      player.volume = Math.max(0, Math.min(1, from + (target - from) * progress));
      if (progress < 1) animation = requestAnimationFrame(frame);
      else { animation = 0; done?.(); }
    }
    animation = requestAnimationFrame(frame);
  }

  function chooseTrack() {
    const candidates = LOBBY_TRACKS.map((_, index) => index).filter(index => index !== current);
    current = candidates[Math.floor(Math.random() * candidates.length)];
    player.pause();
    player.volume = 0;
    player.src = new URL('../assets/audio/' + LOBBY_TRACKS[current].file, import.meta.url).href;
    freshTrack = false;
  }

  function play() {
    if (!waiting || !unlocked) return;
    if (current < 0 || freshTrack) chooseTrack();
    if (!player.paused) {
      fade(volume);
      return;
    }
    const request = ++playRequest;
    player.play().then(() => {
      if (request !== playRequest || !waiting) return;
      fade(volume);
      message(t('Now playing · {track}',{track:label()}));
    }).catch(error => {
      if (request !== playRequest || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        unlocked = false;
        message(t("Interact with the menu to hear music."));
      } else message(t("Could not play this track. Try the next one."));
    });
  }

  function wake() {
    audio.wake();
    unlocked = true;
    if (waiting && player.paused) play();
  }

  function next() {
    if (!waiting) return;
    wake();
    playRequest++;
    chooseTrack();
    play();
  }

  function update(value) {
    value = Boolean(value);
    if (waiting === value) return;
    waiting = value;
    if (nextButton) nextButton.disabled = !waiting;
    if (waiting) {
      if (unlocked) play();
      else message(t("Interact with the menu to hear music."));
    } else {
      playRequest++;
      freshTrack = true;
      fade(0, () => {
        if (!waiting) player.pause();
      });
      message(t("Lobby music pauses during the match."));
    }
  }

  slider?.addEventListener('input', () => {
    volume = Math.max(0, Math.min(1, Number(slider.value) / 100));
    audio.level('music',volume);
    try { localStorage.setItem('bs.volume.music', slider.value); } catch {}
    if (waiting && unlocked) {
      if (player.paused) play();
      else fade(volume);
    }
  });
  nextButton?.addEventListener('click', next);
  player.addEventListener('ended', () => {
    if (!waiting) return;
    freshTrack = true;
    play();
  });
  player.addEventListener('error', () => {
    if (waiting && current >= 0) message(t("Could not load this track. Try the next one."));
  });

  const controls = 'button, summary, select, a, input[type="range"], input[type="checkbox"]';
  function hover(event) {
    const control = event.target.closest?.(controls);
    if (!control || control.disabled || (event.relatedTarget instanceof Node && control.contains(event.relatedTarget))) return;
    const now = performance.now();
    if (now - hoverAt < 90) return;
    hoverAt = now;
    if (waiting || document.body.classList.contains('menu-open')) audio.cue('pickup', null, .16, 1.12);
  }
  document.addEventListener('pointerover', () => audio.wake(), {once:true});
  document.addEventListener('pointerover', hover);
  document.addEventListener('focusin', hover);
  document.addEventListener('pointerdown', wake);
  document.addEventListener('keydown', wake);
  document.addEventListener('click', event => {
    const control = event.target.closest?.(controls);
    if (control && !control.disabled && (waiting || document.body.classList.contains('menu-open'))) {
      audio.cue('fuse', null, .18, 1.08);
    }
  });

  window.addEventListener('language-change', () => {
    message(!waiting ? t('Lobby music pauses during the match.') : !unlocked ? t('Interact with the menu to hear music.') : t('Now playing · {track}',{track:label()}));
  });
  return { update, wake };
}
