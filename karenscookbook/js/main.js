/**
 * Application bootstrap.
 *
 * Wires the store, views, audio and the Karen controller together and owns the
 * top-level UI state (search box, category filter, toolbar). Deliberately thin:
 * all behaviour lives in the modules it composes.
 */
import { RecipeStore } from './data/recipeStore.js';
import { AudioManager } from './audio/audioManager.js';
import { RecipeListView } from './ui/recipeListView.js';
import { RecipeDetailView } from './ui/recipeDetailView.js';
import { KarenController } from './controllers/karenController.js';

class App {
  constructor() {
    this._store = new RecipeStore();
    this._audio = new AudioManager();

    this._listEl = document.getElementById('recipe-list');
    this._detailEl = document.getElementById('recipe-detail');
    this._searchEl = document.getElementById('search');
    this._categoryEl = document.getElementById('category');

    this._detail = new RecipeDetailView(this._detailEl);
    this._list = new RecipeListView(this._listEl, (id) => this._onSelect(id));

    this._karen = new KarenController({
      audio: this._audio,
      listView: this._list,
      store: this._store,
      onLeave: () => this._leave(),
    });

    this._bindUI();
    this._populateCategories();
    this._refreshList();
  }

  _bindUI() {
    this._searchEl.addEventListener('input', () => this._onSearchInput());
    this._categoryEl.addEventListener('change', () => this._refreshList());

    // Toolbar buttons just provoke a Karen reaction for now.
    for (const btn of document.querySelectorAll('[data-action]')) {
      btn.addEventListener('click', () =>
        this._karen.reactToAction(btn.dataset.action)
      );
    }
  }

  _populateCategories() {
    const current = this._categoryEl.value || 'All';
    this._categoryEl.replaceChildren();
    for (const name of ['All', ...this._store.categories()]) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this._categoryEl.appendChild(opt);
    }
    this._categoryEl.value = current;
  }

  /** Recompute the visible recipes from the search term + category filter. */
  _refreshList(keepId = null) {
    const term = this._searchEl.value;
    const category = this._categoryEl.value;
    let recipes = this._store.search(term);
    if (category && category !== 'All') {
      recipes = recipes.filter((r) => r.category === category);
    }
    this._list.render(recipes, keepId);
  }

  _onSelect(id) {
    const honoured = this._karen.handleSelection(id);
    if (honoured) {
      this._detail.render(this._store.recipe(id));
    }
  }

  _onSearchInput() {
    const forcedId = this._karen.handleSearchInput(this._searchEl.value);
    if (!forcedId) return;

    // Karen takes over: clear the box, drop the filter so her pick is visible,
    // then force it into view.
    this._searchEl.value = '';
    this._categoryEl.value = 'All';
    this._refreshList(forcedId);
    this._karen.forceSelect(forcedId);
  }

  /** Karen has left the building — start over from the splash screen. */
  _leave() {
    this._audio.stopAll();
    window.location.reload();
  }

  /** Kick off the intro once the user has interacted (autoplay policy). */
  async start() {
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* fullscreen is best-effort */
      }
    }
    await this._karen.playIntro();
  }
}

function main() {
  const app = new App();
  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('start-btn');
  startBtn.addEventListener('click', () => {
    splash.classList.add('hidden');
    app.start();
  });
}

document.addEventListener('DOMContentLoaded', main);
