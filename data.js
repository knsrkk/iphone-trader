// Начальные данные приложения
const initialProducts = [
    {
        id: 1,
        name: "iPhone 14 Pro",
        description: "256GB, Space Black, Отличное состояние, гарантия до 2024",
        purchasePrice: 75000,
        sellingPrice: 89990,
        category: "phones",
        status: "in-stock",
        createdAt: "2024-01-15",
        soldAt: null,
        profit: 14990,
        attachments: ["чек.jpg", "гарантия.pdf"],
        photos: []
    },
    {
        id: 2,
        name: "iPhone 13",
        description: "128GB, Blue, Хорошее состояние, оригинальная коробка",
        purchasePrice: 55000,
        sellingPrice: 64990,
        category: "phones",
        status: "in-stock",
        createdAt: "2024-01-10",
        soldAt: null,
        profit: 9990,
        attachments: ["чек.jpg"],
        photos: []
    },
    {
        id: 3,
        name: "AirPods Pro 2",
        description: "Новые, гарантия, оригинальная упаковка",
        purchasePrice: 15000,
        sellingPrice: 18990,
        category: "accessories",
        status: "in-stock",
        createdAt: "2024-01-05",
        soldAt: null,
        profit: 3990,
        attachments: ["чек.jpg"],
        photos: []
    },
    {
        id: 4,
        name: "iPhone 12 Pro Max",
        description: "512GB, Pacific Blue, Идеальное состояние",
        purchasePrice: 60000,
        sellingPrice: 75000,
        category: "phones",
        status: "sold",
        createdAt: "2023-12-20",
        soldAt: "2024-01-05",
        profit: 15000,
        attachments: ["чек.jpg", "гарантия.pdf"],
        photos: []
    },
    {
        id: 5,
        name: "Дисплей iPhone 13",
        description: "Оригинальный, новый, с рамкой",
        purchasePrice: 12000,
        sellingPrice: 15990,
        category: "parts",
        status: "in-stock",
        createdAt: "2024-01-12",
        soldAt: null,
        profit: 3990,
        attachments: ["чек.jpg"],
        photos: []
    },
    {
        id: 6,
        name: "iPhone 11 Pro",
        description: "256GB, Space Gray, Хорошее состояние",
        purchasePrice: 40000,
        sellingPrice: 49990,
        category: "phones",
        status: "sold",
        createdAt: "2023-12-15",
        soldAt: "2023-12-28",
        profit: 9990,
        attachments: ["чек.jpg"],
        photos: []
    }
];

const categories = {
    phones: "Телефоны",
    accessories: "Аксессуары",
    parts: "Запчасти",
    sold: "Продано"
};

const statuses = {
    "in-stock": { text: "В наличии", class: "in-stock" },
    "sold": { text: "Продано", class: "sold" }
};

// Инициализация хранилища
let products = JSON.parse(localStorage.getItem('products')) || initialProducts;
let currentProductId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;

// Сохранение в localStorage
function saveProducts() {
    localStorage.setItem('products', JSON.stringify(products));
}

// Получение статистики
function getStats() {
    const inStockProducts = products.filter(p => p.status === 'in-stock');
    const soldProducts = products.filter(p => p.status === 'sold');
    
    const totalProfit = soldProducts.reduce((sum, p) => sum + p.profit, 0);
    const totalTurnover = soldProducts.reduce((sum, p) => sum + p.sellingPrice, 0);
    
    return {
        profit: totalProfit,
        turnover: totalTurnover,
        inStock: inStockProducts.length,
        sold: soldProducts.length
    };
}

// Получение товаров по категории
function getProductsByCategory(category) {
    if (category === 'sold') {
        return products.filter(p => p.status === 'sold');
    } else if (category === 'all') {
        return products;
    } else {
        return products.filter(p => p.category === category && p.status === 'in-stock');
    }
}

// Получение категорий с количеством товаров
function getCategoriesWithCounts() {
    const counts = {
        phones: products.filter(p => p.category === 'phones' && p.status === 'in-stock').length,
        accessories: products.filter(p => p.category === 'accessories' && p.status === 'in-stock').length,
        parts: products.filter(p => p.category === 'parts' && p.status === 'in-stock').length,
        sold: products.filter(p => p.status === 'sold').length
    };
    
    return counts;
}

// Добавление нового товара
function addProduct(productData) {
    currentProductId++;
    const profit = productData.sellingPrice - productData.purchasePrice;
    
    const newProduct = {
        id: currentProductId,
        ...productData,
        status: 'in-stock',
        createdAt: new Date().toISOString().split('T')[0],
        soldAt: null,
        profit: profit,
        attachments: [],
        photos: []
    };
    
    products.push(newProduct);
    saveProducts();
    return newProduct;
}

