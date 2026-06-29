/**
 * Recipe list view.
 *
 * Renders the recipe titles as a selectable list and emits a callback when the
 * selection changes. Knows nothing about Karen or the store — it's handed
 * recipes to display and reports which one the user picked.
 */
export class RecipeListView {
  /**
   * @param {HTMLElement} root - container <ul> element.
   * @param {(id: string) => void} onSelect - called with the selected id.
   */
  constructor(root, onSelect) {
    this._root = root;
    this._onSelect = onSelect;
    this._selectedId = null;
  }

  get selectedId() {
    return this._selectedId;
  }

  /** Replace the list contents. Selection is reset unless `keepId` survives. */
  render(recipes, keepId = null) {
    this._root.replaceChildren();
    for (const recipe of recipes) {
      const li = document.createElement('li');
      li.className = 'recipe-item';
      li.textContent = recipe.title;
      li.dataset.id = recipe.id;
      li.title = recipe.category ? `Category: ${recipe.category}` : '';
      li.addEventListener('click', () => this.select(recipe.id));
      this._root.appendChild(li);
    }

    const ids = recipes.map((r) => r.id);
    if (keepId && ids.includes(keepId)) {
      this.select(keepId, { silent: false });
    } else if (recipes.length > 0) {
      this.select(recipes[0].id);
    } else {
      this._selectedId = null;
    }
  }

  /**
   * Select a row by id.
   * @param {object} [opts]
   * @param {boolean} [opts.silent] - update highlight without firing onSelect.
   */
  select(id, { silent = false } = {}) {
    this._selectedId = id;
    for (const li of this._root.children) {
      li.classList.toggle('selected', li.dataset.id === id);
    }
    const selected = this._root.querySelector('.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
    if (!silent && this._onSelect) this._onSelect(id);
  }
}
