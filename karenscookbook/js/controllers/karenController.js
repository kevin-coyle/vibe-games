/**
 * Karen — the "personality" controller.
 *
 * This is where the joke lives. Karen reacts to what the user does:
 *
 *   - Selecting a recipe usually earns a short approving noise, but ~15% of
 *     the time she launches into a long story instead.
 *   - While the story plays, switching to a different recipe interrupts her.
 *     She scolds you, snaps the selection back, and resumes the story from
 *     where she left off (the browser's seekable audio makes this trivial).
 *   - Five interruptions and she's done: she says goodbye and the app "leaves".
 *   - Typing in the search box is futile — after a few characters she clears it,
 *     says her piece, and forces her signature dish into view.
 *
 * Ported from the interruption/story state machine in the original
 * MainWindow.cpp, with timing constants preserved.
 */

const STORY_ON_SELECTION = 5; // the Nth recipe they pick gets the story instead
const REACTIONS = ['delicious', 'tasty', 'goodchoice'];
const SCOLDS = ['rude', 'notfinished', 'letmefinish', 'mykids'];
const MAX_INTERRUPTIONS = 5; // on the 5th, she leaves
const SCOLD_TO_RESUME_MS = 1500; // pause after a scold before resuming
const SEARCH_HIJACK_THRESHOLD = 4; // chars typed before she takes over
const FAVORITE = 'Beef Stroganoff'; // her signature dish

export class KarenController {
  /**
   * @param {object} deps
   * @param {import('../audio/audioManager.js').AudioManager} deps.audio
   * @param {import('../ui/recipeListView.js').RecipeListView} deps.listView
   * @param {import('../data/recipeStore.js').RecipeStore} deps.store
   * @param {() => void} deps.onLeave - called when Karen quits the app.
   */
  constructor({ audio, listView, store, onLeave }) {
    this._audio = audio;
    this._list = listView;
    this._store = store;
    this._onLeave = onLeave;

    this._storyRecipeId = null; // which recipe was playing when the story began
    this._interruptCount = 0;
    this._resumeTimer = null;
    this._suppressReaction = false; // skip reaction on a forced auto-pick
    this._selectionCount = 0; // reaction-eligible selections so far

    this._audio.onStoryEnded(() => this._endStory());
  }

  get _storyPlaying() {
    return this._audio.storyPlaying;
  }

  /** Opening jingle followed by the welcome line. */
  async playIntro() {
    await this._audio.play('jingle');
    await this._audio.play('welcome');
  }

  /**
   * Called whenever the list selection changes.
   * @returns {boolean} true if the selection should be honoured (caller may
   *   render the detail); false if Karen overrode it (interruption).
   */
  handleSelection(recipeId) {
    if (this._storyPlaying && recipeId !== this._storyRecipeId) {
      this._handleInterruption();
      return false;
    }

    if (this._suppressReaction) return true;
    this._reactToSelection(recipeId);
    return true;
  }

  _reactToSelection(recipeId) {
    this._selectionCount += 1;
    if (this._selectionCount === STORY_ON_SELECTION) {
      this._startStory(recipeId);
    } else {
      const idx = Math.floor(Math.random() * REACTIONS.length);
      this._audio.play(REACTIONS[idx]);
    }
  }

  _startStory(recipeId, { resume = false } = {}) {
    if (!resume) {
      this._interruptCount = 0;
      this._audio.stopStory(); // rewind to the top for a fresh story
    }
    this._storyRecipeId = recipeId;
    this._audio.playStory();
  }

  _handleInterruption() {
    this._audio.pauseStory(); // keep position so we can resume there

    // Five strikes and she's had enough: play her goodbye, then leave once the
    // clip has actually finished (play() resolves on the audio 'ended' event).
    if (this._interruptCount >= MAX_INTERRUPTIONS - 1) {
      this._storyRecipeId = null;
      this._audio.play('goodbye').then(() => this._onLeave());
      return;
    }

    const scold = SCOLDS[Math.min(this._interruptCount, SCOLDS.length - 1)];
    this._audio.play(scold);
    this._interruptCount += 1;

    // Snap the selection back to the recipe she was talking about.
    this._list.select(this._storyRecipeId, { silent: true });

    clearTimeout(this._resumeTimer);
    this._resumeTimer = setTimeout(() => {
      this._startStory(this._storyRecipeId, { resume: true });
    }, SCOLD_TO_RESUME_MS);
  }

  _endStory() {
    this._storyRecipeId = null;
    this._audio.stopStory();
  }

  /**
   * Called as the user types in the search box. Returns the recipe id Karen
   * forces into view, or null if she's letting them type for now.
   */
  handleSearchInput(text) {
    if (text.length < SEARCH_HIJACK_THRESHOLD) return null;
    this._audio.play('herpick');
    return this._pickFavorite();
  }

  _pickFavorite() {
    const recipes = this._store.all();
    const favorite = recipes.find((r) => r.title === FAVORITE);
    const target = favorite ?? recipes[0] ?? null;
    return target ? target.id : null;
  }

  /**
   * React to a toolbar button. Karen has opinions about you touching her
   * recipes: she dismisses "New", is insulted by "Edit", furious at "Delete".
   * Plays on the one-shot channel so it can bark over anything.
   */
  reactToAction(action) {
    const clip = {
      new: 'newrecipe',
      edit: 'editrecipe',
      delete: 'deleterecipe',
    }[action];
    if (clip) this._audio.play(clip);
  }

  /**
   * Force-select a recipe without triggering the usual random reaction
   * (used after the search hijack so she doesn't talk over her own line).
   */
  forceSelect(recipeId) {
    this._suppressReaction = true;
    this._list.select(recipeId);
    this._suppressReaction = false;
  }
}