// Обновление товара
function updateProduct(id, updates) {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        // Пересчитываем прибыль если изменились цены
        if (updates.purchasePrice || updates.sellingPrice) {
            const purchasePrice = updates.purchasePrice || products[index].purchasePrice;
            const sellingPrice = updates.sellingPrice || products[index].sellingPrice;
            updates.profit = sellingPrice - purchasePrice;
        }
        
        products[index] = { ...products[index], ...updates };
        saveProducts();
        return products[index];
    }
    return null;
}

// Продажа товара
function sellProduct(id, actualPrice, notes = '') {
    const product = products.find(p => p.id === id);
    if (product) {
        product.status = 'sold';
        product.soldAt = new Date().toISOString().split('T')[0];
        product.actualSellingPrice = actualPrice;
        product.saleNotes = notes;
        product.profit = actualPrice - product.purchasePrice;
        saveProducts();
        return product;
    }
    return null;
}

// Добавим после функции sellProduct

// Редактирование товара с историей изменений
function updateProduct(id, updates) {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        const oldProduct = { ...products[index] };
        const changes = {};
        
        // Записываем изменения
        Object.keys(updates).forEach(key => {
            if (oldProduct[key] !== updates[key]) {
                changes[key] = {
                    old: oldProduct[key],
                    new: updates[key]
                };
            }
        });
        
        // Пересчитываем прибыль если изменились цены
        if (updates.purchasePrice || updates.sellingPrice) {
            const purchasePrice = updates.purchasePrice || oldProduct.purchasePrice;
            const sellingPrice = updates.sellingPrice || oldProduct.sellingPrice;
            updates.profit = sellingPrice - purchasePrice;
            
            if (oldProduct.purchasePrice !== purchasePrice || oldProduct.sellingPrice !== sellingPrice) {
                changes.profit = {
                    old: oldProduct.profit,
                    new: sellingPrice - purchasePrice
                };
            }
        }
        
        // Добавляем дату изменения
        updates.lastUpdated = new Date().toISOString().split('T')[0];
        
        // Сохраняем историю изменений
        if (Object.keys(changes).length > 0) {
            if (!updates.changeHistory) {
                updates.changeHistory = [];
            }
            updates.changeHistory.push({
                date: new Date().toISOString(),
                changes: changes
            });
        }
        
        // Сохраняем старую историю если есть
        if (oldProduct.changeHistory) {
            updates.changeHistory = [...oldProduct.changeHistory, ...(updates.changeHistory || [])];
        }
        
        products[index] = { ...oldProduct, ...updates };
        saveProducts();
        
        // Возвращаем обновленный товар и информацию об изменениях
        return {
            product: products[index],
            changes: Object.keys(changes).length > 0 ? changes : null
        };
    }
    return null;
}

// Получение изменений товара
function getProductChanges(id) {
    const product = getProductById(id);
    return product?.changeHistory || [];
}

// Восстановление предыдущей версии товара
function revertProductChange(id, changeIndex) {
    const product = getProductById(id);
    if (!product || !product.changeHistory || !product.changeHistory[changeIndex]) {
        return null;
    }
    
    const changes = product.changeHistory[changeIndex].changes;
    const revertedProduct = { ...product };
    
    // Отменяем изменения
    Object.keys(changes).forEach(key => {
        revertedProduct[key] = changes[key].old;
    });
    
    // Удаляем эту запись из истории
    revertedProduct.changeHistory = revertedProduct.changeHistory.filter((_, idx) => idx !== changeIndex);
    
    // Сохраняем восстановленную версию
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index] = revertedProduct;
        saveProducts();
        return revertedProduct;
    }
    
    return null;
}

// Поиск товаров
function searchProducts(query, category = null) {
    return products.filter(product => {
        const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) ||
                           product.description.toLowerCase().includes(query.toLowerCase());
        
        const matchesCategory = !category || product.category === category;
        
        return matchesQuery && matchesCategory;
    });
}

// Получение товаров по дате
function getProductsByDateRange(startDate, endDate, status = null) {
    return products.filter(product => {
        const productDate = product.status === 'sold' ? 
            new Date(product.soldAt) : 
            new Date(product.createdAt);
        
        const inDateRange = (!startDate || productDate >= new Date(startDate)) &&
                           (!endDate || productDate <= new Date(endDate));
        
        const matchesStatus = !status || product.status === status;
        
        return inDateRange && matchesStatus;
    });
}

