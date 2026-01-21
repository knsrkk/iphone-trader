// Управление отображением товаров
class ProductManager {
    constructor() {
        this.currentCategory = 'phones';
        this.selectedProductId = null;
    }
    
    // Отображение статистики
    updateStats() {
        const stats = getStats();
        document.getElementById('profitValue').textContent = `${stats.profit.toLocaleString()} ₽`;
        document.getElementById('turnoverValue').textContent = `${stats.turnover.toLocaleString()} ₽`;
        document.getElementById('inStockValue').textContent = stats.inStock;
        document.getElementById('soldValue').textContent = stats.sold;
    }
    
    // Обновление счетчиков категорий
    updateCategoryCounts() {
        const counts = getCategoriesWithCounts();
        document.getElementById('phonesCount').textContent = counts.phones;
        document.getElementById('accessoriesCount').textContent = counts.accessories;
        document.getElementById('partsCount').textContent = counts.parts;
        document.getElementById('soldCount').textContent = counts.sold;
    }
    
    // Создание карточки товара
    createProductCard(product) {
        const status = statuses[product.status];
        
        return `
            <div class="product-card ios-tap-highlight" data-product-id="${product.id}">
                <div class="product-image">
                    <i class="fas fa-${product.category === 'phones' ? 'mobile-alt' : product.category === 'accessories' ? 'headphones' : 'cogs'}"></i>
                </div>
                <div class="product-info">
                    <div class="product-header">
                        <div>
                            <div class="product-name">${product.name}</div>
                            <div class="product-category">${categories[product.category]}</div>
                        </div>
                        <span class="product-status ${status.class}">${status.text}</span>
                    </div>
                    <div class="product-description">${product.description}</div>
                    <div class="product-footer">
                        <div class="product-price">${product.sellingPrice.toLocaleString()} ₽</div>
                        <div class="product-meta">
                            ${product.status === 'sold' ? 
                                `<small>Продано: ${new Date(product.soldAt).toLocaleDateString('ru-RU')}</small>` : 
                                `<small>Прибыль: ${product.profit.toLocaleString()} ₽</small>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Отображение товаров на главной
    renderHomeProducts() {
        const container = document.getElementById('homeProducts');
        const recentProducts = getRecentProducts(3);
        
        if (recentProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open fa-3x"></i>
                    <p>Нет товаров в наличии</p>
                    <button class="btn-primary" id="addFirstProductBtn">
                        <i class="fas fa-plus"></i> Добавить первый товар
                    </button>
                </div>
            `;
            
            document.getElementById('addFirstProductBtn')?.addEventListener('click', () => {
                switchPage('addProduct');
            });
        } else {
            container.innerHTML = recentProducts.map(product => 
                this.createProductCard(product)
            ).join('');
        }
    }
    
    // Отображение товаров в категории
    renderCategoryProducts(category = this.currentCategory) {
        const container = document.getElementById('warehouseProducts');
        const products = getProductsByCategory(category);
        const title = document.getElementById('currentCategoryTitle');
        
        title.textContent = categories[category];
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${category === 'sold' ? 'check-circle' : 'box'} fa-3x"></i>
                    <p>${category === 'sold' ? 'Нет проданных товаров' : 'Нет товаров в этой категории'}</p>
                </div>
            `;
        } else {
            container.innerHTML = products.map(product => 
                this.createProductCard(product)
            ).join('');
        }
    }
    
    // Отображение деталей товара
    renderProductDetail(id) {
        const product = getProductById(id);
        if (!product) return;
        
        this.selectedProductId = id;
        
        const status = statuses[product.status];
        
        document.getElementById('detailName').textContent = product.name;
        document.getElementById('detailCategory').textContent = categories[product.category];
        document.getElementById('detailStatus').textContent = status.text;
        document.getElementById('detailStatus').className = `product-status ${status.class}`;
        document.getElementById('detailDescription').textContent = product.description;
        document.getElementById('detailPurchasePrice').textContent = `${product.purchasePrice.toLocaleString()} ₽`;
        document.getElementById('detailSellingPrice').textContent = `${product.sellingPrice.toLocaleString()} ₽`;
        document.getElementById('detailProfit').textContent = `${product.profit.toLocaleString()} ₽`;
        
        const sellBtn = document.getElementById('sellProductBtn');
        if (product.status === 'sold') {
            sellBtn.innerHTML = '<i class="fas fa-check"></i> Уже продано';
            sellBtn.disabled = true;
            sellBtn.style.opacity = '0.6';
        } else {
            sellBtn.innerHTML = '<i class="fas fa-check-circle"></i> Продать';
            sellBtn.disabled = false;
            sellBtn.style.opacity = '1';
        }
        
        // Обновляем рекомендуемую цену в модальном окне
        document.getElementById('recommendedPrice').textContent = `${product.sellingPrice.toLocaleString()} ₽`;
        document.getElementById('actualSellingPrice').value = product.sellingPrice;
    }
    
    // Инициализация обработчиков событий
    initEventListeners() {
        // Клик по категории
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                this.currentCategory = card.dataset.category;
                this.renderCategoryProducts(this.currentCategory);
            });
        });
        
        // Клик по товару
        document.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                const productId = parseInt(productCard.dataset.productId);
                this.renderProductDetail(productId);
                switchPage('productDetail');
            }
        });
        
        // Кнопка редактирования
        document.getElementById('editProductBtn')?.addEventListener('click', () => {
            // Здесь можно добавить функционал редактирования
            showToast('Функция редактирования в разработке');
        });
        
        // Кнопка продажи
        document.getElementById('sellProductBtn')?.addEventListener('click', () => {
            if (this.selectedProductId) {
                const product = getProductById(this.selectedProductId);
                if (product.status !== 'sold') {
                    document.getElementById('sellModal').classList.add('active');
                }
            }
        });
        
        // Подтверждение продажи
        document.getElementById('confirmSellBtn')?.addEventListener('click', () => {
            const actualPrice = parseInt(document.getElementById('actualSellingPrice').value) || 0;
            const notes = document.getElementById('saleNotes').value;
            
            if (actualPrice <= 0) {
                showToast('Введите корректную цену продажи');
                return;
            }
            
            if (this.selectedProductId) {
                const soldProduct = sellProduct(this.selectedProductId, actualPrice, notes);
                if (soldProduct) {
                    showToast('Товар успешно продан!');
                    document.getElementById('sellModal').classList.remove('active');
                    
                    // Обновляем отображение
                    this.updateStats();
                    this.updateCategoryCounts();
                    this.renderHomeProducts();
                    this.renderCategoryProducts(this.currentCategory);
                    this.renderProductDetail(this.selectedProductId);
                    
                    // Возвращаемся на главную
                    switchPage('home');
                }
            }
        });
        
        // Закрытие модального окна
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('sellModal').classList.remove('active');
            });
        });
        
        // Клик по фону модального окна
        document.getElementById('sellModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('sellModal')) {
                document.getElementById('sellModal').classList.remove('active');
            }
        });
    }
    
    // Инициализация
    init() {
        this.updateStats();
        this.updateCategoryCounts();
        this.renderHomeProducts();
        this.renderCategoryProducts();
        this.initEventListeners();
    }
    // Добавим в класс ProductManager

