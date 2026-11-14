/**
 * ============================================================================
 * AURELIA UA — Admin Dashboard Logic
 * City-based catalog filtering, 18-store promotional price editor & 2-level categories
 * ============================================================================
 */

(function () {
  'use strict';

  const AdminState = {
    products: [],
    searchQuery: '',
    editingProductId: null,
    activeTab: 'products',
    users: [],
    userSearchQuery: '',
    editingUserId: null,
    confirmCallback: null,
    usersRefreshTimer: null
  };

  const API_STORE_META = (window.AureliaAPI && window.AureliaAPI.STORE_META) || {};

  const STORES = (window.AureliaAPI && Array.isArray(window.AureliaAPI.ALL_STORE_IDS))
    ? window.AureliaAPI.ALL_STORE_IDS
    : ['silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart', 'thrash', 'simi', 'blyzenko', 'taistra', 'arsen', 'rukavychka', 'eva', 'prostor', 'avrora', 'epicentr'];

  const STORE_NAMES = Object.keys(API_STORE_META).length > 0
    ? Object.fromEntries(Object.entries(API_STORE_META).map(([k, v]) => [k, v.name]))
    : { silpo: 'Сільпо', atb: 'АТБ-Маркет', novus: 'NOVUS', metro: 'METRO', varus: 'VARUS', auchan: 'АШАН', epicentrk_food: 'Епіцентр Food', velmart: 'Велмарт', thrash: 'Траш! ТРАШ!', simi: 'Сімі', blyzenko: 'Близенько', taistra: 'Тайстра', arsen: 'Арсен', rukavychka: 'Рукавичка', eva: 'EVA', prostor: 'Prostor', avrora: 'Аврора Мультимаркет', epicentr: 'Епіцентр К' };

  const CATEGORY_HIERARCHY = {
    'Продукти': [
      'Кава та Чай',
      'Молочні та Сири',
      'М\'ясо та Риба',
      'Солодощі',
      'Бакалія',
      'Напої',
      'Овочі та Фрукти'
    ],
    'Краса та Гігієна': [
      'Догляд за шкірою',
      'Догляд за волоссям',
      'Декоративна косметика',
      'Особиста гігієна'
    ],
    'Дім та Побут': [
      'Побутова хімія',
      'Кухня та Посуд',
      'Паперова продукція',
      'Дім та Затишок'
    ],
    'Зоотовари': [
      'Для котів',
      'Для собак'
    ]
  };

  const SUBCATEGORY_ALIASES = {
    'волосся': 'Догляд за волоссям',
    'косметика': 'Декоративна косметика',
    'гігієна': 'Особиста гігієна',
    'дім та декор': 'Дім та Затишок'
  };

  function normalizeAdminSubCategory(sub) {
    const clean = String(sub || '').trim();
    return SUBCATEGORY_ALIASES[clean.toLowerCase()] || clean;
  }

  const CITY_NAMES = (window.AureliaAPI && window.AureliaAPI.CITIES)
    ? Object.assign({ all: 'Всі міста' }, Object.fromEntries(Object.entries(window.AureliaAPI.CITIES).map(([id, c]) => [id, c.name])))
    : { all: 'Всі міста', 'ivano-frankivsk': 'Івано-Франківськ', lviv: 'Львів', ternopil: 'Тернопіль', lutsk: 'Луцьк', chernivtsi: 'Чернівці', rivne: 'Рівне', uzhhorod: 'Ужгород', khmelnytskyi: 'Хмельницький', kyiv: 'Київ' };

  const DOM = {
    storeInputs: {}
  };

  function cacheDOM() {
    DOM.dashboardContent = document.getElementById('admin-dashboard-content');
    DOM.accessDenied = document.getElementById('admin-access-denied');
    DOM.qaBadge = document.getElementById('admin-qa-badge');
    DOM.tabProducts = document.getElementById('admin-tab-products');
    DOM.tabUsers = document.getElementById('admin-tab-users');
    DOM.productsSection = document.getElementById('admin-products-section');
    DOM.usersSection = document.getElementById('admin-users-section');
    DOM.tbody = document.getElementById('admin-products-tbody');
    DOM.searchInput = document.getElementById('admin-search-input');
    DOM.citySelect = document.getElementById('admin-city-select');
    DOM.btnAdd = document.getElementById('btn-admin-add-product');
    DOM.btnSync = document.getElementById('btn-admin-sync-promos');
    DOM.syncLabel = document.getElementById('sync-promos-label');
    DOM.modal = document.getElementById('admin-product-modal');
    DOM.modalTitle = document.getElementById('admin-product-modal-title');
    DOM.form = document.getElementById('admin-product-form');

    // Customers Management Elements
    DOM.userSearchInput = document.getElementById('admin-user-search');
    DOM.btnRefreshUsers = document.getElementById('btn-admin-refresh-users');
    DOM.usersCountBadge = document.getElementById('admin-users-count-badge');
    DOM.usersTbody = document.getElementById('admin-users-tbody');
    DOM.userEditModal = document.getElementById('admin-user-edit-modal');
    DOM.userEditForm = document.getElementById('admin-user-edit-form');
    DOM.editUserName = document.getElementById('admin-edit-user-name');
    DOM.editUserEmail = document.getElementById('admin-edit-user-email');
    DOM.editUserRole = document.getElementById('admin-edit-user-role');
    DOM.editUserVerified = document.getElementById('admin-edit-user-verified');
    DOM.editUserPassword = document.getElementById('admin-edit-user-password');
    DOM.editUserError = document.getElementById('admin-edit-user-error');
    DOM.editUserSubmitBtn = document.getElementById('admin-edit-user-submit-btn');

    // Confirmation Pop-up Modal
    DOM.confirmModal = document.getElementById('admin-confirm-modal');
    DOM.confirmTitle = document.getElementById('admin-confirm-title');
    DOM.confirmMessage = document.getElementById('admin-confirm-message');
    DOM.confirmCancelBtn = document.getElementById('admin-confirm-cancel-btn');
    DOM.confirmOkBtn = document.getElementById('admin-confirm-ok-btn');

    // Product Core Fields
    DOM.titleInput = document.getElementById('admin-prod-title');
    DOM.cityInput = document.getElementById('admin-prod-city');
    DOM.mainCategorySelect = document.getElementById('admin-prod-main-category');
    DOM.subCategorySelect = document.getElementById('admin-prod-sub-category');
    DOM.unitInput = document.getElementById('admin-prod-unit');
    DOM.promoTagInput = document.getElementById('admin-prod-promo-tag');

    // Errors
    DOM.titleError = document.getElementById('admin-title-error');
    DOM.mainCategoryError = document.getElementById('admin-main-category-error');
    DOM.subCategoryError = document.getElementById('admin-sub-category-error');
    DOM.unitError = document.getElementById('admin-unit-error');

    // Stats
    DOM.statTotal = document.getElementById('stat-total-products');
    DOM.statDiscount = document.getElementById('stat-avg-discount');

    // 18 Store Inputs Cache
    STORES.forEach(store => {
      DOM.storeInputs[store] = {
        price: document.getElementById(`admin-price-${store}`),
        oldPrice: document.getElementById(`admin-oldprice-${store}`),
        url: document.getElementById(`admin-url-${store}`)
      };
    });
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    if (modalEl._closeTimer) {
      clearTimeout(modalEl._closeTimer);
      modalEl._closeTimer = null;
    }
    const header = document.getElementById('site-header');
    if (header) header.classList.remove('is-zoomed-out');
    modalEl.classList.remove('is-closing');
    void modalEl.offsetWidth;
    modalEl.classList.add('is-open');
    document.body.classList.add('is-locked', 'has-page-modal');
    document.body.classList.remove('has-header-dropdown');
    const firstInput = modalEl.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    if (modalEl._closeTimer) {
      clearTimeout(modalEl._closeTimer);
    }
    modalEl.classList.remove('is-open');
    modalEl.classList.add('is-closing');
    document.body.classList.remove('is-locked', 'has-page-modal');

    modalEl._closeTimer = setTimeout(() => {
      modalEl.classList.remove('is-closing');
      modalEl._closeTimer = null;
    }, 380);
  }

  function populateSubCategories(mainCat, selectedSubCat = '') {
    if (!DOM.subCategorySelect) return;
    const subCats = CATEGORY_HIERARCHY[mainCat] || CATEGORY_HIERARCHY['Продукти'];
    const normSelected = normalizeAdminSubCategory(selectedSubCat);
    DOM.subCategorySelect.innerHTML = subCats.map(sub => `
      <option value="${escapeHtml(sub)}" ${sub === normSelected ? 'selected' : ''}>${escapeHtml(sub)}</option>
    `).join('');
  }

  async function loadProducts() {
    const selectedCity = DOM.citySelect ? DOM.citySelect.value : 'all';
    if (window.AureliaAPI) {
      AdminState.products = await window.AureliaAPI.getProducts(selectedCity === 'all' ? undefined : selectedCity);
    }
    updateStats();
    renderTable();
  }

  function updateStats() {
    if (DOM.statTotal) {
      DOM.statTotal.textContent = AdminState.products.length;
    }

    if (DOM.statDiscount) {
      if (AdminState.products.length === 0) {
        DOM.statDiscount.textContent = '0%';
        return;
      }
      let totalDiscount = 0;
      let count = 0;

      AdminState.products.forEach(p => {
        const prices = Array.isArray(p.prices) && p.prices.length > 0
          ? p.prices
          : Object.values(p.storePrices || {});

        prices.forEach(pr => {
          const disc = pr.discount || (pr.oldPrice > pr.price ? Math.round(((pr.oldPrice - pr.price) / pr.oldPrice) * 100) : 0);
          if (disc > 0) {
            totalDiscount += disc;
            count++;
          }
        });
      });

      const avg = count > 0 ? Math.round(totalDiscount / count) : 0;
      DOM.statDiscount.textContent = `${avg}%`;
    }
  }

  function getProductPricesList(product) {
    const list = [];
    if (Array.isArray(product.prices) && product.prices.length > 0) {
      product.prices.forEach(p => {
        const pr = parseFloat(p.price);
        if (!isNaN(pr) && pr > 0) {
          list.push({
            store: p.store,
            price: pr,
            oldPrice: parseFloat(p.oldPrice) || 0,
            discount: p.discount || 0,
            url: p.sourceUrl || ''
          });
        }
      });
    } else if (product.storePrices && typeof product.storePrices === 'object') {
      Object.entries(product.storePrices).forEach(([st, data]) => {
        const pr = parseFloat(data?.price);
        if (!isNaN(pr) && pr > 0) {
          list.push({
            store: st,
            price: pr,
            oldPrice: parseFloat(data?.oldPrice) || 0,
            discount: data?.discount || 0,
            url: data?.sourceUrl || ''
          });
        }
      });
    }
    return list;
  }

  function renderTable() {
    if (!DOM.tbody) return;

    let list = AdminState.products;
    if (AdminState.searchQuery) {
      const q = AdminState.searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.mainCategory && p.mainCategory.toLowerCase().includes(q)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      DOM.tbody.innerHTML = `
        <tr>
          <td colspan="5" class="admin-table-empty">
            Товарів не знайдено за вказаними фільтрами.
          </td>
        </tr>
      `;
      return;
    }

    DOM.tbody.innerHTML = list.map(product => {
      const prices = getProductPricesList(product);
      const minPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price)) : 0;
      const mainCat = escapeHtml(product.mainCategory || 'Продукти');
      const subCat = escapeHtml(product.subCategory || product.category || 'Загальне');
      const cityName = escapeHtml(CITY_NAMES[product.city] || product.city || 'Усі міста');
      const safeTitle = escapeHtml(product.title || product.name || '');
      const safeUnit = escapeHtml(product.unit || 'шт');
      const safePromoTag = product.promoTag ? escapeHtml(product.promoTag) : '';
      const safeId = escapeHtml(product.id);

      return `
        <tr>
          <td>
            <div class="admin-prod-cell">
              <strong class="admin-prod-title">${safeTitle}</strong>
              <div class="admin-prod-meta">
                <span>${safeUnit}</span>
                ${safePromoTag ? `<span class="promo-tag-badge">${safePromoTag}</span>` : ''}
              </div>
            </div>
          </td>
          <td>
            <div class="admin-category-badges">
              <span class="status-badge active">${mainCat}</span>
              <span class="subcat-chip">${subCat}</span>
            </div>
          </td>
          <td>
            <span class="city-badge">${cityName}</span>
          </td>
          <td>
            <div class="admin-prices-chips">
              ${prices.length === 0 ? '<span class="file-hint">Немає цін</span>' : prices.map(p => {
                const isMin = Math.abs(p.price - minPrice) < 0.01;
                const storeLabel = escapeHtml(STORE_NAMES[p.store] || p.store);
                const catIcon = escapeHtml((window.AureliaAPI?.STORE_META?.[p.store]?.logo) || 'cat-groceries');
                return `
                  <span class="admin-price-chip ${isMin ? 'is-best' : ''}" title="${storeLabel}: ${p.price.toFixed(2)} грн">
                    <svg class="icon icon-stroke icon-xs" aria-hidden="true">
                      <use href="assets/sprite.svg#${catIcon}"></use>
                    </svg>
                    <span>${storeLabel}: <strong>${p.price.toFixed(2)} ₴</strong></span>
                    ${isMin ? '<span class="best-star" aria-label="Найнижча ціна">★</span>' : ''}
                  </span>
                `;
              }).join('')}
            </div>
          </td>
          <td>
            <div class="table-actions-cell">
              ${isReadOnlyQA()
                ? '<span class="table-readonly-badge">Тільки перегляд</span>'
                : `<button type="button" class="btn-icon" data-admin-edit="${safeId}" aria-label="Редагувати ${safeTitle}">
                    <svg class="icon icon-sm" aria-hidden="true">
                      <use href="assets/sprite.svg#icon-edit"></use>
                    </svg>
                  </button>
                  <button type="button" class="btn-icon" data-admin-delete="${safeId}" aria-label="Видалити ${safeTitle}">
                    <svg class="icon icon-sm" aria-hidden="true">
                      <use href="assets/sprite.svg#icon-trash"></use>
                    </svg>
                  </button>`}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindTableActions();
  }

  function getCurrentStaffUser() {
    if (!window.AureliaAPI || typeof window.AureliaAPI.getCurrentUser !== 'function') return null;
    return window.AureliaAPI.getCurrentUser();
  }

  function isStaffAuthorized(user) {
    if (!user || !user.email) return false;
    const isStaffDomain = String(user.email).trim().toLowerCase().endsWith('@aurelia.ua');
    const role = String(user.role || '').toUpperCase();
    return isStaffDomain && (role === 'ADMIN' || role === 'QA');
  }

  function isReadOnlyQA(user) {
    const active = user || getCurrentStaffUser();
    return Boolean(isStaffAuthorized(active) && String(active.role || '').toUpperCase() === 'QA');
  }

  function bindTableActions() {
    if (!DOM.tbody || DOM.tbody._delegatedTableActions) return;
    DOM.tbody._delegatedTableActions = true;

    DOM.tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-admin-edit]');
      if (editBtn && DOM.tbody.contains(editBtn)) {
        if (isReadOnlyQA()) return;
        const id = editBtn.dataset.adminEdit;
        const prod = AdminState.products.find(p => String(p.id) === String(id));
        if (prod) openEditForm(prod);
        return;
      }

      const delBtn = e.target.closest('[data-admin-delete]');
      if (delBtn && DOM.tbody.contains(delBtn)) {
        if (isReadOnlyQA()) {
          alert('Режим QA (тільки перегляд): редагування та видалення заборонено');
          return;
        }
        const id = delBtn.dataset.adminDelete;
        const prod = AdminState.products.find(p => String(p.id) === String(id));
        openConfirmModal({
          title: 'Видалення товару',
          message: `Видалити товар «${prod?.title || prod?.name || ''}» з каталогу?`,
          confirmLabel: 'Видалити',
          onConfirm: async () => {
            try {
              if (window.AureliaAPI) {
                await window.AureliaAPI.deleteProduct(id);
              }
              AdminState.products = AdminState.products.filter(p => String(p.id) !== String(id));
              updateStats();
              renderTable();
            } catch (err) {
              alert(err.message || 'Не вдалося видалити товар.');
            }
          }
        });
      }
    });
  }

  function openCreateForm() {
    if (isReadOnlyQA()) {
      alert('Режим QA (тільки перегляд): редагування та видалення заборонено');
      return;
    }
    AdminState.editingProductId = null;
    clearErrors();
    if (DOM.form) DOM.form.reset();
    if (DOM.modalTitle) DOM.modalTitle.textContent = 'Додати акційний товар';

    // Defaults
    if (DOM.mainCategorySelect) DOM.mainCategorySelect.value = 'Продукти';
    populateSubCategories('Продукти', 'Кава та Чай');
    if (DOM.cityInput) {
      const activeFilterCity = DOM.citySelect ? DOM.citySelect.value : 'ivano-frankivsk';
      DOM.cityInput.value = activeFilterCity === 'all' ? 'ivano-frankivsk' : activeFilterCity;
    }
    if (DOM.unitInput) DOM.unitInput.value = 'шт';

    // Clear all 18 store inputs
    STORES.forEach(s => {
      if (DOM.storeInputs[s].price) DOM.storeInputs[s].price.value = '';
      if (DOM.storeInputs[s].oldPrice) DOM.storeInputs[s].oldPrice.value = '';
      if (DOM.storeInputs[s].url) DOM.storeInputs[s].url.value = '';
    });

    openModal(DOM.modal);
  }

  function openEditForm(prod) {
    if (isReadOnlyQA()) {
      alert('Режим QA (тільки перегляд): редагування та видалення заборонено');
      return;
    }
    AdminState.editingProductId = prod.id;
    clearErrors();

    if (DOM.modalTitle) DOM.modalTitle.textContent = 'Редагувати акційний товар';
    if (DOM.titleInput) DOM.titleInput.value = prod.title || prod.name || '';
    if (DOM.cityInput) DOM.cityInput.value = prod.city || 'ivano-frankivsk';

    const mainCat = prod.mainCategory || 'Продукти';
    const subCat = prod.subCategory || prod.category || 'Кава та Чай';
    if (DOM.mainCategorySelect) DOM.mainCategorySelect.value = mainCat;
    populateSubCategories(mainCat, subCat);

    if (DOM.unitInput) DOM.unitInput.value = prod.unit || 'шт';
    if (DOM.promoTagInput) DOM.promoTagInput.value = prod.promoTag || prod.promo_tag || '';

    // Populate prices for each of the 18 stores
    const pricesList = getProductPricesList(prod);
    STORES.forEach(s => {
      const entry = pricesList.find(p => p.store === s);
      if (entry) {
        if (DOM.storeInputs[s].price) DOM.storeInputs[s].price.value = entry.price || '';
        if (DOM.storeInputs[s].oldPrice) DOM.storeInputs[s].oldPrice.value = entry.oldPrice || '';
        if (DOM.storeInputs[s].url) DOM.storeInputs[s].url.value = entry.url || '';
      } else {
        if (DOM.storeInputs[s].price) DOM.storeInputs[s].price.value = '';
        if (DOM.storeInputs[s].oldPrice) DOM.storeInputs[s].oldPrice.value = '';
        if (DOM.storeInputs[s].url) DOM.storeInputs[s].url.value = '';
      }
    });

    openModal(DOM.modal);
  }

  function clearErrors() {
    if (DOM.titleError) DOM.titleError.textContent = '';
    if (DOM.mainCategoryError) DOM.mainCategoryError.textContent = '';
    if (DOM.subCategoryError) DOM.subCategoryError.textContent = '';
    if (DOM.unitError) DOM.unitError.textContent = '';
  }

  function initForm() {
    if (DOM.btnAdd) {
      DOM.btnAdd.addEventListener('click', openCreateForm);
    }

    // Dynamic Subcategory Population on Main Category Change
    if (DOM.mainCategorySelect) {
      DOM.mainCategorySelect.addEventListener('change', (e) => {
        populateSubCategories(e.target.value);
      });
    }

    // City Selector Filter in Admin Actions Bar
    if (DOM.citySelect) {
      DOM.citySelect.addEventListener('change', () => {
        loadProducts();
      });
    }

    // Live Supermarket Price Sync Button
    if (DOM.btnSync) {
      DOM.btnSync.addEventListener('click', async () => {
        if (isReadOnlyQA()) {
          alert('Режим QA (тільки перегляд): редагування та видалення заборонено');
          return;
        }
        const cityToSync = DOM.citySelect ? DOM.citySelect.value : 'ivano-frankivsk';
        const actualCity = cityToSync === 'all' ? 'ivano-frankivsk' : cityToSync;
        try {
          DOM.btnSync.disabled = true;
          if (DOM.syncLabel) DOM.syncLabel.textContent = `Синхронізація (${CITY_NAMES[actualCity] || actualCity})...`;

          if (window.AureliaAPI && typeof window.AureliaAPI.syncProducts === 'function') {
            await window.AureliaAPI.syncProducts(actualCity);
            await loadProducts();
          } else {
            await loadProducts();
          }

          if (DOM.syncLabel) DOM.syncLabel.textContent = 'Оновлено!';
          setTimeout(() => {
            if (DOM.syncLabel) DOM.syncLabel.textContent = 'Синхронізувати ціни';
            DOM.btnSync.disabled = false;
          }, 2000);
        } catch (err) {
          console.error('Помилка синхронізації цін:', err);
          alert(err.message || 'Не вдалося синхронізувати ціни.');
          if (DOM.syncLabel) DOM.syncLabel.textContent = 'Помилка';
          setTimeout(() => {
            if (DOM.syncLabel) DOM.syncLabel.textContent = 'Синхронізувати ціни';
            DOM.btnSync.disabled = isReadOnlyQA();
          }, 2000);
        }
      });
    }

    // Modal Close Buttons & Escape handling across all admin modals
    [DOM.modal, DOM.userEditModal, DOM.confirmModal].forEach((modalEl) => {
      if (!modalEl) return;
      modalEl.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalEl));
      });
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal(modalEl);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (DOM.confirmModal && DOM.confirmModal.classList.contains('is-open')) {
        closeModal(DOM.confirmModal);
        return;
      }
      if (DOM.userEditModal && DOM.userEditModal.classList.contains('is-open')) {
        closeModal(DOM.userEditModal);
        return;
      }
      if (DOM.modal && DOM.modal.classList.contains('is-open')) {
        closeModal(DOM.modal);
      }
    });

    // Form Submit Handler
    if (DOM.form) {
      DOM.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const title = (DOM.titleInput?.value || '').trim();
        const mainCategory = (DOM.mainCategorySelect?.value || 'Продукти').trim();
        const subCategory = (DOM.subCategorySelect?.value || 'Кава та Чай').trim();
        const city = (DOM.cityInput?.value || 'ivano-frankivsk').trim();
        const unit = (DOM.unitInput?.value || 'шт').trim();
        const promoTag = (DOM.promoTagInput?.value || '').trim();

        let hasError = false;
        if (!title) {
          if (DOM.titleError) DOM.titleError.textContent = 'Вкажіть назву товару.';
          hasError = true;
        }
        if (!mainCategory) {
          if (DOM.mainCategoryError) DOM.mainCategoryError.textContent = 'Оберіть головну категорію.';
          hasError = true;
        }
        if (!subCategory) {
          if (DOM.subCategoryError) DOM.subCategoryError.textContent = 'Оберіть підкатегорію.';
          hasError = true;
        }
        if (!unit) {
          if (DOM.unitError) DOM.unitError.textContent = 'Вкажіть одиницю виміру.';
          hasError = true;
        }

        if (hasError) return;

        // Collect prices from the 18 stores
        const prices = [];
        const storePrices = {};

        STORES.forEach(s => {
          const pVal = parseFloat(DOM.storeInputs[s].price?.value);
          if (!isNaN(pVal) && pVal > 0) {
            const parsedOld = parseFloat(DOM.storeInputs[s].oldPrice?.value);
            const oldPVal = (!isNaN(parsedOld) && parsedOld > pVal) ? parsedOld : null;
            const urlVal = (DOM.storeInputs[s].url?.value || '').trim();
            const discount = oldPVal ? Math.round(((oldPVal - pVal) / oldPVal) * 100) : 0;

            const priceObj = {
              store: s,
              price: pVal,
              oldPrice: oldPVal,
              discount,
              sourceUrl: urlVal,
              city
            };

            prices.push(priceObj);
            storePrices[s] = priceObj;
          }
        });

        // Ensure at least one price exists
        if (prices.length === 0) {
          alert('Будь ласка, вкажіть ціну хоча б в одній торговельній мережі.');
          return;
        }

        const payload = {
          name: title,
          title,
          mainCategory,
          subCategory,
          category: subCategory || mainCategory,
          city,
          unit,
          promoTag,
          promo_tag: promoTag,
          prices,
          storePrices
        };

        try {
          if (AdminState.editingProductId) {
            if (window.AureliaAPI) {
              const updated = await window.AureliaAPI.updateProduct(AdminState.editingProductId, payload);
              const idx = AdminState.products.findIndex(p => String(p.id) === String(AdminState.editingProductId));
              if (idx > -1) AdminState.products[idx] = updated;
            }
          } else {
            if (window.AureliaAPI) {
              const created = await window.AureliaAPI.createProduct(payload);
              AdminState.products.unshift(created);
            }
          }

          closeModal(DOM.modal);
          updateStats();
          renderTable();
        } catch (err) {
          console.error('Помилка збереження товару:', err);
          alert('Помилка збереження товару: ' + (err.message || 'Невідома помилка'));
        }
      });
    }

    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', (e) => {
        AdminState.searchQuery = e.target.value.trim();
        renderTable();
      });
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatOnlineStatusHtml(user) {
    if (user && user.is_online) {
      return '<span class="user-online-badge">● Онлайн</span>';
    }
    if (!user || !user.last_seen_at) {
      return '<span class="user-last-seen is-never">Ще не входив</span>';
    }
    const seen = new Date(user.last_seen_at);
    if (isNaN(seen.getTime())) {
      return '<span class="user-last-seen is-never">Ще не входив</span>';
    }
    const now = new Date();
    const diffMin = Math.max(0, Math.floor((now.getTime() - seen.getTime()) / 60000));
    if (diffMin < 1) {
      return '<span class="user-last-seen">Був(ла): щойно</span>';
    }
    if (diffMin < 60) {
      return `<span class="user-last-seen">Був(ла): ${diffMin} хв тому</span>`;
    }
    if (seen.toDateString() === now.toDateString()) {
      const hh = String(seen.getHours()).padStart(2, '0');
      const mm = String(seen.getMinutes()).padStart(2, '0');
      return `<span class="user-last-seen">Сьогодні о ${hh}:${mm}</span>`;
    }
    const dd = String(seen.getDate()).padStart(2, '0');
    const mon = String(seen.getMonth() + 1).padStart(2, '0');
    const yyyy = seen.getFullYear();
    return `<span class="user-last-seen">${dd}.${mon}.${yyyy}</span>`;
  }

  function openConfirmModal({ title, message, confirmLabel = 'Підтвердити', onConfirm }) {
    if (!DOM.confirmModal) return;
    AdminState.confirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
    if (DOM.confirmTitle) DOM.confirmTitle.textContent = title || 'Підтвердження дії';
    if (DOM.confirmMessage) DOM.confirmMessage.textContent = message || 'Ви впевнені?';
    if (DOM.confirmOkBtn) {
      DOM.confirmOkBtn.textContent = confirmLabel;
      DOM.confirmOkBtn.disabled = false;
    }
    openModal(DOM.confirmModal);
  }

  async function loadUsers() {
    if (!DOM.usersTbody || !window.AureliaAPI || typeof window.AureliaAPI.getAdminUsers !== 'function') return;
    try {
      const users = await window.AureliaAPI.getAdminUsers();
      AdminState.users = Array.isArray(users) ? users : [];
      renderUsersTable();
    } catch (err) {
      DOM.usersTbody.innerHTML = `
        <tr>
          <td colspan="4" class="admin-table-empty">${escapeHtml(err.message || 'Не вдалося завантажити список користувачів.')}</td>
        </tr>
      `;
    }
  }

  function openEditUserModal(user) {
    if (isReadOnlyQA()) {
      alert('Режим QA (тільки перегляд): редагування заборонено');
      return;
    }
    if (!user || !DOM.userEditModal) return;
    AdminState.editingUserId = user.id;
    if (DOM.editUserError) DOM.editUserError.textContent = '';
    if (DOM.editUserName) DOM.editUserName.value = user.name || '';
    if (DOM.editUserEmail) DOM.editUserEmail.value = user.email || '';
    if (DOM.editUserRole) DOM.editUserRole.value = String(user.role || 'USER').toUpperCase();
    if (DOM.editUserVerified) DOM.editUserVerified.checked = Boolean(user.is_verified);
    if (DOM.editUserPassword) DOM.editUserPassword.value = '';
    openModal(DOM.userEditModal);
  }

  function renderUsersTable() {
    if (!DOM.usersTbody) return;
    const readOnly = isReadOnlyQA();
    const q = AdminState.userSearchQuery.toLowerCase();

    const filtered = AdminState.users.filter((u) => {
      if (!q) return true;
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q)
      );
    });

    if (DOM.usersCountBadge) {
      DOM.usersCountBadge.textContent = `${filtered.length} з ${AdminState.users.length} акаунтів`;
    }

    if (filtered.length === 0) {
      DOM.usersTbody.innerHTML = `
        <tr>
          <td colspan="4" class="admin-table-empty">Клієнтів за вашим запитом не знайдено.</td>
        </tr>
      `;
      return;
    }

    DOM.usersTbody.innerHTML = filtered.map((u) => {
      const displayName = u.name || (u.email ? u.email.split('@')[0] : 'Користувач');
      const role = String(u.role || 'USER').toUpperCase();
      const roleClass = role === 'ADMIN' ? 'is-admin' : (role === 'QA' ? 'is-qa' : 'is-user');
      const verifiedBadge = u.is_verified
        ? '<span class="user-verify-badge is-verified">Підтверджено</span>'
        : '<span class="user-verify-badge is-pending">Очікує</span>';

      const cards = Array.isArray(u.cards) ? u.cards : [];
      const cardsHtml = cards.length === 0
        ? '<span class="file-hint">Немає карток</span>'
        : `<div class="admin-user-cards-list">${cards.map((c) => {
            const storeLabel = (STORE_NAMES[c.store] || c.storeName || c.store || 'МЕРЕЖА').toUpperCase();
            return `
              <span class="admin-user-card-chip" title="${escapeHtml(c.number || '')}">
                <span class="admin-user-card-store">${escapeHtml(storeLabel)}</span>
                ${readOnly ? '' : `<button type="button" class="admin-user-card-del" data-delete-user-card="${escapeHtml(u.id)}:${escapeHtml(c.id)}" data-user-name="${escapeHtml(displayName)}" data-store-name="${escapeHtml(storeLabel)}" aria-label="Видалити картку ${escapeHtml(storeLabel)} у ${escapeHtml(displayName)}">✕</button>`}
              </span>
            `;
          }).join('')}</div>`;

      const basketCount = Number(u.basket_count) || 0;
      const actionsHtml = readOnly
        ? '<span class="table-readonly-badge">Тільки перегляд</span>'
        : `
          <div class="admin-user-actions">
            <button type="button" class="btn btn-secondary btn-xs" data-edit-user="${escapeHtml(u.id)}">Редагувати</button>
            <button type="button" class="btn btn-outline btn-xs" data-impersonate-user="${escapeHtml(u.id)}">Імперсонація</button>
            <button type="button" class="btn btn-outline btn-xs" data-clear-basket="${escapeHtml(u.id)}" data-user-name="${escapeHtml(displayName)}">Очистити кошик (${basketCount})</button>
          </div>
        `;

      return `
        <tr>
          <td>
            <div class="admin-user-cell">
              <strong class="admin-user-name">${escapeHtml(displayName)}</strong>
              <span class="admin-user-email">${escapeHtml(u.email || '')}</span>
              <div class="admin-user-badges">
                <span class="user-role-badge ${roleClass}">${escapeHtml(role)}</span>
                ${verifiedBadge}
              </div>
            </div>
          </td>
          <td>${formatOnlineStatusHtml(u)}</td>
          <td>${cardsHtml}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');

    bindUsersTableActions();
  }

  function bindUsersTableActions() {
    if (!DOM.usersTbody || DOM.usersTbody._delegatedUsersActions) return;
    DOM.usersTbody._delegatedUsersActions = true;

    DOM.usersTbody.addEventListener('click', async (e) => {
      if (isReadOnlyQA()) return;

      const editBtn = e.target.closest('[data-edit-user]');
      if (editBtn && DOM.usersTbody.contains(editBtn)) {
        const uid = editBtn.dataset.editUser;
        const target = AdminState.users.find(u => String(u.id) === String(uid));
        if (target) openEditUserModal(target);
        return;
      }

      const impBtn = e.target.closest('[data-impersonate-user]');
      if (impBtn && DOM.usersTbody.contains(impBtn)) {
        const uid = impBtn.dataset.impersonateUser;
        if (!window.AureliaAPI || typeof window.AureliaAPI.impersonateUser !== 'function') return;
        try {
          impBtn.disabled = true;
          await window.AureliaAPI.impersonateUser(uid);
          window.location.href = 'index.html';
        } catch (err) {
          impBtn.disabled = false;
          alert(err.message || 'Не вдалося виконати імперсонацію.');
        }
        return;
      }

      const delCardBtn = e.target.closest('[data-delete-user-card]');
      if (delCardBtn && DOM.usersTbody.contains(delCardBtn)) {
        const [uid, cardId] = String(delCardBtn.dataset.deleteUserCard || '').split(':');
        const userName = delCardBtn.dataset.userName || 'користувача';
        const storeName = delCardBtn.dataset.storeName || '';
        openConfirmModal({
          title: 'Видалити картку клієнта',
          message: `Видалити картку ${storeName} у користувача ${userName}?`,
          confirmLabel: 'Підтвердити',
          onConfirm: async () => {
            await window.AureliaAPI.deleteAdminUserCard(uid, cardId);
            await loadUsers();
          }
        });
        return;
      }

      const clearBtn = e.target.closest('[data-clear-basket]');
      if (clearBtn && DOM.usersTbody.contains(clearBtn)) {
        const uid = clearBtn.dataset.clearBasket;
        const userName = clearBtn.dataset.userName || 'користувача';
        openConfirmModal({
          title: 'Очистити кошик клієнта',
          message: `Очистити кошик користувача ${userName}?`,
          confirmLabel: 'Підтвердити',
          onConfirm: async () => {
            await window.AureliaAPI.clearAdminUserBasket(uid);
            await loadUsers();
          }
        });
      }
    });
  }

  function switchAdminSectionTab(tabName) {
    AdminState.activeTab = tabName === 'users' ? 'users' : 'products';
    const isUsers = AdminState.activeTab === 'users';

    if (DOM.tabProducts) {
      DOM.tabProducts.classList.toggle('is-active', !isUsers);
      DOM.tabProducts.setAttribute('aria-selected', !isUsers ? 'true' : 'false');
    }
    if (DOM.tabUsers) {
      DOM.tabUsers.classList.toggle('is-active', isUsers);
      DOM.tabUsers.setAttribute('aria-selected', isUsers ? 'true' : 'false');
    }
    if (DOM.productsSection) {
      DOM.productsSection.classList.toggle('is-hidden', isUsers);
    }
    if (DOM.usersSection) {
      DOM.usersSection.classList.toggle('is-hidden', !isUsers);
    }

    if (isUsers) {
      loadUsers();
      if (!AdminState.usersRefreshTimer) {
        AdminState.usersRefreshTimer = window.setInterval(() => {
          if (AdminState.activeTab === 'users' && document.visibilityState === 'visible') {
            loadUsers();
          }
        }, 30000);
      }
    }
  }

  function initUsersControls() {
    if (DOM.tabProducts) {
      DOM.tabProducts.addEventListener('click', () => switchAdminSectionTab('products'));
    }
    if (DOM.tabUsers) {
      DOM.tabUsers.addEventListener('click', () => switchAdminSectionTab('users'));
    }
    if (DOM.userSearchInput) {
      DOM.userSearchInput.addEventListener('input', (e) => {
        AdminState.userSearchQuery = e.target.value.trim();
        renderUsersTable();
      });
    }
    if (DOM.btnRefreshUsers) {
      DOM.btnRefreshUsers.addEventListener('click', () => loadUsers());
    }

    if (DOM.confirmCancelBtn) {
      DOM.confirmCancelBtn.addEventListener('click', () => {
        AdminState.confirmCallback = null;
        closeModal(DOM.confirmModal);
      });
    }

    if (DOM.confirmOkBtn) {
      DOM.confirmOkBtn.addEventListener('click', async () => {
        const cb = AdminState.confirmCallback;
        AdminState.confirmCallback = null;
        if (!cb) {
          closeModal(DOM.confirmModal);
          return;
        }
        try {
          DOM.confirmOkBtn.disabled = true;
          await cb();
          closeModal(DOM.confirmModal);
        } catch (err) {
          alert(err.message || 'Помилка виконання дії.');
        } finally {
          DOM.confirmOkBtn.disabled = false;
        }
      });
    }

    if (DOM.userEditForm) {
      DOM.userEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (DOM.editUserError) DOM.editUserError.textContent = '';

        const name = (DOM.editUserName?.value || '').trim();
        const email = (DOM.editUserEmail?.value || '').trim().toLowerCase();
        const role = (DOM.editUserRole?.value || 'USER').trim().toUpperCase();
        const is_verified = Boolean(DOM.editUserVerified?.checked);
        const newPassword = DOM.editUserPassword?.value || '';

        if (!name || name.length < 2) {
          if (DOM.editUserError) DOM.editUserError.textContent = 'Ім’я користувача повинно містити щонайменше 2 символи.';
          return;
        }
        if (!email || !email.includes('@')) {
          if (DOM.editUserError) DOM.editUserError.textContent = 'Вкажіть коректну адресу електронної пошти.';
          return;
        }
        if ((role === 'ADMIN' || role === 'QA') && !email.endsWith('@aurelia.ua')) {
          if (DOM.editUserError) DOM.editUserError.textContent = 'Ролі ADMIN та QA доступні лише для адрес @aurelia.ua.';
          return;
        }
        if (newPassword.trim().length > 0 && newPassword.trim().length < 6) {
          if (DOM.editUserError) DOM.editUserError.textContent = 'Новий пароль повинен містити щонайменше 6 символів.';
          return;
        }

        try {
          if (DOM.editUserSubmitBtn) DOM.editUserSubmitBtn.disabled = true;
          await window.AureliaAPI.updateAdminUser(AdminState.editingUserId, {
            name,
            email,
            role,
            is_verified,
            ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {})
          });
          closeModal(DOM.userEditModal);
          await loadUsers();
        } catch (err) {
          if (DOM.editUserError) DOM.editUserError.textContent = err.message || 'Не вдалося зберегти зміни користувача.';
        } finally {
          if (DOM.editUserSubmitBtn) DOM.editUserSubmitBtn.disabled = false;
        }
      });
    }
  }

  function applyStaffRoleUI(user) {
    const readOnly = isReadOnlyQA(user);
    if (DOM.qaBadge) DOM.qaBadge.classList.toggle('is-hidden', !readOnly);
    if (DOM.btnAdd) {
      DOM.btnAdd.classList.toggle('is-hidden', readOnly);
      DOM.btnAdd.disabled = readOnly;
    }
    if (DOM.btnSync) {
      DOM.btnSync.classList.toggle('is-hidden', readOnly);
      DOM.btnSync.disabled = readOnly;
    }
  }

  function showUnauthorizedView() {
    if (DOM.dashboardContent) DOM.dashboardContent.classList.add('is-hidden');
    if (DOM.accessDenied) DOM.accessDenied.classList.remove('is-hidden');
    if (DOM.qaBadge) DOM.qaBadge.classList.add('is-hidden');
    setTimeout(() => {
      window.location.replace('index.html');
    }, 1200);
  }

  async function init() {
    cacheDOM();

    const user = getCurrentStaffUser();
    if (!isStaffAuthorized(user)) {
      showUnauthorizedView();
      return;
    }

    if (DOM.accessDenied) DOM.accessDenied.classList.add('is-hidden');
    if (DOM.dashboardContent) DOM.dashboardContent.classList.remove('is-hidden');
    applyStaffRoleUI(user);

    initForm();
    initUsersControls();
    loadProducts();

    // Verify JWT session cleanly with backend when online
    if (window.AureliaAPI && typeof window.AureliaAPI.getMe === 'function') {
      try {
        const freshUser = await window.AureliaAPI.getMe();
        if (!isStaffAuthorized(freshUser)) {
          showUnauthorizedView();
          return;
        }
        applyStaffRoleUI(freshUser);
        renderTable();
        if (AdminState.activeTab === 'users') {
          renderUsersTable();
        }
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
