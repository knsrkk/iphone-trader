// app.js - ПОЛНЫЙ ПЕРЕПИС ДЛЯ SUPABASE
// app.js - В НАЧАЛЕ ФАЙЛА ДОБАВЬТЕ
if (!window.supabaseService) {
    console.error('SupabaseService не загружен! Проверьте подключение файлов в index.html');
    // Создаем заглушку для предотвращения ошибок
    window.supabaseService = {
        getProducts: () => Promise.resolve([]),
        getParts: () => Promise.resolve([]),
        getStats: () => Promise.resolve({ profit: 0, turnover: 0, investment: 0, inStock: 0, sold: 0 }),
        login: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        register: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        logout: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        addProduct: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        updateProduct: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        deleteProduct: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        addPart: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        deletePart: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        subscribeToProducts: () => () => {},
        subscribeToParts: () => () => {},
        getCurrentUser: () => null
    };
}
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

        // Новые массивы для фото при редактировании
        this.editPhotos = []; // Существующие фото после удаления
        this.newEditPhotos = []; // Новые добавленные фото
        
        // Состояние загрузки
        this.isLoading = false;
        this.currentLoadingType = null;
        
        // Настройки сжатия фото
        this.compressionSettings = {
            high: { maxWidth: 1200, quality: 0.7 },
            medium: { maxWidth: 800, quality: 0.5 },
            low: { maxWidth: 600, quality: 0.3 }
        };
        this.currentCompression = 'high';
        
        this.init();
    }

    // ========== ОСНОВНЫЕ МЕТОДЫ ИНИЦИАЛИЗАЦИИ ==========

    async init() {
        console.log('Приложение инициализируется с Supabase...');

        // Проверка iOS
        if (this.isIOS()) {
            console.log('Обнаружено iOS устройство');
            this.showIOSWarning();
        }
        
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

    // ========== ЗАГРУЗКА ДАННЫХ И SUPABASE ==========

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
            // Загружаем продукты через Supabase
            this.products = await supabaseService.getProducts(this.currentUser.id);
            console.log('Товары загружены:', this.products.length);
            
            // Загружаем запчасти
            this.requiredParts = await supabaseService.getParts(this.currentUser.id);
            console.log('Запчасти загружены:', this.requiredParts.length);
            
            // Подписываемся на обновления в реальном времени
            this.setupRealtimeSubscriptions();
            
            // Обновляем статистику
            await this.updateStats();
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
        this.productsUnsubscribe = supabaseService.subscribeToProducts(
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
        this.partsUnsubscribe = supabaseService.subscribeToParts(
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

    // ========== ОБРАБОТКА ТОВАРОВ (PRODUCTS) ==========

    async addNewProduct(formData) {
        console.log('=== НАЧАЛО addNewProduct ===');
        console.log('this._addingProduct:', this._addingProduct);
        console.log('this.currentUser ДО проверки auth:', this.currentUser);
        console.log('checkAuth результат:', this.checkAuth());
        
        if (this._addingProduct) {
            console.log('⚠️ Уже добавляется товар - пропускаем');
            return;
        }
    
        if (!this.checkAuth()) {
            console.log('❌ Не авторизован');
            return;
        }
    
        this._addingProduct = true;
        this.setButtonLoading('addProductSubmit', true);
    
        try {
            console.log('📦 Данные формы:', formData);
            console.log('👤 Текущий пользователь для добавления:', {
                id: this.currentUser?.id,
                auth_uid: this.currentUser?.auth_uid,
                email: this.currentUser?.email
            });
    
            // Подготавливаем данные для Supabase
            const newProduct = {
                name: formData.name,
                description: formData.description || '',
                purchase_price: parseFloat(formData.purchasePrice) || 0,
                investment: parseFloat(formData.investment) || 0,
                selling_price: null,
                category: formData.category,
                phone_status: formData.category === 'phones' ? formData.phoneStatus : null,
                purchase_source: formData.purchaseSource || null,
                status: 'in-stock',
                sold_at: null,
                sale_source: null,
                photos: formData.photos || [],
                required_parts: formData.requiredParts || '',
                change_history: []
            };
    
            console.log('📤 Отправляемый товар:', newProduct);
            
            const result = await supabaseService.addProduct(newProduct);
            
            console.log('📥 Результат добавления:', result);
    
            if (result.success) {
                console.log('✅ Товар добавлен успешно!');
                
                if (formData.requiredParts && formData.requiredParts.trim() !== '') {
                    await this.addRequiredPart(formData.requiredParts, newProduct.name);
                }
    
                this.showToast('Успех', 'Товар успешно добавлен', 'success');
    
                // Очистка формы
                const addProductForm = document.getElementById('addProductForm');
                if (addProductForm) addProductForm.reset();
                
                const photoPreviewSection = document.getElementById('photoPreviewSection');
                if (photoPreviewSection) photoPreviewSection.style.display = 'none';
                
                this.tempPhotos = [];
    
                // Переход на главную сразу
                this.switchPage('home');
                
                // Обновляем список товаров (в фоне)
                this.loadUserData().catch(err => console.error('Ошибка обновления списка:', err));
    
            } else {
                console.error('❌ Ошибка добавления товара:', result.error);
                this.showToast('Ошибка', result.error, 'error');
            }
        } catch (error) {
            console.error('💥 Критическая ошибка:', error);
            this.showToast('Ошибка', 'Не удалось добавить товар', 'error');
        } finally {
            console.log('=== КОНЕЦ addNewProduct ===');
            this._addingProduct = false;
            this.setButtonLoading('addProductSubmit', false);
        }
    }

    async updateProduct(productId, updates) {
        try {
            const result = await supabaseService.updateProduct(productId, updates);
            return result;
        } catch (error) {
            console.error('Ошибка обновления товара:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteProduct(productId) {
        if (!this.checkAuth()) return;
        
        this.setButtonLoading('confirmDeleteBtn', true);
        
        const result = await supabaseService.deleteProduct(productId);
        
        this.setButtonLoading('confirmDeleteBtn', false);
        
        if (result.success) {
            this.showToast('Успех', 'Товар успешно удален', 'success');
            this.switchPage('warehouse');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }

    async sellProduct(productId, sellingPrice, notes = '', saleSource = null) {
        if (!this.checkAuth()) return;
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showToast('Ошибка', 'Товар не найден', 'error');
            return;
        }
        
        const updates = {
            status: 'sold',
            selling_price: parseFloat(sellingPrice) || 0,
            sold_at: new Date().toISOString(),
            sale_notes: notes,
            sale_source: saleSource || null
        };
        
        console.log('Продаем товар:', productId, updates);
        
        this.setButtonLoading('confirmSellBtn', true);
        
        const result = await supabaseService.updateProduct(productId, updates);
        
        this.setButtonLoading('confirmSellBtn', false);
        
        if (result.success) {
            // Закрываем модальное окно
            const sellModal = document.getElementById('sellModal');
            const modalOverlay = document.getElementById('modalOverlay');
            if (sellModal) sellModal.classList.remove('active');
            if (modalOverlay) modalOverlay.classList.remove('active');
            
            // Очищаем форму
            document.getElementById('sellingPrice').value = '';
            document.getElementById('saleNotes').value = '';
            const saleSourceSelect = document.getElementById('saleSource');
            if (saleSourceSelect) saleSourceSelect.value = 'avito';
            
            this.showToast('Успех', 'Товар успешно продан', 'success');
            this.switchPage('home');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }

    // ========== ОБРАБОТКА ЗАПЧАСТЕЙ (PARTS) ==========

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
                
                await supabaseService.addPart(partData);
            }
        }
        
        return this.requiredParts;
    }

    async removeRequiredPart(partId) {
        if (!this.checkAuth()) return false;
        
        console.log('Удаляем запчасть:', partId);
        
        const result = await supabaseService.deletePart(partId);
        return result.success;
    }

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

    // ========== СТАТИСТИКА ==========

    async updateStats() {
        if (!this.currentUser) {
            this.setStatsToZero();
            return;
        }
        
        try {
            const stats = await supabaseService.getStats(this.currentUser.id);
            
            // Быстрая статистика
            const quickProfitEl = document.getElementById('quickProfit');
            const quickInStockEl = document.getElementById('quickInStock');
            
            if (quickProfitEl) quickProfitEl.textContent = `${stats.profit.toLocaleString()} ₽`;
            if (quickInStockEl) quickInStockEl.textContent = stats.inStock;
            
            // Детальная статистика
            const statProfitEl = document.getElementById('statProfit');
            const statTurnoverEl = document.getElementById('statTurnover');
            const statInStockEl = document.getElementById('statInStock');
            const statSoldEl = document.getElementById('statSold');
            
            if (statProfitEl) statProfitEl.textContent = `${stats.profit.toLocaleString()} ₽`;
            if (statTurnoverEl) statTurnoverEl.textContent = `${stats.turnover.toLocaleString()} ₽`;
            if (statInStockEl) statInStockEl.textContent = stats.inStock;
            if (statSoldEl) statSoldEl.textContent = stats.sold;
            
        } catch (error) {
            console.error('Ошибка обновления статистики:', error);
            this.setStatsToZero();
        }
    }

    setStatsToZero() {
        const quickProfitEl = document.getElementById('quickProfit');
        const quickInStockEl = document.getElementById('quickInStock');
        const statProfitEl = document.getElementById('statProfit');
        const statTurnoverEl = document.getElementById('statTurnover');
        const statInStockEl = document.getElementById('statInStock');
        const statSoldEl = document.getElementById('statSold');
        
        if (quickProfitEl) quickProfitEl.textContent = `0 ₽`;
        if (quickInStockEl) quickInStockEl.textContent = '0';
        if (statProfitEl) statProfitEl.textContent = `0 ₽`;
        if (statTurnoverEl) statTurnoverEl.textContent = `0 ₽`;
        if (statInStockEl) statInStockEl.textContent = '0';
        if (statSoldEl) statSoldEl.textContent = '0';
    }

    updateCategoryCounts() {
        if (!this.currentUser) {
            const categoryPhonesEl = document.getElementById('categoryPhones');
            const categoryAccessoriesEl = document.getElementById('categoryAccessories');
            const categoryPartsEl = document.getElementById('categoryParts');
            const categorySoldEl = document.getElementById('categorySold');
            
            if (categoryPhonesEl) categoryPhonesEl.textContent = '0';
            if (categoryAccessoriesEl) categoryAccessoriesEl.textContent = '0';
            if (categoryPartsEl) categoryPartsEl.textContent = '0';
            if (categorySoldEl) categorySoldEl.textContent = '0';
            return;
        }
        
        const phoneCount = this.products.filter(p => p.category === 'phones' && p.status === 'in-stock').length;
        const accessoriesCount = this.products.filter(p => p.category === 'accessories' && p.status === 'in-stock').length;
        const partsCount = this.products.filter(p => p.category === 'parts' && p.status === 'in-stock').length;
        const soldCount = this.products.filter(p => p.status === 'sold').length;
        
        const categoryPhonesEl = document.getElementById('categoryPhones');
        const categoryAccessoriesEl = document.getElementById('categoryAccessories');
        const categoryPartsEl = document.getElementById('categoryParts');
        const categorySoldEl = document.getElementById('categorySold');
        
        if (categoryPhonesEl) categoryPhonesEl.textContent = phoneCount;
        if (categoryAccessoriesEl) categoryAccessoriesEl.textContent = accessoriesCount;
        if (categoryPartsEl) categoryPartsEl.textContent = partsCount;
        if (categorySoldEl) categorySoldEl.textContent = soldCount;
    }

    // ========== ПОЛЬЗОВАТЕЛЬ И АВТОРИЗАЦИЯ ==========

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
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'flex';
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
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    async logout() {
        const result = await supabaseService.logout();
        
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
            
            const profileModal = document.getElementById('profileModal');
            if (profileModal) profileModal.classList.remove('active');
            
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

    checkAuth() {
        if (!this.currentUser) {
            this.openAuthModal();
            return false;
        }
        return true;
    }

    openAuthModal() {
        const authModal = document.getElementById('authModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (authModal) authModal.classList.add('active');
        if (modalOverlay) modalOverlay.classList.add('active');
    }

    closeAuthModal() {
        const authModal = document.getElementById('authModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (authModal) authModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        console.log('Попытка входа:', { email, passwordLength: password.length });
        
        if (!email || !password) {
            this.showToast('Ошибка', 'Заполните все поля', 'error');
            return;
        }
        
        console.log('Вызываем supabaseService.login...');
        this.setButtonLoading('loginSubmit', true);
        
        const result = await supabaseService.login(email, password);
        
        console.log('Результат входа:', result);
        
        this.setButtonLoading('loginSubmit', false);
        
        if (result.success) {
            console.log('Вход успешен, пользователь:', result.user);
            this.currentUser = result.user;
            this.updateUserProfile(this.currentUser);
            
            this.showLoading('global', 'Загрузка данных...');
            await this.loadUserData();
            
            this.closeAuthModal();
            this.showToast('Успех', 'Вы успешно вошли в систему', 'success');
            
            const loginForm = document.getElementById('loginForm');
            if (loginForm) loginForm.reset();
        } else {
            console.error('Ошибка входа:', result.error);
            this.showToast('Ошибка', result.error || 'Не удалось войти', 'error');
        }
    }

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
        
        const result = await supabaseService.register(email, password, name);
        
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
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.reset();
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }

    // ========== ОТОБРАЖЕНИЕ СТРАНИЦ ==========

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
            filtered = filtered.filter(p => p.phone_status === this.currentPhoneStatus);
        }
        
        // Поиск
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.description && p.description.toLowerCase().includes(query))
            );
        }
        
        // Сортировка
        switch (this.currentSort) {
            case 'newest':
                filtered.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateB - dateA;
                });
                break;
            case 'oldest':
                filtered.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateA - dateB;
                });
                break;
            case 'price-high':
                filtered.sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0));
                break;
            case 'price-low':
                filtered.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0));
                break;
        }
        
        return filtered;
    }

    renderProductCard(product) {
        const statusClass = product.status === 'sold' ? 'sold' : 'in-stock';
        const statusText = product.status === 'sold' ? 'Продано' : 'В наличии';
        
        // Определяем иконку статуса телефона
        let phoneStatusIcon = '';
        let phoneStatusClass = '';
        let phoneStatusText = '';
        
        if (product.category === 'phones' && product.phone_status) {
            switch(product.phone_status) {
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
        const totalCost = (product.purchase_price || 0) + (product.investment || 0);
        
        // Показываем цену продажи если товар продан, иначе итоговые затраты
        let priceText;
        let priceClass = 'product-price';
        
        if (product.status === 'sold') {
            // Для проданных товаров показываем цену продажи
            priceText = product.selling_price ? 
                `${product.selling_price.toLocaleString()} ₽` : 
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
                        ${product.category === 'phones' && product.phone_status ? 
                            `<span class="phone-status ${product.phone_status}">
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

    renderHomePage() {
        console.log('Рендерим главную страницу');
        
        let recentProducts = this.products;
        
        if (this.currentUser) {
            recentProducts = recentProducts
                .filter(p => p.status === 'in-stock')
                .sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
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
                const addFirstProductBtn = document.getElementById('addFirstProduct');
                if (addFirstProductBtn) {
                    addFirstProductBtn.addEventListener('click', () => {
                        this.switchPage('addProduct');
                    });
                }
            } else {
                const loginFirstBtn = document.getElementById('loginFirst');
                if (loginFirstBtn) {
                    loginFirstBtn.addEventListener('click', () => {
                        this.openAuthModal();
                    });
                }
            }
        } else {
            container.innerHTML = recentProducts.map(p => this.renderProductCard(p)).join('');
        }
    }

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
            
            const loginFromWarehouseBtn = document.getElementById('loginFromWarehouse');
            if (loginFromWarehouseBtn) {
                loginFromWarehouseBtn.addEventListener('click', () => {
                    this.openAuthModal();
                });
            }
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
            
            const addFromWarehouseBtn = document.getElementById('addFromWarehouse');
            if (addFromWarehouseBtn) {
                addFromWarehouseBtn.addEventListener('click', () => {
                    this.switchPage('addProduct');
                });
            }
        } else {
            container.innerHTML = products.map(p => this.renderProductCard(p)).join('');
        }
    }

    renderProductDetail(productId) {
        console.log('Рендерим детали товара:', productId);
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('Товар не найден:', productId);
            return;
        }
        
        this.selectedProductId = productId;
        const totalCost = (product.purchase_price || 0) + (product.investment || 0);
        const profit = product.selling_price ? product.selling_price - totalCost : 0;
        const statusClass = product.status === 'sold' ? 'sold' : 'in-stock';
        const statusText = product.status === 'sold' ? 'Продано' : 'В наличии';
        
        // Статус телефона
        let phoneStatusInfo = '';
        if (product.category === 'phones' && product.phone_status) {
            let phoneStatusText = '';
            switch(product.phone_status) {
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
        if (product.required_parts) {
            requiredPartsHtml = `
                <div class="info-section">
                    <h3><i class="fas fa-wrench"></i> Нужные запчасти</h3>
                    <p>${product.required_parts}</p>
                </div>
            `;
        }
        
        // Дата продажи
        let soldAtHtml = '';
        if (product.status === 'sold' && product.sold_at) {
            const soldDate = new Date(product.sold_at);
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
                    <div class="price-value purchase">${(product.purchase_price || 0).toLocaleString()} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Вложения</div>
                    <div class="price-value investment">${(product.investment || 0).toLocaleString()} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Итого затрат</div>
                    <div class="price-value total-cost">${totalCost.toLocaleString()} ₽</div>
                </div>
                ${product.selling_price && product.selling_price > 0 ? `
                    <div class="price-item">
                        <div class="price-label">Цена продажи</div>
                        <div class="price-value selling">${product.selling_price.toLocaleString()} ₽</div>
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
            const sellProductBtn = document.getElementById('sellProductBtn');
            if (sellProductBtn) {
                sellProductBtn.addEventListener('click', () => {
                    this.openSellModal(product);
                });
            }
            
            const editProductBtn = document.getElementById('editProductBtn');
            if (editProductBtn) {
                editProductBtn.addEventListener('click', () => {
                    this.openEditForm(product);
                });
            }
        }
        
        // Инициализация просмотра фото
        this.initPhotoViewers();
    }

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
                const loginFromPartsBtn = document.getElementById('loginFromParts');
                if (loginFromPartsBtn) {
                    loginFromPartsBtn.addEventListener('click', () => {
                        this.openAuthModal();
                    });
                }
            }
        } else {
            container.innerHTML = userParts.map(part => `
                <div class="part-item" data-part-id="${part.id}">
                    <div class="part-item-content">
                        <div class="part-item-name">${part.name}</div>
                        <div class="part-item-info">
                            ${part.product ? `Из товара: ${part.product}` : 'Добавлено вручную'} • 
                            ${part.created_at ? 
                                new Date(part.created_at).toLocaleDateString('ru-RU') : 
                                'Нет даты'}
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

    renderStatistics() {
        if (!this.checkAuth()) {
            this.switchPage('home');
            return;
        }

        const container = document.getElementById('statisticsContainer');
        if (!container) return;

        // Рассчитываем статистику
        const stats = this.calculateStatistics();
        
        container.innerHTML = `
            <!-- Общая статистика -->
            <div class="stats-overview">
                <div class="stat-overview-card">
                    <div class="stat-overview-icon profit">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-overview-content">
                        <div class="stat-overview-label">Общая прибыль</div>
                        <div class="stat-overview-value">${this.formatCurrency(stats.totalProfit)}</div>
                    </div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon sales">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-overview-content">
                        <div class="stat-overview-label">Оборот</div>
                        <div class="stat-overview-value">${this.formatCurrency(stats.totalTurnover)}</div>
                    </div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon sold">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-overview-content">
                        <div class="stat-overview-label">Продано товаров</div>
                        <div class="stat-overview-value">${stats.soldCount}</div>
                    </div>
                </div>
                <div class="stat-overview-card">
                    <div class="stat-overview-icon stock">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="stat-overview-content">
                        <div class="stat-overview-label">В наличии</div>
                        <div class="stat-overview-value">${stats.inStockCount}</div>
                    </div>
                </div>
            </div>

            <!-- Диаграммы -->
            <div class="charts-section">
                <div class="chart-container">
                    <h3 class="chart-title">Покупки iPhone по неделям (текущий месяц)</h3>
                    <canvas id="salesChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3 class="chart-title">Распределение по месту покупки</h3>
                    <canvas id="profitChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3 class="chart-title">Распределение по месту продажи</h3>
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>

            <!-- Таблица продаж -->
            <div class="table-section">
                <h3 class="section-title">Последние продажи</h3>
                <div class="stats-table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Категория</th>
                                <th>Цена покупки</th>
                                <th>Цена продажи</th>
                                <th>Прибыль</th>
                                <th>Дата продажи</th>
                            </tr>
                        </thead>
                        <tbody id="salesTableBody">
                            <!-- Заполнится динамически -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Создаем диаграммы
        this.createCharts(stats);
        
        // Заполняем таблицу
        this.fillSalesTable(stats.recentSales);
    }

    // ========== МЕТОДЫ РЕДАКТИРОВАНИЯ ==========

    renderEditForm(product) {
        console.log('Рендерим форму редактирования:', product.id);
        
        const form = document.getElementById('editProductForm');
        if (!form) {
            console.error('Форма editProductForm не найдена');
            return;
        }
        
        // Сбрасываем массивы фото при каждом новом редактировании
        this.editPhotos = [...(product.photos || [])];
        this.newEditPhotos = [];
        
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
                            <input type="number" id="editPurchasePrice" class="form-input" value="${product.purchase_price || 0}" required>
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
                                <option value="new" ${product.phone_status === 'new' ? 'selected' : ''}>Новый</option>
                                <option value="in-progress" ${product.phone_status === 'in-progress' ? 'selected' : ''}>В процессе</option>
                                <option value="ready" ${product.phone_status === 'ready' ? 'selected' : ''}>Готовый</option>
                                <option value="for-sale" ${product.phone_status === 'for-sale' ? 'selected' : ''}>На продаже</option>
                            </select>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
    
                <div class="form-group">
                    <label for="editRequiredParts" class="form-label">
                        <i class="fas fa-wrench"></i> Нужные запчасти
                    </label>
                    <textarea id="editRequiredParts" class="form-textarea" rows="2">${product.required_parts || ''}</textarea>
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
    
            <!-- iOS предупреждение -->
            ${this.isIOS() ? `
            <div class="ios-warning">
                <i class="fas fa-mobile-alt"></i>
                <div>
                    <strong>iOS устройство:</strong> Для загрузки фото используйте JPEG формат.
                    HEIC фото будут автоматически конвертированы.
                </div>
            </div>
            ` : ''}
    
            <!-- Индикатор загрузки -->
            <div class="upload-progress-container" id="editUploadProgressContainer" style="display: none;">
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill" id="editUploadProgress"></div>
                </div>
                <div class="upload-progress-text" id="editUploadProgressText">Обработка фото...</div>
            </div>
    
            <!-- Добавление новых фото -->
            <div class="form-section">
                <h3 class="form-section-title">Добавить новые фотографии</h3>
                <div class="form-group">
                    <div class="attachments-container">
                        <div class="attachment-option">
                            <div class="attachment-icon">
                                <i class="fas fa-camera"></i>
                            </div>
                            <span>Добавить фото</span>
                            <input type="file" accept="image/*" class="attachment-input" id="editPhotoInput" multiple>
                        </div>
                    </div>
                </div>
                <div class="form-hint">
                    <i class="fas fa-info-circle"></i>
                    Можно добавить несколько фото. iOS HEIC фото автоматически конвертируются в JPEG.
                </div>
            </div>
    
            <!-- Предпросмотр новых фото -->
            <div class="form-section" id="editPhotoPreviewSection" style="display: none;">
                <h3 class="form-section-title">Новые фотографии</h3>
                <div class="photo-preview" id="editPhotoPreview"></div>
                <div class="form-hint">
                    Новые фото будут добавлены к существующим
                </div>
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
        
        // Добавляем обработчики событий
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductChanges(product.id);
        });
        
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                // Очищаем массивы фото при отмене редактирования
                this.editPhotos = [];
                this.newEditPhotos = [];
                this.switchPage('productDetail');
            });
        }
        
        const deleteProductBtn = document.getElementById('deleteProductBtn');
        if (deleteProductBtn) {
            deleteProductBtn.addEventListener('click', () => {
                this.openDeleteModal(product);
            });
        }
        
        // Показываем/скрываем поле статуса телефона
        const editProductCategory = document.getElementById('editProductCategory');
        if (editProductCategory) {
            editProductCategory.addEventListener('change', (e) => {
                const phoneStatusGroup = document.getElementById('editPhoneStatusGroup');
                if (phoneStatusGroup) {
                    phoneStatusGroup.style.display = e.target.value === 'phones' ? 'block' : 'none';
                }
            });
        }
        
        // Удаление существующих фото
        document.querySelectorAll('.remove-photo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                
                // Проверяем валидность индекса
                if (isNaN(index) || !this.editPhotos || index < 0 || index >= this.editPhotos.length) {
                    console.error('Неверный индекс фото для удаления:', index);
                    return;
                }
                
                // Удаляем фото из массива
                this.editPhotos.splice(index, 1);
                
                // Обновляем форму с обновленными фото
                this.renderEditForm({...product, photos: this.editPhotos});
            });
        });
        
        // Добавление новых фото при редактировании
        const editPhotoInput = document.getElementById('editPhotoInput');
        if (editPhotoInput) {
            editPhotoInput.addEventListener('change', async (e) => {
                await this.handleEditPhotoUpload(e.target);
            });
        }
    }

    async saveProductChanges(productId) {
        if (!this.checkAuth()) return;
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showToast('Ошибка', 'Товар не найден', 'error');
            return;
        }
        
        // Инициализируем массивы если они undefined
        if (!this.editPhotos) this.editPhotos = [];
        if (!this.newEditPhotos) this.newEditPhotos = [];
        
        // Фильтруем валидные фото (убираем null, undefined, пустые строки)
        const validEditPhotos = this.editPhotos.filter(photo => photo && typeof photo === 'string' && photo.trim() !== '');
        const validNewPhotos = this.newEditPhotos.filter(photo => photo && typeof photo === 'string' && photo.trim() !== '');
        
        // Собираем все фото: старые (оставшиеся) + новые
        const allPhotos = [...validEditPhotos, ...validNewPhotos];
        
        const updates = {
            name: document.getElementById('editProductName').value.trim(),
            purchase_price: parseFloat(document.getElementById('editPurchasePrice').value) || 0,
            investment: parseFloat(document.getElementById('editInvestment').value) || 0,
            category: document.getElementById('editProductCategory').value,
            description: document.getElementById('editProductDescription').value.trim(),
            required_parts: document.getElementById('editRequiredParts').value.trim(),
            photos: allPhotos
        };
        
        // Добавляем статус телефона если это телефон
        if (updates.category === 'phones') {
            updates.phone_status = document.getElementById('editPhoneStatus').value;
        }
        
        // Валидация
        if (!updates.name) {
            this.showToast('Ошибка', 'Введите название товара', 'error');
            return;
        }
        
        if (updates.purchase_price <= 0) {
            this.showToast('Ошибка', 'Введите корректную цену покупки', 'error');
            return;
        }
        
        console.log('Сохраняем изменения товара:', productId, updates);
        
        this.setButtonLoading('saveProductBtn', true);
        
        // Обновляем через Supabase
        const result = await supabaseService.updateProduct(productId, updates);
        
        this.setButtonLoading('saveProductBtn', false);
        
        if (result.success) {
            // Если изменились нужные запчасти, добавляем их в список
            if (updates.required_parts && updates.required_parts !== product.required_parts) {
                await this.addRequiredPart(updates.required_parts, updates.name);
            }
            
            // Сбрасываем массивы фото после успешного сохранения
            this.editPhotos = [];
            this.newEditPhotos = [];
            
            this.showToast('Успех', 'Товар успешно обновлен', 'success');
            this.switchPage('productDetail');
        } else {
            this.showToast('Ошибка', result.error, 'error');
        }
    }

    // ========== ОБРАБОТКА ФОТО ==========

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
    
    supportsWebP() {
        const elem = document.createElement('canvas');
        if (!!(elem.getContext && elem.getContext('2d'))) {
            return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        }
        return false;
    }
    
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

    async handlePhotoUpload(input) {
        return new Promise((resolve) => {
            const files = Array.from(input.files);
            const photos = [];
            
            if (files.length === 0) {
                resolve([]);
                return;
            }
            
            // Для iOS показываем уведомление о начале обработки
            if (this.isIOS()) {
                this.showToast('Инфо', 'Обработка фото...', 'info');
            }
            
            let processedCount = 0;
            const totalFiles = files.length;
            
            const processFile = async (file, index) => {
                try {
                    // Для iOS используем упрощенную обработку
                    if (this.isIOS()) {
                        const compressedPhoto = await this.compressImageForIOS(file);
                        photos[index] = compressedPhoto;
                    } else {
                        // Для других устройств обычное сжатие
                        const compressedPhoto = await this.compressImageFile(file);
                        photos[index] = compressedPhoto;
                    }
                } catch (error) {
                    console.error('Ошибка обработки файла:', error, file.name);
                    // Если сжатие не удалось, используем оригинал через FileReader
                    const originalPhoto = await this.readFileAsDataURL(file);
                    photos[index] = originalPhoto;
                } finally {
                    processedCount++;
                    
                    // Обновляем прогресс
                    this.updateUploadProgress(processedCount, totalFiles);
                    
                    // Когда все файлы обработаны
                    if (processedCount === totalFiles) {
                        // Фильтруем undefined (если какие-то файлы не удалось обработать)
                        const result = photos.filter(photo => photo !== undefined);
                        
                        if (result.length > 0) {
                            this.showToast('Успех', `Загружено ${result.length} из ${totalFiles} фото`, 'success');
                        }
                        
                        resolve(result);
                    }
                }
            };
            
            // Обрабатываем файлы последовательно для iOS, параллельно для других
            if (this.isIOS()) {
                // Для iOS последовательно чтобы не перегружать
                const processSequentially = async () => {
                    for (let i = 0; i < files.length; i++) {
                        await processFile(files[i], i);
                    }
                };
                processSequentially();
            } else {
                // Для других устройств параллельно
                files.forEach((file, index) => {
                    processFile(file, index);
                });
            }
        });
    }

    async handleEditPhotoUpload(input) {
        try {
            // Проверяем наличие файлов
            if (!input || !input.files || input.files.length === 0) {
                return;
            }
            
            // Показываем индикатор загрузки
            const progressContainer = document.getElementById('editUploadProgressContainer');
            const progressBar = document.getElementById('editUploadProgress');
            const progressText = document.getElementById('editUploadProgressText');
            
            if (progressContainer) {
                progressContainer.style.display = 'block';
            }
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            if (progressText) {
                progressText.textContent = 'Обработка фото...';
            }
            
            // Инициализируем массив если не существует
            if (!this.newEditPhotos) {
                this.newEditPhotos = [];
            }
            
            // Загружаем фото
            const newPhotos = await this.handlePhotoUpload(input);
            
            // Проверяем результат
            if (!newPhotos || newPhotos.length === 0) {
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                this.showToast('Предупреждение', 'Не удалось обработать фото', 'warning');
                return;
            }
            
            // Добавляем к новым фото для этого редактирования
            this.newEditPhotos = [...this.newEditPhotos, ...newPhotos];
            
            // Показываем превью
            this.showEditPhotoPreview();
            
            // Обновляем индикатор
            if (progressBar && progressText) {
                progressBar.style.width = '100%';
                progressText.textContent = `Загружено ${newPhotos.length} фото`;
                
                // Скрываем через 2 секунды
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                }, 2000);
            }
            
            // Очищаем input чтобы можно было загрузить те же файлы снова
            input.value = '';
            
        } catch (error) {
            console.error('Ошибка загрузки фото при редактировании:', error);
            this.showToast('Ошибка', `Не удалось загрузить фото: ${error.message || 'Неизвестная ошибка'}`, 'error');
            
            const progressContainer = document.getElementById('editUploadProgressContainer');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            
            // Инициализируем массив если произошла ошибка
            if (!this.newEditPhotos) {
                this.newEditPhotos = [];
            }
        }
    }

    showEditPhotoPreview() {
        const previewSection = document.getElementById('editPhotoPreviewSection');
        const previewContainer = document.getElementById('editPhotoPreview');
        
        if (!previewSection || !previewContainer) return;
        
        // Используем правильную переменную для новых фото при редактировании
        if (!this.newEditPhotos || this.newEditPhotos.length === 0) {
            previewSection.style.display = 'none';
            return;
        }
        
        previewSection.style.display = 'block';
        previewContainer.innerHTML = this.newEditPhotos.map((photo, index) => `
            <div class="photo-item">
                <img src="${photo}" alt="Новое фото ${index + 1}">
                <button type="button" class="remove-photo" data-new-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // Добавляем обработчики для удаления новых фото
        previewContainer.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.newIndex);
                if (this.newEditPhotos && index >= 0 && index < this.newEditPhotos.length) {
                    this.newEditPhotos.splice(index, 1);
                    this.showEditPhotoPreview();
                }
            });
        });
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    getCategoryName(category) {
        const categories = {
            'phones': 'Телефоны',
            'accessories': 'Аксессуары',
            'parts': 'Запчасти'
        };
        return categories[category] || category;
    }

    switchPage(pageName) {
        console.log('Переключаем страницу на:', pageName);
        
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Скрываем поиск если открыт
        const searchContainer = document.getElementById('searchContainer');
        if (searchContainer) searchContainer.classList.remove('active');
        
        // Скрываем профиль
        const profileModal = document.getElementById('profileModal');
        if (profileModal) profileModal.classList.remove('active');
        
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
            case 'statistics':
                this.renderStatistics();
                break;
        }
    }

    openSellModal(product) {
        const modal = document.getElementById('sellModal');
        const sellingPriceInput = document.getElementById('sellingPrice');
        
        if (!modal || !sellingPriceInput) return;
        
        // Предлагаем цену на 20% выше затрат
        const totalCost = (product.purchase_price || 0) + (product.investment || 0);
        const suggestedPrice = Math.round(totalCost * 1.2);
        sellingPriceInput.value = suggestedPrice;
        
        modal.classList.add('active');
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) modalOverlay.classList.add('active');
        
        setTimeout(() => {
            sellingPriceInput.focus();
            sellingPriceInput.select();
        }, 100);
    }

    openDeleteModal(product) {
        const modal = document.getElementById('deleteModal');
        const preview = document.getElementById('deletePreview');
        
        if (!modal) return;
        
        if (preview) {
            preview.innerHTML = `
                <h4>${product.name}</h4>
                <p>Категория: ${this.getCategoryName(product.category)}</p>
                <p>Статус: ${product.status === 'sold' ? 'Продано' : 'В наличии'}</p>
                <p>Цена покупки: ${(product.purchase_price || 0).toLocaleString()} ₽</p>
                <p>Вложения: ${(product.investment || 0).toLocaleString()} ₽</p>
            `;
        }
        
        modal.classList.add('active');
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) modalOverlay.classList.add('active');
    }

    openEditForm(product) {
        this.renderEditForm(product);
        this.switchPage('editProduct');
    }

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

    // ========== МЕТОДЫ ЗАГРУЗКИ/ИНДИКАТОРЫ ==========

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

    // ========== СТАТИСТИЧЕСКИЕ МЕТОДЫ ==========

    calculateStatistics() {
        const soldProducts = this.products.filter(p => p.status === 'sold');
        const inStockProducts = this.products.filter(p => p.status === 'in-stock');
        const phoneProducts = this.products.filter(p => p.category === 'phones');
        
        // Общая прибыль
        const totalProfit = soldProducts.reduce((sum, p) => {
            const purchase = p.purchase_price || 0;
            const investment = p.investment || 0;
            const selling = p.selling_price || 0;
            return sum + (selling - purchase - investment);
        }, 0);
        
        // Общий оборот
        const totalTurnover = soldProducts.reduce((sum, p) => sum + (p.selling_price || 0), 0);
        
        // Статистика покупок iPhone по неделям текущего месяца
        const weeklyPhonePurchases = this.getWeeklyPhonePurchases(phoneProducts);
        
        // Распределение по месту покупки
        const purchaseSourceStats = this.getSourceStats(this.products, 'purchase_source');
        
        // Распределение по месту продажи (только проданные)
        const saleSourceStats = this.getSourceStats(soldProducts, 'sale_source');
        
        // Последние продажи
        const recentSales = soldProducts
            .filter(p => p.sold_at)
            .sort((a, b) => {
                const dateA = new Date(a.sold_at);
                const dateB = new Date(b.sold_at);
                return dateB - dateA;
            })
            .slice(0, 20);
        
        return {
            totalProfit,
            totalTurnover,
            soldCount: soldProducts.length,
            inStockCount: inStockProducts.length,
            weeklyPhonePurchases,
            purchaseSourceStats,
            saleSourceStats,
            recentSales
        };
    }

    getWeeklyPhonePurchases(products) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // 4 недели + возможная 5-я
        const weeks = [0, 0, 0, 0, 0];
        
        products.forEach(product => {
            const created = new Date(product.created_at);
            if (!created || isNaN(created.getTime())) return;
            if (created.getFullYear() !== currentYear || created.getMonth() !== currentMonth) return;
            
            const day = created.getDate();
            let weekIndex = Math.floor((day - 1) / 7);
            if (weekIndex < 0) weekIndex = 0;
            if (weekIndex > 4) weekIndex = 4;
            weeks[weekIndex] += 1;
        });
        
        const labels = ['1 неделя', '2 неделя', '3 неделя', '4 неделя', '5 неделя'];
        
        return {
            labels,
            data: weeks
        };
    }

    getSourceStats(products, field) {
        const stats = {};
        
        products.forEach(product => {
            let value = product[field] || 'unknown';
            // Нормализуем значения
            if (field === 'purchase_source') {
                const map = {
                    avito_lenta: 'Авито лента',
                    avito_skupka: 'Авито скупка',
                    vk: 'ВК',
                    tg: 'ТГ',
                    unknown: 'Не указано'
                };
                stats[map[value] || map.unknown] = (stats[map[value] || map.unknown] || 0) + 1;
            } else if (field === 'sale_source') {
                const map = {
                    avito: 'Авито',
                    vk: 'ВК',
                    tg: 'ТГ',
                    unknown: 'Не указано'
                };
                stats[map[value] || map.unknown] = (stats[map[value] || map.unknown] || 0) + 1;
            }
        });
        
        return stats;
    }

    createCharts(stats) {
        // Диаграмма покупок iPhone по неделям
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx && typeof Chart !== 'undefined') {
            new Chart(salesCtx, {
                type: 'bar',
                data: {
                    labels: stats.weeklyPhonePurchases.labels,
                    datasets: [{
                        label: 'Количество покупок',
                        data: stats.weeklyPhonePurchases.data,
                        backgroundColor: 'rgba(0, 122, 255, 0.6)',
                        borderColor: 'rgba(0, 122, 255, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
        
        // Диаграмма по месту покупки
        const profitCtx = document.getElementById('profitChart');
        if (profitCtx && typeof Chart !== 'undefined') {
            new Chart(profitCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.purchaseSourceStats),
                    datasets: [{
                        data: Object.values(stats.purchaseSourceStats),
                        backgroundColor: [
                            'rgba(0, 122, 255, 0.8)',
                            'rgba(52, 199, 89, 0.8)',
                            'rgba(88, 86, 214, 0.8)',
                            'rgba(255, 149, 0, 0.8)',
                            'rgba(142, 142, 147, 0.8)'
                        ],
                        borderColor: [
                            'rgba(0, 122, 255, 1)',
                            'rgba(52, 199, 89, 1)',
                            'rgba(88, 86, 214, 1)',
                            'rgba(255, 149, 0, 1)',
                            'rgba(142, 142, 147, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // Круговая диаграмма по месту продажи
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx && typeof Chart !== 'undefined') {
            new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.saleSourceStats),
                    datasets: [{
                        data: Object.values(stats.saleSourceStats),
                        backgroundColor: [
                            'rgba(0, 122, 255, 0.8)',
                            'rgba(88, 86, 214, 0.8)',
                            'rgba(255, 149, 0, 0.8)',
                            'rgba(52, 199, 89, 0.8)'
                        ],
                        borderColor: [
                            'rgba(0, 122, 255, 1)',
                            'rgba(88, 86, 214, 1)',
                            'rgba(255, 149, 0, 1)',
                            'rgba(52, 199, 89, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }

    fillSalesTable(sales) {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;
        
        if (sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                        <p>Пока нет продаж</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        const categoryLabels = {
            phones: 'Телефоны',
            accessories: 'Аксессуары',
            parts: 'Запчасти'
        };
        
        tbody.innerHTML = sales.map(product => {
            const purchase = product.purchase_price || 0;
            const investment = product.investment || 0;
            const selling = product.selling_price || 0;
            const profit = selling - purchase - investment;
            
            const soldDate = new Date(product.sold_at);
            const dateStr = soldDate && !isNaN(soldDate.getTime()) 
                ? soldDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '-';
            
            return `
                <tr>
                    <td>${product.name || '-'}</td>
                    <td>${categoryLabels[product.category] || product.category || '-'}</td>
                    <td>${this.formatCurrency(purchase)}</td>
                    <td>${this.formatCurrency(selling)}</td>
                    <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${this.formatCurrency(profit)}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        }).join('');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ФОТО ==========

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    compressImageForIOS(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    // Для iOS ограничиваем максимальный размер
                    const maxSize = 1024;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        } else {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }
                    
                    // Создаем canvas только если нужно изменить размер
                    if (width !== img.width || height !== img.height) {
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Для iOS используем JPEG с качеством 0.8
                        try {
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            resolve(compressedDataUrl);
                        } catch (error) {
                            // Если canvas не работает, возвращаем оригинал
                            resolve(e.target.result);
                        }
                    } else {
                        // Если размер и так маленький, возвращаем оригинал
                        resolve(e.target.result);
                    }
                };
                
                img.onerror = () => {
                    // Если не удалось загрузить изображение, возвращаем оригинал
                    resolve(e.target.result);
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                // В случае ошибки чтения, пробуем еще раз с простым чтением
                const fallbackReader = new FileReader();
                fallbackReader.onload = (e2) => resolve(e2.target.result);
                fallbackReader.readAsDataURL(file);
            };
            
            reader.readAsDataURL(file);
        });
    }

    compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const mimeType = file.type || 'image/jpeg';
                    const compressed = await this.compressImage(e.target.result, mimeType);
                    resolve(compressed);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    updateUploadProgress(current, total) {
        // Обновляем прогресс для обычной загрузки
        const progressElement = document.getElementById('uploadProgress');
        if (progressElement) {
            const percent = Math.round((current / total) * 100);
            progressElement.style.width = `${percent}%`;
            progressElement.textContent = `${current}/${total}`;
        }
        
        // Обновляем прогресс для редактирования
        const editProgressBar = document.getElementById('editUploadProgress');
        const editProgressText = document.getElementById('editUploadProgressText');
        if (editProgressBar && editProgressText) {
            const percent = Math.round((current / total) * 100);
            editProgressBar.style.width = `${percent}%`;
            editProgressText.textContent = `Обработка фото: ${current} из ${total}`;
        }
    }

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
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                this.switchPage('addProduct');
                // Сбрасываем форму
                const addProductForm = document.getElementById('addProductForm');
                if (addProductForm) addProductForm.reset();
                
                const photoPreviewSection = document.getElementById('photoPreviewSection');
                if (photoPreviewSection) photoPreviewSection.style.display = 'none';
                
                const phoneStatusGroup = document.getElementById('phoneStatusGroup');
                if (phoneStatusGroup) phoneStatusGroup.style.display = 'none';
                
                this.tempPhotos = [];
            });
        }
        
        // Кнопка запчастей в шапке
        const partsBtn = document.getElementById('partsBtn');
        if (partsBtn) {
            partsBtn.addEventListener('click', () => {
                this.switchPage('parts');
            });
        }
        
        // Кнопка профиля
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modal = document.getElementById('profileModal');
                if (modal) {
                    modal.classList.toggle('active');
                }
                
                if (!this.currentUser) {
                    this.openAuthModal();
                }
            });
        }
        
        // Закрытие профиля при клике снаружи
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('profileModal');
            const profileBtn = document.getElementById('profileBtn');
            
            if (modal && profileBtn && !modal.contains(e.target) && !profileBtn.contains(e.target)) {
                modal.classList.remove('active');
            }
        });
        
        // Выход из системы
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
        
        // Кнопка статистики в профиле
        const profileStatistics = document.getElementById('profileStatistics');
        if (profileStatistics) {
            profileStatistics.addEventListener('click', () => {
                const profileModal = document.getElementById('profileModal');
                if (profileModal) profileModal.classList.remove('active');
                this.switchPage('statistics');
            });
        }
        
        // Поиск
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const container = document.getElementById('searchContainer');
                if (container) {
                    container.classList.toggle('active');
                    
                    if (container.classList.contains('active')) {
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) searchInput.focus();
                    }
                }
            });
        }
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim();
                if (this.currentPage === 'warehouse') {
                    this.renderWarehouse();
                }
            });
        }
        
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = '';
                this.searchQuery = '';
                if (this.currentPage === 'warehouse') {
                    this.renderWarehouse();
                }
            });
        }
        
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
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.renderWarehouse();
            });
        }
        
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
        const backButtons = {
            'backFromWarehouse': 'home',
            'backFromAdd': 'home',
            'backFromEdit': () => this.selectedProductId ? 'productDetail' : 'warehouse',
            'backFromDetail': 'warehouse',
            'backFromParts': 'home',
            'backFromStatistics': 'home'
        };
        
        Object.entries(backButtons).forEach(([buttonId, targetPage]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    if (typeof targetPage === 'function') {
                        this.switchPage(targetPage());
                    } else {
                        this.switchPage(targetPage);
                    }
                });
            }
        });
        
        // Форма добавления товара
        const addForm = document.getElementById('addProductForm');
        if (addForm) {
            // Показ/скрытие поля статуса телефона
            const productCategory = document.getElementById('productCategory');
            if (productCategory) {
                productCategory.addEventListener('change', (e) => {
                    const phoneStatusGroup = document.getElementById('phoneStatusGroup');
                    if (phoneStatusGroup) {
                        phoneStatusGroup.style.display = e.target.value === 'phones' ? 'block' : 'none';
                    }
                });
            }
            
            // Загрузка фото при добавлении товара
            const photoInput = document.getElementById('photoInput');
            if (photoInput) {
                photoInput.addEventListener('change', async (e) => {
                    const photos = await this.handlePhotoUpload(e.target);
                    this.tempPhotos = photos;
                    this.showPhotoPreview(photos);
                });
            }
            
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!this.checkAuth()) return;
                
                const formData = {
                    name: document.getElementById('productName').value.trim(),
                    purchasePrice: parseInt(document.getElementById('purchasePrice').value) || 0,
                    investment: parseInt(document.getElementById('investment').value) || 0,
                    category: document.getElementById('productCategory').value,
                    purchaseSource: document.getElementById('purchaseSource')?.value || 'avito_lenta',
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
                
                // Добавляем товар через Supabase
                await this.addNewProduct(formData);
                
                // Сбрасываем форму
                e.target.reset();
                const photoPreviewSection = document.getElementById('photoPreviewSection');
                if (photoPreviewSection) photoPreviewSection.style.display = 'none';
                
                const phoneStatusGroup = document.getElementById('phoneStatusGroup');
                if (phoneStatusGroup) phoneStatusGroup.style.display = 'none';
                
                this.tempPhotos = [];
            });
        }
        
        // Отмена добавления
        const cancelAddBtn = document.getElementById('cancelAddBtn');
        if (cancelAddBtn) {
            cancelAddBtn.addEventListener('click', () => {
                const addProductForm = document.getElementById('addProductForm');
                if (addProductForm) addProductForm.reset();
                
                const photoPreviewSection = document.getElementById('photoPreviewSection');
                if (photoPreviewSection) photoPreviewSection.style.display = 'none';
                
                const phoneStatusGroup = document.getElementById('phoneStatusGroup');
                if (phoneStatusGroup) phoneStatusGroup.style.display = 'none';
                
                this.tempPhotos = [];
                this.switchPage('home');
            });
        }
        
        // Продажа товара
        const confirmSellBtn = document.getElementById('confirmSellBtn');
        if (confirmSellBtn) {
            confirmSellBtn.addEventListener('click', () => {
                const sellingPrice = parseInt(document.getElementById('sellingPrice')?.value) || 0;
                const notes = document.getElementById('saleNotes')?.value.trim() || '';
                const saleSource = document.getElementById('saleSource')?.value || 'avito';
                
                if (sellingPrice <= 0) {
                    this.showToast('Ошибка', 'Введите корректную цену продажи', 'error');
                    return;
                }
                
                if (this.selectedProductId) {
                    this.sellProduct(this.selectedProductId, sellingPrice, notes, saleSource);
                }
            });
        }
        
        // Удаление товара
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (this.selectedProductId) {
                    this.deleteProduct(this.selectedProductId);
                }
            });
        }
        
        // Закрытие модальных окон
        const closeModal = (modalId) => {
            const modal = document.getElementById(modalId);
            const modalOverlay = document.getElementById('modalOverlay');
            
            if (modal) modal.classList.remove('active');
            if (modalOverlay) modalOverlay.classList.remove('active');
        };
        
        const closeButtons = {
            'closeSellModal': 'sellModal',
            'closeDeleteModal': 'deleteModal',
            'cancelSellBtn': 'sellModal',
            'cancelDeleteBtn': 'deleteModal'
        };
        
        Object.entries(closeButtons).forEach(([buttonId, modalId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => closeModal(modalId));
            }
        });
        
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
                modalOverlay.classList.remove('active');
            });
        }
        
        // Добавление запчастей вручную
        const addPartBtn = document.getElementById('addPartBtn');
        if (addPartBtn) {
            addPartBtn.addEventListener('click', async () => {
                const partInput = document.getElementById('newPart');
                const partName = partInput?.value.trim();
                
                if (partName) {
                    this.setButtonLoading('addPartBtn', true);
                    await this.addRequiredPart(partName);
                    if (partInput) partInput.value = '';
                    this.renderPartsList();
                    this.setButtonLoading('addPartBtn', false);
                    this.showToast('Успех', 'Запчасть добавлена', 'success');
                } else {
                    this.showToast('Ошибка', 'Введите название запчасти', 'error');
                }
            });
        }
        
        // Ввод в поле добавления запчастей (Enter для добавления)
        const newPartInput = document.getElementById('newPart');
        if (newPartInput) {
            newPartInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const addPartBtn = document.getElementById('addPartBtn');
                    if (addPartBtn) addPartBtn.click();
                }
            });
        }
        
        // Авторизация
        this.initAuthEventListeners();
    }

    initAuthEventListeners() {
        // Закрытие окна авторизации
        const closeAuthModal = document.getElementById('closeAuthModal');
        if (closeAuthModal) {
            closeAuthModal.addEventListener('click', () => {
                this.closeAuthModal();
            });
        }
        
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
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }
        
        // Форма регистрации
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleRegister();
            });
        }
    }

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

    getCompressionName(level) {
        const names = {
            high: 'Высокое',
            medium: 'Среднее',
            low: 'Экономное'
        };
        return names[level] || 'Высокое';
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    showIOSWarning() {
        const warning = document.createElement('div');
        warning.className = 'ios-warning';
        warning.innerHTML = `
            <i class="fas fa-mobile-alt"></i>
            <strong>iOS устройство:</strong> Обработка фото может занять несколько секунд
        `;
        
        const addProductPage = document.getElementById('addProductPage');
        if (addProductPage) {
            const form = addProductPage.querySelector('.add-product-form');
            if (form) {
                form.insertBefore(warning, form.firstChild);
            }
        }
    }

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
            const closeFullscreen = document.getElementById('closeFullscreen');
            if (closeFullscreen) {
                closeFullscreen.addEventListener('click', () => {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                });
            }
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
        
        const photo = document.getElementById('fullscreenPhoto');
        if (photo) {
            photo.src = product.photos[photoIndex];
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
}

// Запуск приложения при загрузке страницы
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запускаем приложение с Supabase...');
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
};

// Экспортируем app для глобального доступа
window.app = app;