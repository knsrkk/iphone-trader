// app.js - ПОЛНЫЙ ФАЙЛ С FIREBASE И ЗАГРУЗКОЙ
class iPhoneTraderApp {
    _addingProduct = false;
    constructor() {
        this.currentUser = null;
        this.products = [];
        this.requiredParts = [];
        this.currentPage = 'home';
        this.currentFilter = 'all';
        this.currentPhoneStatus = 'all';
        this.currentSort = 'newest';
        this.selectedProductId = null;
        this.searchQuery = '';
        this.tempPhotos = [];
        
        // Подписки для обновлений в реальном времени
        this.productsUnsubscribe = null;
        this.partsUnsubscribe = null;
        
        // Состояние загрузки
        this.isLoading = false;
        this.currentLoadingType = null;
        
        this.init();

        this.compressionSettings = {
            high: { maxWidth: 1200, quality: 0.7 },
            medium: { maxWidth: 800, quality: 0.5 },
            low: { maxWidth: 600, quality: 0.3 }
        };
        this.currentCompression = 'high';
    }
    compressImage(dataUrl, mimeType, customSettings = null) {
        return new Promise((resolve, reject) => {
            const settings = customSettings || this.compressionSettings[this.currentCompression];
            const maxWidth = settings.maxWidth;
            const quality = settings.quality;
            
            const img = new Image();
            
            img.onload = () => {
                // Показываем прогресс
                this.showCompressionProgress(true);
                
                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Рассчитываем новые размеры
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                // Устанавливаем размеры canvas
                canvas.width = width;
                canvas.height = height;
                
                // Рисуем сжатое изображение
                const ctx = canvas.getContext('2d');
                
                // Улучшаем качество сжатия
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // Конвертируем HEIC/HEIF в JPEG если нужно
                let outputMimeType = mimeType;
                if (mimeType === 'image/heic' || mimeType === 'image/heif' || mimeType === 'image/heif-sequence') {
                    outputMimeType = 'image/jpeg';
                }
                
                // Для WebP если браузер поддерживает
                if (outputMimeType === 'image/jpeg' && this.supportsWebP()) {
                    outputMimeType = 'image/webp';
                }
                
                // Получаем сжатое изображение
                try {
                    const compressedDataUrl = canvas.toDataURL(outputMimeType, quality);
                    
                    // Скрываем прогресс
                    this.showCompressionProgress(false);
                    
                    // Обновляем статистику
                    this.updatePhotoStats(compressedDataUrl, {
                        originalWidth: img.width,
                        originalHeight: img.height,
                        compressedWidth: width,
                        compressedHeight: height,
                        quality: quality
                    });
                    
                    resolve(compressedDataUrl);
                } catch (error) {
                    this.showCompressionProgress(false);
                    reject(error);
                }
            };
            
            img.onerror = (error) => {
                this.showCompressionProgress(false);
                reject(error);
            };
            
            img.src = dataUrl;
        });
    }
    
    // Проверка поддержки WebP
    supportsWebP() {
        const elem = document.createElement('canvas');
        if (!!(elem.getContext && elem.getContext('2d'))) {
            return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        }
        return false;
    }
    
    // Показать/скрыть прогресс сжатия
    showCompressionProgress(show = true) {
        const progressBar = document.getElementById('compressionProgressBar');
        const progressContainer = document.getElementById('compressionProgress');
        
        if (progressBar && progressContainer) {
            if (show) {
                progressContainer.classList.add('active');
                progressBar.style.width = '0%';
                setTimeout(() => {
                    progressBar.style.width = '100%';
                }, 10);
            } else {
                setTimeout(() => {
                    progressBar.style.width = '0%';
                    setTimeout(() => {
                        progressContainer.classList.remove('active');
                    }, 300);
                }, 500);
            }
        }
    }
    
    // Обновить статистику фото
    updatePhotoStats(dataUrl, stats) {
        const statsContainer = document.getElementById('photoStats');
        if (!statsContainer) return;
        
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const sizeInBytes = Math.ceil(base64Length * 3 / 4);
        const sizeInKB = Math.round(sizeInBytes / 1024);
        
        statsContainer.innerHTML = `
            <div class="stat-item">
                <i class="fas fa-expand-alt"></i>
                <span>${stats.compressedWidth}×${stats.compressedHeight}</span>
            </div>
            <div class="stat-item">
                <i class="fas fa-weight-hanging"></i>
                <span>${sizeInKB} KB</span>
            </div>
            <div class="stat-item">
                <i class="fas fa-compress-alt"></i>
                <span>${Math.round(stats.quality * 100)}%</span>
            </div>
        `;
        
        statsContainer.style.display = 'flex';
    }
    // Инициализация приложения
    async init() {
        console.log('Приложение инициализируется...');
        
        // Проверяем, есть ли сохраненный пользователь
        const savedUser = localStorage.getItem('iphoneTraderUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('Найден сохраненный пользователь:', this.currentUser.email);
                this.updateUserProfile(this.currentUser);
                this.showLoading('list', 'Загрузка данных...');
                await this.loadUserData();
            } catch (error) {
                console.error('Ошибка загрузки пользователя:', error);
                localStorage.removeItem('iphoneTraderUser');
            }
        }
        