// Загрузка данных в форму редактирования
loadProductToEditForm(id) {
    const product = getProductById(id);
    if (!product) return;
    
    this.selectedProductId = id;
    
    // Заполняем форму
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editPurchasePrice').value = product.purchasePrice;
    document.getElementById('editSellingPrice').value = product.sellingPrice;
    document.getElementById('editProductCategory').value = product.category;
    document.getElementById('editProductStatus').value = product.status;
    document.getElementById('editProductDescription').value = product.description;
    
    // Заполняем предпросмотр для удаления
    const deletePreview = document.getElementById('deletePreview');
    deletePreview.innerHTML = `
        <h4>${product.name}</h4>
        <p>Категория: ${categories[product.category]}</p>
        <p>Статус: ${statuses[product.status].text}</p>
        <p class="price">Цена продажи: ${product.sellingPrice.toLocaleString()} ₽</p>
        <p>Прибыль: ${product.profit.toLocaleString()} ₽</p>
    `;
    
    // Отмечаем что форма редактируется
    document.getElementById('editProductPage').classList.add('editing');
}

// Отображение истории изменений
renderChangeHistory(productId) {
    const changes = getProductChanges(productId);
    
    if (changes.length === 0) {
        return '<div class="empty-state"><p>Нет истории изменений</p></div>';
    }
    
    return `
        <div class="changes-history">
            <h4>История изменений</h4>
            ${changes.reverse().map((change, index) => `
                <div class="change-item">
                    <div>
                        <div class="change-date">${new Date(change.date).toLocaleString('ru-RU')}</div>
                        <div class="change-details">
                            ${Object.entries(change.changes).map(([field, values]) => {
                                let fieldName = field;
                                switch(field) {
                                    case 'name': fieldName = 'Название'; break;
                                    case 'purchasePrice': fieldName = 'Цена покупки'; break;
                                    case 'sellingPrice': fieldName = 'Цена продажи'; break;
                                    case 'category': fieldName = 'Категория'; break;
                                    case 'status': fieldName = 'Статус'; break;
                                    case 'description': fieldName = 'Описание'; break;
                                    case 'profit': fieldName = 'Прибыль'; break;
                                }
                                
                                let oldValue = values.old;
                                let newValue = values.new;
                                
                                if (field === 'category') {
                                    oldValue = categories[oldValue] || oldValue;
                                    newValue = categories[newValue] || newValue;
                                } else if (field === 'status') {
                                    oldValue = statuses[oldValue]?.text || oldValue;
                                    newValue = statuses[newValue]?.text || newValue;
                                } else if (field.includes('Price') || field === 'profit') {
                                    oldValue = `${parseInt(oldValue).toLocaleString()} ₽`;
                                    newValue = `${parseInt(newValue).toLocaleString()} ₽`;
                                }
                                
                                return `
                                    <div class="change-field">
                                        ${fieldName}: 
                                        <span class="old-value">${oldValue}</span> → 
                                        <span class="new-value">${newValue}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <button class="btn-icon revert-btn" data-change-index="${changes.length - 1 - index}" title="Отменить это изменение">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// Инициализация обработчиков для редактирования
initEditEventListeners() {
    // Кнопка редактирования на странице деталей
    document.getElementById('editProductBtn').addEventListener('click', () => {
        if (this.selectedProductId) {
            this.loadProductToEditForm(this.selectedProductId);
            switchPage('editProduct');
        }
    });
    
    // Кнопка возврата из редактирования
    document.getElementById('backFromEditBtn').addEventListener('click', () => {
        if (this.selectedProductId) {
            this.renderProductDetail(this.selectedProductId);
            switchPage('productDetail');
        } else {
            switchPage('warehouse');
        }
    });
    
    // Отмена редактирования
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        if (this.selectedProductId) {
            this.renderProductDetail(this.selectedProductId);
            switchPage('productDetail');
        } else {
            switchPage('warehouse');
        }
    });
    
    // Удаление товара
    document.getElementById('deleteProductBtn').addEventListener('click', () => {
        if (this.selectedProductId) {
            document.getElementById('deleteConfirmModal').classList.add('active');
        }
    });
    
    // Подтверждение удаления
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (this.selectedProductId) {
            deleteProduct(this.selectedProductId);
            showToast('Товар удален');
            document.getElementById('deleteConfirmModal').classList.remove('active');
            
            // Обновляем данные
            this.updateStats();
            this.updateCategoryCounts();
            this.renderHomeProducts();
            this.renderCategoryProducts(this.currentCategory);
            
            // Возвращаемся на склад
            switchPage('warehouse');
        }
    });
    
    // Закрытие модального окна удаления
    document.getElementById('deleteConfirmModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('deleteConfirmModal')) {
            document.getElementById('deleteConfirmModal').classList.remove('active');
        }
    });
    
    document.querySelectorAll('#deleteConfirmModal .modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('deleteConfirmModal').classList.remove('active');
        });
    });
    
    // Отправка формы редактирования
    document.getElementById('editProductForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!this.selectedProductId) return;
        
        const updates = {
            name: document.getElementById('editProductName').value.trim(),
            purchasePrice: parseInt(document.getElementById('editPurchasePrice').value) || 0,
            sellingPrice: parseInt(document.getElementById('editSellingPrice').value) || 0,
            category: document.getElementById('editProductCategory').value,
            status: document.getElementById('editProductStatus').value,
            description: document.getElementById('editProductDescription').value.trim()
        };
        
        // Валидация
        if (!updates.name) {
            showToast('Введите название товара');
            return;
        }
        
        if (updates.purchasePrice <= 0 || updates.sellingPrice <= 0) {
            showToast('Введите корректные цены');
            return;
        }
        
        if (updates.sellingPrice <= updates.purchasePrice) {
            showToast('Цена продажи должна быть выше цены покупки');
            return;
        }
        
        // Обновляем товар
        const result = updateProduct(this.selectedProductId, updates);
        
        if (result) {
            showToast('Товар обновлен!');
            
            // Обновляем данные
            this.updateStats();
            this.updateCategoryCounts();
            this.renderHomeProducts();
            this.renderCategoryProducts(this.currentCategory);
            this.renderProductDetail(this.selectedProductId);
            
            // Возвращаемся к деталям товара
            switchPage('productDetail');
        }
    });
    
    // Отслеживание изменений в форме для подсветки
    const editForm = document.getElementById('editProductForm');
    const originalValues = {};
    
    editForm.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => {
            const formGroup = input.closest('.form-group');
            if (formGroup) {
                if (input.value !== originalValues[input.id]) {
                    formGroup.classList.add('edited');
                } else {
                    formGroup.classList.remove('edited');
                }
            }
        });
    });
    
    // Сохраняем оригинальные значения при загрузке формы
    document.addEventListener('DOMContentLoaded', () => {
        editForm.querySelectorAll('input, select, textarea').forEach(input => {
            originalValues[input.id] = input.value;
        });
    });
}

// Обновим метод initEventListeners чтобы добавить редактирование
initEventListeners() {
    // ... существующий код ...
    
    // Инициализация обработчиков редактирования
    this.initEditEventListeners();
}
}

// Создаем экземпляр менеджера товаров
const productManager = new ProductManager();