// Экспорт данных
function exportProducts(format = 'json') {
    const data = {
        products: products,
        stats: getStats(),
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    if (format === 'json') {
        return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
        // Простая реализация CSV экспорта
        const headers = ['ID', 'Название', 'Категория', 'Статус', 'Цена покупки', 'Цена продажи', 'Прибыль', 'Дата создания'];
        const rows = products.map(p => [
            p.id,
            `"${p.name}"`,
            categories[p.category],
            statuses[p.status].text,
            p.purchasePrice,
            p.sellingPrice,
            p.profit,
            p.createdAt
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    
    return null;
}

// Импорт данных
function importProducts(data) {
    try {
        const imported = JSON.parse(data);
        
        if (imported.products && Array.isArray(imported.products)) {
            // Сбрасываем ID для предотвращения конфликтов
            const maxId = Math.max(...products.map(p => p.id), ...imported.products.map(p => p.id || 0));
            currentProductId = maxId;
            
            // Добавляем импортированные товары
            imported.products.forEach(product => {
                // Обновляем ID если товар с таким ID уже существует
                const existingIndex = products.findIndex(p => p.id === product.id);
                if (existingIndex !== -1) {
                    product.id = ++currentProductId;
                }
                products.push(product);
            });
            
            saveProducts();
            return { success: true, count: imported.products.length };
        }
    } catch (error) {
        console.error('Import error:', error);
    }
    
    return { success: false, error: 'Invalid data format' };
}

// Дублирование товара
function duplicateProduct(id) {
    const product = getProductById(id);
    if (product) {
        currentProductId++;
        const duplicated = {
            ...product,
            id: currentProductId,
            name: `${product.name} (копия)`,
            status: 'in-stock',
            createdAt: new Date().toISOString().split('T')[0],
            soldAt: null,
            changeHistory: []
        };
        
        // Удаляем информацию о продаже если она есть
        delete duplicated.actualSellingPrice;
        delete duplicated.saleNotes;
        
        products.push(duplicated);
        saveProducts();
        return duplicated;
    }
    return null;
}

// Массовое редактирование
function bulkUpdateProduct(ids, updates) {
    const results = [];
    ids.forEach(id => {
        const result = updateProduct(id, updates);
        if (result) {
            results.push(result);
        }
    });
    return results;
}

// Получение статистики по изменениям
function getEditStats() {
    const allChanges = products.flatMap(p => p.changeHistory || []);
    
    return {
        totalEdits: allChanges.length,
        recentEdits: allChanges.filter(change => {
            const changeDate = new Date(change.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return changeDate > weekAgo;
        }).length,
        mostEditedProduct: products.reduce((most, product) => {
            const edits = (product.changeHistory || []).length;
            return edits > most.edits ? { id: product.id, name: product.name, edits } : most;
        }, { id: null, name: '', edits: 0 })
    };
}

// Удаление товара
function deleteProduct(id) {
    products = products.filter(p => p.id !== id);
    saveProducts();
}

// Получение товара по ID
function getProductById(id) {
    return products.find(p => p.id === id);
}

// Получение последних товаров
function getRecentProducts(limit = 3) {
    return products
        .filter(p => p.status === 'in-stock')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
}
// Добавим в конец файла

// Получение изменений за период
function getRecentChanges(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return products.reduce((acc, product) => {
        const recentChanges = (product.changeHistory || [])
            .filter(change => new Date(change.date) > cutoffDate)
            .map(change => ({
                productId: product.id,
                productName: product.name,
                ...change
            }));
        
        return [...acc, ...recentChanges];
    }, []);
}

// Статистика по активности редактирования
function getEditingActivity() {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const changesByDay = {};
    const changesByUser = {}; // можно добавить систему пользователей позже
    
    products.forEach(product => {
        (product.changeHistory || []).forEach(change => {
            const changeDate = new Date(change.date);
            if (changeDate > lastWeek) {
                const dateKey = changeDate.toISOString().split('T')[0];
                changesByDay[dateKey] = (changesByDay[dateKey] || 0) + 1;
            }
        });
    });
    
    return {
        changesByDay,
        totalChanges: Object.values(changesByDay).reduce((sum, count) => sum + count, 0)
    };
}

// Экспорт истории изменений
function exportChangeHistory(productId = null, format = 'json') {
    let historyData;
    
    if (productId) {
        const product = getProductById(productId);
        historyData = product?.changeHistory || [];
    } else {
        historyData = products.flatMap(product => 
            (product.changeHistory || []).map(change => ({
                productId: product.id,
                productName: product.name,
                ...change
            }))
        );
    }
    
    if (format === 'json') {
        return JSON.stringify(historyData, null, 2);
    }
    
    return null;
}

// Восстановление товара из архива (если реализуем архив)
function restoreFromArchive(productData) {
    // Проверяем, есть ли уже товар с таким ID
    const existingIndex = products.findIndex(p => p.id === productData.id);
    
    if (existingIndex !== -1) {
        // Обновляем существующий товар
        products[existingIndex] = productData;
    } else {
        // Добавляем новый товар
        products.push(productData);
    }
    
    saveProducts();
    return productData;
}