/**
 * Read-only recipe store.
 *
 * Recipes are hardcoded from the seed data. This intentionally exposes only
 * query methods (no add/update/remove) — the toolbar buttons are wired to
 * placeholder handlers for now. The query surface mirrors the original C++
 * RecipeStore so the views and controller stay storage-agnostic: if a
 * persistent backend is added later, only this class changes.
 */
import { seedRecipes } from './seed.js';

export class RecipeStore {
  constructor() {
    this._recipes = seedRecipes().sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  /** All recipes, sorted by title. */
  all() {
    return [...this._recipes];
  }

  /** Look up a single recipe by id (or null). */
  recipe(id) {
    return this._recipes.find((r) => r.id === id) ?? null;
  }

  /** Distinct, sorted list of non-empty categories. */
  categories() {
    const set = new Set(
      this._recipes.map((r) => r.category).filter(Boolean)
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Case-insensitive substring match across title, category, ingredients and
   * instructions — same fields the C++ SQL LIKE query searched.
   */
  search(term) {
    const t = term.trim().toLowerCase();
    if (!t) return this.all();
    return this._recipes.filter((r) => {
      const haystack = [
        r.title,
        r.category,
        r.ingredients.join(' '),
        r.instructions,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(t);
    });
  }
}
