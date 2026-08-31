class RecipeViewer {
  constructor() {
    this.recipes = [];
    this.addonTextures = {};
    this.vanillaTextures = {};
    this.recipesByOutput = new Map();
    this.historyStack = [];
    this.currentRecipeList = [];
    this.currentRecipeIndex = 0;

    this.initElements();
    this.bindEvents();
    this.loadData();
  }

  initElements() {
    this.searchInput = document.getElementById('search-input');
    this.clearBtn = document.getElementById('clear-btn');
    this.backBtn = document.getElementById('back-btn');
    this.catalog = document.getElementById('item-catalog');
    this.itemCountBadge = document.getElementById('item-count-badge');
    this.recipeTitle = document.getElementById('current-recipe-title');
    this.gridSlots = document.querySelectorAll('.crafting-grid .slot');
    this.resultSlot = document.getElementById('result-slot');
    this.resultCount = document.getElementById('result-count');
    this.paginationControls = document.getElementById('pagination-controls');
    this.recipeIndexIndicator = document.getElementById('recipe-index-indicator');
    this.prevRecipeBtn = document.getElementById('prev-recipe-btn');
    this.nextRecipeBtn = document.getElementById('next-recipe-btn');
  }

  bindEvents() {
    this.searchInput.addEventListener('input', () => this.filterCatalog());
    this.clearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.filterCatalog();
    });

    this.backBtn.addEventListener('click', () => this.goBack());

    this.prevRecipeBtn.addEventListener('click', () => {
      if (this.currentRecipeIndex > 0) {
        this.currentRecipeIndex--;
        this.displayCurrentRecipe();
      }
    });

    this.nextRecipeBtn.addEventListener('click', () => {
      if (this.currentRecipeIndex < this.currentRecipeList.length - 1) {
        this.currentRecipeIndex++;
        this.displayCurrentRecipe();
      }
    });

    // Handle clicks inside 3x3 crafting grid to jump to nested recipe
    this.gridSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        const itemId = slot.dataset.itemId;
        if (itemId) this.viewItemRecipes(itemId);
      });
    });
  }

  async loadData() {
    try {
      const resp = await fetch('data/recipes.json');
      const data = await resp.json();

      this.recipes = data.recipes || [];
      this.addonTextures = data.textures || {};
      this.vanillaTextures = data.vanilla_textures || {};

      // Build Output Lookup Map
      this.recipes.forEach(rec => {
        const outId = rec.result.item;
        if (!this.recipesByOutput.has(outId)) {
          this.recipesByOutput.set(outId, []);
        }
        this.recipesByOutput.get(outId).push(rec);
      });

      this.populateCatalog();
    } catch (e) {
      this.recipeTitle.innerText = "Error loading data/recipes.json";
      console.error(e);
    }
  }

  getTextureUrl(itemId) {
    if (!itemId || itemId === 'minecraft:air') return null;

    if (this.addonTextures[itemId]) {
      return `assets/textures/${this.addonTextures[itemId]}`;
    }
    if (this.vanillaTextures[itemId]) {
      return `assets/vanilla/${this.vanillaTextures[itemId]}`;
    }

    const shortName = itemId.includes(':') ? itemId.split(':')[1] : itemId;
    return `assets/vanilla/${shortName}.png`;
  }

  populateCatalog(filter = '') {
    this.catalog.innerHTML = '';
    const cleanFilter = filter.toLowerCase();

    const uniqueItems = Array.from(this.recipesByOutput.keys()).filter(id => 
      id.toLowerCase().includes(cleanFilter)
    );

    this.itemCountBadge.innerText = `${uniqueItems.length} items`;

    uniqueItems.forEach(itemId => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.title = itemId;

      const img = document.createElement('img');
      img.src = this.getTextureUrl(itemId);
      img.onerror = () => { img.style.display = 'none'; };

      el.appendChild(img);
      el.addEventListener('click', () => this.viewItemRecipes(itemId));
      this.catalog.appendChild(el);
    });
  }

  filterCatalog() {
    this.populateCatalog(this.searchInput.value.trim());
  }

  viewItemRecipes(itemId, pushHistory = true) {
    const list = this.recipesByOutput.get(itemId);
    if (!list || list.length === 0) return;

    if (pushHistory && this.currentRecipeList.length > 0) {
      const currentItem = this.currentRecipeList[this.currentRecipeIndex].result.item;
      this.historyStack.push(currentItem);
      this.backBtn.disabled = false;
    }

    this.currentRecipeList = list;
    this.currentRecipeIndex = 0;
    this.displayCurrentRecipe();
  }

  displayCurrentRecipe() {
    const recipe = this.currentRecipeList[this.currentRecipeIndex];
    if (!recipe) return;

    const itemName = recipe.result.item.replace(/^(minecraft|vatonage|sf):/, '');
    this.recipeTitle.innerText = itemName.replace(/_/g, ' ');

    // Update Pagination
    if (this.currentRecipeList.length > 1) {
      this.paginationControls.style.display = 'flex';
      this.recipeIndexIndicator.innerText = `${this.currentRecipeIndex + 1} / ${this.currentRecipeList.length}`;
      this.prevRecipeBtn.disabled = this.currentRecipeIndex === 0;
      this.nextRecipeBtn.disabled = this.currentRecipeIndex === this.currentRecipeList.length - 1;
    } else {
      this.paginationControls.style.display = 'none';
    }

    // Populate Grid
    this.gridSlots.forEach((slot, i) => {
      slot.innerHTML = '';
      slot.dataset.itemId = '';
      const inputId = recipe.grid[i];

      if (inputId) {
        slot.dataset.itemId = inputId;
        const img = document.createElement('img');
        img.src = this.getTextureUrl(inputId);
        img.onerror = () => { img.style.display = 'none'; };
        slot.appendChild(img);
      }
    });

    // Populate Output Slot
    this.resultSlot.innerHTML = '';
    const resImg = document.createElement('img');
    resImg.src = this.getTextureUrl(recipe.result.item);
    this.resultSlot.appendChild(resImg);

    if (recipe.result.count > 1) {
      const badge = document.createElement('span');
      badge.className = 'count-badge';
      badge.innerText = recipe.result.count;
      this.resultSlot.appendChild(badge);
    }
  }

  goBack() {
    if (this.historyStack.length === 0) return;
    const prevItem = this.historyStack.pop();
    this.viewItemRecipes(prevItem, false);
    if (this.historyStack.length === 0) {
      this.backBtn.disabled = true;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.viewer = new RecipeViewer();
});
