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
    editingProductId: null
  };

  const STORES = [
    'silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart',
    'thrash', 'simi', 'blyzenko', 'taistra', 'arsen', 'rukavychka',
    'eva', 'prostor', 'avrora', 'epicentr'
  ];

  const STORE_NAMES = {
    silpo: 'Сільпо',
    atb: 'АТБ-Маркет',
    novus: 'NOVUS',
    metro: 'METRO',
    varus: 'VARUS',
    auchan: 'АШАН',
    epicentrk_food: 'Епіцентр Food',
    velmart: 'Велмарт',
    thrash: 'Траш! ТРАШ!',
    simi: 'Сімі',
    blyzenko: 'Близенько',
    taistra: 'Тайстра',
    arsen: 'Арсен',
    rukavychka: 'Рукавичка',
    eva: 'EVA',
    prostor: 'Prostor',
    avrora: 'Аврора Мультимаркет',
    epicentr: 'Епіцентр К'
  };

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
      'Дім та Затишок'
    ],
    'Зоотовари': [
      'Для котів',
      'Для собак'
    ]
  };

  const CITY_NAMES = {
    'all': 'Всі міста',
    'ivano-frankivsk': 'Івано-Франківськ',
    'lviv': 'Львів',
    'ternopil': 'Тернопіль',
    'lutsk': 'Луцьк',
    'chernivtsi': 'Чернівці',
    'rivne': 'Рівне',
    'uzhhorod': 'Ужгород',
    'khmelnytskyi': 'Хмельницький',
    'kyiv': 'Київ'
  };

  const DOM = {
    storeInputs: {}
  };

  function cacheDOM() {
    DOM.tbody = document.getElementById('admin-products-tbody');
    DOM.searchInput = document.getElementById('admin-search-input');
    DOM.citySelect = document.getElementById('admin-city-select');
    DOM.btnAdd = document.getElementById('btn-admin-add-product');
    DOM.btnSync = document.getElementById('btn-admin-sync-promos');
    DOM.syncLabel = document.getElementById('sync-promos-label');
    DOM.modal = document.getElementById('admin-product-modal');
    DOM.modalTitle = document.getElementById('admin-product-modal-title');
    DOM.form = document.getElementById('admin-product-form');

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
    modalEl.classList.add('is-open');
    document.body.classList.add('is-locked');
    const firstInput = modalEl.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }

  function populateSubCategories(mainCat, selectedSubCat = '') {
    if (!DOM.subCategorySelect) return;
    const subCats = CATEGORY_HIERARCHY[mainCat] || CATEGORY_HIERARCHY['Продукти'];
    DOM.subCategorySelect.innerHTML = subCats.map(sub => `
      <option value="${sub}" ${sub === selectedSubCat ? 'selected' : ''}>${sub}</option>
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

    if (DOM.statDiscount && AdminState.products.length > 0) {
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

      const avg = count > 0 ? Math.round(totalDiscount / count) : 25;
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
      const mainCat = product.mainCategory || 'Продукти';
      const subCat = product.subCategory || product.category || 'Загальне';
      const cityName = CITY_NAMES[product.city] || product.city || 'Усі міста';

      return `
        <tr>
          <td>
            <div class="admin-prod-cell">
              <strong class="admin-prod-title">${product.title || product.name}</strong>
              <div class="admin-prod-meta">
                <span>${product.unit || 'шт'}</span>
                ${product.promoTag ? `<span class="promo-tag-badge">${product.promoTag}</span>` : ''}
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
                const storeLabel = STORE_NAMES[p.store] || p.store;
                return `
                  <span class="admin-price-chip ${isMin ? 'is-best' : ''}" title="${storeLabel}: ${p.price.toFixed(2)} грн">
                    <svg class="icon icon-xs" aria-hidden="true">
                      <use href="assets/sprite.svg#logo-${p.store}"></use>
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
              <button type="button" class="btn-icon" data-admin-edit="${product.id}" aria-label="Редагувати ${product.title || product.name}">
                <svg class="icon icon-sm" aria-hidden="true">
                  <use href="assets/sprite.svg#icon-edit"></use>
                </svg>
              </button>
              <button type="button" class="btn-icon" data-admin-delete="${product.id}" aria-label="Видалити ${product.title || product.name}">
                <svg class="icon icon-sm" aria-hidden="true">
                  <use href="assets/sprite.svg#icon-trash"></use>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindTableActions();
  }

  function bindTableActions() {
    DOM.tbody.querySelectorAll('[data-admin-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.adminEdit;
        const prod = AdminState.products.find(p => String(p.id) === String(id));
        if (prod) openEditForm(prod);
      });
    });

    DOM.tbody.querySelectorAll('[data-admin-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.adminDelete;
        const prod = AdminState.products.find(p => String(p.id) === String(id));
        if (confirm(`Видалити товар "${prod?.title || prod?.name || ''}" з каталогу?`)) {
          if (window.AureliaAPI) {
            await window.AureliaAPI.deleteProduct(id);
          }
          AdminState.products = AdminState.products.filter(p => String(p.id) !== String(id));
          updateStats();
          renderTable();
        }
      });
    });
  }

  function openCreateForm() {
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
          if (DOM.syncLabel) DOM.syncLabel.textContent = 'Помилка';
          setTimeout(() => {
            if (DOM.syncLabel) DOM.syncLabel.textContent = 'Синхронізувати ціни';
            DOM.btnSync.disabled = false;
          }, 2000);
        }
      });
    }

    // Modal Close Buttons (using data-close-modal)
    if (DOM.modal) {
      DOM.modal.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(DOM.modal));
      });

      DOM.modal.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeModal(DOM.modal);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.modal && DOM.modal.classList.contains('is-open')) {
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
            const oldPVal = parseFloat(DOM.storeInputs[s].oldPrice?.value) || Math.round(pVal * 1.25);
            const urlVal = (DOM.storeInputs[s].url?.value || '').trim();
            const discount = oldPVal > pVal ? Math.round(((oldPVal - pVal) / oldPVal) * 100) : 0;

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

  function init() {
    cacheDOM();
    initForm();
    loadProducts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
