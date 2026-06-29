/**
 * Seed recipes. Ported verbatim from the original C++ RecipeStore::seedData(),
 * including the title -> seed-image mapping.
 */
import { Recipe } from '../models/recipe.js';

const IMAGE_BY_TITLE = {
  'Classic Pancakes': 'pancakes',
  'Spaghetti Bolognese': 'spaghetti',
  'Chicken Tikka Masala': 'tikka',
  'Greek Salad': 'greek-salad',
  'Chocolate Chip Cookies': 'cookies',
  'Margherita Pizza': 'pizza',
  'Beef Stroganoff': 'stroganoff',
  'Caesar Salad': 'caesar',
  'Banana Bread': 'banana-bread',
  'Guacamole': 'guacamole',
  'French Onion Soup': 'onion-soup',
  'Tiramisu': 'tiramisu',
};

const RAW = [
  {
    title: 'Classic Pancakes',
    category: 'Breakfast',
    ingredients: [
      '1 cup all-purpose flour', '2 tbsp sugar', '1 tsp baking powder',
      '1/2 tsp baking soda', '1/4 tsp salt', '3/4 cup buttermilk',
      '1 egg', '2 tbsp melted butter', '1 tsp vanilla extract',
    ],
    instructions:
      'Whisk dry ingredients. In another bowl mix wet ingredients. ' +
      'Combine until just lumpy. Heat griddle over medium heat. ' +
      'Pour batter, cook until bubbles form, flip and cook 1 more minute.',
  },
  {
    title: 'Spaghetti Bolognese',
    category: 'Main Course',
    ingredients: [
      '400g spaghetti', '500g ground beef', '1 onion, diced',
      '3 cloves garlic, minced', '800g crushed tomatoes',
      '2 tbsp tomato paste', '1 tsp dried oregano', '1 tsp dried basil',
      'Salt and pepper', 'Parmesan to serve',
    ],
    instructions:
      'Brown beef in a large pot. Add onion and garlic, cook 5 min. ' +
      'Stir in tomatoes, paste, herbs. Simmer 30 min. ' +
      'Cook spaghetti al dente. Serve sauce over pasta with Parmesan.',
  },
  {
    title: 'Chicken Tikka Masala',
    category: 'Main Course',
    ingredients: [
      '500g chicken breast, cubed', '1 cup yogurt',
      '2 tbsp tikka masala paste', '1 onion, diced',
      '3 cloves garlic, minced', '400g crushed tomatoes',
      '1 cup heavy cream', '2 tbsp butter', 'Cilantro for garnish',
    ],
    instructions:
      'Marinate chicken in yogurt and paste for 1 hour. ' +
      'Grill or pan-fry chicken until charred. ' +
      'Sauté onion and garlic in butter, add tomatoes, simmer 10 min. ' +
      'Stir in cream, add chicken, simmer 5 min. Garnish with cilantro.',
  },
  {
    title: 'Greek Salad',
    category: 'Salad',
    ingredients: [
      '2 large tomatoes, chopped', '1 cucumber, diced',
      '1 red onion, thinly sliced', '1 green bell pepper, sliced',
      '200g feta cheese, cubed', '1/2 cup Kalamata olives',
      '3 tbsp olive oil', '1 tbsp red wine vinegar',
      '1 tsp dried oregano', 'Salt and pepper',
    ],
    instructions:
      'Combine all vegetables in a large bowl. ' +
      'Top with feta and olives. ' +
      'Whisk oil, vinegar, oregano, salt, pepper. ' +
      'Dress and toss lightly.',
  },
  {
    title: 'Chocolate Chip Cookies',
    category: 'Dessert',
    ingredients: [
      '2 1/4 cups all-purpose flour', '1 cup butter, softened',
      '3/4 cup sugar', '3/4 cup brown sugar',
      '2 eggs', '1 tsp vanilla extract', '1 tsp baking soda',
      '1/2 tsp salt', '2 cups chocolate chips',
    ],
    instructions:
      'Cream butter and sugars. Beat in eggs and vanilla. ' +
      'Mix flour, baking soda, salt. Stir into wet mix. ' +
      'Fold in chocolate chips. ' +
      'Drop tablespoons onto baking sheet. ' +
      'Bake at 350°F for 9-11 minutes.',
  },
  {
    title: 'Margherita Pizza',
    category: 'Main Course',
    ingredients: [
      '1 pizza dough', '1/2 cup tomato sauce',
      '200g fresh mozzarella, sliced', 'Fresh basil leaves',
      '2 tbsp olive oil', 'Salt',
    ],
    instructions:
      'Preheat oven to 500°F with pizza stone or inverted sheet. ' +
      'Stretch dough into 12-inch round. ' +
      'Spread sauce, top with mozzarella. ' +
      'Bake 8-10 minutes until golden. ' +
      'Top with basil, drizzle olive oil, salt.',
  },
  {
    title: 'Beef Stroganoff',
    category: 'Main Course',
    ingredients: [
      '500g beef sirloin, thinly sliced', '1 onion, diced',
      '200g mushrooms, sliced', '2 cloves garlic, minced',
      '1 cup sour cream', '1 tbsp Dijon mustard',
      '1 cup beef broth', '2 tbsp butter', 'Egg noodles',
    ],
    instructions:
      'Season beef, sear in butter, remove. ' +
      'Sauté onion and mushrooms, add garlic. ' +
      'Pour in broth, simmer 5 min. ' +
      'Stir in sour cream and mustard, return beef. ' +
      'Serve over egg noodles.',
  },
  {
    title: 'Caesar Salad',
    category: 'Salad',
    ingredients: [
      '1 romaine lettuce, chopped', '1/2 cup Parmesan, shaved',
      '1 cup croutons', '1 clove garlic',
      '2 anchovy fillets', '1 egg yolk',
      '2 tbsp lemon juice', '1 tsp Dijon mustard',
      '1/2 cup olive oil', 'Salt and pepper',
    ],
    instructions:
      'Mash garlic and anchovies into a paste. ' +
      'Whisk in yolk, lemon, mustard. ' +
      'Drizzle oil while whisking. Season. ' +
      'Toss lettuce with dressing. Top with croutons and Parmesan.',
  },
  {
    title: 'Banana Bread',
    category: 'Dessert',
    ingredients: [
      '3 ripe bananas, mashed', '1/3 cup melted butter',
      '3/4 cup sugar', '1 egg', '1 tsp vanilla extract',
      '1 1/2 cups flour', '1 tsp baking soda', '1/4 tsp salt',
    ],
    instructions:
      'Preheat oven to 350°F. Grease a loaf pan. ' +
      'Mix bananas and butter. Add sugar, egg, vanilla. ' +
      'Fold in flour, baking soda, salt. ' +
      'Pour into pan, bake 60 min until toothpick comes clean.',
  },
  {
    title: 'Guacamole',
    category: 'Appetizer',
    ingredients: [
      '3 ripe avocados', '1 lime, juiced', '1/4 cup onion, finely diced',
      '1 tomato, seeded and diced', '1 jalapeño, minced',
      '1/4 cup cilantro, chopped', 'Salt',
    ],
    instructions:
      'Halve and pit avocados. Scoop into bowl, mash to desired texture. ' +
      'Stir in lime juice, onion, tomato, jalapeño, cilantro, salt. ' +
      'Serve immediately with tortilla chips.',
  },
  {
    title: 'French Onion Soup',
    category: 'Soup',
    ingredients: [
      '4 large onions, thinly sliced', '3 tbsp butter',
      '4 cups beef broth', '1 cup dry white wine',
      '1 tsp thyme', 'Baguette slices', 'Gruyère cheese, grated',
    ],
    instructions:
      'Caramelize onions in butter over medium-low heat for 45 min. ' +
      'Add wine, cook 2 min. Add broth and thyme, simmer 20 min. ' +
      'Ladle into oven-safe bowls. Top with baguette and cheese. ' +
      'Broil until cheese is bubbly and golden.',
  },
  {
    title: 'Tiramisu',
    category: 'Dessert',
    ingredients: [
      '6 egg yolks', '3/4 cup sugar', '500g mascarpone',
      '2 cups heavy cream', '2 cups strong espresso, cooled',
      '3 tbsp coffee liqueur', 'Ladyfinger biscuits',
      'Cocoa powder for dusting',
    ],
    instructions:
      'Whisk yolks and sugar until thick. Fold in mascarpone. ' +
      'Whip cream to stiff peaks, fold into mascarpone mix. ' +
      'Mix espresso and liqueur. Dip ladyfingers briefly, line dish. ' +
      'Spread half the cream. Repeat. ' +
      'Dust heavily with cocoa. Refrigerate 4+ hours.',
  },
];

/** Build fresh Recipe instances with their seed images attached. */
export function seedRecipes() {
  return RAW.map((data) =>
    new Recipe({
      ...data,
      image: `assets/images/${IMAGE_BY_TITLE[data.title]}.png`,
    })
  );
}
