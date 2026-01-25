// supabase-config.js - ПРОСТАЯ И РАБОЧАЯ ВЕРСИЯ
const SUPABASE_URL = 'https://ooihrxpzbzdkrwhyizgb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lfeAkv6ZX2XTX4kSGr4kcg_D2SdKPOM';

// Инициализируем Supabase только если еще не создан
if (!window.supabaseClient) {
    try {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
                storageKey: 'iphone-trader-auth'
            },
            realtime: {
                params: {
                    eventsPerSecond: 5
                }
            }
        });
        
        console.log('Supabase клиент успешно создан');
        
    } catch (error) {
        console.error('Ошибка создания Supabase клиента:', error);
        window.supabaseClient = null;
    }
} else {
    console.log('Supabase клиент уже был создан ранее');
}

console.log('Supabase конфигурация загружена, URL:', SUPABASE_URL);