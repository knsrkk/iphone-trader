// supabase-service.js - ПОЛНЫЙ И ИСПРАВЛЕННЫЙ ВАРИАНТ
class SupabaseService {
    constructor() {
        console.log('Инициализация SupabaseService...');
        
        // Используем клиент из конфига
        this.supabase = window.supabaseClient;
        
        if (!this.supabase) {
            console.error('Supabase клиент не загружен!');
            throw new Error('Supabase не инициализирован');
        }
        
        this.currentUser = null;
        this.session = null;
        
        console.log('SupabaseService создан, клиент доступен');
        
        // Инициализируем асинхронно
        this.initializeAuth();
    }
    
    async initializeAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Ошибка получения сессии:', error);
                return;
            }
            
            this.session = session;
            
            // Если есть сессия, получаем пользователя из таблицы users
            if (session?.user) {
                await this.loadUserFromDatabase(session.user.id);
            }
            
            // Слушаем изменения аутентификации
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Состояние аутентификации изменилось:', event);
                this.session = session;
                
                if (event === 'SIGNED_IN' && session?.user) {
                    // Загружаем пользователя из таблицы users (с правильным id)
                    await this.loadUserFromDatabase(session.user.id);
                    console.log('Пользователь вошел:', this.currentUser?.email);
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    console.log('Пользователь вышел');
                }
            });
            
        } catch (error) {
            console.error('Ошибка инициализации аутентификации:', error);
        }
    }
    
    // Вспомогательный метод для загрузки пользователя из таблицы users
    async loadUserFromDatabase(authUid) {
        try {
            const { data: userData, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('auth_uid', authUid)
                .maybeSingle();
            
            if (error) {
                console.warn('Ошибка загрузки пользователя из БД:', error);
                return;
            }
            
            if (userData) {
                this.currentUser = userData;
                console.log('Пользователь загружен из БД, id:', userData.id);
            } else {
                console.log('Пользователь не найден в таблице users для auth_uid:', authUid);
                // Не устанавливаем currentUser если пользователя нет в таблице users
                this.currentUser = null;
            }
        } catch (error) {
            console.error('Ошибка в loadUserFromDatabase:', error);
        }
    }

    // ========== АУТЕНТИФИКАЦИЯ ==========
    
    async register(email, password, name) {
        try {
            console.log('Регистрация нового пользователя:', email);
            
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: name,
                        is_admin: false
                    }
                }
            });
            
            if (authError) throw authError;
            
            if (!authData.user) {
                throw new Error('Не удалось создать пользователя');
            }
            
            console.log('Пользователь создан в Auth:', authData.user.id);
            
            // Создаем запись в таблице users сразу после регистрации
            const { data: newUser, error: createError } = await this.supabase
                .from('users')
                .insert([{
                    auth_uid: authData.user.id,
                    name: name,
                    email: email,
                    is_admin: false
                }])
                .select()
                .single();
            
            if (createError) {
                console.error('Ошибка создания пользователя в таблице users:', createError);
                // Продолжаем, пользователь будет создан при первом логине
            } else {
                console.log('Пользователь создан в таблице users, id:', newUser.id);
            }
            
            // Пробуем автоматически залогинить
            // Если требуется подтверждение email, это не сработает
            try {
                const loginResult = await this.login(email, password);
                if (loginResult.success) {
                    return loginResult;
                }
            } catch (loginError) {
                console.log('Автологин не удался (возможно требуется подтверждение email):', loginError);
            }
            
            // Если автологин не сработал, но регистрация прошла успешно
            // Устанавливаем пользователя из созданной записи
            if (newUser) {
                this.currentUser = newUser;
                return {
                    success: true,
                    user: newUser,
                    message: 'Регистрация успешна'
                };
            }
            
            // Если и это не сработало, возвращаем успех с сообщением о подтверждении email
            return {
                success: true,
                user: { email: email, name: name },
                message: 'Регистрация успешна. Возможно требуется подтверждение email.'
            };
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    async login(email, password) {
        try {
            console.log('Вход пользователя:', email);
            
            // Выполняем вход
            const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (authError) throw authError;
            
            console.log('Вход успешен, auth_uid:', authData.user.id);
            
            // Получаем данные пользователя из нашей таблицы users
            let userData = null;
            
            // Шаг 1: Пытаемся найти пользователя по auth_uid
            const { data: existingUser, error: fetchError } = await this.supabase
                .from('users')
                .select('*')
                .eq('auth_uid', authData.user.id)
                .maybeSingle();
            
            if (fetchError && !fetchError.message.includes('PGRST116')) {
                console.warn('Ошибка получения пользователя:', fetchError);
            }
            
            if (existingUser) {
                // Пользователь найден - используем его id из таблицы users
                userData = existingUser;
                console.log('Пользователь найден в таблице users, id:', userData.id);
            } else {
                // Шаг 2: Пользователь не найден - создаем нового
                console.log('Пользователь не найден в таблице users, создаем...');
                
                const { data: newUser, error: createError } = await this.supabase
                    .from('users')
                    .insert([{
                        auth_uid: authData.user.id,
                        name: authData.user.user_metadata?.name || email.split('@')[0],
                        email: email,
                        is_admin: false
                    }])
                    .select()
                    .single();
                
                if (createError) {
                    console.error('Ошибка создания пользователя в таблице users:', createError);
                    throw new Error('Не удалось создать пользователя в базе данных. Обратитесь к администратору.');
                }
                
                userData = newUser;
                console.log('Пользователь создан в таблице users, id:', userData.id);
            }
            
            // Проверяем, что у нас есть правильный id из таблицы users
            if (!userData || !userData.id) {
                throw new Error('Не удалось получить id пользователя из таблицы users');
            }
            
            // Обновляем текущего пользователя
            this.currentUser = userData;
            
            console.log('Текущий пользователь установлен:', {
                id: this.currentUser.id,
                auth_uid: this.currentUser.auth_uid,
                email: this.currentUser.email
            });
            
            return {
                success: true,
                user: this.currentUser
            };
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    async logout() {
        try {
            console.log('Выход пользователя');
            
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('Ошибка выхода:', error);
                throw error;
            }
            
            this.currentUser = null;
            this.session = null;
            
            console.log('Выход успешен');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ АВТОРИЗАЦИИ ==========
    
    getAuthErrorMessage(error) {
        const errorCode = error.message || error.toString();
        
        const errorMessages = {
            'Invalid login credentials': 'Неверный email или пароль',
            'Email not confirmed': 'Email не подтвержден. Проверьте вашу почту',
            'User already registered': 'Пользователь с таким email уже зарегистрирован',
            'Weak password': 'Пароль слишком слабый. Минимум 6 символов',
            'Invalid email': 'Некорректный email адрес',
            'Email rate limit exceeded': 'Слишком много запросов. Попробуйте позже',
            'User not found': 'Пользователь не найден',
            'Network request failed': 'Ошибка сети. Проверьте подключение к интернету'
        };
        
        // Ищем совпадение в сообщении об ошибке
        for (const [key, message] of Object.entries(errorMessages)) {
            if (errorCode.includes(key)) {
                return message;
            }
        }
        
        // Если не нашли совпадение, возвращаем оригинальное сообщение
        return errorCode || 'Неизвестная ошибка';
    }
    
    // ========== ПРОДУКТЫ ==========
    
    async getProducts(userId) {
        try {
            if (!userId) {
                console.log('Нет userId для получения товаров');
                return [];
            }
            
            console.log('Получение товаров для пользователя (ID):', userId);
            
            // Простая логика - ищем товары по user_id напрямую
            // userId уже должен быть id из таблицы users
            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .eq('user_id', userId) // Используем userId напрямую
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Ошибка получения товаров:', error);
                throw error;
            }
            
            console.log('Получено товаров:', data?.length || 0);
            return data || [];
            
        } catch (error) {
            console.error('Ошибка в getProducts:', error);
            return [];
        }
    }  

    async addProduct(productData) {
        try {
            if (!this.currentUser) {
                throw new Error('Пользователь не авторизован');
            }
            
            console.log('Добавление товара:', productData.name);
            console.log('Текущий пользователь:', {
                id: this.currentUser.id,
                auth_uid: this.currentUser.auth_uid,
                email: this.currentUser.email
            });
            
            // Проверяем, что id - это id из таблицы users, а не auth_uid
            // auth_uid обычно выглядит как UUID, а id из таблицы users - это integer
            const userId = this.currentUser.id;
            
            // Валидация: проверяем что userId существует и это не auth_uid
            if (!userId) {
                throw new Error('ID пользователя не найден. Пожалуйста, выйдите и войдите снова.');
            }
            
            // Если userId равен auth_uid, это ошибка - нужно перелогиниться
            if (this.currentUser.auth_uid && userId === this.currentUser.auth_uid) {
                console.error('ОШИБКА: userId совпадает с auth_uid! Это приведет к foreign key ошибке.');
                throw new Error('Ошибка данных пользователя. Пожалуйста, выйдите и войдите снова.');
            }
            
            console.log('Используем user_id для товара:', userId);
            
            // Подготавливаем данные для Supabase
            const product = {
                name: productData.name,
                description: productData.description || '',
                purchase_price: parseFloat(productData.purchase_price) || 0,
                investment: parseFloat(productData.investment) || 0,
                selling_price: null,
                category: productData.category,
                phone_status: productData.category === 'phones' ? productData.phone_status : null,
                purchase_source: productData.purchase_source || null,
                status: 'in-stock',
                sold_at: null,
                sale_source: null,
                photos: productData.photos || [],
                required_parts: productData.required_parts || '',
                change_history: [],
                user_id: userId, // Используем id из таблицы users
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString()
            };
            
            console.log('Отправляемые данные товара:', product);
            
            const { data, error } = await this.supabase
                .from('products')
                .insert([product])
                .select()
                .single();
            
            if (error) throw error;
            
            console.log('Товар добавлен с ID:', data.id);
            
            return {
                success: true,
                productId: data.id,
                product: data
            };
            
        } catch (error) {
            console.error('Ошибка добавления товара:', error);
            return {
                success: false,
                error: error.message || 'Не удалось добавить товар'
            };
        }
    }

    async updateProduct(productId, updates) {
        try {
            console.log('Обновление товара:', productId);
            
            const updateData = {
                ...updates,
                last_updated: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('products')
                .update(updateData)
                .eq('id', productId)
                .select()
                .single();
            
            if (error) throw error;
            
            console.log('Товар обновлен');
            return { 
                success: true,
                product: data
            };
            
        } catch (error) {
            console.error('Ошибка обновления товара:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteProduct(productId) {
        try {
            console.log('Удаление товара:', productId);
            
            const { error } = await this.supabase
                .from('products')
                .delete()
                .eq('id', productId);
            
            if (error) throw error;
            
            console.log('Товар удален');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========== ЗАПЧАСТИ ==========
    
    async getParts(userId) {
        try {
            if (!userId) {
                console.log('Нет userId для получения запчастей');
                return [];
            }
            
            console.log('Получение запчастей для пользователя:', userId);
            
            const { data, error } = await this.supabase
                .from('parts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Ошибка получения запчастей:', error);
                throw error;
            }
            
            console.log('Получено запчастей:', data?.length || 0);
            return data || [];
            
        } catch (error) {
            console.error('Ошибка получения запчастей:', error);
            return [];
        }
    }

    async addPart(partData) {
        try {
            if (!this.currentUser) {
                throw new Error('Пользователь не авторизован');
            }
            
            console.log('Добавление запчасти:', partData.name);
            
            const part = {
                name: partData.name,
                product: partData.product || '',
                source: partData.source || 'manual',
                user_id: this.currentUser.id,
                created_at: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('parts')
                .insert([part])
                .select()
                .single();
            
            if (error) throw error;
            
            console.log('Запчасть добавлена с ID:', data.id);
            
            return {
                success: true,
                partId: data.id,
                part: data
            };
            
        } catch (error) {
            console.error('Ошибка добавления запчасти:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deletePart(partId) {
        try {
            console.log('Удаление запчасти:', partId);
            
            const { error } = await this.supabase
                .from('parts')
                .delete()
                .eq('id', partId);
            
            if (error) throw error;
            
            console.log('Запчасть удалена');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления запчасти:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========== СТАТИСТИКА ==========
    
    async getStats(userId) {
        try {
            if (!userId) {
                return {
                    profit: 0,
                    turnover: 0,
                    investment: 0,
                    inStock: 0,
                    sold: 0
                };
            }
            
            const products = await this.getProducts(userId);
            const phoneProducts = products.filter(p => p.category === 'phones');
            const inStockPhones = phoneProducts.filter(p => p.status === 'in-stock');
            const soldPhones = phoneProducts.filter(p => p.status === 'sold');
            
            const totalProfit = soldPhones.reduce((sum, p) => {
                const purchase = p.purchase_price || 0;
                const investment = p.investment || 0;
                const selling = p.selling_price || 0;
                return sum + (selling - purchase - investment);
            }, 0);
            
            const totalTurnover = inStockPhones.reduce((sum, p) => {
                return sum + ((p.purchase_price || 0) + (p.investment || 0));
            }, 0);
            
            const totalInvestment = phoneProducts.reduce((sum, p) => sum + (p.investment || 0), 0);
            
            return {
                profit: totalProfit,
                turnover: totalTurnover,
                investment: totalInvestment,
                inStock: inStockPhones.length,
                sold: soldPhones.length
            };
            
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return {
                profit: 0,
                turnover: 0,
                investment: 0,
                inStock: 0,
                sold: 0
            };
        }
    }

    // ========== СИНХРОНИЗАЦИЯ ==========
    
    subscribeToProducts(userId, callback) {
        if (!userId || !callback) {
            console.log('Нет userId или callback для подписки на товары');
            return () => {};
        }
        
        try {
            console.log('Подписка на товары для пользователя:', userId);
            
            const channel = this.supabase
                .channel('products-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'products',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        console.log('Изменение в товарах:', payload.eventType);
                        this.getProducts(userId).then(products => {
                            if (callback && typeof callback === 'function') {
                                callback(products);
                            }
                        });
                    }
                )
                .subscribe((status) => {
                    console.log('Статус подписки на товары:', status);
                });
            
            return () => {
                console.log('Отписка от товаров');
                this.supabase.removeChannel(channel);
            };
            
        } catch (error) {
            console.error('Ошибка создания подписки на товары:', error);
            return () => {};
        }
    }

    subscribeToParts(userId, callback) {
        if (!userId || !callback) {
            console.log('Нет userId или callback для подписки на запчасти');
            return () => {};
        }
        
        try {
            console.log('Подписка на запчасти для пользователя:', userId);
            
            const channel = this.supabase
                .channel('parts-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'parts',
                        filter: `user_id=eq.${userId}`
                    },
                    () => {
                        this.getParts(userId).then(parts => callback(parts));
                    }
                )
                .subscribe();
            
            return () => {
                console.log('Отписка от запчастей');
                this.supabase.removeChannel(channel);
            };
            
        } catch (error) {
            console.error('Ошибка создания подписки на запчасти:', error);
            return () => {};
        }
    }
    
    // ========== ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ==========
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    // ========== ПРОВЕРКА СОЕДИНЕНИЯ ==========
    
    async testConnection() {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .select('count')
                .limit(1);
            
            return {
                success: !error,
                error: error ? error.message : null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // ========== УТИЛИТЫ ==========
    
    async resetUserCache() {
        this.currentUser = null;
        this.session = null;
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========
    
    async initializeDatabase() {
        try {
            console.log('Проверка инициализации базы данных...');
            
            // Проверяем существование таблиц
            const tables = ['products', 'parts', 'users'];
            
            for (const table of tables) {
                try {
                    const { data, error } = await this.supabase
                        .from(table)
                        .select('count')
                        .limit(1);
                    
                    if (error && error.message.includes('не существует')) {
                        console.log(`Таблица ${table} не существует`);
                    } else {
                        console.log(`Таблица ${table} доступна`);
                    }
                } catch (error) {
                    console.log(`Ошибка проверки таблицы ${table}:`, error.message);
                }
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Создаем глобальный экземпляр сервиса
console.log('Создание глобального экземпляра SupabaseService...');
let supabaseService;

try {
    supabaseService = new SupabaseService();
    window.supabaseService = supabaseService;
    console.log('SupabaseService успешно создан и доступен как window.supabaseService');
} catch (error) {
    console.error('Не удалось создать SupabaseService:', error);
    
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
        getCurrentUser: () => null,
        testConnection: () => Promise.resolve({ success: false, error: 'Сервис не загружен' }),
        initializeDatabase: () => Promise.resolve({ success: false, error: 'Сервис не загружен' })
    };
}

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseService };
}