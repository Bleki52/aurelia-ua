/**
 * ============================================================================
 * AURELIA UA — Master App Application Logic
 * Mobile-First PWA Controller: Theme, Modals, Wallet, Catalog & Smart Basket
 * ============================================================================
 */

(function () {
  'use strict';

  /* ─── 0. Fail-Safe Immediate Preloader Dismissal ────────────────────────── */
  function forceHidePreloader() {
    try {
      const preloader = document.getElementById('preloader');
      if (preloader) {
        preloader.classList.add('is-hidden');
        preloader.classList.add('loaded');
        preloader.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
  }

  // Guaranteed fallback dismissal timers (runs independent of subsequent initialization)
  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(forceHidePreloader, 150);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(forceHidePreloader, 150));
      window.addEventListener('load', forceHidePreloader);
    }
    // Hard ultimate safety net timer (400ms max):
    setTimeout(forceHidePreloader, 400);
  }

  /* ─── 1. State Management & Constants ───────────────────────────────────── */
  const STORE_META = (window.AureliaAPI && window.AureliaAPI.STORE_META) || {
    silpo:          { name: 'Сільпо', program: 'Власний Рахунок', logo: 'logo-silpo', badgeText: 'балів' },
    atb:            { name: 'АТБ-Маркет', program: 'Картка АТБ', logo: 'logo-atb', badgeText: 'знижка' },
    novus:          { name: 'NOVUS', program: 'NOVUS Club', logo: 'logo-novus', badgeText: 'бонусів' },
    metro:          { name: 'METRO', program: 'METRO Card', logo: 'logo-metro', badgeText: 'клуб' },
    varus:          { name: 'VARUS', program: 'VARUS Poshuk', logo: 'logo-varus', badgeText: 'бонусів' },
    auchan:         { name: 'АШАН', program: 'Auchan Club', logo: 'logo-auchan', badgeText: 'бонусів' },
    epicentrk_food: { name: 'Епіцентр Food', program: 'Вигода', logo: 'logo-epicentrk_food', badgeText: 'балів' },
    velmart:        { name: 'Велмарт', program: 'Велмарт Бонус', logo: 'logo-velmart', badgeText: 'бонусів' },
    thrash:         { name: 'Траш! ТРАШ!', program: 'Власний Рахунок', logo: 'logo-thrash', badgeText: 'балів' },
    simi:           { name: 'Сімі', program: 'Сімі Клуб', logo: 'logo-simi', badgeText: 'бонусів' },
    blyzenko:       { name: 'Близенько', program: 'Близенько Разом', logo: 'logo-blyzenko', badgeText: 'бонусів' },
    taistra:        { name: 'Тайстра', program: 'Тайстра Бонус', logo: 'logo-taistra', badgeText: 'бонусів' },
    arsen:          { name: 'Арсен', program: 'Пакко Бонус', logo: 'logo-arsen', badgeText: 'бонусів' },
    rukavychka:     { name: 'Рукавичка', program: 'Родина Рукавичка', logo: 'logo-rukavychka', badgeText: 'бонусів' },
    eva:            { name: 'EVA', program: 'EVA МОЗАЇКА', logo: 'logo-eva', badgeText: 'бонусів' },
    prostor:        { name: 'Prostor', program: 'PROSTOR club', logo: 'logo-prostor', badgeText: 'бонусів' },
    avrora:         { name: 'Аврора Мультимаркет', program: 'Аврора Бонус', logo: 'logo-avrora', badgeText: 'бонусів' },
    epicentr:       { name: 'Епіцентр К', program: 'Вигода', logo: 'logo-epicentr', badgeText: 'балів' },
    other:          { name: 'Мережа', program: 'Картка лояльності', logo: 'icon-qr', badgeText: 'картка' }
  };

  const STORES = Object.keys(STORE_META).filter(s => s !== 'other');

  const CATEGORY_HIERARCHY = {
    'all': [
      { id: 'all', title: 'Усі акції', icon: 'cat-all' }
    ],
    'Продукти': [
      { id: 'all', title: 'Усі продукти', icon: 'cat-groceries' },
      { id: 'Молочні та Сири', title: 'Молочні та Сири', icon: 'sub-dairy' },
      { id: 'М\'ясо та Риба', title: 'М\'ясо та Риба', icon: 'sub-meat' },
      { id: 'Кава та Чай', title: 'Кава та Чай', icon: 'sub-coffee' },
      { id: 'Солодощі', title: 'Солодощі', icon: 'sub-sweets' },
      { id: 'Бакалія', title: 'Бакалія', icon: 'sub-grocery' },
      { id: 'Напої', title: 'Напої', icon: 'sub-drinks' },
      { id: 'Овочі та Фрукти', title: 'Овочі та Фрукти', icon: 'sub-produce' }
    ],
    'Краса та Гігієна': [
      { id: 'all', title: 'Усе для краси', icon: 'cat-beauty' },
      { id: 'Догляд за шкірою', title: 'Догляд за шкірою', icon: 'sub-skincare' },
      { id: 'Догляд за волоссям', title: 'Догляд за волоссям', icon: 'sub-haircare' },
      { id: 'Декоративна косметика', title: 'Декоративна косметика', icon: 'sub-cosmetics' },
      { id: 'Особиста гігієна', title: 'Особиста гігієна', icon: 'sub-hygiene' }
    ],
    'Дім та Побут': [
      { id: 'all', title: 'Усе для дому', icon: 'cat-home' },
      { id: 'Побутова хімія', title: 'Побутова хімія', icon: 'sub-cleaning' },
      { id: 'Кухня та Посуд', title: 'Кухня та Посуд', icon: 'sub-kitchen' },
      { id: 'Дім та Затишок', title: 'Дім та Затишок', icon: 'sub-homedecor' }
    ],
    'Зоотовари': [
      { id: 'all', title: 'Усі зоотовари', icon: 'cat-pets' },
      { id: 'Для котів', title: 'Для котів', icon: 'sub-catfood' },
      { id: 'Для собак', title: 'Для собак', icon: 'sub-dogfood' }
    ]
  };

  const AppState = {
    theme: 'dark',
    activeModal: null,
    activeCheckoutCard: null,
    checkoutMode: 'qr',
    editingCardId: null,
    uploadedScreenshotUrl: null,
    filterStore: 'all',
    searchQuery: '',
    cards: [],
    // City State (Default: Ivano-Frankivsk)
    selectedCity: (window.AureliaAPI && typeof window.AureliaAPI.getSelectedCity === 'function')
      ? window.AureliaAPI.getSelectedCity()
      : 'ivano-frankivsk',
    // Personalization (My Stores)
    selectedStores: (window.AureliaAPI && typeof window.AureliaAPI.getSelectedStores === 'function')
      ? window.AureliaAPI.getSelectedStores()
      : [...STORES],
    // Catalog State (2-Level Hierarchy)
    products: [],
    catalogMainCategory: 'all',
    catalogSubCategory: 'all',
    catalogCategory: 'all',
    catalogStore: 'all',
    catalogSort: 'cheap',
    catalogSearch: '',
    // Basket State
    basket: []
  };

  /* ─── 2. DOM Elements Cache ──────────────────────────────────────────────── */
  const DOM = {};

  function cacheDOM() {
    DOM.preloader = document.getElementById('preloader');
    DOM.header = document.getElementById('site-header');
    DOM.themeToggleBtn = document.getElementById('theme-toggle-btn');
    DOM.btnPwaInstall = document.getElementById('btn-pwa-install');
    DOM.burgerBtn = document.getElementById('burger-menu-btn');
    DOM.mobileNav = document.getElementById('mobile-nav');

    // City Selector Elements
    DOM.btnCityModalTrigger = document.getElementById('btn-city-modal-trigger');
    DOM.headerCityName = document.getElementById('header-city-name');
    DOM.cityModal = document.getElementById('city-modal');
    DOM.citySelectBtns = document.querySelectorAll('.city-select-btn');

    // "Мої Мережі" (My Stores) Selector Elements
    DOM.btnStoresModalTrigger = document.getElementById('btn-stores-modal-trigger');
    DOM.headerStoresCount = document.getElementById('header-stores-count');
    DOM.storesModal = document.getElementById('stores-modal');
    DOM.btnStoresSelectAll = document.getElementById('btn-stores-select-all');
    DOM.btnStoresSelectCore = document.getElementById('btn-stores-select-core');
    DOM.btnStoresClear = document.getElementById('btn-stores-clear');
    DOM.btnStoresSave = document.getElementById('btn-stores-save');
    DOM.storesSelectorForm = document.getElementById('stores-selector-form');

    // Modals
    DOM.checkoutModal = document.getElementById('checkout-modal');
    DOM.cardFormModal = document.getElementById('card-form-modal');
    DOM.authModal = document.getElementById('auth-modal');

    // Checkout surface elements (index.html)
    DOM.checkoutSurface = document.getElementById('checkout-display-surface');
    DOM.checkoutDigits = document.getElementById('checkout-display-digits');
    DOM.checkoutStore = document.getElementById('checkout-display-store');
    DOM.checkoutModeBtns = document.querySelectorAll('.checkout-mode-btn');

    // Card Form (index.html)
    DOM.cardForm = document.getElementById('loyalty-card-form');
    DOM.cardModalTitle = document.getElementById('card-modal-title');
    DOM.cardStoreSelect = document.getElementById('card-store-select');
    DOM.cardNumberInput = document.getElementById('card-number-input');
    DOM.cardNoteInput = document.getElementById('card-note-input');
    DOM.cardFileInput = document.getElementById('card-file-input');
    DOM.cardFileStatus = document.getElementById('card-file-status');
    DOM.cardStoreError = document.getElementById('card-store-error');
    DOM.cardNumberError = document.getElementById('card-number-error');

    // Cards list & toolbar (index.html)
    DOM.cardsContainer = document.getElementById('wallet-cards-container');
    DOM.btnAddCard = document.getElementById('btn-add-card');
    DOM.cardSearchInput = document.getElementById('card-search-input');
    DOM.cardFilterBtns = document.querySelectorAll('.filter-bar .filter-btn[data-store]');

    // Catalog 2-Level & Filter Elements (catalog.html)
    DOM.catalogContainer = document.getElementById('catalog-products-container');
    DOM.productSearchInput = document.getElementById('product-search-input');
    DOM.macroCategoriesBar = document.getElementById('macro-categories-bar');
    DOM.macroCatBtns = document.querySelectorAll('.macro-cat-btn');
    DOM.subCategoriesWrapper = document.getElementById('sub-categories-wrapper');
    DOM.subCategoriesBar = document.getElementById('sub-categories-bar');
    DOM.breadcrumbMacro = document.getElementById('breadcrumb-macro');
    DOM.breadcrumbSub = document.getElementById('breadcrumb-sub');
    DOM.breadcrumbCount = document.getElementById('breadcrumb-count');
    DOM.storeFilterBar = document.getElementById('store-filter-bar');
    DOM.storeFilterBtns = document.querySelectorAll('#store-filter-bar .filter-btn');
    DOM.catalogSortSelect = document.getElementById('catalog-sort-select');
    DOM.btnCatalogSync = document.getElementById('btn-catalog-sync');
    DOM.catalogSyncLabel = document.getElementById('catalog-sync-label');
    DOM.catalogSyncStatus = document.getElementById('catalog-sync-status');

    // Basket page elements (basket.html)
    DOM.basketItemsContainer = document.getElementById('basket-items-container');
    DOM.basketCountBadge = document.getElementById('basket-count-badge');
    DOM.scorecardContainer = document.getElementById('scorecard-list-container');
    DOM.savingsTextDesc = document.getElementById('savings-text-desc');
    DOM.btnClearBasket = document.getElementById('btn-clear-basket');
    DOM.optimizerOptimalView = document.getElementById('optimizer-optimal-view');
    DOM.optimizerStoresView = document.getElementById('optimizer-stores-view');
    DOM.optimalRouteContainer = document.getElementById('optimal-route-container');
    DOM.tabBtnOptimal = document.getElementById('tab-btn-optimal');
    DOM.tabBtnStores = document.getElementById('tab-btn-stores');

    // Auth
    DOM.authOpenBtn = document.getElementById('auth-open-btn');
    DOM.mobileAuthBtn = document.getElementById('mobile-auth-btn');
    DOM.authForm = document.getElementById('auth-form');
    DOM.authBtnLabel = document.getElementById('auth-btn-label');
  }

  /* ─── 3. Theme Engine ────────────────────────────────────────────────────── */
  function initTheme() {
    const savedTheme = localStorage.getItem('aurelia-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    AppState.theme = savedTheme || (prefersLight ? 'light' : 'dark');
    applyTheme(AppState.theme);

    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  function applyTheme(theme) {
    AppState.theme = theme;
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('aurelia-theme', theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  function updateThemeIcon() {
    if (!DOM.themeToggleBtn) return;
    const isLight = AppState.theme === 'light';
    const iconId = isLight ? 'icon-moon' : 'icon-sun';
    DOM.themeToggleBtn.innerHTML = `
      <svg class="icon icon-stroke" aria-hidden="true">
        <use href="assets/sprite.svg#${iconId}"></use>
      </svg>
    `;
  }

  /* ─── 4. Preloader & Header Scroll ───────────────────────────────────────── */
  function initPreloader() {
    forceHidePreloader();
  }

  function initHeaderScroll() {
    if (!DOM.header) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        DOM.header.classList.add('is-scrolled');
      } else {
        DOM.header.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  /* ─── 5. Mobile Burger Navigation ────────────────────────────────────────── */
  function initBurgerMenu() {
    if (!DOM.burgerBtn || !DOM.mobileNav) return;

    function toggleMenu(forceClose) {
      const isOpen = forceClose === true ? false : !DOM.mobileNav.classList.contains('is-open');
      DOM.mobileNav.classList.toggle('is-open', isOpen);
      DOM.burgerBtn.classList.toggle('is-active', isOpen);
      DOM.burgerBtn.setAttribute('aria-expanded', String(isOpen));
      DOM.mobileNav.setAttribute('aria-hidden', String(!isOpen));
      document.body.classList.toggle('is-locked', isOpen);
    }

    DOM.burgerBtn.addEventListener('click', () => toggleMenu());

    // Close on mobile link clicks
    const links = DOM.mobileNav.querySelectorAll('.mobile-nav-link');
    links.forEach(l => l.addEventListener('click', () => toggleMenu(true)));

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.mobileNav.classList.contains('is-open')) {
        toggleMenu(true);
      }
    });
  }

  /* ─── 6. Generic Modal Manager ───────────────────────────────────────────── */
  function openModal(modalEl) {
    if (!modalEl) return;
    if (AppState.activeModal && AppState.activeModal !== modalEl) {
      closeModal(AppState.activeModal);
    }
    modalEl.classList.add('is-open');
    document.body.classList.add('is-locked');
    AppState.activeModal = modalEl;

    const focusable = modalEl.querySelector('input, select, button:not([data-close-modal])');
    if (focusable) focusable.focus();
  }

  function closeModal(modalEl) {
    const target = modalEl || AppState.activeModal;
    if (!target) return;
    target.classList.remove('is-open');
    AppState.activeModal = null;
    document.body.classList.remove('is-locked');
  }

  function initModalEvents() {
    // Backdrop click ("miss-click")
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop);
        }
      });
    });

    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal());
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && AppState.activeModal) {
        closeModal(AppState.activeModal);
      }
    });
  }

  /* ─── 6a. "Місто" (City Selector & Regional Store Manager) ──────────────── */
  function updateHeaderCityName(cityId) {
    const currentId = cityId || AppState.selectedCity || 'ivano-frankivsk';
    const city = (window.AureliaAPI && typeof window.AureliaAPI.getCityConfig === 'function')
      ? window.AureliaAPI.getCityConfig(currentId)
      : null;
    const name = city ? city.name : 'Івано-Франківськ';
    if (DOM.headerCityName) {
      DOM.headerCityName.textContent = name;
    }
  }

  function syncCityModalUI(activeCityId) {
    const current = activeCityId || AppState.selectedCity || 'ivano-frankivsk';
    const btns = document.querySelectorAll('.city-select-btn');
    btns.forEach(btn => {
      if (btn.dataset.cityId === current) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });
  }

  function updateStoresModalForCity(cityId) {
    const currentCity = cityId || AppState.selectedCity || 'ivano-frankivsk';
    const storeCards = document.querySelectorAll('.store-toggle-card');

    storeCards.forEach(card => {
      const input = card.querySelector('.store-toggle-input');
      if (!input) return;
      const storeId = input.value;
      const metaContainer = card.querySelector('.store-toggle-meta');

      const inCity = (window.AureliaAPI && typeof window.AureliaAPI.isStoreInCity === 'function')
        ? window.AureliaAPI.isStoreInCity(storeId, currentCity)
        : true;

      let notInCityBadge = metaContainer ? metaContainer.querySelector('.store-not-in-city-badge') : null;

      if (!inCity) {
        card.classList.add('is-not-in-city');
        input.disabled = true;
        input.checked = false;
        if (!notInCityBadge && metaContainer) {
          notInCityBadge = document.createElement('span');
          notInCityBadge.className = 'store-not-in-city-badge';
          notInCityBadge.textContent = 'Немає в місті';
          metaContainer.appendChild(notInCityBadge);
        }
      } else {
        card.classList.remove('is-not-in-city');
        input.disabled = false;
        input.checked = AppState.selectedStores.includes(storeId);
        if (notInCityBadge) {
          notInCityBadge.remove();
        }
      }
    });

    // Re-synchronize selected stores filtering out stores that are not in this city
    if (window.AureliaAPI && typeof window.AureliaAPI.getSelectedStores === 'function') {
      AppState.selectedStores = window.AureliaAPI.getSelectedStores();
    }
    updateStoresCountBadge();
  }

  async function changeSelectedCity(cityId) {
    if (!cityId) return;
    AppState.selectedCity = cityId;
    if (window.AureliaAPI && typeof window.AureliaAPI.setSelectedCity === 'function') {
      window.AureliaAPI.setSelectedCity(cityId);
    }
    updateHeaderCityName(cityId);
    syncCityModalUI(cityId);
    updateStoresModalForCity(cityId);
    updateStoresModalLiveBadges();
    closeModal(DOM.cityModal);

    // Refresh active page data for the newly selected city
    if (DOM.catalogContainer) {
      if (window.AureliaAPI && typeof window.AureliaAPI.getProducts === 'function') {
        AppState.products = await window.AureliaAPI.getProducts(cityId);
      }
      renderCatalogStoreFilters();
      renderCatalog();
    }
    if (DOM.cardsContainer) {
      renderCards();
    }
    if (DOM.basketItemsContainer) {
      if (window.AureliaAPI && typeof window.AureliaAPI.getProducts === 'function') {
        AppState.products = await window.AureliaAPI.getProducts(cityId);
      }
      renderBasket();
    }
  }

  function initCitySelector() {
    updateHeaderCityName(AppState.selectedCity);
    syncCityModalUI(AppState.selectedCity);
    updateStoresModalForCity(AppState.selectedCity);

    if (DOM.btnCityModalTrigger && DOM.cityModal) {
      DOM.btnCityModalTrigger.addEventListener('click', () => {
        syncCityModalUI(AppState.selectedCity);
        openModal(DOM.cityModal);
      });
    }

    const cityBtns = document.querySelectorAll('.city-select-btn');
    cityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const cityId = btn.dataset.cityId;
        if (cityId) {
          changeSelectedCity(cityId);
        }
      });
    });
  }

  /* ─── 6b. "Мої Мережі" (My Stores) Personalization Modal ─────────────────── */
  function updateStoresCountBadge() {
    if (DOM.headerStoresCount) {
      DOM.headerStoresCount.textContent = AppState.selectedStores.length;
    }
  }

  function syncStoresModalInputs() {
    updateStoresModalForCity(AppState.selectedCity);
    const inputs = document.querySelectorAll('.store-toggle-input:not([disabled])');
    inputs.forEach(input => {
      input.checked = AppState.selectedStores.includes(input.value);
    });
    updateStoresCountBadge();
  }

  function applyStoresSelection(newSelectedStores) {
    AppState.selectedStores = newSelectedStores;
    if (window.AureliaAPI && typeof window.AureliaAPI.setSelectedStores === 'function') {
      window.AureliaAPI.setSelectedStores(AppState.selectedStores);
    } else {
      localStorage.setItem('@aurelia_selected_stores', JSON.stringify(AppState.selectedStores));
    }
    updateStoresCountBadge();

    // Trigger page-specific re-renders based on active page
    if (DOM.catalogContainer) {
      renderCatalogStoreFilters();
      renderCatalog();
    }
    if (DOM.cardsContainer) {
      renderCards();
    }
    if (DOM.basketItemsContainer) {
      renderBasket();
    }
  }

  async function updateStoresModalLiveBadges() {
    if (!DOM.storesModal) return;
    try {
      if (window.AureliaAPI && typeof window.AureliaAPI.getStoresStatus === 'function') {
        const statuses = await window.AureliaAPI.getStoresStatus(AppState.selectedCity);
        if (Array.isArray(statuses)) {
          statuses.forEach(item => {
            const input = document.querySelector(`.store-toggle-input[value="${item.store}"]`);
            if (!input) return;
            const metaContainer = input.parentElement ? input.parentElement.querySelector('.store-toggle-meta') : null;
            if (!metaContainer) return;
            let badge = metaContainer.querySelector('.store-status-badge');
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'store-status-badge';
              metaContainer.appendChild(badge);
            }
            if (item.status === 'not_in_city') {
              badge.className = 'store-status-badge store-offline-badge';
              badge.textContent = 'Немає в місті';
            } else if (item.count > 0) {
              badge.className = 'store-status-badge store-live-badge';
              badge.textContent = `${item.count} акцій`;
            } else {
              badge.className = 'store-status-badge store-offline-badge';
              badge.textContent = 'QR-картка';
            }
          });
        }
      }
    } catch (err) {
      console.warn('⚠️ [Stores Modal] Не вдалося оновити бейджі статусів мереж:', err);
    }
  }

  function initStoresModal() {
    updateStoresCountBadge();
    updateStoresModalLiveBadges();

    // Trigger button in header
    if (DOM.btnStoresModalTrigger && DOM.storesModal) {
      DOM.btnStoresModalTrigger.addEventListener('click', () => {
        syncStoresModalInputs();
        updateStoresModalLiveBadges();
        openModal(DOM.storesModal);
      });
    }

    // Select all stores (active in city)
    if (DOM.btnStoresSelectAll) {
      DOM.btnStoresSelectAll.addEventListener('click', () => {
        const allStores = (window.AureliaAPI && window.AureliaAPI.ALL_STORE_IDS) || STORES;
        const availableInCity = allStores.filter(s =>
          (window.AureliaAPI && typeof window.AureliaAPI.isStoreInCity === 'function')
            ? window.AureliaAPI.isStoreInCity(s, AppState.selectedCity)
            : true
        );
        applyStoresSelection([...availableInCity]);
        syncStoresModalInputs();
      });
    }

    // Select core stores (active in city)
    if (DOM.btnStoresSelectCore) {
      DOM.btnStoresSelectCore.addEventListener('click', () => {
        const coreStores = (window.AureliaAPI && window.AureliaAPI.CORE_STORE_IDS) || ['silpo', 'atb', 'novus', 'varus', 'metro'];
        const availableInCity = coreStores.filter(s =>
          (window.AureliaAPI && typeof window.AureliaAPI.isStoreInCity === 'function')
            ? window.AureliaAPI.isStoreInCity(s, AppState.selectedCity)
            : true
        );
        applyStoresSelection([...availableInCity]);
        syncStoresModalInputs();
      });
    }

    // Clear stores
    if (DOM.btnStoresClear) {
      DOM.btnStoresClear.addEventListener('click', () => {
        applyStoresSelection([]);
        syncStoresModalInputs();
      });
    }

    // Individual checkboxes
    const storeInputs = document.querySelectorAll('.store-toggle-input');
    storeInputs.forEach(input => {
      input.addEventListener('change', () => {
        const checkedValues = Array.from(document.querySelectorAll('.store-toggle-input:checked')).map(el => el.value);
        applyStoresSelection(checkedValues);
      });
    });

    // Save button (also closes modal)
    if (DOM.btnStoresSave && DOM.storesModal) {
      DOM.btnStoresSave.addEventListener('click', () => {
        const checkedValues = Array.from(document.querySelectorAll('.store-toggle-input:checked')).map(el => el.value);
        applyStoresSelection(checkedValues);
        closeModal(DOM.storesModal);
      });
    }
  }

  /* ─── 7. Checkout Register Modal & Code Rendering (Wallet) ───────────────── */
  function openCheckoutModal(card) {
    AppState.activeCheckoutCard = card;
    AppState.checkoutMode = card.format === 'barcode' ? 'barcode' : 'qr';

    if (DOM.checkoutDigits) {
      const numStr = String(card.number || card.card_number || '');
      const formatted = numStr.replace(/(\d{4})/g, '$1 ').trim();
      DOM.checkoutDigits.textContent = formatted || '••••';
    }
    if (DOM.checkoutStore) {
      const meta = STORE_META[card.store] || STORE_META.other;
      DOM.checkoutStore.textContent = `${meta.name} • ${card.program || meta.program}`;
    }

    updateCheckoutModeButtons();
    renderActiveCheckoutCode();
    openModal(DOM.checkoutModal);
  }

  function updateCheckoutModeButtons() {
    if (!DOM.checkoutModeBtns) return;
    DOM.checkoutModeBtns.forEach(btn => {
      const mode = btn.dataset.mode;
      const isActive = mode === AppState.checkoutMode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  function renderActiveCheckoutCode() {
    if (!DOM.checkoutSurface || !AppState.activeCheckoutCard) return;
    const card = AppState.activeCheckoutCard;
    const mode = AppState.checkoutMode;
    const numStr = String(card.number || card.card_number || '');
    const qrVal = String(card.qrPayload || card.qr_payload || numStr);

    DOM.checkoutSurface.innerHTML = '';

    if (mode === 'qr') {
      if (window.AureliaQR) {
        DOM.checkoutSurface.innerHTML = window.AureliaQR.generateQRSvgString(qrVal, {
          size: 210,
          color: '#000000',
          bgColor: '#FFFFFF'
        });
      }
    } else if (mode === 'barcode') {
      if (window.AureliaQR) {
        DOM.checkoutSurface.innerHTML = window.AureliaQR.generateBarcodeSvgString(numStr, {
          barHeight: 80,
          showText: true,
          color: '#000000',
          bgColor: '#FFFFFF'
        });
      }
    } else if (mode === 'screenshot') {
      const screenshot = card.screenshotDataUrl || card.screenshot_data;
      if (screenshot) {
        const img = document.createElement('img');
        img.src = screenshot;
        img.alt = `Скріншот картки ${card.storeName || ''}`;
        DOM.checkoutSurface.appendChild(img);
      } else {
        DOM.checkoutSurface.innerHTML = `
          <p class="file-hint">Скріншот для цієї картки не завантажено.<br>Використовуйте генератор QR або Штрихкоду.</p>
        `;
      }
    }
  }

  function initCheckoutModeSwitchers() {
    if (!DOM.checkoutModeBtns) return;
    DOM.checkoutModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.checkoutMode = btn.dataset.mode;
        updateCheckoutModeButtons();
        renderActiveCheckoutCode();
      });
    });
  }

  /* ─── 8. Loyalty Cards Controller (index.html) ───────────────────────────── */
  async function initWalletPage() {
    if (!DOM.cardsContainer) return;

    if (window.AureliaAPI) {
      AppState.cards = await window.AureliaAPI.getCards();
    }
    renderCards();
    initCardForm();
    initCardFilters();
  }

  function renderCards() {
    if (!DOM.cardsContainer) return;

    let filtered = AppState.cards;

    if (AppState.filterStore !== 'all') {
      filtered = filtered.filter(c => c.store === AppState.filterStore);
    }

    if (AppState.searchQuery) {
      const q = AppState.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.number && c.number.toLowerCase().includes(q)) ||
        (c.storeName && c.storeName.toLowerCase().includes(q)) ||
        (c.program && c.program.toLowerCase().includes(q)) ||
        (c.note && c.note.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      DOM.cardsContainer.innerHTML = `
        <div class="wallet-empty-state">
          <svg class="icon icon-lg" aria-hidden="true">
            <use href="assets/sprite.svg#icon-search"></use>
          </svg>
          <h3 class="wallet-empty-title">Карток не знайдено</h3>
          <p class="wallet-empty-desc">Спробуйте змінити критерії пошуку або додайте нову картку лояльності.</p>
          <button type="button" class="btn btn-primary" id="empty-add-btn">
            <svg class="icon" aria-hidden="true">
              <use href="assets/sprite.svg#icon-plus"></use>
            </svg>
            <span>Додати картку</span>
          </button>
        </div>
      `;
      const emptyAdd = document.getElementById('empty-add-btn');
      if (emptyAdd) emptyAdd.addEventListener('click', openAddCardForm);
      return;
    }

    DOM.cardsContainer.innerHTML = filtered.map(card => {
      const meta = STORE_META[card.store] || STORE_META.other;
      const logoSymbol = meta.logo;
      const numStr = String(card.number || card.card_number || '');
      const formattedNumber = numStr.replace(/(\d{4})/g, '$1 ').trim();
      const actionIcon = card.format === 'barcode' ? 'icon-barcode' : 'icon-qr';

      return `
        <article class="loyalty-card reveal-item is-visible" data-store="${card.store}" data-card-id="${card.id}">
          <div class="card-top">
            <div class="card-brand">
              <svg class="store-badge-icon" aria-hidden="true">
                <use href="assets/sprite.svg#${logoSymbol}"></use>
              </svg>
              <div class="card-title-group">
                <h3 class="card-store-name">${card.storeName || meta.name}</h3>
                <span class="card-program-name">${card.program || meta.program}</span>
              </div>
            </div>
            ${card.note ? `<span class="card-bonuses-badge">${card.note}</span>` : ''}
          </div>

          <div class="card-number-wrapper">
            <span class="card-number-label">Номер картки / QR</span>
            <div class="card-number-code">${formattedNumber}</div>
          </div>

          <div class="card-actions">
            <button type="button" class="btn-card-scan" data-action="scan" data-card-id="${card.id}" aria-label="Показати на касі ${card.storeName || meta.name}">
              <svg class="icon" aria-hidden="true">
                <use href="assets/sprite.svg#${actionIcon}"></use>
              </svg>
              <span>Показати на касі</span>
            </button>
            <div class="card-action-group">
              <button type="button" class="btn-icon" data-action="edit" data-card-id="${card.id}" aria-label="Редагувати картку ${card.storeName || meta.name}">
                <svg class="icon icon-sm" aria-hidden="true">
                  <use href="assets/sprite.svg#icon-edit"></use>
                </svg>
              </button>
              <button type="button" class="btn-icon" data-action="delete" data-card-id="${card.id}" aria-label="Видалити картку ${card.storeName || meta.name}">
                <svg class="icon icon-sm" aria-hidden="true">
                  <use href="assets/sprite.svg#icon-trash"></use>
                </svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    bindCardActionButtons();
  }

  function bindCardActionButtons() {
    if (!DOM.cardsContainer) return;

    DOM.cardsContainer.querySelectorAll('[data-action="scan"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cardId;
        const card = AppState.cards.find(c => String(c.id) === String(id));
        if (card) openCheckoutModal(card);
      });
    });

    DOM.cardsContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cardId;
        const card = AppState.cards.find(c => String(c.id) === String(id));
        if (card) openEditCardForm(card);
      });
    });

    DOM.cardsContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.cardId;
        const card = AppState.cards.find(c => String(c.id) === String(id));
        const name = card ? card.storeName : 'картку';
        if (confirm(`Ви впевнені, що бажаєте видалити ${name}?`)) {
          if (window.AureliaAPI) {
            await window.AureliaAPI.deleteCard(id);
          }
          AppState.cards = AppState.cards.filter(c => String(c.id) !== String(id));
          renderCards();
        }
      });
    });
  }

  function openAddCardForm() {
    AppState.editingCardId = null;
    AppState.uploadedScreenshotUrl = null;
    if (DOM.cardForm) DOM.cardForm.reset();
    if (DOM.cardModalTitle) DOM.cardModalTitle.textContent = 'Додати картку лояльності';
    if (DOM.cardFileStatus) DOM.cardFileStatus.textContent = 'Натисніть або перетягніть скріншот сюди';
    clearCardFormErrors();
    openModal(DOM.cardFormModal);
  }

  function openEditCardForm(card) {
    AppState.editingCardId = card.id;
    AppState.uploadedScreenshotUrl = card.screenshotDataUrl || card.screenshot_data || null;
    clearCardFormErrors();

    if (DOM.cardModalTitle) DOM.cardModalTitle.textContent = 'Редагувати картку лояльності';
    if (DOM.cardStoreSelect) DOM.cardStoreSelect.value = card.store;
    if (DOM.cardNumberInput) DOM.cardNumberInput.value = card.number || card.card_number || '';
    if (DOM.cardNoteInput) DOM.cardNoteInput.value = card.note || card.points || '';
    if (DOM.cardFileStatus) {
      DOM.cardFileStatus.textContent = (card.screenshotDataUrl || card.screenshot_data) ? 'Скріншот завантажено ✓' : 'Натисніть для зміни скріншота';
    }

    openModal(DOM.cardFormModal);
  }

  function clearCardFormErrors() {
    if (DOM.cardStoreError) DOM.cardStoreError.textContent = '';
    if (DOM.cardNumberError) DOM.cardNumberError.textContent = '';
  }

  function initCardForm() {
    if (DOM.btnAddCard) {
      DOM.btnAddCard.addEventListener('click', openAddCardForm);
    }

    if (DOM.cardFileInput) {
      DOM.cardFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (DOM.cardFileStatus) DOM.cardFileStatus.textContent = 'Розпізнавання коду...';

        if (window.AureliaQR) {
          try {
            const result = await window.AureliaQR.decodeImage(file);
            AppState.uploadedScreenshotUrl = result.dataUrl;

            if (result.success && result.rawValue) {
              if (DOM.cardNumberInput) DOM.cardNumberInput.value = result.rawValue;
              if (DOM.cardFileStatus) DOM.cardFileStatus.textContent = `Зчитано код: ${result.rawValue} ✓`;
            } else {
              if (DOM.cardFileStatus) DOM.cardFileStatus.textContent = `Скріншот збережено ✓ (${file.name})`;
            }
          } catch (err) {
            console.error('File decode error:', err);
            if (DOM.cardFileStatus) DOM.cardFileStatus.textContent = 'Помилка зчитування файлу.';
          }
        }
      });
    }

    if (DOM.cardForm) {
      DOM.cardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearCardFormErrors();

        const store = (DOM.cardStoreSelect?.value || '').trim();
        const number = (DOM.cardNumberInput?.value || '').trim();
        const note = (DOM.cardNoteInput?.value || '').trim();

        let hasError = false;
        if (!store) {
          if (DOM.cardStoreError) DOM.cardStoreError.textContent = 'Оберіть мережу супермаркетів.';
          hasError = true;
        }
        if (!number || number.length < 4) {
          if (DOM.cardNumberError) DOM.cardNumberError.textContent = 'Введіть коректний номер картки (від 4 символів).';
          hasError = true;
        }

        if (hasError) return;

        const meta = STORE_META[store] || STORE_META.other;
        const cardPayload = {
          store,
          storeName: meta.name,
          program: meta.program,
          number,
          qrPayload: number,
          note,
          format: /^\d+$/.test(number) && number.length >= 12 ? 'barcode' : 'qr',
          screenshotDataUrl: AppState.uploadedScreenshotUrl
        };

        if (AppState.editingCardId) {
          if (window.AureliaAPI) {
            const updated = await window.AureliaAPI.updateCard(AppState.editingCardId, cardPayload);
            const idx = AppState.cards.findIndex(c => String(c.id) === String(AppState.editingCardId));
            if (idx !== -1) AppState.cards[idx] = updated;
          }
        } else {
          if (window.AureliaAPI) {
            const created = await window.AureliaAPI.createCard(cardPayload);
            AppState.cards.unshift(created);
          }
        }

        closeModal(DOM.cardFormModal);
        renderCards();
      });
    }
  }

  function initCardFilters() {
    if (DOM.cardFilterBtns) {
      DOM.cardFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          DOM.cardFilterBtns.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          AppState.filterStore = btn.dataset.store || 'all';
          renderCards();
        });
      });
    }

    if (DOM.cardSearchInput) {
      DOM.cardSearchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value.trim();
        renderCards();
      });
    }
  }

  function updateCatalogSyncBadge(timestamp) {
    if (!DOM.catalogSyncStatus) return;
    if (!timestamp) {
      DOM.catalogSyncStatus.textContent = 'Останнє оновлення: сьогодні';
      return;
    }
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) {
        DOM.catalogSyncStatus.textContent = 'Останнє оновлення: актуально';
        return;
      }
      const formatted = d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      DOM.catalogSyncStatus.textContent = `Останнє оновлення: ${formatted}`;
    } catch {
      DOM.catalogSyncStatus.textContent = 'Останнє оновлення: актуально';
    }
  }

  /* ─── 9. Catalog & Promotions Controller (catalog.html) ─────────────────── */
  function renderSubCategories(macroCat) {
    if (!DOM.subCategoriesBar) return;
    const items = CATEGORY_HIERARCHY[macroCat] || CATEGORY_HIERARCHY['all'] || [];

    DOM.subCategoriesBar.innerHTML = items.map(sub => {
      const isActive = AppState.catalogSubCategory === sub.id;
      return `
        <button type="button" class="sub-cat-chip ${isActive ? 'is-active' : ''}" data-sub="${sub.id}">
          <svg class="icon icon-stroke" aria-hidden="true">
            <use href="assets/sprite.svg#${sub.icon}"></use>
          </svg>
          <span>${sub.title}</span>
        </button>
      `;
    }).join('');

    const chips = DOM.subCategoriesBar.querySelectorAll('.sub-cat-chip');
    if (chips && chips.length > 0) {
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          DOM.subCategoriesBar?.querySelectorAll('.sub-cat-chip')?.forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          AppState.catalogSubCategory = chip.dataset.sub || 'all';
          renderCatalog();
        });
      });
    }
  }

  function renderCatalogStoreFilters() {
    if (!DOM.storeFilterBar) return;
    const activeStores = AppState.selectedStores.length > 0 ? AppState.selectedStores : STORES;
    const buttons = [
      `<button type="button" class="filter-btn ${AppState.catalogStore === 'all' ? 'is-active' : ''}" data-store="all">Всі мережі</button>`
    ];

    activeStores.forEach(s => {
      const meta = STORE_META[s] || { name: s.toUpperCase() };
      const isActive = AppState.catalogStore === s;
      buttons.push(
        `<button type="button" class="filter-btn ${isActive ? 'is-active' : ''}" data-store="${s}">${meta.name}</button>`
      );
    });

    DOM.storeFilterBar.innerHTML = buttons.join('');

    const filterBtns = DOM.storeFilterBar.querySelectorAll('.filter-btn');
    if (filterBtns && filterBtns.length > 0) {
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          DOM.storeFilterBar?.querySelectorAll('.filter-btn')?.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          AppState.catalogStore = btn.dataset.store || 'all';
          renderCatalog();
        });
      });
    }
  }

  function updateCatalogBreadcrumbs(totalCount) {
    if (DOM.breadcrumbMacro) {
      const macroTitles = {
        'all': 'Всі категорії',
        'Продукти': 'Продукти харчування',
        'Краса та Гігієна': 'Краса та догляд',
        'Дім та Побут': 'Товари для дому',
        'Зоотовари': 'Зоотовари'
      };
      DOM.breadcrumbMacro.textContent = macroTitles[AppState.catalogMainCategory] || AppState.catalogMainCategory;
    }

    if (DOM.breadcrumbSub) {
      if (AppState.catalogSubCategory === 'all') {
        DOM.breadcrumbSub.textContent = 'Всі товари';
      } else {
        DOM.breadcrumbSub.textContent = AppState.catalogSubCategory;
      }
    }

    if (DOM.breadcrumbCount) {
      DOM.breadcrumbCount.textContent = `Знайдено: ${totalCount} акцій`;
    }
  }

  async function initCatalogPage() {
    if (!DOM.catalogContainer) return;

    if (window.AureliaAPI) {
      AppState.products = await window.AureliaAPI.getProducts();
      AppState.basket = await window.AureliaAPI.getBasket();
    }

    const lastSync = (window.AureliaAPI && typeof window.AureliaAPI.getLastSyncTime === 'function' ? window.AureliaAPI.getLastSyncTime() : null) || AppState.products?.[0]?.syncedAt;
    updateCatalogSyncBadge(lastSync);

    renderSubCategories(AppState.catalogMainCategory);
    renderCatalogStoreFilters();
    renderCatalog();
    initCatalogControls();
  }

  function renderCatalog() {
    if (!DOM.catalogContainer) return;

    let list = [...AppState.products];

    // Filter by Level 1 Macro Category
    if (AppState.catalogMainCategory !== 'all') {
      list = list.filter(p => {
        const cat = p.mainCategory || p.main_category;
        if (cat) return cat === AppState.catalogMainCategory;
        if (window.AureliaAPI && typeof window.AureliaAPI.resolveCategories === 'function') {
          return window.AureliaAPI.resolveCategories(p).mainCategory === AppState.catalogMainCategory;
        }
        return true;
      });
    }

    // Filter by Level 2 Subcategory
    if (AppState.catalogSubCategory !== 'all') {
      list = list.filter(p => {
        const sub = p.subCategory || p.sub_category;
        if (sub && sub === AppState.catalogSubCategory) return true;
        if (p.category === AppState.catalogSubCategory) return true;
        if (window.AureliaAPI && typeof window.AureliaAPI.resolveCategories === 'function') {
          return window.AureliaAPI.resolveCategories(p).subCategory === AppState.catalogSubCategory;
        }
        return false;
      });
    }

    // Filter by store personalization: keep products that have at least one price in user's selected stores
    const activeSelectedStores = AppState.selectedStores.length > 0 ? AppState.selectedStores : STORES;
    list = list.filter(p => {
      const prices = Array.isArray(p.prices) && p.prices.length > 0
        ? p.prices
        : Object.entries(p.storePrices || {}).map(([s, val]) => ({ store: s, ...val }));
      return prices.some(pr => activeSelectedStores.includes(pr.store) && parseFloat(pr.price) > 0);
    });

    // Filter by single store if chosen via store filter button
    if (AppState.catalogStore && AppState.catalogStore !== 'all') {
      list = list.filter(p => {
        if (Array.isArray(p.prices) && p.prices.length > 0) {
          return p.prices.some(pr => pr.store === AppState.catalogStore && parseFloat(pr.price) > 0);
        }
        return Boolean(p.storePrices && p.storePrices[AppState.catalogStore]);
      });
    }

    // Filter by search query
    if (AppState.catalogSearch) {
      const q = AppState.catalogSearch.toLowerCase();
      list = list.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q))
      );
    }

    // Filter by multi-store comparison mode (2+ stores)
    if (AppState.catalogSort === 'multi-store') {
      list = list.filter(p => {
        const prices = (
          Array.isArray(p.prices) && p.prices.length > 0
            ? p.prices
            : Object.entries(p.storePrices || {}).map(([s, val]) => ({ store: s, ...val }))
        ).filter(entry => {
          const pr = parseFloat(entry.price);
          const inSelected = activeSelectedStores.includes(entry.store);
          const matchesStore = AppState.catalogStore === 'all' || entry.store === AppState.catalogStore;
          return !isNaN(pr) && pr > 0 && inSelected && matchesStore;
        });
        return prices.length >= 2;
      });
    }

    // Sort
    list.sort((a, b) => {
      const getMinPrice = (prod) => {
        const prs = (Array.isArray(prod.prices) && prod.prices.length > 0
          ? prod.prices.map(x => parseFloat(x.price))
          : Object.values(prod.storePrices || {}).map(x => parseFloat(x.price))
        ).filter(p => !isNaN(p) && p > 0);
        return prs.length > 0 ? Math.min(...prs) : 0;
      };

      const getMaxDisc = (prod) => {
        const prs = (Array.isArray(prod.prices) && prod.prices.length > 0
          ? prod.prices.map(x => {
              const p = parseFloat(x.price) || 0;
              const op = parseFloat(x.oldPrice || x.old_price) || 0;
              return (p > 0 && op > p) ? Math.round(((op - p) / op) * 100) : 0;
            })
          : Object.values(prod.storePrices || {}).map(x => Number(x.discount) || 0)
        ).filter(d => !isNaN(d) && d > 0);
        return prs.length > 0 ? Math.max(...prs) : 0;
      };

      if (AppState.catalogSort === 'cheap') {
        return getMinPrice(a) - getMinPrice(b);
      } else if (AppState.catalogSort === 'discount') {
        return getMaxDisc(b) - getMaxDisc(a);
      } else if (AppState.catalogSort === 'multi-store') {
        const getStoreCount = (prod) => {
          const prs = (Array.isArray(prod.prices) && prod.prices.length > 0
            ? prod.prices
            : Object.entries(prod.storePrices || {}).map(([s, val]) => ({ store: s, ...val }))
          ).filter(entry => {
            const pr = parseFloat(entry.price);
            const inSelected = activeSelectedStores.includes(entry.store);
            const matchesStore = AppState.catalogStore === 'all' || entry.store === AppState.catalogStore;
            return !isNaN(pr) && pr > 0 && inSelected && matchesStore;
          });
          return prs.length;
        };
        const countDiff = getStoreCount(b) - getStoreCount(a);
        if (countDiff !== 0) return countDiff;
        return getMinPrice(a) - getMinPrice(b);
      } else if (AppState.catalogSort === 'title') {
        return (a.title || a.name || '').localeCompare(b.title || b.name || '', 'uk');
      }
      return 0;
    });

    updateCatalogBreadcrumbs(list.length);

    if (list.length === 0) {
      DOM.catalogContainer.innerHTML = `
        <div class="wallet-empty-state">
          <svg class="icon icon-lg" aria-hidden="true">
            <use href="assets/sprite.svg#icon-search"></use>
          </svg>
          <h3 class="wallet-empty-title">Товарів не знайдено</h3>
          <p class="wallet-empty-desc">Спробуйте змінити фільтри або пошуковий запит.</p>
        </div>
      `;
      return;
    }

    DOM.catalogContainer.innerHTML = list.map(prod => {
      // Collect prices strictly for active selected stores & selected single store
      const priceEntries = (
        Array.isArray(prod.prices) && prod.prices.length > 0
          ? prod.prices
          : Object.entries(prod.storePrices || {}).map(([store, val]) => ({ store, ...val }))
      ).filter(entry => {
        const p = parseFloat(entry.price);
        const inSelected = activeSelectedStores.includes(entry.store);
        const matchesStore = AppState.catalogStore === 'all' || entry.store === AppState.catalogStore;
        return !isNaN(p) && p > 0 && inSelected && matchesStore;
      });

      // Guard minPrice and maxDiscount so they NEVER display Infinity or NaN
      let minPrice = 0;
      let maxDiscount = 0;

      if (priceEntries.length > 0) {
        const numericPrices = priceEntries.map(e => parseFloat(e.price)).filter(p => !isNaN(p) && p > 0);
        if (numericPrices.length > 0) {
          minPrice = Math.min(...numericPrices);
        }

        priceEntries.forEach(entry => {
          const p = parseFloat(entry.price) || 0;
          const rawOld = entry.oldPrice !== undefined ? entry.oldPrice : entry.old_price;
          const oldPrice = (rawOld && !isNaN(parseFloat(rawOld))) ? parseFloat(rawOld) : null;
          const disc = entry.discount !== undefined
            ? Number(entry.discount) || 0
            : (oldPrice && oldPrice > p ? Math.round(((oldPrice - p) / oldPrice) * 100) : 0);
          if (disc > maxDiscount) maxDiscount = disc;
        });
      }

      if (!isFinite(minPrice) || isNaN(minPrice) || minPrice <= 0) {
        minPrice = 0;
      }
      if (!isFinite(maxDiscount) || isNaN(maxDiscount) || maxDiscount <= 0) {
        maxDiscount = 0;
      }

      // Build store comparison rows ONLY for stores that actually returned the item
      const storesHtml = priceEntries.length > 0 ? priceEntries.map(entry => {
        const s = entry.store;
        const p = parseFloat(entry.price) || 0;
        const rawOld = entry.oldPrice !== undefined ? entry.oldPrice : entry.old_price;
        const oldPrice = (rawOld && !isNaN(parseFloat(rawOld))) ? parseFloat(rawOld) : null;
        const isBest = minPrice > 0 && Math.abs(p - minPrice) < 0.01;
        const meta = STORE_META[s] || { name: (s || 'Мережа').toUpperCase(), program: '', logo: 'icon-cart', badgeText: '' };
        const verifyLink = entry.sourceUrl
          ? `<a href="${entry.sourceUrl}" class="store-verify-link" target="_blank" rel="noopener noreferrer">На сайті ↗</a>`
          : '';

        return `
          <div class="store-price-row ${isBest ? 'is-best' : ''}">
            <div class="store-price-brand">
              <span class="store-pill ${s}">${meta.name}</span>
              ${isBest && priceEntries.length > 1 ? '<span class="best-price-badge">НАЙВИГІДНІШЕ</span>' : ''}
            </div>
            <div class="store-price-val">
              <span>${p.toFixed(2)} грн</span>
              ${oldPrice && oldPrice > p ? `<small class="price-old">${oldPrice.toFixed(2)}</small>` : ''}
              ${verifyLink}
            </div>
          </div>
        `;
      }).join('') : '<div class="file-hint">Ціни оновлюються...</div>';

      // Check if already in basket
      const inBasket = AppState.basket.some(item => String(item.productId) === String(prod.id));

      const priceCurrentHtml = minPrice > 0
        ? `${minPrice.toFixed(2)} грн`
        : 'Уточнюється';

      const displayCategory = prod.subCategory || prod.category || 'Продукти';
      const multiStoreBadgeHtml = priceEntries.length >= 2
        ? `<span class="multi-store-badge">Порівняння в ${priceEntries.length} мережах</span>`
        : '';

      return `
        <article class="product-card reveal-item is-visible" data-product-id="${prod.id}">
          <div class="product-badge-row">
            <span class="product-category-tag">${displayCategory}</span>
            ${multiStoreBadgeHtml}
            ${maxDiscount > 0 ? `<span class="discount-tag">до -${maxDiscount}%</span>` : ''}
          </div>

          <h3 class="product-title">${prod.title || prod.name}</h3>
          <div class="file-hint">Одиниця: ${prod.unit || 'шт'}</div>

          <!-- Таблиця цін за наявними мережами -->
          <div class="product-stores-list">
            ${storesHtml}
          </div>

          <div class="product-price-row">
            <div>
              <span class="file-hint">${priceEntries.length > 1 ? 'Найкраща ціна від:' : 'Ціна:'}</span>
              <span class="price-current">${priceCurrentHtml}</span>
            </div>
            <button type="button" class="btn ${inBasket ? 'btn-secondary' : 'btn-primary'}" data-add-basket="${prod.id}">
              <svg class="icon icon-sm" aria-hidden="true">
                <use href="assets/sprite.svg#icon-cart"></use>
              </svg>
              <span>${inBasket ? 'У кошику ✓' : 'Додати в кошик'}</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    bindCatalogActions();
  }

  function bindCatalogActions() {
    if (!DOM.catalogContainer) return;

    DOM.catalogContainer.querySelectorAll('[data-add-basket]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.addBasket;
        if (window.AureliaAPI) {
          const existing = AppState.basket.find(i => String(i.productId) === String(prodId));
          const newQty = existing ? existing.qty + 1 : 1;
          AppState.basket = await window.AureliaAPI.toggleBasketItem(prodId, newQty);
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
          btn.querySelector('span').textContent = 'У кошику ✓';
        }
      });
    });
  }

  function initCatalogControls() {
    // Level 1 Macro Category buttons
    const macroBtns = document.querySelectorAll('.macro-cat-btn');
    if (macroBtns.length > 0) {
      macroBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          macroBtns.forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
          AppState.catalogMainCategory = btn.dataset.main || 'all';
          AppState.catalogSubCategory = 'all';
          renderSubCategories(AppState.catalogMainCategory);
          renderCatalog();
        });
      });
    }

    // Live search
    if (DOM.productSearchInput) {
      DOM.productSearchInput.addEventListener('input', (e) => {
        AppState.catalogSearch = e.target.value.trim();
        renderCatalog();
      });
    }

    // Sorting select
    if (DOM.catalogSortSelect) {
      DOM.catalogSortSelect.addEventListener('change', (e) => {
        AppState.catalogSort = e.target.value;
        renderCatalog();
      });
    }

    // Live synchronization button in catalog
    if (DOM.btnCatalogSync) {
      DOM.btnCatalogSync.addEventListener('click', async () => {
        try {
          DOM.btnCatalogSync.disabled = true;
          if (DOM.catalogSyncLabel) DOM.catalogSyncLabel.textContent = 'Синхронізація...';
          if (DOM.catalogSyncStatus) {
            DOM.catalogSyncStatus.classList.add('is-syncing');
            DOM.catalogSyncStatus.textContent = 'Отримання свіжих цін із супермаркетів...';
          }

          if (window.AureliaAPI && typeof window.AureliaAPI.syncProducts === 'function') {
            const fresh = await window.AureliaAPI.syncProducts();
            if (Array.isArray(fresh) && fresh.length > 0) {
              AppState.products = fresh;
              renderCatalog();
            }
          }

          const syncTime = (window.AureliaAPI && typeof window.AureliaAPI.getLastSyncTime === 'function' ? window.AureliaAPI.getLastSyncTime() : null) || new Date().toISOString();
          updateCatalogSyncBadge(syncTime);

          if (DOM.catalogSyncLabel) DOM.catalogSyncLabel.textContent = 'Оновлено!';
          setTimeout(() => {
            if (DOM.catalogSyncLabel) DOM.catalogSyncLabel.textContent = 'Оновити актуальні акції';
            DOM.btnCatalogSync.disabled = false;
            if (DOM.catalogSyncStatus) DOM.catalogSyncStatus.classList.remove('is-syncing');
          }, 1800);
        } catch (err) {
          console.error('Помилка оновлення акцій:', err);
          if (DOM.catalogSyncLabel) DOM.catalogSyncLabel.textContent = 'Помилка';
          setTimeout(() => {
            if (DOM.catalogSyncLabel) DOM.catalogSyncLabel.textContent = 'Оновити актуальні акції';
            DOM.btnCatalogSync.disabled = false;
            if (DOM.catalogSyncStatus) DOM.catalogSyncStatus.classList.remove('is-syncing');
          }, 1800);
        }
      });
    }
  }

  /* ─── 10. Smart Basket & Two-Mode Optimizer Controller (basket.html) ────── */
  async function initBasketPage() {
    if (!DOM.basketItemsContainer) return;

    initOptimizerTabs();

    if (window.AureliaAPI) {
      AppState.products = await window.AureliaAPI.getProducts(AppState.selectedCity);
      AppState.basket = await window.AureliaAPI.getBasket();
    }

    renderBasket();

    if (DOM.btnClearBasket) {
      DOM.btnClearBasket.addEventListener('click', async () => {
        if (confirm('Очистити весь кошик покупок?')) {
          if (window.AureliaAPI) {
            AppState.basket = await window.AureliaAPI.clearBasket();
          }
          renderBasket();
        }
      });
    }
  }

  function initOptimizerTabs() {
    if (!DOM.tabBtnOptimal || !DOM.tabBtnStores) return;

    DOM.tabBtnOptimal.addEventListener('click', () => {
      DOM.tabBtnOptimal.classList.add('is-active');
      DOM.tabBtnOptimal.setAttribute('aria-selected', 'true');
      DOM.tabBtnStores.classList.remove('is-active');
      DOM.tabBtnStores.setAttribute('aria-selected', 'false');

      if (DOM.optimizerOptimalView) {
        DOM.optimizerOptimalView.classList.add('is-active');
      }
      if (DOM.optimizerStoresView) {
        DOM.optimizerStoresView.classList.remove('is-active');
      }
    });

    DOM.tabBtnStores.addEventListener('click', () => {
      DOM.tabBtnStores.classList.add('is-active');
      DOM.tabBtnStores.setAttribute('aria-selected', 'true');
      DOM.tabBtnOptimal.classList.remove('is-active');
      DOM.tabBtnOptimal.setAttribute('aria-selected', 'false');

      if (DOM.optimizerStoresView) {
        DOM.optimizerStoresView.classList.add('is-active');
      }
      if (DOM.optimizerOptimalView) {
        DOM.optimizerOptimalView.classList.remove('is-active');
      }
    });
  }

  /**
   * Resolves valid promotional prices for a product in the current city & selected stores,
   * with guaranteed fallback to any city-available store to avoid 0.00 грн display.
   */
  function getProductValidPrices(prod) {
    if (!prod) return [];
    let list = [];
    if (Array.isArray(prod.prices) && prod.prices.length > 0) {
      list = prod.prices;
    } else if (prod.storePrices && typeof prod.storePrices === 'object') {
      list = Object.entries(prod.storePrices).map(([st, data]) => ({
        store: st,
        price: parseFloat(data?.price) || 0,
        oldPrice: parseFloat(data?.oldPrice) || 0,
        discount: data?.discount || 0,
        sourceUrl: data?.sourceUrl || '',
        city: prod.city || AppState.selectedCity
      }));
    }

    const valid = list.filter(p => p && parseFloat(p.price) > 0);

    const cityConfig = (window.AureliaAPI && window.AureliaAPI.CITIES)
      ? window.AureliaAPI.CITIES[AppState.selectedCity]
      : null;
    const cityActiveStores = cityConfig ? cityConfig.activeStores : STORES;

    // Filter by city active stores
    let cityPrices = valid.filter(p => {
      const storeKey = (p.store || '').toLowerCase();
      const storeMatch = cityActiveStores.some(cas => cas.toLowerCase() === storeKey);
      if (p.city && p.city !== 'all' && p.city !== AppState.selectedCity) return false;
      return storeMatch;
    });

    if (cityPrices.length === 0) {
      cityPrices = valid;
    }

    // Filter by user's personalized "Мої мережі"
    const userStores = Array.isArray(AppState.selectedStores) && AppState.selectedStores.length > 0
      ? AppState.selectedStores
      : cityActiveStores;

    let userPrices = cityPrices.filter(p => {
      const storeKey = (p.store || '').toLowerCase();
      return userStores.some(us => us.toLowerCase() === storeKey);
    });

    // Fallback to all city stores for that product so item never calculates as 0.00 грн
    if (userPrices.length === 0) {
      userPrices = cityPrices;
    }

    return userPrices;
  }

  function renderBasket() {
    if (!DOM.basketItemsContainer) return;

    // Update count badge
    const totalItems = AppState.basket.reduce((sum, item) => sum + item.qty, 0);
    if (DOM.basketCountBadge) {
      DOM.basketCountBadge.textContent = totalItems;
    }

    if (AppState.basket.length === 0) {
      DOM.basketItemsContainer.innerHTML = `
        <div class="wallet-empty-state">
          <svg class="icon icon-lg" aria-hidden="true">
            <use href="assets/sprite.svg#icon-cart"></use>
          </svg>
          <h3 class="wallet-empty-title">Ваш кошик порожній</h3>
          <p class="wallet-empty-desc">Додайте акційні товари з каталогу, щоб миттєво порахувати та порівняти чек у кожному супермаркеті вашого міста.</p>
          <a href="catalog.html" class="btn btn-primary">
            <svg class="icon" aria-hidden="true">
              <use href="assets/sprite.svg#icon-search"></use>
            </svg>
            <span>Перейти до каталогу акцій</span>
          </a>
        </div>
      `;

      if (DOM.optimalRouteContainer) {
        DOM.optimalRouteContainer.innerHTML = '<p class="file-hint text-center">Додайте товари з каталогу для розрахунку оптимального маршруту.</p>';
      }
      if (DOM.scorecardContainer) {
        DOM.scorecardContainer.innerHTML = '<p class="file-hint text-center">Додайте товари з каталогу для порівняння чеків.</p>';
      }
      if (DOM.savingsTextDesc) {
        DOM.savingsTextDesc.textContent = 'Оберіть товари для порівняння';
      }
      return;
    }

    // Render list of basket items with best available store in city
    DOM.basketItemsContainer.innerHTML = AppState.basket.map(item => {
      const prod = AppState.products.find(p => String(p.id) === String(item.productId));
      if (!prod) return '';

      const validPrices = getProductValidPrices(prod);
      validPrices.sort((a, b) => a.price - b.price);

      const best = validPrices[0];
      const minP = best ? parseFloat(best.price) : 0;
      const bestStore = best ? best.store : '';
      const storeName = STORE_META[bestStore]?.name || bestStore;
      const itemTotal = (minP * item.qty).toFixed(2);

      return `
        <article class="basket-item reveal-item is-visible" data-basket-product="${prod.id}">
          <div class="basket-item-main">
            <div class="basket-item-info">
              <h3 class="basket-item-title">${prod.title || prod.name}</h3>
              <span class="basket-item-meta">${prod.category || prod.subCategory} • від ${minP.toFixed(2)} грн / ${prod.unit || 'шт'}${storeName ? ` (найкраща ціна у ${storeName})` : ''}</span>
            </div>
            <div class="basket-price-total">
              ${itemTotal} грн
            </div>
          </div>

          <div class="basket-item-actions">
            <div class="qty-control">
              <button type="button" class="qty-btn" data-qty-change="-1" data-prod-id="${prod.id}" aria-label="Зменшити кількість">-</button>
              <span class="qty-val">${item.qty}</span>
              <button type="button" class="qty-btn" data-qty-change="1" data-prod-id="${prod.id}" aria-label="Збільшити кількість">+</button>
            </div>

            <button type="button" class="btn-icon" data-remove-basket="${prod.id}" aria-label="Видалити ${prod.title || prod.name}">
              <svg class="icon icon-sm" aria-hidden="true">
                <use href="assets/sprite.svg#icon-trash"></use>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    bindBasketActions();
    calculateAndRenderOptimizer();
  }

  function bindBasketActions() {
    if (!DOM.basketItemsContainer) return;

    // Quantity buttons
    DOM.basketItemsContainer.querySelectorAll('[data-qty-change]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.prodId;
        const change = parseInt(btn.dataset.qtyChange, 10);
        const item = AppState.basket.find(i => String(i.productId) === String(prodId));
        if (!item) return;

        const newQty = item.qty + change;
        if (window.AureliaAPI) {
          AppState.basket = await window.AureliaAPI.toggleBasketItem(prodId, newQty);
        }
        renderBasket();
      });
    });

    // Remove button
    DOM.basketItemsContainer.querySelectorAll('[data-remove-basket]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.removeBasket;
        if (window.AureliaAPI) {
          AppState.basket = await window.AureliaAPI.toggleBasketItem(prodId, 0);
        }
        renderBasket();
      });
    });
  }

  /* ─── Two-Mode Basket Optimizer (Split-Store Route & Single-Store Leaderboard) ─── */
  function calculateAndRenderOptimizer() {
    if (AppState.basket.length === 0) return;

    const cityConfig = (window.AureliaAPI && window.AureliaAPI.CITIES)
      ? window.AureliaAPI.CITIES[AppState.selectedCity]
      : null;
    const cityActiveStores = cityConfig ? cityConfig.activeStores : STORES;

    /* ── MODE A: Оптимальний маршрут (Split-Store Best Deal) ── */
    const routeStores = {};
    AppState.basket.forEach(item => {
      const prod = AppState.products.find(p => String(p.id) === String(item.productId));
      if (!prod) return;

      const validPrices = getProductValidPrices(prod);
      if (validPrices.length === 0) return;

      validPrices.sort((a, b) => a.price - b.price);
      const best = validPrices[0];

      const itemPrice = parseFloat(best.price);
      const itemOldPrice = parseFloat(best.oldPrice) && parseFloat(best.oldPrice) > itemPrice
        ? parseFloat(best.oldPrice)
        : Math.round(itemPrice * 1.25);
      const lineTotal = itemPrice * item.qty;
      const lineOldTotal = itemOldPrice * item.qty;

      if (!routeStores[best.store]) {
        routeStores[best.store] = {
          store: best.store,
          meta: STORE_META[best.store] || { name: best.store.toUpperCase(), logo: 'icon-cart' },
          items: [],
          total: 0,
          oldTotal: 0
        };
      }

      routeStores[best.store].items.push({
        title: prod.title || prod.name,
        unit: prod.unit || 'шт',
        qty: item.qty,
        price: itemPrice,
        oldPrice: itemOldPrice,
        lineTotal,
        lineOldTotal,
        sourceUrl: best.sourceUrl || ''
      });

      routeStores[best.store].total += lineTotal;
      routeStores[best.store].oldTotal += lineOldTotal;
    });

    const routeList = Object.values(routeStores);
    const optimalTotal = routeList.reduce((sum, s) => sum + s.total, 0);
    const regularTotal = routeList.reduce((sum, s) => sum + s.oldTotal, 0);
    const savingsTotal = Math.max(0, regularTotal - optimalTotal);
    const savingsPercent = regularTotal > 0 ? Math.round((savingsTotal / regularTotal) * 100) : 0;
    const stopsCount = routeList.length;

    if (DOM.optimalRouteContainer) {
      if (routeList.length === 0) {
        DOM.optimalRouteContainer.innerHTML = '<p class="file-hint text-center">Немає доступних цін для обраних товарів.</p>';
      } else {
        DOM.optimalRouteContainer.innerHTML = `
          <div class="optimal-route-summary-card">
            <div class="optimal-summary-header">
              <div class="optimal-summary-left">
                <span class="optimal-summary-caption">Оптимальний підсумок кошика:</span>
                <div class="optimal-summary-prices">
                  <span class="optimal-total-val">${optimalTotal.toFixed(2)} грн</span>
                  ${regularTotal > optimalTotal ? `<del class="optimal-old-val">${regularTotal.toFixed(2)} грн</del>` : ''}
                </div>
              </div>
              ${savingsTotal > 0 ? `
                <div class="optimal-savings-chip">
                  <span class="savings-percent-tag">-${savingsPercent}%</span>
                  <span class="savings-amount-label">Економія ${savingsTotal.toFixed(2)} грн</span>
                </div>
              ` : ''}
            </div>

            <div class="optimal-route-badge">
              <svg class="icon icon-sm" aria-hidden="true">
                <use href="assets/sprite.svg#icon-location"></use>
              </svg>
              <span>Розподіл покупок між <strong>${stopsCount} ${stopsCount === 1 ? 'мережею' : 'мережами'}</strong> міста для максимальної вигоди</span>
            </div>
          </div>

          <div class="optimal-stores-list">
            ${routeList.map(st => `
              <div class="optimal-store-group">
                <div class="optimal-store-header">
                  <div class="scorecard-store-group">
                    <svg class="store-badge-icon" aria-hidden="true">
                      <use href="assets/sprite.svg#${st.meta.logo}"></use>
                    </svg>
                    <div>
                      <strong>${st.meta.name}</strong>
                      <div class="file-hint">${st.items.length} ${st.items.length === 1 ? 'позиція' : 'позиції'} у чеку</div>
                    </div>
                  </div>
                  <div class="optimal-store-subtotal">
                    <span class="store-subtotal-val">${st.total.toFixed(2)} грн</span>
                  </div>
                </div>

                <ul class="optimal-items-list">
                  ${st.items.map(it => `
                    <li class="optimal-item-row">
                      <div class="optimal-item-name">
                        <span class="optimal-item-title">${it.title}</span>
                        <span class="optimal-item-unit-calc">${it.qty} × ${it.price.toFixed(2)} грн / ${it.unit}</span>
                      </div>
                      <div class="optimal-item-price-col">
                        <span class="optimal-line-total">${it.lineTotal.toFixed(2)} грн</span>
                        ${it.sourceUrl ? `
                          <a href="${it.sourceUrl}" target="_blank" rel="noopener noreferrer" class="link-store-source" aria-label="Відкрити ${it.title} на офіційному сайті ${st.meta.name}">
                            <span>На сайті</span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        ` : ''}
                      </div>
                    </li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    /* ── MODE B: Порівняння чеків по мережах міста (Single-Store Leaderboard) ── */
    if (!DOM.scorecardContainer) return;

    const activeStores = AppState.selectedStores.length > 0 ? AppState.selectedStores : cityActiveStores;

    const storeTotals = activeStores.map(store => {
      let sum = 0;
      let regularSum = 0;
      let matchedCount = 0;

      AppState.basket.forEach(item => {
        const prod = AppState.products.find(p => String(p.id) === String(item.productId));
        if (prod) {
          const validPrices = getProductValidPrices(prod);
          const sp = validPrices.find(x => (x.store || '').toLowerCase() === store.toLowerCase());
          if (sp && sp.price) {
            sum += sp.price * item.qty;
            const oldP = sp.oldPrice && sp.oldPrice > sp.price ? sp.oldPrice : Math.round(sp.price * 1.25);
            regularSum += oldP * item.qty;
            matchedCount++;
          }
        }
      });

      return {
        store,
        meta: STORE_META[store] || { name: store.toUpperCase(), logo: 'icon-cart' },
        total: sum,
        regularTotal: regularSum,
        matchedCount
      };
    }).filter(st => st.matchedCount > 0);

    if (storeTotals.length === 0) {
      DOM.scorecardContainer.innerHTML = '<p class="file-hint text-center">Немає цін для обраних товарів у вибраних мережах.</p>';
      if (DOM.savingsTextDesc) DOM.savingsTextDesc.textContent = 'Оберіть товари для порівняння';
      return;
    }

    // Sort: 1st by most items available (desc), 2nd by cheapest total (asc)
    storeTotals.sort((a, b) => {
      if (b.matchedCount !== a.matchedCount) {
        return b.matchedCount - a.matchedCount;
      }
      return a.total - b.total;
    });

    const winner = storeTotals[0];
    const mostExpensive = storeTotals[storeTotals.length - 1];
    const singleStoreSavings = mostExpensive.total - winner.total;

    // Update banner
    if (DOM.savingsTextDesc) {
      if (singleStoreSavings > 0 && storeTotals.length > 1) {
        DOM.savingsTextDesc.textContent = `У мережі ${winner.meta.name} чек становить ${winner.total.toFixed(2)} грн (${winner.matchedCount} з ${AppState.basket.length} позицій) — економія ${singleStoreSavings.toFixed(2)} грн порівняно з найдорожчим варіантом!`;
      } else {
        DOM.savingsTextDesc.textContent = `У мережі ${winner.meta.name} підсумок: ${winner.total.toFixed(2)} грн (${winner.matchedCount} з ${AppState.basket.length} позицій)`;
      }
    }

    // Render single-store scorecard list
    DOM.scorecardContainer.innerHTML = storeTotals.map((st, idx) => {
      const isWinner = idx === 0;
      const diff = st.total - winner.total;
      const hasAllItems = st.matchedCount === AppState.basket.length;

      return `
        <div class="scorecard-item ${isWinner ? 'is-winner' : ''}">
          <div class="scorecard-store-group">
            <svg class="store-badge-icon" aria-hidden="true">
              <use href="assets/sprite.svg#${st.meta.logo}"></use>
            </svg>
            <div>
              <strong>${st.meta.name}</strong>
              <div class="file-hint">${st.matchedCount} з ${AppState.basket.length} позицій ${hasAllItems ? '• повний чек' : '• частковий чек'}</div>
              ${isWinner ? '<div class="best-price-badge">НАЙВИГІДНІШИЙ ЄДИНИЙ ЧЕК</div>' : ''}
            </div>
          </div>

          <div class="scorecard-details">
            <span class="scorecard-total">${st.total.toFixed(2)} грн</span>
            ${diff > 0 ? `<span class="scorecard-diff">+${diff.toFixed(2)} грн</span>` : '<span class="scorecard-diff is-leader">Лідер єдиного чека</span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ─── 11. Auth Modal & Session Controller ────────────────────────────────── */
  function initAuth() {
    // Restore existing logged in user session label on page load
    if (window.AureliaAPI && typeof window.AureliaAPI.getCurrentUser === 'function') {
      const user = window.AureliaAPI.getCurrentUser();
      if (user && DOM.authBtnLabel) {
        DOM.authBtnLabel.textContent = user.name || (user.email ? user.email.split('@')[0] : 'Кабінет');
      }
    }

    const triggerAuth = () => openModal(DOM.authModal);
    if (DOM.authOpenBtn) DOM.authOpenBtn.addEventListener('click', triggerAuth);
    if (DOM.mobileAuthBtn) DOM.mobileAuthBtn.addEventListener('click', triggerAuth);

    if (DOM.authForm) {
      DOM.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('auth-email-input');
        const passInput = document.getElementById('auth-password-input');
        const errEl = document.getElementById('auth-email-error');
        if (errEl) errEl.textContent = '';

        const email = emailInput ? emailInput.value.trim() : '';
        const pass = passInput ? passInput.value.trim() : '';

        if (!email || !pass) {
          if (errEl) errEl.textContent = 'Введіть пошту та пароль.';
          return;
        }

        try {
          if (window.AureliaAPI) {
            const res = await window.AureliaAPI.login(email, pass);
            const user = (res && res.user) ? res.user : res;
            if (DOM.authBtnLabel) DOM.authBtnLabel.textContent = user?.name || email.split('@')[0];
          } else {
            if (DOM.authBtnLabel) DOM.authBtnLabel.textContent = email.split('@')[0];
          }
          closeModal(DOM.authModal);
        } catch (err) {
          if (errEl) errEl.textContent = err.message || 'Невірний email або пароль.';
        }
      });
    }
  }

  /* ─── 12. Scroll Reveal Animations ───────────────────────────────────────── */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal-item').forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-item').forEach(el => observer.observe(el));
  }

  /* ─── 13. Service Worker, PWA Install & Offline Indicator ─────────────────── */
  let deferredInstallPrompt = null;

  function initPwaInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent automatic mini-infobar on mobile Chrome
      e.preventDefault();
      deferredInstallPrompt = e;

      if (DOM.btnPwaInstall) {
        DOM.btnPwaInstall.classList.remove('is-hidden');
      }
    });

    if (DOM.btnPwaInstall) {
      DOM.btnPwaInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;

        if (choiceResult && choiceResult.outcome === 'accepted') {
          console.log('✅ [PWA] Користувач погодився встановити додаток AURELIA UA.');
        } else {
          console.log('ℹ️ [PWA] Встановлення додатка відхилено або відкладено.');
        }

        deferredInstallPrompt = null;
        DOM.btnPwaInstall.classList.add('is-hidden');
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('🎉 [PWA] Додаток AURELIA UA успішно встановлено на головний екран!');
      deferredInstallPrompt = null;
      if (DOM.btnPwaInstall) {
        DOM.btnPwaInstall.classList.add('is-hidden');
      }
    });
  }

  function getOrCreateOfflineBadge() {
    let badge = document.getElementById('offline-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-status-badge';
      badge.className = 'offline-status-badge is-hidden';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      badge.innerHTML = `
        <div class="offline-badge-content">
          <svg class="icon icon-sm" aria-hidden="true">
            <use href="assets/sprite.svg#icon-qr"></use>
          </svg>
          <span id="offline-badge-text">Офлайн-режим • QR-картки доступні</span>
        </div>
      `;
      document.body.appendChild(badge);
    }
    return badge;
  }

  function initOfflineIndicator() {
    const badge = getOrCreateOfflineBadge();
    const badgeText = document.getElementById('offline-badge-text');

    function updateNetworkStatus() {
      if (!navigator.onLine) {
        if (badgeText) badgeText.textContent = 'Офлайн-режим • QR-картки доступні';
        badge.classList.remove('is-hidden');
        badge.classList.add('is-offline');
        badge.classList.add('is-visible');
      } else {
        if (badge.classList.contains('is-offline')) {
          badge.classList.remove('is-offline');
          badge.classList.add('is-online');
          if (badgeText) badgeText.textContent = 'З\'єднання відновлено • Синхронізація';
          setTimeout(() => {
            badge.classList.remove('is-visible');
            badge.classList.add('is-hidden');
            badge.classList.remove('is-online');
          }, 2500);
        } else {
          badge.classList.add('is-hidden');
          badge.classList.remove('is-visible');
        }
      }
    }

    window.addEventListener('offline', updateNetworkStatus);
    window.addEventListener('online', updateNetworkStatus);

    // Initial check
    if (!navigator.onLine) {
      updateNetworkStatus();
    }
  }

  function initServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.protocol.startsWith('https'))) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((reg) => {
            console.log('✅ [PWA] Service Worker успішно активовано:', reg.scope);
          })
          .catch((err) => {
            console.warn('⚠️ [PWA] Помилка реєстрації Service Worker:', err);
          });
      });
    }

    initPwaInstallPrompt();
    initOfflineIndicator();
  }

  /* ─── 14. App Initialisation ─────────────────────────────────────────────── */
  function init() {
    cacheDOM();
    initTheme();
    initPreloader();
    initHeaderScroll();
    initBurgerMenu();
    initModalEvents();
    initCitySelector();
    initStoresModal();
    initAuth();
    initScrollReveal();
    initServiceWorker();

    // Route to appropriate page controller with isolated error containment
    try {
      if (DOM.cardsContainer) {
        initCheckoutModeSwitchers();
        initWalletPage();
      }
    } catch (e) {
      console.error('Wallet init error:', e);
    }

    try {
      if (DOM.catalogContainer) {
        initCatalogPage();
      }
    } catch (e) {
      console.error('Catalog init error:', e);
    }

    try {
      if (DOM.basketItemsContainer) {
        initBasketPage();
      }
    } catch (e) {
      console.error('Basket init error:', e);
    }
  }

  function bootstrap() {
    try {
      init();
    } catch (err) {
      console.error('⚠️ [Aurelia App Bootstrap Error]:', err);
    } finally {
      forceHidePreloader();
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }
})();
