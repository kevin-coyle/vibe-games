/**
 * Audio manager.
 *
 * Thin wrapper over the HTML5 Audio element that the rest of the app uses to
 * play Karen's voice clips. Replaces the original C++ approach of shelling out
 * to `paplay`/`ffplay`. The browser gives us seekable playback for free, which
 * is what makes the resumable "story" feature simpler than the Qt version.
 *
 * Two independent channels:
 *   - `oneShot`  : short reaction / scold lines that talk over nothing.
 *   - `story`    : the long story clip, which can be paused, resumed and sought.
 */

const SOUND_DIR = 'assets/sounds';

const CLIPS = {
  jingle: 'jingle.wav',
  welcome: 'welcome.wav',
  delicious: 'delicious.wav',
  tasty: 'tasty.wav',
  goodchoice: 'goodchoice.wav',
  story: 'story.wav',
  rude: 'rude.wav',
  notfinished: 'notfinished.wav',
  letmefinish: 'letmefinish.wav',
  mykids: 'mykids.wav',
  goodbye: 'goodbye.wav',
  herpick: 'herpick.wav',
  newrecipe: 'newrecipe.mp3',
  editrecipe: 'editrecipe.mp3',
  deleterecipe: 'deleterecipe.mp3',
};

export class AudioManager {
  constructor() {
    this._oneShot = new Audio();
    this._story = new Audio();
    this._story.src = `${SOUND_DIR}/${CLIPS.story}`;
    this._story.preload = 'auto';
  }

  _url(name) {
    const file = CLIPS[name];
    if (!file) throw new Error(`Unknown sound clip: ${name}`);
    return `${SOUND_DIR}/${file}`;
  }

  /**
   * Play a short clip on the one-shot channel, interrupting any previous
   * one-shot. Returns a promise that resolves when the clip finishes (or
   * rejects if the browser blocks autoplay).
   */
  play(name) {
    this._oneShot.src = this._url(name);
    this._oneShot.currentTime = 0;
    const done = new Promise((resolve) => {
      this._oneShot.onended = resolve;
      this._oneShot.onerror = resolve;
    });
    const p = this._oneShot.play();
    if (p && p.catch) p.catch(() => {});
    return done;
  }

  /** Start (or resume) the story on the dedicated story channel. */
  playStory() {
    const p = this._story.play();
    if (p && p.catch) p.catch(() => {});
  }

  /** Pause the story, leaving its playback position intact for a resume. */
  pauseStory() {
    this._story.pause();
  }

  /** Stop the story and rewind to the beginning. */
  stopStory() {
    this._story.pause();
    this._story.currentTime = 0;
  }

  /** Whether the story is currently playing. */
  get storyPlaying() {
    return !this._story.paused && !this._story.ended;
  }

  /** Register a callback for when the story finishes on its own. */
  onStoryEnded(cb) {
    this._story.onended = cb;
  }

  /** Stop everything (used on teardown / "goodbye"). */
  stopAll() {
    this._oneShot.pause();
    this.stopStory();
  }
}
