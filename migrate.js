// migrate.js - МИГРАЦИЯ ДАННЫХ ИЗ FIREBASE В SUPABASE
console.log('🔥➡️🟢 Начинаем миграцию данных из Firebase в Supabase...');

// Конфигурация Firebase (старая)
const firebaseConfig = {
    apiKey: "AIzaSyCxVPbP6YvOQbEXYxCTcKtQOGLyHOLn_Tg",
    authDomain: "iphone-trader-f2dca.firebaseapp.com",
    projectId: "iphone-trader-f2dca",
    storageBucket: "iphone-trader-f2dca.firebasestorage.app",
    messagingSenderId: "169886941769",
    appId: "1:169886941769:web:7403dbfe5b4ea5f9272fb4"
};

// Конфигурация Supabase (новая)
const SUPABASE_URL = 'https://ooihrxpzbzdkrwhyizgb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaWhyeHB6Ynpka3J3aHlpemdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI3NjU4NCwiZXhwIjoyMDg0ODUyNTg0fQ.8K1pcDWMgG4S41IloHJwABROBQTRJGruFeqS6FcUOvg'; // Нужен service_role ключ из Dashboard

async function migrateData() {
    console.log('🚀 Запуск миграции...');
    
    try {
        // 1. Инициализация Firebase (только Firestore)
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getFirestore, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const firebaseApp = initializeApp(firebaseConfig);
        const firestore = getFirestore(firebaseApp);
        
        console.log('✅ Firebase инициализирован');
        
        // 2. Инициализация Supabase
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        console.log('✅ Supabase клиент создан');
        
        // 3. Миграция пользователей
        await migrateUsers(firestore, supabaseClient);
        
        // 4. Миграция товаров
        await migrateProducts(firestore, supabaseClient);
        
        // 5. Миграция запчастей
        await migrateParts(firestore, supabaseClient);
        
        console.log('🎉 МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
        
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
    }
}

async function migrateUsers(firestore, supabaseClient) {
    console.log('👥 Начинаем миграцию пользователей...');
    
    try {
        // Получаем всех пользователей из Firebase
        const usersRef = collection(firestore, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        console.log(`📊 Найдено пользователей в Firebase: ${usersSnapshot.size}`);
        
        let migratedCount = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            // Подготавливаем данные для Supabase
            const supabaseUser = {
                id: userData.uid || userDoc.id,
                auth_uid: userData.uid || userDoc.id,
                name: userData.name || userData.email?.split('@')[0] || 'Пользователь',
                email: userData.email || '',
                is_admin: userData.isAdmin || false,
                created_at: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            try {
                // Вставляем пользователя в Supabase
                const { error } = await supabaseClient
                    .from('users')
                    .upsert([supabaseUser], { onConflict: 'auth_uid' });
                
                if (error) {
                    console.warn(`⚠️ Ошибка миграции пользователя ${userData.email}:`, error.message);
                } else {
                    migratedCount++;
                    console.log(`✅ Мигрирован пользователь: ${userData.email}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Ошибка при миграции пользователя:`, error);
            }
        }
        
        console.log(`👥 Миграция пользователей завершена: ${migratedCount}/${usersSnapshot.size}`);
        
    } catch (error) {
        console.error('❌ Ошибка миграции пользователей:', error);
    }
}

async function migrateProducts(firestore, supabaseClient) {
    console.log('📦 Начинаем миграцию товаров...');
    
    try {
        // Получаем все товары из Firebase
        const productsRef = collection(firestore, 'products');
        const productsSnapshot = await getDocs(productsRef);
        
        console.log(`📊 Найдено товаров в Firebase: ${productsSnapshot.size}`);
        
        let migratedCount = 0;
        
        // Сначала получим всех пользователей из Supabase для маппинга uid → id
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, auth_uid');
        
        if (usersError) {
            console.error('❌ Ошибка получения пользователей:', usersError);
            return;
        }
        
        // Создаем мап для быстрого поиска
        const userMap = {};
        users.forEach(user => {
            userMap[user.auth_uid] = user.id;
        });
        
        for (const productDoc of productsSnapshot.docs) {
            const productData = productDoc.data();
            
            // Находим правильный user_id
            let userId = null;
            if (productData.userId && userMap[productData.userId]) {
                userId = userMap[productData.userId];
            } else if (productData.user_id && userMap[productData.user_id]) {
                userId = userMap[productData.user_id];
            }
            
            if (!userId) {
                console.warn(`⚠️ Не найден пользователь для товара ${productData.name}, пропускаем`);
                continue;
            }
            
            // Подготавливаем данные для Supabase
            const supabaseProduct = {
                id: productDoc.id,
                user_id: userId,
                name: productData.name || 'Без названия',
                description: productData.description || '',
                purchase_price: parseFloat(productData.purchasePrice) || parseFloat(productData.purchase_price) || 0,
                investment: parseFloat(productData.investment) || 0,
                selling_price: parseFloat(productData.sellingPrice) || parseFloat(productData.selling_price) || null,
                category: productData.category || 'phones',
                phone_status: productData.phoneStatus || productData.phone_status || null,
                purchase_source: productData.purchaseSource || productData.purchase_source || null,
                status: productData.status || 'in-stock',
                photos: productData.photos || [],
                required_parts: productData.requiredParts || productData.required_parts || '',
                sold_at: productData.soldAt?.toDate?.()?.toISOString() || productData.sold_at || null,
                sale_source: productData.saleSource || productData.sale_source || null,
                sale_notes: productData.saleNotes || productData.sale_notes || '',
                change_history: productData.changeHistory || productData.change_history || [],
                created_at: productData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                last_updated: new Date().toISOString()
            };
            
            try {
                // Вставляем товар в Supabase
                const { error } = await supabaseClient
                    .from('products')
                    .upsert([supabaseProduct], { onConflict: 'id' });
                
                if (error) {
                    console.warn(`⚠️ Ошибка миграции товара ${productData.name}:`, error.message);
                } else {
                    migratedCount++;
                    console.log(`✅ Мигрирован товар: ${productData.name}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Ошибка при миграции товара:`, error);
            }
        }
        
        console.log(`📦 Миграция товаров завершена: ${migratedCount}/${productsSnapshot.size}`);
        
    } catch (error) {
        console.error('❌ Ошибка миграции товаров:', error);
    }
}

async function migrateParts(firestore, supabaseClient) {
    console.log('🔧 Начинаем миграцию запчастей...');
    
    try {
        // Получаем все запчасти из Firebase
        const partsRef = collection(firestore, 'parts');
        const partsSnapshot = await getDocs(partsRef);
        
        console.log(`📊 Найдено запчастей в Firebase: ${partsSnapshot.size}`);
        
        let migratedCount = 0;
        
        // Получаем пользователей для маппинга
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, auth_uid');
        
        if (usersError) {
            console.error('❌ Ошибка получения пользователей:', usersError);
            return;
        }
        
        const userMap = {};
        users.forEach(user => {
            userMap[user.auth_uid] = user.id;
        });
        
        for (const partDoc of partsSnapshot.docs) {
            const partData = partDoc.data();
            
            // Находим правильный user_id
            let userId = null;
            if (partData.userId && userMap[partData.userId]) {
                userId = userMap[partData.userId];
            } else if (partData.user_id && userMap[partData.user_id]) {
                userId = userMap[partData.user_id];
            }
            
            if (!userId) {
                console.warn(`⚠️ Не найден пользователь для запчасти ${partData.name}, пропускаем`);
                continue;
            }
            
            // Подготавливаем данные для Supabase
            const supabasePart = {
                id: partDoc.id,
                user_id: userId,
                name: partData.name || 'Без названия',
                product: partData.product || '',
                source: partData.source || 'manual',
                status: partData.status || 'needed',
                created_at: partData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            try {
                // Вставляем запчасть в Supabase
                const { error } = await supabaseClient
                    .from('parts')
                    .upsert([supabasePart], { onConflict: 'id' });
                
                if (error) {
                    console.warn(`⚠️ Ошибка миграции запчасти ${partData.name}:`, error.message);
                } else {
                    migratedCount++;
                    console.log(`✅ Мигрирована запчасть: ${partData.name}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Ошибка при миграции запчасти:`, error);
            }
        }
        
        console.log(`🔧 Миграция запчастей завершена: ${migratedCount}/${partsSnapshot.size}`);
        
    } catch (error) {
        console.error('❌ Ошибка миграции запчастей:', error);
    }
}

// Запуск миграции при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Страница миграции загружена');
    
    // Создаем интерфейс
    createMigrationUI();
});

function createMigrationUI() {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 500px;
        width: 90%;
        text-align: center;
    `;
    
    container.innerHTML = `
        <h2 style="color: #333; margin-bottom: 20px;">🔥➡️🟢 Миграция данных</h2>
        <p style="color: #666; margin-bottom: 25px;">
            Перенос данных из Firebase в Supabase
        </p>
        
        <div style="margin-bottom: 20px; text-align: left;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                🔑 Supabase Service Role Key:
            </label>
            <input type="password" id="serviceKey" 
                   placeholder="Введите service_role ключ из Supabase Dashboard"
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 15px;">
            <small style="color: #888; display: block; margin-bottom: 15px;">
                Найти: Supabase Dashboard → Settings → API → service_role
            </small>
        </div>
        
        <div id="progress" style="display: none; margin-bottom: 20px;">
            <div style="background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden;">
                <div id="progressBar" style="background: #007AFF; height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="progressText" style="margin-top: 10px; color: #666;"></div>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="startBtn" style="
                background: #007AFF;
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
            ">🚀 Начать миграцию</button>
            
            <button id="closeBtn" style="
                background: #f0f0f0;
                color: #333;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
            ">❌ Закрыть</button>
        </div>
        
        <div id="logContainer" style="
            margin-top: 25px;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            max-height: 200px;
            overflow-y: auto;
            text-align: left;
            display: none;
        ">
            <div id="logs" style="font-family: monospace; font-size: 12px;"></div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    // Обработчики событий
    document.getElementById('startBtn').addEventListener('click', async () => {
        const serviceKey = document.getElementById('serviceKey').value.trim();
        
        if (!serviceKey) {
            alert('⚠️ Введите service_role ключ!');
            return;
        }
        
        // Сохраняем ключ
        window.SUPABASE_SERVICE_KEY = serviceKey;
        
        // Показываем прогресс
        document.getElementById('progress').style.display = 'block';
        document.getElementById('logContainer').style.display = 'block';
        
        // Отключаем кнопку
        document.getElementById('startBtn').disabled = true;
        document.getElementById('startBtn').innerHTML = '⏳ Миграция...';
        
        // Запускаем миграцию
        await migrateData();
        
        // Включаем кнопку обратно
        document.getElementById('startBtn').disabled = false;
        document.getElementById('startBtn').innerHTML = '✅ Завершено';
    });
    
    document.getElementById('closeBtn').addEventListener('click', () => {
        document.body.removeChild(container);
    });
    
    // Перехватываем console.log для отображения в интерфейсе
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = function(...args) {
        originalLog.apply(console, args);
        addLog('📝', args.join(' '));
    };
    
    console.error = function(...args) {
        originalError.apply(console, args);
        addLog('❌', args.join(' '));
    };
    
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        addLog('⚠️', args.join(' '));
    };
    
    function addLog(icon, message) {
        const logsDiv = document.getElementById('logs');
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #eee;';
        logEntry.innerHTML = `<span style="margin-right: 10px;">${icon}</span> ${message}`;
        
        logsDiv.appendChild(logEntry);
        logsDiv.scrollTop = logsDiv.scrollHeight;
    }
    
    function updateProgress(percent, text) {
        document.getElementById('progressBar').style.width = percent + '%';
        document.getElementById('progressText').textContent = text;
    }
}