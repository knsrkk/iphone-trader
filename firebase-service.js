// firebase-service.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class FirebaseService {
    constructor() {
        // Проверяем, инициализирован ли Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.currentUser = null;
        
        console.log('FirebaseService инициализирован');
        
        // Слушаем изменения состояния аутентификации
        this.auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
            this.currentUser = user;
        });
    }

    // ========== АУТЕНТИФИКАЦИЯ ==========
    
    async register(email, password, name) {
        try {
            console.log('Регистрация пользователя:', email);
            
            // 1. Создаем пользователя в Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            console.log('Пользователь создан в Auth:', userCredential.user.uid);
            
            // 2. Обновляем имя пользователя
            await userCredential.user.updateProfile({
                displayName: name
            });
            console.log('Профиль обновлен');
            
            // 3. Создаем запись в коллекции users
            const userData = {
                uid: userCredential.user.uid,
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            };
            
            await this.db.collection('users').doc(userCredential.user.uid).set(userData);
            console.log('Данные пользователя сохранены в Firestore');
            
            return {
                success: true,
                user: {
                    id: userCredential.user.uid,
                    name: name,
                    email: email,
                    isAdmin: false
                }
            };
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async login(email, password) {
        try {
            console.log('Вход пользователя:', email);
            
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('Вход успешен:', userCredential.user.uid);
            
            // Получаем дополнительные данные пользователя из Firestore
            const userDoc = await this.db.collection('users').doc(userCredential.user.uid).get();
            
            let userData = {
                id: userCredential.user.uid,
                name: userCredential.user.displayName || email.split('@')[0],
                email: userCredential.user.email,
                isAdmin: false
            };
            
            if (userDoc.exists) {
                const data = userDoc.data();
                userData.name = data.name || userData.name;
                userData.isAdmin = data.isAdmin || false;
            }
            
            return {
                success: true,
                user: userData
            };
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async logout() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========== ПРОДУКТЫ ==========
    
    async getProducts(userId) {
        try {
            if (!userId) {
                console.log('Нет userId для получения товаров');
                return [];
            }
            
            console.log('Получение товаров для пользователя:', userId);
            
            const snapshot = await this.db
                .collection('products')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('Товары получены:', products.length);
            return products;
            
        } catch (error) {
            console.error('Ошибка получения товаров:', error);
            
            // Если ошибка из-за отсутствия индекса, создаем его
            if (error.code === 'failed-precondition') {
                console.log('Создайте индекс в Firestore Console для запроса продуктов');
            }
            
            return [];
        }
    }

    async addProduct(productData) {
        try {
            if (!this.currentUser) {
                throw new Error('Пользователь не авторизован');
            }
            
            console.log('Добавление товара:', productData.name);
            
            const product = {
                ...productData,
                userId: this.currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                status: productData.status || 'in-stock'
            };
            
            const docRef = await this.db.collection('products').add(product);
            console.log('Товар добавлен с ID:', docRef.id);
            
            return {
                success: true,
                productId: docRef.id,
                product: { id: docRef.id, ...product }
            };
            
        } catch (error) {
            console.error('Ошибка добавления товара:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async updateProduct(productId, updates) {
        try {
            console.log('Обновление товара:', productId);
            
            const productRef = this.db.collection('products').doc(productId);
            await productRef.update({
                ...updates,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Товар обновлен');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка обновления товара:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async deleteProduct(productId) {
        try {
            console.log('Удаление товара:', productId);
            
            await this.db.collection('products').doc(productId).delete();
            console.log('Товар удален');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
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
            
            const snapshot = await this.db
                .collection('parts')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            
            const parts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('Запчасти получены:', parts.length);
            return parts;
            
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
                ...partData,
                userId: this.currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await this.db.collection('parts').add(part);
            console.log('Запчасть добавлена с ID:', docRef.id);
            
            return {
                success: true,
                partId: docRef.id,
                part: { id: docRef.id, ...part }
            };
            
        } catch (error) {
            console.error('Ошибка добавления запчасти:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async deletePart(partId) {
        try {
            console.log('Удаление запчасти:', partId);
            
            await this.db.collection('parts').doc(partId).delete();
            console.log('Запчасть удалена');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления запчасти:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
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
                const purchase = p.purchasePrice || 0;
                const investment = p.investment || 0;
                const selling = p.sellingPrice || 0;
                return sum + (selling - purchase - investment);
            }, 0);
            
            const totalTurnover = inStockPhones.reduce((sum, p) => {
                return sum + ((p.purchasePrice || 0) + (p.investment || 0));
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

    // ========== УТИЛИТЫ ==========
    
    getErrorMessage(error) {
        const errorMessages = {
            // Регистрация
            'auth/email-already-in-use': 'Этот email уже используется',
            'auth/invalid-email': 'Некорректный email',
            'auth/operation-not-allowed': 'Регистрация отключена',
            'auth/weak-password': 'Пароль слишком слабый (минимум 6 символов)',
            
            // Вход
            'auth/user-disabled': 'Аккаунт отключен',
            'auth/user-not-found': 'Пользователь не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            
            // Firestore
            'permission-denied': 'Нет доступа. Проверьте права доступа',
            'unavailable': 'Сервис временно недоступен',
            'failed-precondition': 'Необходимо создать индекс в Firestore Console'
        };
        
        return errorMessages[error.code] || error.message || 'Произошла ошибка';
    }

    // ========== СИНХРОНИЗАЦИЯ ==========
    
    subscribeToProducts(userId, callback) {
        if (!userId) {
            console.log('Нет userId для подписки на товары');
            return () => {};
        }
        
        console.log('Подписка на товары для пользователя:', userId);
        
        try {
            return this.db
                .collection('products')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const products = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('Товары обновлены (подписка):', products.length);
                    callback(products);
                }, (error) => {
                    console.error('Ошибка подписки на товары:', error);
                    
                    // Если ошибка из-за отсутствия индекса
                    if (error.code === 'failed-precondition') {
                        console.log('ВАЖНО: Создайте индекс в Firestore Console для запроса продуктов!');
                        console.log('Перейдите в Firebase Console → Firestore → Indexes → Create index');
                        console.log('Collection ID: products');
                        console.log('Fields: userId (Ascending), createdAt (Descending)');
                    }
                });
        } catch (error) {
            console.error('Ошибка создания подписки на товары:', error);
            return () => {};
        }
    }

    subscribeToParts(userId, callback) {
        if (!userId) {
            console.log('Нет userId для подписки на запчасти');
            return () => {};
        }
        
        console.log('Подписка на запчасти для пользователя:', userId);
        
        try {
            return this.db
                .collection('parts')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const parts = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('Запчасти обновлены (подписка):', parts.length);
                    callback(parts);
                }, (error) => {
                    console.error('Ошибка подписки на запчасти:', error);
                });
        } catch (error) {
            console.error('Ошибка создания подписки на запчасти:', error);
            return () => {};
        }
    }
}

// Создаем глобальный экземпляр сервиса
const firebaseService = new FirebaseService();
window.firebaseService = firebaseService;