        this.initEventListeners();
        this.renderHomePage();
        this.renderPartsList();
        this.initFullscreenPhoto();
    }
    
    // ========== МЕТОДЫ ЗАГРУЗКИ ==========
    
    // Показать индикатор загрузки
    showLoading(type = 'global', text = 'Загрузка...') {
        this.isLoading = true;
        this.currentLoadingType = type;
        
        switch(type) {
            case 'global':
                this.showGlobalLoader(text);
                break;
            case 'list':
                this.showListLoader(text);
                break;
            case 'modal':
                this.showModalLoader(text);
                break;
        }
    }
    
    // Скрыть индикатор загрузки
    hideLoading() {
        this.isLoading = false;
        this.currentLoadingType = null;
        
        // Глобальный загрузчик
        const globalLoader = document.getElementById('globalLoader');
        if (globalLoader) {
            globalLoader.classList.remove('active');
        }
        
        // Спиннеры в кнопках
        document.querySelectorAll('.btn.loading').forEach(btn => {
            btn.classList.remove('loading');
        });
        
        // Модальные загрузчики
        document.querySelectorAll('.modal-loading').forEach(loader => {
            loader.classList.remove('active');
        });
        
        // Скрыть скелетоны
        document.querySelectorAll('.skeleton').forEach(skeleton => {
            skeleton.style.display = 'none';
        });
    }
    
    // Показать глобальный загрузчик
    showGlobalLoader(text = 'Загрузка...') {
        let loader = document.getElementById('globalLoader');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'loading-overlay';
            loader.id = 'globalLoader';
            loader.innerHTML = `
                <div class="loader"></div>
                <div class="loader-text">${text}</div>
            `;
            document.body.appendChild(loader);
        }
        
        loader.querySelector('.loader-text').textContent = text;
        loader.classList.add('active');
    }
    
    // Показать загрузчик списка
    showListLoader(text = 'Загрузка...') {
        // Для главной страницы
        const recentContainer = document.getElementById('recentProducts');
        if (recentContainer && this.currentPage === 'home') {
            recentContainer.innerHTML = `
                <div class="list-loading">
                    <div class="loader"></div>
                    <div class="loader-text">${text}</div>
                </div>
            `;
        }
        
        // Для склада
        const warehouseContainer = document.getElementById('warehouseProducts');
        if (warehouseContainer && this.currentPage === 'warehouse') {
            warehouseContainer.innerHTML = `
                <div class="list-loading">
                    <div class="loader"></div>
                    <div class="loader-text">${text}</div>
                </div>
            `;
        }
        
        // Для запчастей
        const partsContainer = document.getElementById('partsList');
        if (partsContainer && this.currentPage === 'parts') {
            partsContainer.innerHTML = `
                <div class="list-loading">
                    <div class="loader"></div>
                    <div class="loader-text">${text}</div>
                </div>
            `;
        }
    }
    
    // Показать загрузчик в модальном окне
    showModalLoader(modalId, text = 'Загрузка...') {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        let loader = modal.querySelector('.modal-loading');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'modal-loading';
            loader.innerHTML = `
                <div class="loader"></div>
                <div class="loader-text">${text}</div>
            `;
            modal.appendChild(loader);
        }
        
        loader.querySelector('.loader-text').textContent = text;
        loader.classList.add('active');
    }
    
    // Показать скелетоны загрузки
    showSkeletons(containerId, count = 3) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let skeletons = '';
        for (let i = 0; i < count; i++) {
            skeletons += `
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
            `;
        }
        
        container.innerHTML = skeletons;
    }
    
    // Установить кнопку в состояние загрузки
    setButtonLoading(buttonId, isLoading = true) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
            
            if (!button.querySelector('.loader-small')) {
                const loader = document.createElement('div');
                loader.className = 'loader-small active';
                button.appendChild(loader);
            } else {
                button.querySelector('.loader-small').classList.add('active');
            }
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.querySelector('.loader-small')?.classList.remove('active');
        }
    }
    
    // ========== ОСНОВНЫЕ МЕТОДЫ ==========
    
    // Загрузка данных пользователя
    async loadUserData() {
        if (!this.currentUser || !this.currentUser.id) {
            console.log('Нет пользователя для загрузки данных');
            this.products = [];
            this.requiredParts = [];
            return;
        }
        
        console.log('Загрузка данных для пользователя:', this.currentUser.id);
        
        this.showLoading('list', 'Загрузка данных...');
        
        try {
            // Загружаем продукты
            this.products = await firebaseService.getProducts(this.currentUser.id);
            console.log('Товары загружены:', this.products.length);
            
            // Загружаем запчасти
            this.requiredParts = await firebaseService.getParts(this.currentUser.id);
            console.log('Запчасти загружены:', this.requiredParts.length);
            
            // Подписываемся на обновления в реальном времени
            this.setupRealtimeSubscriptions();
            
            // Обновляем статистику
            this.updateStats();
            this.updateCategoryCounts();
            
            // Обновляем текущую страницу
            if (this.currentPage === 'warehouse') {
                this.renderWarehouse();
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showToast('Ошибка', 'Не удалось загрузить данные', 'error');
        } finally {
            this.hideLoading();
            this.renderHomePage();
            this.renderPartsList();
        }
    }
    
    // Настройка подписок на обновления в реальном времени
    setupRealtimeSubscriptions() {
        if (!this.currentUser) {
            console.log('Нет пользователя для подписки');
            return;
        }
        
        // Отписываемся от старых подписок
        if (this.productsUnsubscribe) {
            this.productsUnsubscribe();
        }
        if (this.partsUnsubscribe) {
            this.partsUnsubscribe();
        }
        
        // Подписываемся на продукты
        this.productsUnsubscribe = firebaseService.subscribeToProducts(
            this.currentUser.id,
            (products) => {
                console.log('Получены обновленные товары:', products.length);
                this.products = products;
                this.updateStats();
                this.updateCategoryCounts();
                
                // Обновляем текущую страницу
                if (this.currentPage === 'home') {
                    this.renderHomePage();
                } else if (this.currentPage === 'warehouse') {
                    this.renderWarehouse();
                } else if (this.currentPage === 'productDetail' && this.selectedProductId) {
                    this.renderProductDetail(this.selectedProductId);
                }
            }
        );
        
        // Подписываемся на запчасти
        this.partsUnsubscribe = firebaseService.subscribeToParts(
            this.currentUser.id,
            (parts) => {
                console.log('Получены обновленные запчасти:', parts.length);
                this.requiredParts = parts;
                if (this.currentPage === 'parts') {
                    this.renderPartsList();
                }
            }
        );
        
        console.log('Подписки на обновления установлены');
    }
    
    // Проверка авторизации
    checkAuth() {
        if (!this.currentUser) {
            this.openAuthModal();
            return false;
        }
        return true;
    }
    
    // Открытие окна авторизации
    openAuthModal() {
        document.getElementById('authModal').classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }
    
    // Закрытие окна авторизации
    closeAuthModal() {
        document.getElementById('authModal').classList.remove('active');
        document.getElementById('modalOverlay').classList.remove('active');
    }
    
    // Обновление статистики
    async updateStats() {
        if (!this.currentUser) {
            // Если нет пользователя, показываем нули
            this.setStatsToZero();
            return;
        }
        
        try {
            const stats = await firebaseService.getStats(this.currentUser.id);
            
            // Быстрая статистика
            document.getElementById('quickProfit').textContent = `${stats.profit.toLocaleString()} ₽`;
            document.getElementById('quickInStock').textContent = stats.inStock;
            
            // Детальная статистика
            document.getElementById('statProfit').textContent = `${stats.profit.toLocaleString()} ₽`;
            document.getElementById('statTurnover').textContent = `${stats.turnover.toLocaleString()} ₽`;
            document.getElementById('statInStock').textContent = stats.inStock;
            document.getElementById('statSold').textContent = stats.sold;
            
        } catch (error) {
            console.error('Ошибка обновления статистики:', error);
            this.setStatsToZero();
        }
    }
    
    // Установка нулевой статистики
    setStatsToZero() {
        document.getElementById('quickProfit').textContent = `0 ₽`;
        document.getElementById('quickInStock').textContent = '0';
        document.getElementById('statProfit').textContent = `0 ₽`;
        document.getElementById('statTurnover').textContent = `0 ₽`;
        document.getElementById('statInStock').textContent = '0';
        document.getElementById('statSold').textContent = '0';
    }
    
    // Обновление счетчиков категорий
    updateCategoryCounts() {
        if (!this.currentUser) {
            document.getElementById('categoryPhones').textContent = '0';
            document.getElementById('categoryAccessories').textContent = '0';
            document.getElementById('categoryParts').textContent = '0';
            document.getElementById('categorySold').textContent = '0';
            return;
        }
        
        const phoneCount = this.products.filter(p => p.category === 'phones' && p.status === 'in-stock').length;
        const accessoriesCount = this.products.filter(p => p.category === 'accessories' && p.status === 'in-stock').length;
        const partsCount = this.products.filter(p => p.category === 'parts' && p.status === 'in-stock').length;
        const soldCount = this.products.filter(p => p.status === 'sold').length;
        
        document.getElementById('categoryPhones').textContent = phoneCount;
        document.getElementById('categoryAccessories').textContent = accessoriesCount;
        document.getElementById('categoryParts').textContent = partsCount;
        document.getElementById('categorySold').textContent = soldCount;
    }
    
    // Получение товаров по фильтру и сортировке
    getFilteredProducts() {
        let filtered = [...this.products];
        
        // Фильтрация по категории
        if (this.currentFilter !== 'all') {
            if (this.currentFilter === 'sold') {
                filtered = filtered.filter(p => p.status === 'sold');
            } else {
                filtered = filtered.filter(p => p.category === this.currentFilter && p.status === 'in-stock');
            }
        }
        
        // Дополнительная фильтрация по статусу телефонов
        if (this.currentFilter === 'phones' && this.currentPhoneStatus !== 'all') {
            filtered = filtered.filter(p => p.phoneStatus === this.currentPhoneStatus);
        }
        
        // Поиск
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.description.toLowerCase().includes(query)
            );
        }
        
        // Сортировка
        switch (this.currentSort) {
            case 'newest':
                filtered.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateB - dateA;
                });
                break;
            case 'oldest':
                filtered.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateA - dateB;
                });
                break;
            case 'price-high':
                filtered.sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0));
                break;
            case 'price-low':
                filtered.sort((a, b) => (a.sellingPrice || 0) - (b.sellingPrice || 0));
                break;
        }
        
        return filtered;
    }
    
    // Отображение карточки товара
    renderProductCard(product) {
        const statusClass = product.status === 'sold' ? 'sold' : 'in-stock';
        const statusText = product.status === 'sold' ? 'Продано' : 'В наличии';
        
        // Определяем иконку статуса телефона
        let phoneStatusIcon = '';
        let phoneStatusClass = '';
        let phoneStatusText = '';
        
        if (product.category === 'phones' && product.phoneStatus) {
            switch(product.phoneStatus) {
                case 'new':
                    phoneStatusIcon = 'fas fa-box';
                    phoneStatusClass = 'new';
                    phoneStatusText = 'Новый';
                    break;
                case 'in-progress':
                    phoneStatusIcon = 'fas fa-tools';
                    phoneStatusClass = 'in-progress';
                    phoneStatusText = 'В процессе';
                    break;
                case 'ready':
                    phoneStatusIcon = 'fas fa-check';
                    phoneStatusClass = 'ready';
                    phoneStatusText = 'Готовый';
                    break;
                case 'for-sale':
                    phoneStatusIcon = 'fas fa-tag';
                    phoneStatusClass = 'for-sale';
                    phoneStatusText = 'На продаже';
                    break;
            }
        }
        
        // Получаем первое фото для превью
        const hasPhoto = product.photos && product.photos.length > 0;
        const firstPhoto = hasPhoto ? product.photos[0] : null;
        
        // Рассчитываем итоговые затраты
        const totalCost = (product.purchasePrice || 0) + (product.investment || 0);
        
        // Показываем цену продажи если товар продан, иначе итоговые затраты
        let priceText;
        let priceClass = 'product-price';
        
        if (product.status === 'sold') {
            // Для проданных товаров показываем цену продажи
            priceText = product.sellingPrice ? 
                `${product.sellingPrice.toLocaleString()} ₽` : 
                `<span class="product-price no-price">Продано</span>`;
        } else {
            // Для товаров в наличии показываем итоговые затраты
            priceText = `${totalCost.toLocaleString()} ₽`;
        }
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image ${hasPhoto ? 'has-photo' : ''}">
                    ${hasPhoto ? 
                        `<img src="${firstPhoto}" alt="${product.name}" loading="lazy">` : 
                        `<i class="fas fa-${product.category === 'phones' ? 'mobile-alt' : 
                                         product.category === 'accessories' ? 'headphones' : 'cogs'}"></i>`
                    }
                </div>
                <div class="product-info">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <div class="product-name">${product.name}</div>
                        ${product.category === 'phones' && product.phoneStatus ? 
                            `<span class="phone-status ${product.phoneStatus}">
                                <i class="${phoneStatusIcon}"></i> ${phoneStatusText}
                            </span>` : ''
                        }
                    </div>
                    <div class="product-description">${product.description ? product.description.substring(0, 60) + '...' : 'Нет описания'}</div>
                    <div class="product-footer">
                        <div style="position: relative;">
                            <div class="${priceClass}">${priceText}</div>
                            ${product.status !== 'sold' ? 
                                '<div class="price-hint">Итого затрат</div>' : 
                                '<div class="price-hint">Цена продажи</div>'
                            }
                        </div>
                        <div class="product-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Отображение главной страницы
    renderHomePage() {
        console.log('Рендерим главную страницу');
        
        let recentProducts = this.products;
        
        if (this.currentUser) {
            recentProducts = recentProducts
                .filter(p => p.status === 'in-stock')
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateB - dateA;
                })
                .slice(0, 3);
        } else {
            recentProducts = [];
        }
        
        const container = document.getElementById('recentProducts');
        if (!container) {
            console.error('Контейнер recentProducts не найден');
            return;
        }
        
        // Если идет загрузка, показываем скелетоны
        if (this.isLoading && this.currentLoadingType === 'list') {
            this.showSkeletons('recentProducts', 2);
            return;
        }
        
        if (recentProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>${this.currentUser ? 'Нет товаров в наличии' : 'Войдите в аккаунт для просмотра товаров'}</p>
                    ${this.currentUser ? `
                        <button class="btn btn-primary" id="addFirstProduct">
                            <i class="fas fa-plus"></i> Добавить первый товар
                        </button>
                    ` : `
                        <button class="btn btn-primary" id="loginFirst">
                            <i class="fas fa-sign-in-alt"></i> Войти в аккаунт
                        </button>
                    `}
                </div>
            `;
            
            if (this.currentUser) {
                document.getElementById('addFirstProduct')?.addEventListener('click', () => {
                    this.switchPage('addProduct');
                });
            } else {
                document.getElementById('loginFirst')?.addEventListener('click', () => {
                    this.openAuthModal();
                });
            }
        } else {
            container.innerHTML = recentProducts.map(p => this.renderProductCard(p)).join('');
        }
    }
    
    // Отображение склада
    renderWarehouse() {
        console.log('Рендерим склад');
        
        const products = this.getFilteredProducts();
        const container = document.getElementById('warehouseProducts');
        
        if (!container) {
            console.error('Контейнер warehouseProducts не найден');
            return;
        }
        
        // Если идет загрузка, показываем скелетоны
        if (this.isLoading && this.currentLoadingType === 'list') {
            this.showSkeletons('warehouseProducts', 4);
            return;
        }
        
        if (!this.currentUser) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-lock"></i>
                    <p>Войдите в аккаунт для просмотра склада</p>
                    <button class="btn btn-primary" id="loginFromWarehouse">
                        <i class="fas fa-sign-in-alt"></i> Войти в аккаунт
                    </button>
                </div>
            `;
            
            document.getElementById('loginFromWarehouse')?.addEventListener('click', () => {
                this.openAuthModal();
            });
            return;
        }
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${this.currentFilter === 'sold' ? 'check-circle' : 'box'}"></i>
                    <p>${this.searchQuery ? 'Ничего не найдено' : 
                        this.currentFilter === 'sold' ? 'Нет проданных товаров' : 
                        'Нет товаров в этой категории'}</p>
                    ${this.currentFilter !== 'sold' ? `
                        <button class="btn btn-primary" id="addFromWarehouse">
                            <i class="fas fa-plus"></i> Добавить товар
                        </button>
                    ` : ''}
                </div>
            `;
            
            document.getElementById('addFromWarehouse')?.addEventListener('click', () => {
                this.switchPage('addProduct');
            });
        } else {
            container.innerHTML = products.map(p => this.renderProductCard(p)).join('');
        }
    }
    
    // Отображение деталей товара
    renderProductDetail(productId) {
        console.log('Рендерим детали товара:', productId);
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('Товар не найден:', productId);
            return;
        }
        
        this.selectedProductId = productId;
        const totalCost = (product.purchasePrice || 0) + (product.investment || 0);
        const profit = product.sellingPrice ? product.sellingPrice - totalCost : 0;
        const statusClass = product.status === 'sold' ? 'sold' : 'in-stock';
        const statusText = product.status === 'sold' ? 'Продано' : 'В наличии';
        
        // Статус телефона
        let phoneStatusInfo = '';
        if (product.category === 'phones' && product.phoneStatus) {
            let phoneStatusText = '';
            switch(product.phoneStatus) {
                case 'new': phoneStatusText = 'Новый'; break;
                case 'in-progress': phoneStatusText = 'В процессе'; break;
                case 'ready': phoneStatusText = 'Готовый'; break;
                case 'for-sale': phoneStatusText = 'На продаже'; break;
            }
            phoneStatusInfo = `
                <div class="info-section">
                    <h3><i class="fas fa-phone"></i> Статус телефона</h3>
                    <p>${phoneStatusText}</p>
                </div>
            `;
        }
        
        // Фотографии
        let photosHtml = '';
        if (product.photos && product.photos.length > 0) {
            photosHtml = `
                <div class="product-photos-section">
                    <h3><i class="fas fa-camera"></i> Фотографии</h3>
                    <div class="product-photos">
                        ${product.photos.map((photo, index) => `
                            <div class="photo-thumbnail" data-photo-index="${index}">
                                <img src="${photo}" alt="Фото ${index + 1}" loading="lazy">
                                <div class="photo-thumbnail-overlay">
                                    <i class="fas fa-expand"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Нужные запчасти
        let requiredPartsHtml = '';
        if (product.requiredParts) {
            requiredPartsHtml = `
                <div class="info-section">
                    <h3><i class="fas fa-wrench"></i> Нужные запчасти</h3>
                    <p>${product.requiredParts}</p>
                </div>
            `;
        }
        
        // Дата продажи
        let soldAtHtml = '';
        if (product.status === 'sold' && product.soldAt) {
            const soldDate = product.soldAt?.toDate ? product.soldAt.toDate() : new Date(product.soldAt);
            soldAtHtml = `
                <div class="info-section">
                    <h3><i class="fas fa-calendar-check"></i> Дата продажи</h3>
                    <p>${soldDate.toLocaleDateString('ru-RU')}</p>
                </div>
            `;
        }
        
        const container = document.getElementById('productDetailContainer');
        if (!container) {
            console.error('Контейнер productDetailContainer не найден');
            return;
        }
        
        container.innerHTML = `
            <div class="product-detail-header">
                <div class="product-detail-image" ${product.photos && product.photos.length > 0 ? 'data-photo-index="0"' : ''}>
                    ${product.photos && product.photos.length > 0 ? 
                        `<img src="${product.photos[0]}" alt="${product.name}" loading="lazy">` :
                        `<i class="fas fa-${product.category === 'phones' ? 'mobile-alt' : 
                                         product.category === 'accessories' ? 'headphones' : 'cogs'}"></i>`
                    }
                    ${product.photos && product.photos.length > 0 ? 
                        '<div class="photo-thumbnail-overlay"><i class="fas fa-expand"></i></div>' : ''
                    }
                </div>
                <div class="product-detail-title">${product.name}</div>
                <div class="product-detail-meta">
                    <span class="product-detail-category">${this.getCategoryName(product.category)}</span>
                    <span class="product-detail-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            ${photosHtml}
            
            <div class="product-detail-info">
                ${phoneStatusInfo}
                
                <div class="info-section">
                    <h3><i class="fas fa-align-left"></i> Описание</h3>
                    <p>${product.description || 'Нет описания'}</p>
                </div>
                
                ${requiredPartsHtml}
                ${soldAtHtml}
            </div>
            
            <div class="product-prices">
                <div class="price-item">
                    <div class="price-label">Цена покупки</div>
                    <div class="price-value purchase">${(product.purchasePrice || 0).toLocaleString()} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Вложения</div>
                    <div class="price-value investment">${(product.investment || 0).toLocaleString()} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Итого затрат</div>
                    <div class="price-value total-cost">${totalCost.toLocaleString()} ₽</div>
                </div>
                ${product.sellingPrice && product.sellingPrice > 0 ? `
                    <div class="price-item">
                        <div class="price-label">Цена продажи</div>
                        <div class="price-value selling">${product.sellingPrice.toLocaleString()} ₽</div>
                    </div>
                    <div class="price-item">
                        <div class="price-label">Прибыль</div>
                        <div class="price-value profit">${profit.toLocaleString()} ₽</div>
                    </div>
                    ` : ''}
            </div>
            
            ${product.status !== 'sold' ? `
            <div class="product-detail-actions">
                <button class="btn btn-primary" id="sellProductBtn">
                    <i class="fas fa-check-circle"></i> Продать
                </button>
                <button class="btn btn-secondary" id="editProductBtn">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
            ` : ''}
        `;
        
        // Добавляем обработчики событий
        if (product.status !== 'sold') {
            document.getElementById('sellProductBtn')?.addEventListener('click', () => {
                this.openSellModal(product);
            });
            
            document.getElementById('editProductBtn')?.addEventListener('click', () => {
                this.openEditForm(product);
            });
        }
        
        // Инициализация просмотра фото
        this.initPhotoViewers();
    }
    
    // Отображение формы редактирования
    renderEditForm(product) {
        console.log('Рендерим форму редактирования:', product.id);
        
        const form = document.getElementById('editProductForm');
        if (!form) {
            console.error('Форма editProductForm не найдена');
            return;
        }
        
        form.innerHTML = `
            <div class="form-section">
                <h3 class="form-section-title">Основная информация</h3>
                
                <div class="form-group">
                    <label for="editProductName" class="form-label">
                        <i class="fas fa-tag"></i> Название товара
                    </label>
                    <input type="text" id="editProductName" class="form-input" value="${product.name || ''}" required>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="editPurchasePrice" class="form-label">
                            <i class="fas fa-shopping-cart"></i> Цена покупки
                        </label>
                        <div class="price-input">
                            <input type="number" id="editPurchasePrice" class="form-input" value="${product.purchasePrice || 0}" required>
                            <span class="currency">₽</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editInvestment" class="form-label">
                            <i class="fas fa-ruble-sign"></i> Дополнительные вложения
                        </label>
                        <div class="price-input">
                            <input type="number" id="editInvestment" class="form-input" value="${product.investment || 0}">
                            <span class="currency">₽</span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="editProductCategory" class="form-label">
                        <i class="fas fa-folder"></i> Категория
                    </label>
                    <div class="category-select">
                        <select id="editProductCategory" class="form-select" required>
                            <option value="phones" ${product.category === 'phones' ? 'selected' : ''}>📱 Телефоны</option>
                            <option value="accessories" ${product.category === 'accessories' ? 'selected' : ''}>🎧 Аксессуары</option>
                            <option value="parts" ${product.category === 'parts' ? 'selected' : ''}>🔧 Запчасти</option>
                        </select>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>

                <div id="editPhoneStatusGroup" style="${product.category === 'phones' ? '' : 'display: none;'}">
                    <div class="form-group">
                        <label for="editPhoneStatus" class="form-label">
                            <i class="fas fa-phone"></i> Статус телефона
                        </label>
                        <div class="category-select">
                            <select id="editPhoneStatus" class="form-select">
                                <option value="new" ${product.phoneStatus === 'new' ? 'selected' : ''}>Новый</option>
                                <option value="in-progress" ${product.phoneStatus === 'in-progress' ? 'selected' : ''}>В процессе</option>
                                <option value="ready" ${product.phoneStatus === 'ready' ? 'selected' : ''}>Готовый</option>
                                <option value="for-sale" ${product.phoneStatus === 'for-sale' ? 'selected' : ''}>На продаже</option>
                            </select>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="editRequiredParts" class="form-label">
                        <i class="fas fa-wrench"></i> Нужные запчасти
                    </label>
                    <textarea id="editRequiredParts" class="form-textarea" rows="2">${product.requiredParts || ''}</textarea>
                </div>
            </div>

            <!-- Существующие фото -->
            <div class="form-section">
                <h3 class="form-section-title">Существующие фотографии</h3>
                <div class="form-group">
                    ${product.photos && product.photos.length > 0 ? `
                        <div class="current-photos" id="currentPhotos">
                            ${product.photos.map((photo, index) => `
                                <div class="current-photo" data-photo-index="${index}">
                                    <img src="${photo}" alt="Фото ${index + 1}">
                                    <button type="button" class="remove-photo-btn" data-index="${index}">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="form-hint">Нажмите на крестик, чтобы удалить фотографию</div>
                    ` : `
                        <p style="color: var(--text-tertiary); text-align: center; padding: 20px;">
                            Нет добавленных фотографий
                        </p>
                    `}
                </div>
            </div>

            <!-- Добавление новых фото -->
            <div class="form-section">
    <h3 class="form-section-title">Фотографии</h3>
    
    <!-- Настройки качества -->
    <div class="form-group">
        <div class="quality-settings">
            <div class="quality-option active" data-quality="high">
                <div class="quality-icon">
                    <i class="fas fa-camera"></i>
                </div>
                <div class="quality-info">
                    <div class="quality-name">Высокое качество</div>
                    <div class="quality-desc">До 1200px, 70% качества</div>
                </div>
            </div>
            <div class="quality-option" data-quality="medium">
                <div class="quality-icon">
                    <i class="fas fa-compress-alt"></i>
                </div>
                <div class="quality-info">
                    <div class="quality-name">Среднее качество</div>
                    <div class="quality-desc">До 800px, 50% качества</div>
                </div>
            </div>
            <div class="quality-option" data-quality="low">
                <div class="quality-icon">
                    <i class="fas fa-file-export"></i>
                </div>
                <div class="quality-info">
                    <div class="quality-name">Экономное</div>
                    <div class="quality-desc">До 600px, 30% качества</div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="attachments-container">
        <div class="attachment-option">
            <div class="attachment-icon">
                <i class="fas fa-camera"></i>
            </div>
            <span>Добавить фото</span>
            <input type="file" accept="image/*" class="attachment-input" id="photoInput" multiple>
        </div>
    </div>
    
    <div class="form-hint">
        <i class="fas fa-info-circle"></i>
        Фото автоматически сжимаются. iPhone HEIC конвертируются в JPEG.
    </div>
</div>

            <!-- Предпросмотр новых фото -->
            <div class="form-section" id="editPhotoPreviewSection" style="display: none;">
                <h3 class="form-section-title">Предпросмотр новых фото</h3>
                <div class="photo-preview" id="editPhotoPreview"></div>
            </div>

            <div class="form-section">
                <h3 class="form-section-title">Описание</h3>
                <div class="form-group">
                    <label for="editProductDescription" class="form-label">
                        <i class="fas fa-align-left"></i> Описание товара
                    </label>
                    <textarea id="editProductDescription" class="form-textarea" rows="4">${product.description || ''}</textarea>
                </div>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-danger" id="deleteProductBtn">
                    <i class="fas fa-trash"></i> Удалить товар
                </button>
                <div style="display: flex; gap: 12px; width: 100%;">
                    <button type="button" class="btn btn-secondary" id="cancelEditBtn">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                    <button type="submit" class="btn btn-primary" id="saveProductBtn">
                        <span class="btn-text"><i class="fas fa-save"></i> Сохранить изменения</span>
                        <div class="loader-small"></div>
                    </button>
                </div>
            </div>
        `;
        
        // Сохраняем текущие фото для редактирования
        this.editPhotos = [...(product.photos || [])];
        this.newPhotos = [];
        
        // Добавляем обработчики событий
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductChanges(product.id);
        });
        
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.switchPage('productDetail');
        });
        
        document.getElementById('deleteProductBtn').addEventListener('click', () => {
            this.openDeleteModal(product);
        });
        
        // Показываем/скрываем поле статуса телефона
        document.getElementById('editProductCategory')?.addEventListener('change', (e) => {
            const phoneStatusGroup = document.getElementById('editPhoneStatusGroup');
            if (phoneStatusGroup) {
                phoneStatusGroup.style.display = e.target.value === 'phones' ? 'block' : 'none';
            }
        });
        
        // Удаление существующих фото
        document.querySelectorAll('.remove-photo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.editPhotos.splice(index, 1);
                this.renderEditForm({...product, photos: this.editPhotos});
            });
        });
        
        // Добавление новых фото
        document.getElementById('editPhotoInput')?.addEventListener('change', async (e) => {
            const newPhotos = await this.handlePhotoUpload(e.target);
            this.newPhotos = [...this.newPhotos, ...newPhotos];
            this.showEditPhotoPreview();
        });
    }
    
    // Отображение списка запчастей
    renderPartsList() {
        console.log('Рендерим список запчастей');
        
        let userParts = this.requiredParts;
        const container = document.getElementById('partsList');
        
        if (!container) {
            console.error('Контейнер partsList не найден');
            return;
        }
        
        // Если идет загрузка, показываем скелетоны
        if (this.isLoading && this.currentLoadingType === 'list') {
            this.showSkeletons('partsList', 3);
            return;
        }
        
        if (userParts.length === 0) {
            container.innerHTML = `
                <div class="empty-parts">
                    <i class="fas fa-wrench"></i>
                    <p>${this.currentUser ? 'Нет добавленных запчастей' : 'Войдите в аккаунт для просмотра запчастей'}</p>
                    ${this.currentUser ? `
                        <p class="parts-hint">Добавьте запчасти при создании товара или вручную здесь</p>
                    ` : `
                        <button class="btn btn-primary" id="loginFromParts">
                            <i class="fas fa-sign-in-alt"></i> Войти в аккаунт
                        </button>
                    `}
                </div>
            `;
            
            if (!this.currentUser) {
                document.getElementById('loginFromParts')?.addEventListener('click', () => {
                    this.openAuthModal();
                });
            }
        } else {
            container.innerHTML = userParts.map(part => `
                <div class="part-item" data-part-id="${part.id}">
                    <div class="part-item-content">
                        <div class="part-item-name">${part.name}</div>
                        <div class="part-item-info">
                            ${part.product ? `Из товара: ${part.product}` : 'Добавлено вручную'} • 
                            ${part.createdAt?.toDate ? 
                                part.createdAt.toDate().toLocaleDateString('ru-RU') : 
                                new Date(part.createdAt).toLocaleDateString('ru-RU')}
                        </div>
                    </div>
                    <div class="part-item-actions">
                        <button class="part-item-btn delete" onclick="app.removePart('${part.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // ========== МЕТОДЫ ДЛЯ РАБОТЫ С FIREBASE ==========
    
    // Добавление нового товара
    async addNewProduct(formData) {
        if (this._addingProduct) {
            console.log('Добавление товара уже выполняется — пропуск повторного вызова');
            return;
        }

        if (!this.checkAuth()) return;

        this._addingProduct = true;
        this.setButtonLoading('addProductSubmit', true);

        try {
            console.log('Добавляем новый товар:', formData);

            const newProduct = {
                name: formData.name,
                description: formData.description,
                purchasePrice: formData.purchasePrice,
                investment: formData.investment || 0,
                sellingPrice: null,
                category: formData.category,
                phoneStatus: formData.category === 'phones' ? formData.phoneStatus : null,
                status: 'in-stock',
                soldAt: null,
                photos: formData.photos || [],
                requiredParts: formData.requiredParts || '',
                changeHistory: []
            };

            const result = await firebaseService.addProduct(newProduct);

            if (result.success) {
                if (formData.requiredParts && formData.requiredParts.trim() !== '') {
                    await this.addRequiredPart(formData.requiredParts, newProduct.name);
                }

                this.showToast('Успех', 'Товар успешно добавлен', 'success');

                // Жёстко гарантируем переход на главную
                setTimeout(() => {
                    this.switchPage('home');
                }, 0);

            } else {
                this.showToast('Ошибка', result.error, 'error');
            }
        } finally {
            this._addingProduct = false;
            this.setButtonLoading('addProductSubmit', false);
        }
    }
    
    // Сохранение изменений товара
    async saveProductChanges(productId) {
        if (!this.checkAuth()) return;
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showToast('Ошибка', 'Товар не найден', 'error');
            return;
        }
        
        const updates = {
            name: document.getElementById('editProductName').value.trim(),
            purchasePrice: parseInt(document.getElementById('editPurchasePrice').value) || 0,
            investment: parseInt(document.getElementById('editInvestment').value) || 0,
            category: document.getElementById('editProductCategory').value,
            description: document.getElementById('editProductDescription').value.trim(),
            requiredParts: document.getElementById('editRequiredParts').value.trim(),
            photos: [...this.editPhotos, ...this.newPhotos]
        };
        
        // Добавляем статус телефона если это телефон
        if (updates.category === 'phones') {
            updates.phoneStatus = document.getElementById('editPhoneStatus').value;
        }
        
        // Валидация
        if (!updates.name) {
            this.showToast('Ошибка', 'Введите название товара', 'error');
            return;
        }
        
        if (updates.purchasePrice <= 0) {
            this.showToast('Ошибка', 'Введите корректную цену покупки', 'error');
            return;
        }
        
        console.log('Сохраняем изменения товара:', productId, updates);
        
        this.setButtonLoading('saveProductBtn', true);
        
        // Обновляем через Firebase
        const result = await firebaseService.updateProduct(productId, updates);
        
        this.setButtonLoading('saveProductBtn', false);
        
        if (result.success) {
            // Если изменились нужные запчасти, добавляем их в список
            if (updates.requiredParts && updates.requiredParts !== product.requiredParts) {
                await this.addRequiredPart(updates.requiredParts, updates.name);
            }
            
            this.showToast('Успех', 'Товар успешно обновлен', 'success');
            this.switchPage('productDetail');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }
    
    // Удаление товара
    async deleteProduct(productId) {
        if (!this.checkAuth()) return;
        
        this.setButtonLoading('confirmDeleteBtn', true);
        
        const result = await firebaseService.deleteProduct(productId);
        
        this.setButtonLoading('confirmDeleteBtn', false);
        
        if (result.success) {
            this.showToast('Успех', 'Товар успешно удален', 'success');
            this.switchPage('warehouse');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }
    
    // Продажа товара
    async sellProduct(productId, sellingPrice, notes = '') {
        if (!this.checkAuth()) return;
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showToast('Ошибка', 'Товар не найден', 'error');
            return;
        }
        
        const updates = {
            status: 'sold',
            sellingPrice: sellingPrice,
            soldAt: new Date().toISOString(),
            saleNotes: notes
        };
        
        console.log('Продаем товар:', productId, updates);
        
        this.setButtonLoading('confirmSellBtn', true);
        
        const result = await firebaseService.updateProduct(productId, updates);
        
        this.setButtonLoading('confirmSellBtn', false);
        
        if (result.success) {
            this.showToast('Успех', 'Товар успешно продан', 'success');
            this.switchPage('home');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }
    
    // Добавление запчасти
    async addRequiredPart(partDescription, productName = '') {
        if (!this.checkAuth()) return;
        
        const partsArray = partDescription.split(',').map(part => part.trim()).filter(part => part !== '');
        
        console.log('Добавляем запчасти:', partsArray);
        
        for (const partName of partsArray) {
            const existingPart = this.requiredParts.find(p => 
                p.name.toLowerCase() === partName.toLowerCase()
            );
            
            if (!existingPart) {
                const partData = {
                    name: partName,
                    product: productName || 'Вручную добавлено',
                    source: productName ? 'product' : 'manual'
                };
                
                await firebaseService.addPart(partData);
            }
        }
        
        return this.requiredParts;
    }
    
    // Удаление запчасти
    async removeRequiredPart(partId) {
        if (!this.checkAuth()) return false;
        
        console.log('Удаляем запчасть:', partId);
        
        const result = await firebaseService.deletePart(partId);
        return result.success;
    }
    
    // Метод для удаления запчасти (публичный для использования в onclick)
    async removePart(partId) {
        const partItem = document.querySelector(`.part-item[data-part-id="${partId}"]`);
        if (partItem) {
            partItem.style.opacity = '0.5';
            partItem.style.pointerEvents = 'none';
        }
        
        const success = await this.removeRequiredPart(partId);
        
        if (success) {
            this.renderPartsList();
            this.showToast('Успех', 'Запчасть удалена', 'success');
        } else {
            if (partItem) {
                partItem.style.opacity = '1';
                partItem.style.pointerEvents = 'auto';
            }
            this.showToast('Ошибка', 'Не удалось удалить запчасть', 'error');
        }
    }
    
    // Обновление профиля пользователя
    updateUserProfile(user) {
        this.currentUser = user;
        
        if (user) {
            localStorage.setItem('iphoneTraderUser', JSON.stringify(user));
            
            const profileHeader = document.getElementById('profileHeader');
            if (profileHeader) {
                profileHeader.innerHTML = `
                    <div class="profile-avatar">
                        ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div class="profile-name">${user.name || 'Пользователь'}</div>
                    <div class="profile-email">${user.email || ''}</div>
                `;
            }
            
            document.getElementById('logoutBtn').style.display = 'flex';
        } else {
            localStorage.removeItem('iphoneTraderUser');
            
            const profileHeader = document.getElementById('profileHeader');
            if (profileHeader) {
                profileHeader.innerHTML = `
                    <div class="profile-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="profile-name">Гость</div>
                    <div class="profile-email">Войдите в аккаунт</div>
                `;
            }
            
            document.getElementById('logoutBtn').style.display = 'none';
        }
    }
    
    // Выход из системы
    async logout() {
        const result = await firebaseService.logout();
        
        if (result.success) {
            // Отписываемся от обновлений
            if (this.productsUnsubscribe) {
                this.productsUnsubscribe();
                this.productsUnsubscribe = null;
            }
            if (this.partsUnsubscribe) {
                this.partsUnsubscribe();
                this.partsUnsubscribe = null;
            }
            
            this.currentUser = null;
            this.products = [];
            this.requiredParts = [];
            
            document.getElementById('profileModal').classList.remove('active');
            this.updateUserProfile(null);
            
            // Обновляем отображение
            this.updateStats();
            this.updateCategoryCounts();
            this.renderHomePage();
            this.renderWarehouse();
            
            this.showToast('Успех', 'Вы вышли из системы', 'success');
            this.openAuthModal();
        }
    }
    
    // ========== АВТОРИЗАЦИЯ ==========
    
    // Обработка входа
    async handleLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            this.showToast('Ошибка', 'Заполните все поля', 'error');
            return;
        }
        
        console.log('Попытка входа:', email);
        
        this.setButtonLoading('loginSubmit', true);
        
        const result = await firebaseService.login(email, password);
        
        this.setButtonLoading('loginSubmit', false);
        
        if (result.success) {
            // Сохраняем пользователя
            this.currentUser = result.user;
            this.updateUserProfile(this.currentUser);
            
            // Загружаем данные
            this.showLoading('global', 'Загрузка данных...');
            await this.loadUserData();
            
            // Закрываем модальное окно
            this.closeAuthModal();
            
            this.showToast('Успех', 'Вы успешно вошли в систему', 'success');
            
            // Сбрасываем форму
            document.getElementById('loginForm').reset();
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }
    
    // Обработка регистрации
    async handleRegister() {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        
        // Валидация
        if (!name || !email || !password || !confirmPassword) {
            this.showToast('Ошибка', 'Заполните все поля', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showToast('Ошибка', 'Пароль должен быть не менее 6 символов', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showToast('Ошибка', 'Пароли не совпадают', 'error');
            return;
        }
        
        // Простая валидация email
        if (!email.includes('@') || !email.includes('.')) {
            this.showToast('Ошибка', 'Введите корректный email', 'error');
            return;
        }
        
        console.log('Попытка регистрации:', email);
        
        this.setButtonLoading('registerSubmit', true);
        
        const result = await firebaseService.register(email, password, name);
        
        this.setButtonLoading('registerSubmit', false);
        
        if (result.success) {
            // Автоматически логиним пользователя
            this.currentUser = result.user;
            this.updateUserProfile(this.currentUser);
            
            // Закрываем модальное окно
            this.closeAuthModal();
            
            // Обновляем отображение
            this.showLoading('global', 'Инициализация аккаунта...');
            await this.loadUserData();
            
            this.showToast('Успех', 'Регистрация прошла успешно', 'success');
            
            // Сбрасываем форму
            document.getElementById('registerForm').reset();
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }
    
    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    
    // Получение названия категории
    getCategoryName(category) {
        const categories = {
            'phones': 'Телефоны',
            'accessories': 'Аксессуары',
            'parts': 'Запчасти'
        };
        return categories[category] || category;
    }
    
    // Переключение страниц
    switchPage(pageName) {
        console.log('Переключаем страницу на:', pageName);
        
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Скрываем поиск если открыт
        document.getElementById('searchContainer')?.classList.remove('active');
        
        // Скрываем профиль
        document.getElementById('profileModal')?.classList.remove('active');
        
        // Показываем выбранную страницу
        const targetPage = document.getElementById(`${pageName}Page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Обновляем активную навигацию
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === pageName) {
                item.classList.add('active');
            }
        });
        
        // Обновляем текущую страницу
        this.currentPage = pageName;
        
        // Прокручиваем вверх
        window.scrollTo(0, 0);
        
        // Обновляем данные если нужно
        switch (pageName) {
            case 'home':
                this.renderHomePage();
                break;
            case 'warehouse':
                this.updateCategoryCounts();
                this.renderWarehouse();
                break;
            case 'parts':
                this.renderPartsList();
                break;
        }
    }
    
    // Открытие модального окна продажи
    openSellModal(product) {
        const modal = document.getElementById('sellModal');
        const sellingPriceInput = document.getElementById('sellingPrice');
        
        // Предлагаем цену на 20% выше затрат
        const totalCost = (product.purchasePrice || 0) + (product.investment || 0);
        const suggestedPrice = Math.round(totalCost * 1.2);
        sellingPriceInput.value = suggestedPrice;
        
        modal.classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
        
        setTimeout(() => {
            sellingPriceInput.focus();
            sellingPriceInput.select();
        }, 100);
    }
    
    // Открытие модального окна удаления
    openDeleteModal(product) {
        const modal = document.getElementById('deleteModal');
        const preview = document.getElementById('deletePreview');
        
        if (preview) {
            preview.innerHTML = `
                <h4>${product.name}</h4>
                <p>Категория: ${this.getCategoryName(product.category)}</p>
                <p>Статус: ${product.status === 'sold' ? 'Продано' : 'В наличии'}</p>
                <p>Цена покупки: ${(product.purchasePrice || 0).toLocaleString()} ₽</p>
                <p>Вложения: ${(product.investment || 0).toLocaleString()} ₽</p>
            `;
        }
        
        modal.classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }
    
    // Открытие формы редактирования
    openEditForm(product) {
        this.renderEditForm(product);
        this.switchPage('editProduct');
    }
    
    // Показ уведомлений
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.error('Контейнер toastContainer не найден');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                               type === 'error' ? 'exclamation-circle' : 
                               type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        // Кнопка закрытия
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
    
    // Обработка загрузки фото
    handlePhotoUpload(input) {
        return new Promise((resolve) => {
            const files = input.files;
            const photos = [];
            
            if (files.length === 0) {
                resolve([]);
                return;
            }
            
            let loadedCount = 0;
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Проверяем размер файла (макс 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    this.showToast('Предупреждение', `Файл ${file.name} слишком большой (${Math.round(file.size / 1024 / 1024)}MB). Сжимаем...`, 'warning');
                }
                
                // Проверяем тип файла
                if (!file.type.startsWith('image/')) {
                    this.showToast('Ошибка', `Файл ${file.name} не является изображением`, 'error');
                    loadedCount++;
                    continue;
                }
                
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    this.compressImage(e.target.result, file.type)
                        .then(compressedImage => {
                            photos.push(compressedImage);
                            loadedCount++;
                            
                            if (loadedCount === files.length) {
                                this.showToast('Успех', `Загружено ${photos.length} фото (сжаты)`, 'success');
                                resolve(photos);
                            }
                        })
                        .catch(error => {
                            console.error('Ошибка сжатия:', error);
                            // Если сжатие не удалось, используем оригинал
                            photos.push(e.target.result);
                            loadedCount++;
                            
                            if (loadedCount === files.length) {
                                resolve(photos);
                            }
                        });
                };
                
                reader.onerror = () => {
                    loadedCount++;
                    if (loadedCount === files.length) {
                        resolve(photos);
                    }
                };
                
                reader.readAsDataURL(file);
            }
            
            // Если все файлы были пропущены из-за ошибок
            if (files.length > 0 && photos.length === 0 && loadedCount === files.length) {
                resolve([]);
            }
        });
    }
    
    // Новый метод для сжатия изображений
    compressImage(dataUrl, mimeType, maxWidth = 1200, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Рассчитываем новые размеры
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                // Устанавливаем размеры canvas
                canvas.width = width;
                canvas.height = height;
                
                // Рисуем сжатое изображение
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Конвертируем HEIC/HEIF в JPEG если нужно
                let outputMimeType = mimeType;
                if (mimeType === 'image/heic' || mimeType === 'image/heif') {
                    outputMimeType = 'image/jpeg';
                    this.showToast('Инфо', 'HEIC фото конвертировано в JPEG', 'info');
                }
                
                // Получаем сжатое изображение
                try {
                    const compressedDataUrl = canvas.toDataURL(outputMimeType, quality);
                    
                    // Проверяем размер после сжатия
                    const base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
                    const sizeInBytes = Math.ceil(base64Length * 3 / 4);
                    const sizeInMB = sizeInBytes / 1024 / 1024;
                    
                    console.log(`Сжато: ${Math.round(sizeInMB * 100) / 100}MB`);
                    
                    if (sizeInMB > 2) {
                        // Если все еще слишком большой, сжимаем сильнее
                        this.compressImage(compressedDataUrl, outputMimeType, maxWidth * 0.8, quality * 0.7)
                            .then(moreCompressed => resolve(moreCompressed))
                            .catch(err => reject(err));
                    } else {
                        resolve(compressedDataUrl);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = reject;
            img.src = dataUrl;
        });
    }
    
    // Показ предпросмотра фото при добавлении товара
    showPhotoPreview(photos) {
        const previewSection = document.getElementById('photoPreviewSection');
        const previewContainer = document.getElementById('photoPreview');
        
        if (!previewSection || !previewContainer) return;
        
        if (photos.length === 0) {
            previewSection.style.display = 'none';
            return;
        }
        
        previewSection.style.display = 'block';
        previewContainer.innerHTML = photos.map((photo, index) => `
            <div class="photo-item">
                <img src="${photo}" alt="Фото ${index + 1}">
                <button class="remove-photo" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // Добавляем обработчики для кнопок удаления фото
        previewContainer.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-photo').dataset.index);
                this.tempPhotos.splice(index, 1);
                this.showPhotoPreview(this.tempPhotos);
            });
        });
    }
    
    // Показ предпросмотра новых фото при редактировании
    showEditPhotoPreview() {
        const previewSection = document.getElementById('editPhotoPreviewSection');
        const previewContainer = document.getElementById('editPhotoPreview');
        
        if (!previewSection || !previewContainer) return;
        
        if (this.newPhotos.length === 0) {
            previewSection.style.display = 'none';
            return;
        }
        
        previewSection.style.display = 'block';
        previewContainer.innerHTML = this.newPhotos.map((photo, index) => `
            <div class="photo-item">
                <img src="${photo}" alt="Новое фото ${index + 1}">
                <button class="remove-photo" data-new-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // Добавляем обработчики для удаления новых фото
        previewContainer.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-photo').dataset.newIndex);
                this.newPhotos.splice(index, 1);
                this.showEditPhotoPreview();
            });
        });
    }
    
    // Инициализация просмотра фото
    initPhotoViewers() {
        // Обработчик для основной фотографии
        const mainPhoto = document.querySelector('.product-detail-image');
        if (mainPhoto && mainPhoto.dataset.photoIndex !== undefined) {
            mainPhoto.addEventListener('click', () => {
                this.openFullscreenPhoto(parseInt(mainPhoto.dataset.photoIndex));
            });
        }
        
        // Обработчики для миниатюр
        document.querySelectorAll('.photo-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', (e) => {
                e.stopPropagation();
                const photoIndex = parseInt(thumbnail.dataset.photoIndex);
                this.openFullscreenPhoto(photoIndex);
            });
        });
    }
    
    // Открытие фото в полноэкранном режиме
    openFullscreenPhoto(photoIndex) {
        const product = this.products.find(p => p.id === this.selectedProductId);
        if (!product || !product.photos || !product.photos[photoIndex]) return;
        
        // Создаем модальное окно если его нет
        let modal = document.getElementById('fullscreenPhotoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'fullscreen-photo-modal';
            modal.id = 'fullscreenPhotoModal';
            modal.innerHTML = `
                <button class="close-fullscreen" id="closeFullscreen">
                    <i class="fas fa-times"></i>
                </button>
                <div class="fullscreen-photo-container">
                    <img class="fullscreen-photo" id="fullscreenPhoto" src="" alt="Полноэкранное фото">
                </div>
            `;
            document.body.appendChild(modal);
            
            // Добавляем обработчик закрытия
            document.getElementById('closeFullscreen').addEventListener('click', () => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
        
        const photo = document.getElementById('fullscreenPhoto');
        photo.src = product.photos[photoIndex];
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Инициализация полноэкранного просмотра
    initFullscreenPhoto() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('fullscreenPhotoModal');
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
        });
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ ==========
    
    initEventListeners() {
        console.log('Инициализация обработчиков событий...');
        
        // Навигация
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });
        
        // Настройки качества фото
    document.querySelectorAll('.quality-option').forEach(option => {
        option.addEventListener('click', () => {
            // Убираем активный класс у всех
            document.querySelectorAll('.quality-option').forEach(opt => {
                opt.classList.remove('active');
            });
            
            // Добавляем активный класс выбранному
            option.classList.add('active');
            
            // Сохраняем настройку
            this.currentCompression = option.dataset.quality;
            
            this.showToast('Настройки', `Качество фото: ${this.getCompressionName(this.currentCompression)}`, 'info');
        });
    });
    

        // Кнопка добавления товара
        document.getElementById('addProductBtn')?.addEventListener('click', () => {
            this.switchPage('addProduct');
            // Сбрасываем форму
            document.getElementById('addProductForm')?.reset();
            document.getElementById('photoPreviewSection').style.display = 'none';
            document.getElementById('phoneStatusGroup').style.display = 'none';
            this.tempPhotos = [];
        });
        
        // Кнопка запчастей в шапке
        document.getElementById('partsBtn')?.addEventListener('click', () => {
            this.switchPage('parts');
        });
        
        // Кнопка профиля
        document.getElementById('profileBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = document.getElementById('profileModal');
            if (modal) {
                modal.classList.toggle('active');
            }
            
            if (!this.currentUser) {
                this.openAuthModal();
            }
        });
        
        // Закрытие профиля при клике снаружи
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('profileModal');
            const profileBtn = document.getElementById('profileBtn');
            
            if (modal && profileBtn && !modal.contains(e.target) && !profileBtn.contains(e.target)) {
                modal.classList.remove('active');
            }
        });
        
        // Выход из системы
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });
        
        // Поиск
        document.getElementById('searchBtn')?.addEventListener('click', () => {
            const container = document.getElementById('searchContainer');
            if (container) {
                container.classList.toggle('active');
                
                if (container.classList.contains('active')) {
                    document.getElementById('searchInput')?.focus();
                }
            }
        });
        
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            if (this.currentPage === 'warehouse') {
                this.renderWarehouse();
            }
        });
        
        document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.searchQuery = '';
            if (this.currentPage === 'warehouse') {
                this.renderWarehouse();
            }
        });
        
        // Фильтры на складе
        document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab[data-filter]').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                this.currentFilter = tab.dataset.filter;
                this.currentPhoneStatus = 'all';
                
                // Показываем/скрываем дополнительный фильтр для телефонов
                const phoneStatusFilter = document.getElementById('phoneStatusFilter');
                if (phoneStatusFilter) {
                    phoneStatusFilter.style.display = this.currentFilter === 'phones' ? 'flex' : 'none';
                }
                
                // Сбрасываем активный класс у фильтров статуса телефонов
                document.querySelectorAll('.filter-tab[data-phone-status]').forEach(t => {
                    t.classList.remove('active');
                });
                
                this.renderWarehouse();
            });
        });
        
        // Фильтры по статусу телефонов
        document.querySelectorAll('.filter-tab[data-phone-status]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab[data-phone-status]').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                this.currentPhoneStatus = tab.dataset.phoneStatus;
                this.renderWarehouse();
            });
        });
        
        // Сортировка
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderWarehouse();
        });
        
        // Категории на складе
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                this.currentFilter = card.dataset.category;
                this.currentPhoneStatus = 'all';
                
                // Активируем соответствующий фильтр
                document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.filter === this.currentFilter);
                });
                
                // Показываем/скрываем фильтр статусов телефонов
                const phoneStatusFilter = document.getElementById('phoneStatusFilter');
                if (phoneStatusFilter) {
                    phoneStatusFilter.style.display = this.currentFilter === 'phones' ? 'flex' : 'none';
                }
                
                // Сбрасываем активный класс у фильтров статуса телефонов
                document.querySelectorAll('.filter-tab[data-phone-status]').forEach(t => {
                    t.classList.remove('active');
                });
                
                this.renderWarehouse();
            });
        });
        
        // Кнопка "Все товары" на главной
        document.querySelectorAll('.view-all').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchPage('warehouse');
            });
        });
        
        // Клик по товару
        document.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                const productId = productCard.dataset.productId;
                this.renderProductDetail(productId);
                this.switchPage('productDetail');
            }
        });
        
        // Кнопки "Назад"
        document.getElementById('backFromWarehouse')?.addEventListener('click', () => {
            this.switchPage('home');
        });
        
        document.getElementById('backFromAdd')?.addEventListener('click', () => {
            this.switchPage('home');
        });
        
        document.getElementById('backFromEdit')?.addEventListener('click', () => {
            if (this.selectedProductId) {
                this.switchPage('productDetail');
            } else {
                this.switchPage('warehouse');
            }
        });
        
        document.getElementById('backFromDetail')?.addEventListener('click', () => {
            this.switchPage('warehouse');
        });
        
        document.getElementById('backFromParts')?.addEventListener('click', () => {
            this.switchPage('home');
        });
        
        // Форма добавления товара
        const addForm = document.getElementById('addProductForm');
        if (addForm) {
            // Показ/скрытие поля статуса телефона
            document.getElementById('productCategory')?.addEventListener('change', (e) => {
                const phoneStatusGroup = document.getElementById('phoneStatusGroup');
                if (phoneStatusGroup) {
                    phoneStatusGroup.style.display = e.target.value === 'phones' ? 'block' : 'none';
                }
            });
            
            // Загрузка фото при добавлении товара
            document.getElementById('photoInput')?.addEventListener('change', async (e) => {
                const photos = await this.handlePhotoUpload(e.target);
                this.tempPhotos = photos;
                this.showPhotoPreview(photos);
            });
            
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!this.checkAuth()) return;
                
                const formData = {
                    name: document.getElementById('productName').value.trim(),
                    purchasePrice: parseInt(document.getElementById('purchasePrice').value) || 0,
                    investment: parseInt(document.getElementById('investment').value) || 0,
                    category: document.getElementById('productCategory').value,
                    description: document.getElementById('productDescription').value.trim(),
                    requiredParts: document.getElementById('requiredParts').value.trim(),
                    photos: this.tempPhotos
                };
                
                // Добавляем статус телефона если это телефон
                if (formData.category === 'phones') {
                    formData.phoneStatus = document.getElementById('phoneStatus').value;
                }
                
                // Валидация
                if (!formData.name) {
                    this.showToast('Ошибка', 'Введите название товара', 'error');
                    return;
                }
                
                if (formData.purchasePrice <= 0) {
                    this.showToast('Ошибка', 'Введите корректную цену покупки', 'error');
                    return;
                }
                
                if (!formData.category) {
                    this.showToast('Ошибка', 'Выберите категорию', 'error');
                    return;
                }
                
                // Добавляем товар через Firebase
                await this.addNewProduct(formData);
                
                // Сбрасываем форму
                e.target.reset();
                document.getElementById('photoPreviewSection').style.display = 'none';
                document.getElementById('phoneStatusGroup').style.display = 'none';
                this.tempPhotos = [];
            });
        }
        
        // Отмена добавления
        document.getElementById('cancelAddBtn')?.addEventListener('click', () => {
            document.getElementById('addProductForm')?.reset();
            document.getElementById('photoPreviewSection').style.display = 'none';
            document.getElementById('phoneStatusGroup').style.display = 'none';
            this.tempPhotos = [];
            this.switchPage('home');
        });
        
        // Продажа товара
        document.getElementById('confirmSellBtn')?.addEventListener('click', () => {
            const sellingPrice = parseInt(document.getElementById('sellingPrice')?.value) || 0;
            const notes = document.getElementById('saleNotes')?.value.trim() || '';
            
            if (sellingPrice <= 0) {
                this.showToast('Ошибка', 'Введите корректную цену продажи', 'error');
                return;
            }
            
            if (this.selectedProductId) {
                this.sellProduct(this.selectedProductId, sellingPrice, notes);
            }
        });
        
        // Удаление товара
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
            if (this.selectedProductId) {
                this.deleteProduct(this.selectedProductId);
            }
        });
        
        // Закрытие модальных окон
        const closeModal = (modalId) => {
            document.getElementById(modalId)?.classList.remove('active');
            document.getElementById('modalOverlay')?.classList.remove('active');
        };
        
        document.getElementById('closeSellModal')?.addEventListener('click', () => closeModal('sellModal'));
        document.getElementById('closeDeleteModal')?.addEventListener('click', () => closeModal('deleteModal'));
        document.getElementById('cancelSellBtn')?.addEventListener('click', () => closeModal('sellModal'));
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => closeModal('deleteModal'));
        
        document.getElementById('modalOverlay')?.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
            document.getElementById('modalOverlay')?.classList.remove('active');
        });
        
        // Добавление запчастей вручную
        document.getElementById('addPartBtn')?.addEventListener('click', async () => {
            const partInput = document.getElementById('newPart');
            const partName = partInput?.value.trim();
            
            if (partName) {
                this.setButtonLoading('addPartBtn', true);
                await this.addRequiredPart(partName);
                partInput.value = '';
                this.renderPartsList();
                this.setButtonLoading('addPartBtn', false);
                this.showToast('Успех', 'Запчасть добавлена', 'success');
            } else {
                this.showToast('Ошибка', 'Введите название запчасти', 'error');
            }
        });
        
        // Ввод в поле добавления запчастей (Enter для добавления)
        document.getElementById('newPart')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('addPartBtn')?.click();
            }
        });
        
        // Авторизация
        this.initAuthEventListeners();
    }
    getCompressionName(level) {
        const names = {
            high: 'Высокое',
            medium: 'Среднее',
            low: 'Экономное'
        };
        return names[level] || 'Высокое';
    }
    
    // Инициализация обработчиков событий авторизации
    initAuthEventListeners() {
        // Закрытие окна авторизации
        document.getElementById('closeAuthModal')?.addEventListener('click', () => {
            this.closeAuthModal();
        });
        
        // Переключение между вкладками авторизации
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchAuthTab(tabName);
            });
        });
        
        // Переход между формами
        document.querySelectorAll('.switch-to-register').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthTab('register');
            });
        });
        
        document.querySelectorAll('.switch-to-login').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthTab('login');
            });
        });
        
        // Форма входа
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
        
        // Форма регистрации
        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });
    }
    
    // Переключение вкладок авторизации
    switchAuthTab(tabName) {
        // Обновляем активные вкладки
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Показываем активную форму
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.dataset.form === tabName);
        });
    }
}

// Запуск приложения при загрузке страницы
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запускаем приложение...');
    app = new iPhoneTraderApp();
});

// Глобальные функции для использования в HTML
function switchPage(pageName) {
    if (app) app.switchPage(pageName);
}

function showToast(title, message, type) {
    if (app) app.showToast(title, message, type);
}

// Функция для удаления запчасти (глобальная)
window.removePart = function(partId) {
    if (app) app.removePart(partId);
}
