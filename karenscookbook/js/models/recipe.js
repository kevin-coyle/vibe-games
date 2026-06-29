/**
 * Recipe domain model.
 *
 * A plain data object plus a couple of helpers. Kept free of any storage or
 * DOM concerns so it can be reused by the store, the views and the seed data.
 */

/** Generate a RFC4122-ish unique id (mirrors the Qt QUuid the C++ app used). */
export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Recipe {
  constructor({
    id = createId(),
    title = '',
    category = '',
    ingredients = [],
    instructions = '',
    image = '',
  } = {}) {
    this.id = id;
    this.title = title;
    this.category = category;
    this.ingredients = ingredients;
    this.instructions = instructions;
    /** Relative URL (seed image) or data URL (user upload). */
    this.image = image;
  }

  isValid() {
    return this.title.trim().length > 0;
  }

  /** Plain object for JSON persistence. */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      ingredients: this.ingredients,
      instructions: this.instructions,
      image: this.image,
    };
  }

  static fromJSON(obj) {
    return new Recipe(obj);
  }
}
