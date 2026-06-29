const SCENE_TIMINGS = [
  { at: 0, sound: 'thunder' },
  { at: 8, sound: 'creak' },
  { at: 14, sound: 'sting' },
];

const SCENE_TEXTS = [
  { at: 0, text: 'Tudor Mansion. 1926.', subtitle: 'A night of mystery and deceit...', img: 'img/intro-mansion.png' },
  { at: 8, text: 'When the clock strikes midnight...', subtitle: 'A scream echoes through the halls.', img: 'img/intro-hallway.png' },
  { at: 14, text: 'Lord Tudor lies dead.', subtitle: 'The mansion is locked. No one can leave.', img: 'img/intro-crime.png' },
  { at: 21, text: 'Six suspects. Six weapons. Nine rooms.', subtitle: 'One of them is the killer.', img: 'img/intro-silhouette.png' },
];

class IntroPlayer {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.isPlaying = false;
    this.sceneIndex = -1;
    this.sfxPlayed = {};
    this.ended = false;
  }

  async init() {
    this.overlay = document.getElementById('intro-overlay');
    this.sceneEl = document.getElementById('intro-scene');
    this.textEl = document.getElementById('intro-text');
    this.subtitleEl = document.getElementById('intro-subtitle');
    this.titleEl = document.getElementById('intro-title');
    this.skipBtn = document.getElementById('intro-skip');
    this.startGameBtn = document.getElementById('intro-start-game');
    this.startPrompt = document.getElementById('intro-start-prompt');
    this.lightningEl = document.getElementById('intro-lightning');
    this.logoContainer = document.getElementById('intro-logo-container');
    this.logoImg = document.getElementById('intro-logo-img');
    this.logoLabel = document.getElementById('intro-logo-label');
    this.logoSub = document.getElementById('intro-logo-sub');
    this.startBtnShown = false;

    this.overlay.classList.remove('hidden');

    this.sounds = {
      thunder: await this.loadAudio('sound/thunder.mp3'),
      creak: await this.loadAudio('sound/creak.mp3'),
      sting: await this.loadAudio('sound/sting.mp3'),
      narration: await this.loadAudio('sound/narration.mp3'),
      bgmusic: await this.loadAudio('sound/bgmusic.mp3'),
    };

    await this.waitForClick();
    this.startPrompt.classList.add('hidden');

    this.skipBtn.addEventListener('click', () => this.skip());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === ' ') this.skip();
    });
  }

  waitForClick() {
    return new Promise((resolve) => {
      const done = () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', keyHandler);
        resolve();
      };
      const handler = (e) => { if (!e.target.closest('.intro-skip')) done(); };
      const keyHandler = (e) => { if (e.key === 'Enter' || e.key === ' ') done(); };
      document.addEventListener('click', handler);
      document.addEventListener('keydown', keyHandler);
    });
  }

  loadAudio(src) {
    return new Promise((resolve) => {
      const a = new Audio(src);
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => resolve(a), { once: true });
      a.addEventListener('error', () => resolve(null));
      a.load();
    });
  }

  async play() {
    await this.init();
    this.isPlaying = true;
    this.sceneIndex = -1;
    this.sfxPlayed = {};
    this.ended = false;

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    this.sounds.bgmusic.volume = 0.3;
    this.sounds.bgmusic.loop = true;
    this.sounds.bgmusic.play().catch(() => {});

    await this.playLogo();

    const narration = this.sounds.narration;
    narration.volume = 1;
    narration.currentTime = 0;
    narration.play().catch(() => {});

    this.setScene(0);

    const tick = () => {
      if (!this.isPlaying || this.ended) return;
      const t = narration.currentTime;

      for (let i = SCENE_TEXTS.length - 1; i >= 0; i--) {
        if (t >= SCENE_TEXTS[i].at) {
          if (i !== this.sceneIndex) this.setScene(i);
          break;
        }
      }

      for (const s of SCENE_TIMINGS) {
        if (!this.sfxPlayed[s.sound] && t >= s.at && t < s.at + 1) {
          this.sfxPlayed[s.sound] = true;
          this.playSFX(s.sound);
        }
      }

      requestAnimationFrame(tick);
    };

    narration.addEventListener('ended', () => {
      this.endIntro();
    }, { once: true });

    requestAnimationFrame(tick);
  }

  async playLogo() {
    this.logoContainer.classList.remove('hidden');

    await this.delay(400);
    this.logoLabel.style.opacity = '1';

    await this.delay(600);
    this.logoImg.style.opacity = '1';
    this.logoImg.style.transform = 'scale(1)';

    await this.delay(800);
    this.logoSub.style.opacity = '1';

    await this.delay(2500);
    this.logoContainer.style.opacity = '0';

    await this.delay(800);
    this.logoContainer.classList.add('hidden');
    this.logoContainer.style.opacity = '';
    this.logoLabel.style.opacity = '';
    this.logoImg.style.opacity = '';
    this.logoImg.style.transform = '';
    this.logoSub.style.opacity = '';
  }

  setScene(index) {
    if (this.sceneIndex === index) return;
    this.sceneIndex = index;
    const scene = SCENE_TEXTS[index];

    this.sceneEl.style.transform = 'scale(1)';
    this.sceneEl.style.backgroundImage = `url(${scene.img})`;
    this.sceneEl.style.opacity = '1';

    this.textEl.style.animation = 'none';
    this.subtitleEl.style.opacity = '0';
    this.subtitleEl.textContent = '';
    void this.textEl.offsetWidth;

    setTimeout(() => {
      this.textEl.textContent = scene.text;
      this.textEl.style.animation = 'textReveal 1.5s ease forwards';
    }, 100);

    setTimeout(() => {
      this.subtitleEl.textContent = scene.subtitle;
      this.subtitleEl.style.opacity = '1';
    }, 1400);

    if (index === 3) {
      setTimeout(() => this.zoomFlashSequence(), 3000);
    }
  }

  playSFX(name) {
    const s = this.sounds[name];
    if (!s) return;
    s.currentTime = 0;
    s.volume = name === 'thunder' ? 0.8 : name === 'sting' ? 0.7 : 0.6;
    s.play().catch(() => {});
    if (name === 'thunder') {
      this.lightningEl.classList.remove('flash');
      void this.lightningEl.offsetWidth;
      this.lightningEl.classList.add('flash');
    }
  }

  async endIntro() {
    if (this.ended) return;
    this.ended = true;

    this.textEl.style.opacity = '0';
    this.subtitleEl.style.opacity = '0';

    this.titleEl.classList.remove('hidden');
    this.titleEl.style.opacity = '1';
    this.titleEl.style.transform = 'scale(1)';

    if (this.sounds.sting) {
      this.sounds.sting.currentTime = 0;
      this.sounds.sting.volume = 0.9;
      this.sounds.sting.play().catch(() => {});
    }

    this.sounds.bgmusic.volume = 0.15;

    await this.delay(600);
    this.showStartButton();
  }

  skip() {
    if (!this.isPlaying) return;
    this.ended = true;
    this.startPrompt.classList.add('hidden');
    this.startGameBtn.classList.add('hidden');
    this.logoContainer.classList.add('hidden');
    this.cleanup();
    this.onComplete();
  }

  cleanup() {
    this.isPlaying = false;
    this.overlay.classList.add('hidden');
    Object.values(this.sounds).forEach(s => {
      if (s) { s.pause(); s.currentTime = 0; }
    });
    this.overlay.style.opacity = '';
  }

  async zoomFlashSequence() {
    const zooms = [1.12, 1.35, 1.7];

    for (const zoom of zooms) {
      this.lightningEl.classList.remove('zoom-flash');
      void this.lightningEl.offsetWidth;
      this.lightningEl.classList.add('zoom-flash');

      this.sceneEl.style.transform = `scale(${zoom})`;

      await this.delay(550);
    }

    this.showStartButton();
  }

  showStartButton() {
    if (this.startBtnShown) return;
    this.startBtnShown = true;
    this.startGameBtn.classList.remove('hidden');
    this.startGameBtn.addEventListener('click', () => {
      this.cleanup();
      this.onComplete();
    }, { once: true });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { IntroPlayer };
