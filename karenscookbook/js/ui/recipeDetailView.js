/**
 * Recipe detail view.
 *
 * Renders a single recipe (title, category tag, image, ingredients,
 * instructions) into a container. Mirrors the HTML the original C++
 * QTextBrowser produced, built safely with the DOM API rather than string
 * concatenation.
 */
export class RecipeDetailView {
  constructor(root) {
    this._root = root;
  }

  clear() {
    this._root.replaceChildren();
  }

  render(recipe) {
    if (!recipe) {
      this.clear();
      return;
    }

    const frag = document.createDocumentFragment();

    const h1 = document.createElement('h1');
    h1.textContent = recipe.title;
    frag.appendChild(h1);

    if (recipe.category) {
      const p = document.createElement('p');
      const tag = document.createElement('span');
      tag.className = 'category-tag';
      tag.textContent = recipe.category;
      p.appendChild(tag);
      frag.appendChild(p);
    }

    if (recipe.image) {
      const img = document.createElement('img');
      img.className = 'recipe-image';
      img.src = recipe.image;
      img.alt = `Photo of ${recipe.title}`;
      img.loading = 'lazy';
      frag.appendChild(img);
    }

    if (recipe.ingredients.length > 0) {
      const h2 = document.createElement('h2');
      h2.textContent = '🍲 Ingredients';
      frag.appendChild(h2);
      const ul = document.createElement('ul');
      for (const ing of recipe.ingredients) {
        const li = document.createElement('li');
        li.textContent = ing;
        ul.appendChild(li);
      }
      frag.appendChild(ul);
    }

    if (recipe.instructions) {
      const h2 = document.createElement('h2');
      h2.textContent = '📝 Instructions';
      frag.appendChild(h2);
      const p = document.createElement('p');
      // Preserve line breaks the way the C++ app did (\n -> <br>).
      const lines = recipe.instructions.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(line));
      });
      frag.appendChild(p);
    }

    this._root.replaceChildren(frag);
    this._root.scrollTop = 0;
  }
}
