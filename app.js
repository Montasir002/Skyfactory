class RecipeViewer {
  constructor() {
    this.recipes = [];
    this.addonTextures = {};
    this.vanillaTextures = {};
    this.recipesByOutput = new Map();
    this.historyStack = [];
    this.currentRecipeList = [];
    this.currentRecipeIndex = 0;
    this.selectedCatalogId = null;

    // Double tap timing tracker for grid slots
    this.gridLastTapTime = 0;
    this.gridLastTappedSlot = null;

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
    this.addonFilter = document.getElementById('addon-filter');
    this.recipeTitle = document.getElementById('current-recipe-title');
    this.gridSlots = document.querySelectorAll('.crafting-grid .slot');
    this.resultSlot = document.getElementById('result-slot');
    this.resultCount = document.getElementById('result-count');
    this.paginationControls = document.getElementById('pagination-controls');
    this.recipeIndexIndicator = document.getElementById('recipe-index-indicator');
    this.prevRecipeBtn = document.getElementById('prev-recipe-btn');
    this.nextRecipeBtn = document.getElementById('next-recipe-btn');

    // Info Box
    this.infoBar = document.getElementById('item-info-bar');
    this.infoItemName = document.getElementById('info-item-name');
    this.infoAddonName = document.getElementById('info-addon-name');
  }

  bindEvents() {
    this.searchInput.addEventListener('input', () => this.renderCatalog());
    this.addonFilter.addEventListener('change', () => this.renderCatalog());
    
    this.clearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.renderCatalog();
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

    // 1. Grid Slots Click & Double Click Handling
    this.gridSlots.forEach((slot, index) => {
      slot.addEventListener('click', () => {
        const itemId = slot.dataset.itemId;
        if (!itemId) return;

        const now = Date.now();
        const isDoubleTap = (this.gridLastTappedSlot === index) && (now - this.gridLastTapTime < 350);
        this.gridLastTapTime = now;
        this.gridLastTappedSlot = index;

        // Highlight active grid slot
        document.querySelectorAll('.slot.selected').forEach(s => s.classList.remove('selected'));
        slot.classList.add('selected');

        // Single click: Show ingredient details
        this.showItemInfo(itemId);

        // Double click: Go to ingredient recipe
        if (isDoubleTap) {
          this.viewItemRecipes(itemId);
        }
      });
    });

    // 2. Result Slot Single Click: Show Details
    this.resultSlot.addEventListener('click', () => {
      if (this.currentRecipeList.length > 0) {
        const outId = this.currentRecipeList[this.currentRecipeIndex].result.item;
        document.querySelectorAll('.slot.selected').forEach(s => s.classList.remove('selected'));
        this.resultSlot.classList.add('selected');
        this.showItemInfo(outId);
      }
    });
  }

  async loadData() {
    try {
      const resp = await fetch('data/recipes.json');
      const data = await resp.json();

      this.recipes = data.recipes || [];
      this.addonTextures = data.textures || {};
      this.vanillaTextures = data.vanilla_textures || {};

      const namespaces = new Set();

      this.recipes.forEach(rec => {
        const outId = rec.result.item;
        if (!this.recipesByOutput.has(outId)) {
          this.recipesByOutput.set(outId, []);
        }
        this.recipesByOutput.get(outId).push(rec);

        const ns = this.extractNamespace(outId);
        namespaces.add(ns);
      });

      this.addonFilter.innerHTML = '<option value="ALL">All Addons / Vanilla</option>';
      Array.from(namespaces).sort().forEach(ns => {
        const opt = document.createElement('option');
        opt.value = ns;
        opt.innerText = this.formatNamespace(ns);
        this.addonFilter.appendChild(opt);
      });

      this.renderCatalog();
    } catch (e) {
      this.recipeTitle.innerText = "Error loading data/recipes.json";
      console.error(e);
    }
  }

  extractNamespace(itemId) {
    if (!itemId) return 'vanilla';
    return itemId.includes(':') ? itemId.split(':')[0] : 'minecraft';
  }

  formatNamespace(ns) {
    if (ns === 'minecraft') return 'Vanilla Minecraft';
    if (ns === 'sf' || ns === 'skyfactory') return 'SkyFactory Core';
    if (ns === 'vatonage') return 'Vatonage Tech';
    return ns.charAt(0).toUpperCase() + ns.slice(1);
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

  renderCatalog() {
    this.catalog.innerHTML = '';
    const cleanFilter = this.searchInput.value.trim().toLowerCase();
    const selectedAddon = this.addonFilter.value;

    const uniqueItems = Array.from(this.recipesByOutput.keys()).filter(id => {
      const matchesSearch = id.toLowerCase().includes(cleanFilter);
      const matchesAddon = (selectedAddon === 'ALL') || (this.extractNamespace(id) === selectedAddon);
      return matchesSearch && matchesAddon;
    });

    this.itemCountBadge.innerText = `${uniqueItems.length} items`;

    uniqueItems.forEach(itemId => {
      const el = document.createElement('div');
      el.className = 'slot';
      if (this.selectedCatalogId === itemId) el.classList.add('selected');

      const img = document.createElement('img');
      img.src = this.getTextureUrl(itemId);
      img.onerror = () => { img.style.display = 'none'; };

      el.appendChild(img);

      // Single click on catalog item: show recipe immediately
      el.addEventListener('click', () => {
        this.selectedCatalogId = itemId;
        document.querySelectorAll('.slot.selected').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        this.showItemInfo(itemId);
        this.viewItemRecipes(itemId);
      });

      this.catalog.appendChild(el);
    });
  }

  showItemInfo(itemId) {
    const ns = this.extractNamespace(itemId);
    const shortName = itemId.includes(':') ? itemId.split(':')[1] : itemId;

    this.infoBar.style.display = 'flex';
    this.infoItemName.innerText = shortName.replace(/_/g, ' ');
    this.infoAddonName.innerText = `Addon: ${this.formatNamespace(ns)} (${itemId})`;
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

    const shortName = recipe.result.item.includes(':') ? recipe.result.item.split(':')[1] : recipe.result.item;
    this.recipeTitle.innerText = shortName.replace(/_/g, ' ');

    if (this.currentRecipeList.length > 1) {
      this.paginationControls.style.display = 'flex';
      this.recipeIndexIndicator.innerText = `${this.currentRecipeIndex + 1} / ${this.currentRecipeList.length}`;
      this.prevRecipeBtn.disabled = this.currentRecipeIndex === 0;
      this.nextRecipeBtn.disabled = this.currentRecipeIndex === this.currentRecipeList.length - 1;
    } else {
      this.paginationControls.style.display = 'none';
    }

    // Populate Crafting Grid Slots
    this.gridSlots.forEach((slot, i) => {
      slot.innerHTML = '';
      slot.dataset.itemId = '';
      slot.classList.remove('selected');
      const inputId = recipe.grid[i];

      if (inputId) {
        slot.dataset.itemId = inputId;
        const img = document.createElement('img');
        img.src = this.getTextureUrl(inputId);
        img.onerror = () => { img.style.display = 'none'; };
        slot.appendChild(img);
      }
    });

    // Populate Result Slot
    this.resultSlot.innerHTML = '';
    this.resultSlot.classList.remove('selected');
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
