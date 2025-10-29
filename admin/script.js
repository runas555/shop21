// Вспомогательная функция для выполнения аутентифицированных запросов
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('adminToken');
    const role = localStorage.getItem('userRole');
    const headers = {
        'X-Admin-Token': token,
        'X-User-Role': role,
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        showToast('Сессия истекла или недействительна. Пожалуйста, войдите снова.', 'error');
        logout();
        throw new Error('Unauthorized');
    } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
        showToast(`Ошибка: ${errorData.error || errorData.message || 'Неизвестная ошибка'}`, 'error');
        throw new Error(errorData.error || errorData.message || 'Network response was not ok');
    }

    return response;
}

function checkAuth() {
    const loginContainer = document.getElementById('login-container');
    const adminContent = document.getElementById('admin-content');
    const adminToken = localStorage.getItem('adminToken');
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    
    // Проверка автоматического входа для демо-режима
    const urlParams = new URLSearchParams(window.location.search);
    const autoLogin = urlParams.get('autoLogin');
    const role = urlParams.get('role');
    
    if (autoLogin === 'true' && role === 'demo' && authToken) {
        // Автоматический вход для демо-режима
        localStorage.setItem('adminToken', authToken);
        localStorage.setItem('userRole', 'demo');
        loginContainer.classList.add('hidden');
        adminContent.classList.remove('hidden');
        setupDemoRestrictions();
    } else if (adminToken) {
        loginContainer.classList.add('hidden');
        adminContent.classList.remove('hidden');

        // Адаптация интерфейса под роль (мобильная навигация)
        const productsTab = document.querySelector('.nav-item[onclick="openTab(\'products\')"]');
        const reportsTab = document.querySelector('.nav-item[onclick="openTab(\'reports\')"]');
        const settingsTab = document.querySelector('.nav-item[onclick="openTab(\'settings\')"]');
        
        // Адаптация интерфейса под роль (десктопный сайдбар)
        const sidebarProductsTab = document.querySelector('.sidebar-nav-item[onclick="openTab(\'products\')"]');
        const sidebarReportsTab = document.querySelector('.sidebar-nav-item[onclick="openTab(\'reports\')"]');
        const sidebarSettingsTab = document.querySelector('.sidebar-nav-item[onclick="openTab(\'settings\')"]');

        if (userRole === 'seller') {
            // Скрытие в мобильной навигации
            if (productsTab) productsTab.style.display = 'none';
            if (reportsTab) reportsTab.style.display = 'none';
            if (settingsTab) settingsTab.style.display = 'none';
            
            // Скрытие в десктопном сайдбаре
            if (sidebarProductsTab) sidebarProductsTab.style.display = 'none';
            if (sidebarReportsTab) sidebarReportsTab.style.display = 'none';
            if (sidebarSettingsTab) sidebarSettingsTab.style.display = 'none';
            
            openTab('orders'); // Роль "Продавец" по умолчанию видит заказы
        } else if (userRole === 'demo') {
            // Demo видит все вкладки, но с ограничениями
            if (productsTab) productsTab.style.display = 'block';
            if (reportsTab) reportsTab.style.display = 'block';
            if (settingsTab) settingsTab.style.display = 'block';
            
            // Показ в десктопном сайдбаре
            if (sidebarProductsTab) sidebarProductsTab.style.display = 'flex';
            if (sidebarReportsTab) sidebarReportsTab.style.display = 'flex';
            if (sidebarSettingsTab) sidebarSettingsTab.style.display = 'flex';
            
            openTab('products'); // Demo по умолчанию видит товары
        } else { // admin
            // Показ в мобильной навигации
            if (productsTab) productsTab.style.display = 'block';
            if (reportsTab) reportsTab.style.display = 'block';
            if (settingsTab) settingsTab.style.display = 'block';
            
            // Показ в десктопном сайдбаре
            if (sidebarProductsTab) sidebarProductsTab.style.display = 'flex';
            if (sidebarReportsTab) sidebarReportsTab.style.display = 'flex';
            if (sidebarSettingsTab) sidebarSettingsTab.style.display = 'flex';
            
            openTab('products'); // Админ по умолчанию видит товары
        }
    } else {
        loginContainer.classList.remove('hidden');
        adminContent.classList.add('hidden');
    }
    document.body.style.display = ''; // Показываем body после определения состояния
}

function getTariffDisplayName(tariffKey, orderDateStr) {
    if (!tariffKey) return 'не указан';

    const orderDate = new Date(orderDateStr);
    const isBefore5PM = orderDate.getHours() < 17;

    switch (tariffKey) {
        case 'fast':
            const deliveryDay = isBefore5PM ? 'Сегодня' : 'Завтра';
            return `Быстрая (${deliveryDay})`;
        case 'standard':
            return 'Стандартная (1-3 дня)';
        default:
            return tariffKey;
    }
}

function getStatusColorClass(status) {
    switch (status) {
        case 'Новый':
            return 'bg-blue-100 text-blue-800';
        case 'В обработке':
            return 'bg-yellow-100 text-yellow-800';
        case 'Ожидает подтверждения':
            return 'bg-purple-100 text-purple-800';
        case 'Сборка':
        case 'Собран':
            return 'bg-orange-100 text-orange-800';
        case 'Поиск курьера':
        case 'Ожидание курьера':
            return 'bg-indigo-100 text-indigo-800';
        case 'Вручен курьеру':
            return 'bg-cyan-100 text-cyan-800';
        case 'Доставлен':
        case 'Выдан':
            return 'bg-green-100 text-green-800';
        case 'Отменен':
            return 'bg-red-100 text-red-800';
        case 'Готов к выдаче':
            return 'bg-emerald-100 text-emerald-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

async function handleLogin() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch('/api/admin?action=login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('userRole', data.role); // Сохраняем роль
            loginError.classList.add('hidden');
            checkAuth();
            checkAppVersionAndReload(); // Вызываем проверку версии после успешной авторизации
        } else {
            loginError.classList.remove('hidden');
            loginError.textContent = data.error || 'Неверное имя пользователя или пароль.';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.classList.remove('hidden');
        loginError.textContent = 'Ошибка входа. Попробуйте еще раз.';
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('userRole'); // Удаляем роль при выходе
    checkAuth();
    showToast('Вы вышли из системы', 'info');
}

function openTab(tabName) {
    // Скрываем все панели вкладок
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    // Убираем активный класс со всех кнопок навигации (мобильных)
    document.querySelectorAll('.nav-item').forEach(button => {
        button.classList.remove('active');
    });

    // Убираем активный класс со всех кнопок сайдбара (десктопных)
    document.querySelectorAll('.sidebar-nav-item').forEach(button => {
        button.classList.remove('active');
    });

    // Показываем нужную панель
    document.getElementById(tabName).classList.add('active');

    // Устанавливаем активный класс для нажатой кнопки (мобильной)
    const activeMobileButton = document.querySelector(`.nav-item[onclick="openTab('${tabName}')"]`);
    if (activeMobileButton) {
        activeMobileButton.classList.add('active');
    }

    // Устанавливаем активный класс для соответствующей кнопки сайдбара (десктопной)
    const activeSidebarButton = document.querySelector(`.sidebar-nav-item[onclick="openTab('${tabName}')"]`);
    if (activeSidebarButton) {
        activeSidebarButton.classList.add('active');
    }


    if (tabName === 'orders') {
        loadOrders();
    } else if (tabName === 'products') {
        loadProducts();
    } else if (tabName === 'reports') {
        loadReportsView();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

let allOrders = []; // Кэш для всех заказов
let openOrders = new Set(); // Set для хранения ID открытых заказов

let storeSettings = {}; // Кэш для настроек магазина

async function loadOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    ordersListContainer.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

    try {
        // Загружаем заказы и настройки
        const response = await authenticatedFetch('/api/admin?action=getOrders');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        allOrders = data.orders.reverse(); // Показываем сначала новые
        storeSettings = data.settings; // Сохраняем настройки
        
        renderOrders();

    } catch (error) {
        console.error('Failed to load orders:', error);
        ordersListContainer.innerHTML = '<p class="text-center text-red-500 py-10">Не удалось загрузить заказы.</p>';
    }
}

function renderOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    const activeStatusButton = document.querySelector('#status-filter-buttons .status-filter-btn.active');
    const selectedStatus = activeStatusButton ? activeStatusButton.dataset.status : 'all';

    // Получаем активную вкладку доставки
    let activeDeliveryTab = document.querySelector('#delivery-tabs .delivery-tab-btn.border-blue-500');
    // Если активная вкладка не найдена, используем первую доступную
    let selectedDelivery = activeDeliveryTab ? activeDeliveryTab.dataset.delivery : 'pickup';
    

    let filteredOrders = allOrders.filter(order => order.deliveryMethod === selectedDelivery);

    if (selectedStatus !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === selectedStatus);
    }

    if (filteredOrders.length === 0) {
        ordersListContainer.innerHTML = '<p class="text-center text-gray-500 py-10">Нет заказов с таким статусом.</p>';
        return;
    }

    let ordersHtml = '';
    const deliveryStatuses = ['Новый', 'В обработке', 'Ожидает подтверждения', 'Сборка', 'Поиск курьера', 'Ожидание курьера', 'Вручен курьеру', 'Доставлен', 'Отменен'];
    const pickupStatuses = ['Новый', 'В обработке', 'Собран', 'Готов к выдаче', 'Выдан', 'Отменен'];
    const sellerAllowedStatuses = ['Подтверждение наличия', 'Сборка', 'Готов к выдаче', 'Передан курьеру'];

    const userRole = localStorage.getItem('userRole');
    
    filteredOrders.forEach(order => {
        let relevantStatuses = order.deliveryMethod === 'pickup' ? pickupStatuses : deliveryStatuses;
        // Если пользователь - продавец, показываем только разрешенные статусы
        if (userRole === 'seller') {
            relevantStatuses = sellerAllowedStatuses;
        }
        // Если пользователь - demo, показываем все статусы, но отключаем изменение
        if (userRole === 'demo') {
            relevantStatuses = order.deliveryMethod === 'pickup' ? pickupStatuses : deliveryStatuses;
        }
        const statusOptions = relevantStatuses.map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('');
        const deliveryInfoHtml = order.deliveryMethod === 'pickup'
            ? `<p><strong>Способ получения:</strong> Самовывоз</p>`
            : `
                <p><strong>Способ получения:</strong> Доставка</p>
                <p><strong>Адрес:</strong> ${order.deliveryAddress}</p>
                <p><strong>Тариф:</strong> ${getTariffDisplayName(order.deliveryTariff, order.date)}</p>
                <p><strong>Стоимость доставки:</strong> ${order.deliveryCost} руб.</p>
            `;

        const uncheckedItems = order.items.filter(item => item.availabilityStatus === 'Не проверено');
        const isFullyChecked = uncheckedItems.length === 0;

        // --- Генерация ссылки и сообщения для WhatsApp ---
        let whatsappLink = '#';
        if (isFullyChecked) {
            // Генерируем ссылку с сообщением только если статус "В обработке"
            if (order.status === 'В обработке') {
                const outOfStockItems = order.items.filter(item => item.availabilityStatus === 'Нет в наличии');
                let whatsappMessage = '';

                if (order.deliveryMethod === 'pickup') {
                    if (outOfStockItems.length === 0) {
                        whatsappMessage = `Здравствуйте, ${order.customerName}! Ваш заказ №${order.id} полностью собран и готов к выдаче. Вы можете забрать его по адресу: ${storeSettings.storeAddress}. Часы работы: ${storeSettings.storeHours}. Пожалуйста, сообщите нам, когда планируете приехать.`;
                    } else {
                        const outOfStockNames = outOfStockItems.map(item => `- ${item.productName}`).join('\n');
                        whatsappMessage = `Здравствуйте, ${order.customerName}! Мы начали собирать ваш заказ №${order.id} для самовывоза и обнаружили, что следующий товар(ы) закончился:\n\n${outOfStockNames}\n\nВсе остальные товары уже отложены для вас. Мы можем предложить замену или подготовить к выдаче только имеющиеся позиции. Как вам будет удобнее?`;
                    }
                } else { // delivery
                    if (outOfStockItems.length === 0) {
                        whatsappMessage = `Здравствуйте, ${order.customerName}! Отличные новости по вашему заказу №${order.id}. Все товары в наличии, мы аккуратно упаковали их для вас. Заказ полностью готов к отправке. В ближайшее время мы свяжемся с вами для согласования деталей доставки.`;
                    } else {
                        const outOfStockNames = outOfStockItems.map(item => `- ${item.productName}`).join('\n');
                        whatsappMessage = `Здравствуйте, ${order.customerName}! Мы начали собирать ваш заказ №${order.id} и обнаружили, что некоторые позиции пользуются огромным спросом. К сожалению, следующий товар(ы) закончился на складе прямо перед вашим заказом (остатки на сайте обновляются с небольшой задержкой, приносим извинения за эту неточность):\n\n${outOfStockNames}\n\nВсе остальные товары из вашего заказа в наличии и уже отложены для вас. Мы можем предложить вам отличную замену или отправить заказ без этих позиций. Подскажите, пожалуйста, как для вас будет удобнее?`;
                    }
                }
                whatsappLink = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;
            } else {
                // Для всех остальных статусов - пустой чат
                whatsappLink = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}`;
            }
        }

        ordersHtml += `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-card-header">
                    <div class="flex justify-between items-center w-full">
                        <div class="order-card-id">Заказ #${order.id}</div>
                        <div class="text-sm text-gray-500">${order.date}</div>
                    </div>
                    <div class="order-card-status ${getStatusColorClass(order.status)}">${order.status}</div>
                </div>
                <div class="order-card-body">
                    <div class="order-card-row">
                        <div class="order-card-label">Клиент:</div>
                        <div class="order-card-value">${order.customerName}</div>
                    </div>
                    <div class="order-card-row">
                        <div class="order-card-label">Сумма:</div>
                        <div class="order-card-value" style="font-size: 1.125rem; font-weight: 700; color: #1e293b;">${order.totalAmount} руб.</div>
                    </div>
                    <div class="order-card-row">
                        <div class="order-card-label">Способ:</div>
                        <div class="order-card-value">${order.deliveryMethod === 'pickup' ? 'Самовывоз' : 'Доставка'}</div>
                    </div>
                    <div class="order-card-actions">
                        ${!isFullyChecked && userRole !== 'seller' ? `
                            <button class="order-card-btn" style="background-color: #ef4444; border-color: #dc2626; color: white;" onclick="openOrderModal('${order.id}')">
                                <i class="fas fa-exclamation-triangle mr-1"></i>Подтвердить наличие
                            </button>
                        ` : `
                            <button class="order-card-btn" onclick="openOrderModal('${order.id}')">
                                <i class="fas fa-eye mr-1"></i>Подробнее
                            </button>
                        `}
                        ${userRole === 'seller' ? `
                            ${order.status === 'В обработке' ? `
                                <button class="order-card-btn primary" onclick="updateOrderStatus('${order.id}', 'Ожидает подтверждения')">
                                    Завершить сборку
                                </button>
                            ` : ''}
                        ` : userRole === 'demo' ? `
                            <select class="order-card-btn" onchange="showDemoWarning()" style="text-align: center; opacity: 0.6; cursor: not-allowed;" disabled>
                                ${statusOptions}
                            </select>
                            <a href="#" onclick="showDemoWarning()" class="order-card-btn" style="opacity: 0.6; cursor: not-allowed;">
                                <i class="fab fa-whatsapp mr-1"></i>Связаться
                            </a>
                        ` : `
                            <select class="order-card-btn" onchange="updateOrderStatus('${order.id}', this.value)" style="text-align: center; ${!isFullyChecked ? 'opacity: 0.6; cursor: not-allowed;' : ''}" ${!isFullyChecked ? 'disabled' : ''}>
                                ${statusOptions}
                            </select>
                            <a ${isFullyChecked ? `href="${whatsappLink}" target="_blank" onclick="handleContactClick('${order.id}')"` : 'href="#" onclick="event.preventDefault();" title="Сначала проверьте наличие всех товаров"'}
                               class="order-card-btn ${isFullyChecked ? 'primary' : ''}" style="${!isFullyChecked ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                                <i class="fab fa-whatsapp mr-1"></i>Связаться
                            </a>
                        `}
                    </div>
                </div>
            </div>
        `;
    });
    ordersListContainer.innerHTML = ordersHtml;
}

function openOrderModal(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const userRole = localStorage.getItem('userRole');
    const modal = document.getElementById('order-modal');
    const title = document.getElementById('order-modal-title');
    const content = document.getElementById('order-modal-content');

    title.textContent = `Заказ #${order.id}`;

    const deliveryStatuses = ['Новый', 'В обработке', 'Ожидает подтверждения', 'Сборка', 'Поиск курьера', 'Ожидание курьера', 'Вручен курьеру', 'Доставлен', 'Отменен'];
    const pickupStatuses = ['Новый', 'В обработке', 'Собран', 'Готов к выдаче', 'Выдан', 'Отменен'];
    const relevantStatuses = order.deliveryMethod === 'pickup' ? pickupStatuses : deliveryStatuses;
    const statusOptions = relevantStatuses.map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('');

    const deliveryInfoHtml = order.deliveryMethod === 'pickup'
        ? `<p><strong>Способ получения:</strong> Самовывоз</p>`
        : `
            <p><strong>Способ получения:</strong> Доставка</p>
            <p><strong>Адрес:</strong> ${order.deliveryAddress}</p>
            <p><strong>Тариф:</strong> ${getTariffDisplayName(order.deliveryTariff, order.date)}</p>
            <div class="flex items-center justify-between">
                <p><strong>Стоимость доставки:</strong></p>
                <div class="flex items-center space-x-2">
                    <input type="number" id="delivery-cost-input" value="${order.deliveryCost}" class="w-20 px-2 py-1 border border-gray-300 rounded text-sm" min="0" step="1">
                    <span>руб.</span>
                    <button onclick="updateDeliveryCost('${order.id}')" class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition">
                        <i class="fas fa-save"></i>
                    </button>
                </div>
            </div>
        `;

    const isFullyChecked = order.items.every(item => item.availabilityStatus !== 'Не проверено');
    let whatsappLink = '#';
    if (isFullyChecked) {
        if (order.status === 'В обработке') {
            const outOfStockItems = order.items.filter(item => item.availabilityStatus === 'Нет в наличии');
            let whatsappMessage = '';
            if (order.deliveryMethod === 'pickup') {
                if (outOfStockItems.length === 0) {
                    whatsappMessage = `Здравствуйте, ${order.customerName}! Ваш заказ №${order.id} полностью собран и готов к выдаче. Вы можете забрать его по адресу: ${storeSettings.storeAddress}. Часы работы: ${storeSettings.storeHours}. Пожалуйста, сообщите нам, когда планируете приехать.`;
                } else {
                    const outOfStockNames = outOfStockItems.map(item => `- ${item.productName}`).join('\n');
                    whatsappMessage = `Здравствуйте, ${order.customerName}! Мы начали собирать ваш заказ №${order.id} для самовывоза и обнаружили, что следующий товар(ы) закончился:\n\n${outOfStockNames}\n\nВсе остальные товары уже отложены для вас. Мы можем предложить замену или подготовить к выдаче только имеющиеся позиции. Как вам будет удобнее?`;
                }
            } else { // delivery
                if (outOfStockItems.length === 0) {
                    whatsappMessage = `Здравствуйте, ${order.customerName}! Отличные новости по вашему заказу №${order.id}. Все товары в наличии, мы аккуратно упаковали их для вас. Заказ полностью готов к отправке. В ближайшее время мы свяжемся с вами для согласования деталей доставки.`;
                } else {
                    const outOfStockNames = outOfStockItems.map(item => `- ${item.productName}`).join('\n');
                    whatsappMessage = `Здравствуйте, ${order.customerName}! Мы начали собирать ваш заказ №${order.id} и обнаружили, что некоторые позиции пользуются огромным спросом. К сожалению, следующий товар(ы) закончился на складе прямо перед вашим заказом (остатки на сайте обновляются с небольшой задержкой, приносим извинения за эту неточность):\n\n${outOfStockNames}\n\nВсе остальные товары из вашего заказа в наличии и уже отложены для вас. Мы можем предложить вам отличную замену или отправить заказ без этих позиций. Подскажите, пожалуйста, как для вас будет удобнее?`;
                }
            }
            whatsappLink = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;
        } else {
            whatsappLink = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}`;
        }
    }

    content.innerHTML = `
        <div class="text-sm text-gray-600 space-y-1">
            <p><strong>Клиент:</strong> ${order.customerName}</p>
            <p><strong>Телефон:</strong> ${order.customerPhone}</p>
            <p><strong>Сумма товаров:</strong> <span class="font-bold">${Math.max(0, Math.floor(order.totalAmount - (order.deliveryCost || 0)))} руб.</span></p>
            <div class="mt-2 pt-2 border-t">
                ${deliveryInfoHtml}
            </div>
            <p><strong>Итого к оплате:</strong> <span id="total-amount-display" class="font-bold text-lg">${order.totalAmount} руб.</span></p>
                <div class="flex items-center justify-between mt-2">
                    <div class="flex items-center">
                        <strong class="mr-2">Статус:</strong>
                        <select class="status-select border border-gray-300 rounded-md p-1 text-xs" onchange="updateOrderStatus('${order.id}', this.value)">
                            ${statusOptions}
                        </select>
                    </div>
                    ${userRole === 'demo' ? `
                    <a href="#" onclick="showDemoWarning()" class="bg-gray-400 cursor-not-allowed text-white text-xs font-bold py-1 px-3 rounded-full transition">
                        <i class="fab fa-whatsapp mr-1"></i>Связаться
                    </a>
                    ` : userRole !== 'seller' ? `
                    <a ${isFullyChecked ? `href="${whatsappLink}" target="_blank" onclick="handleContactClick('${order.id}')"` : 'href="#" onclick="event.preventDefault();" title="Сначала проверьте наличие всех товаров"'}
                       class="${isFullyChecked ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white text-xs font-bold py-1 px-3 rounded-full transition">
                        <i class="fab fa-whatsapp mr-1"></i>Связаться
                    </a>
                    ` : ''}
                </div>
        </div>
        <div class="mt-3 pt-3 border-t">
            <h4 class="font-semibold text-sm mb-2">Товары:</h4>
            <ul class="space-y-2">
                ${order.items.map(item => {
                    let itemBgColor = 'bg-gray-100';
                    let statusHtml = '';

                    // Логика отображения статуса товара в зависимости от статуса заказа
                    if (order.status === 'Новый') {
                        // Для новых заказов показываем кнопки подтверждения
                        if (item.availabilityStatus === 'В наличии') {
                            itemBgColor = 'bg-green-100';
                            statusHtml = `<p class="font-bold text-center text-green-700 py-2">✓ В наличии</p>`;
                        } else if (item.availabilityStatus === 'Нет в наличии') {
                            itemBgColor = 'bg-red-100';
                            statusHtml = `<p class="font-bold text-center text-red-700 py-2">✗ Нет в наличии</p>`;
                        } else { // 'Не проверено'
                            statusHtml = `
                                <div class="flex space-x-1">
                                    <button onclick="${userRole === 'demo' ? 'showDemoWarning()' : `updateItemStatus('${order.id}', '${item.productId}', 'В наличии', this)`}"
                                            class="flex-1 ${userRole === 'demo' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white font-bold py-1 px-2 text-xs rounded-lg transition shadow-md">
                                        ✓ Есть
                                    </button>
                                    <button onclick="${userRole === 'demo' ? 'showDemoWarning()' : `updateItemStatus('${order.id}', '${item.productId}', 'Мало', this)`}"
                                            class="flex-1 ${userRole === 'demo' ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'} text-white font-bold py-1 px-2 text-xs rounded-lg transition shadow-md">
                                        ⚠️ Мало
                                    </button>
                                    <button onclick="${userRole === 'demo' ? 'showDemoWarning()' : `updateItemStatus('${order.id}', '${item.productId}', 'Нет в наличии', this)`}"
                                            class="flex-1 ${userRole === 'demo' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'} text-white font-bold py-1 px-2 text-xs rounded-lg transition shadow-md">
                                        ✗ Нет
                                    </button>
                                </div>
                            `;
                        }
                    } else {
                        // Для остальных статусов просто показываем текст
                        if (item.availabilityStatus === 'В наличии') {
                            itemBgColor = 'bg-green-100';
                            statusHtml = `<p class="font-bold text-center text-green-700 py-2">✓ В наличии</p>`;
                        } else if (item.availabilityStatus === 'Нет в наличии') {
                            itemBgColor = 'bg-red-100';
                            statusHtml = `<p class="font-bold text-center text-red-700 py-2">✗ Нет в наличии</p>`;
                        } else { // 'Не проверено'
                            itemBgColor = 'bg-gray-100';
                            statusHtml = `<p class="font-bold text-center text-gray-700 py-2">${item.availabilityStatus}</p>`;
                        }
                    }

                    return `
                        <li class="p-3 rounded-lg ${itemBgColor} transition-colors duration-300">
                            <p class="font-semibold text-gray-800 mb-2 text-center">${item.productName} - ${item.quantity} шт.</p>
                            ${statusHtml}
                        </li>
                    `;
                }).join('')}
            </ul>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Блокируем скролл основной страницы
}

function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Восстанавливаем скролл
}

function handleContactClick(orderId) {
    // Просто открываем WhatsApp, а статус меняем на "Ожидает подтверждения"
    updateOrderStatus(orderId, 'Ожидает подтверждения');
}

let currentProductsPage = 1;

async function loadProducts(page = 1, search = '') {
    currentProductsPage = page;
    const productsContainer = document.getElementById('products');
    const searchTerm = document.getElementById('product-search') ? document.getElementById('product-search').value : search;
    const userRole = localStorage.getItem('userRole');

    // При первой загрузке или поиске создаем всю структуру
    if (!document.getElementById('product-list')) {
        productsContainer.innerHTML = `
            <div class="flex items-center mb-4">
                <div class="relative flex-grow mr-2">
                    <input type="text" id="product-search" placeholder="Поиск товаров..." value="${searchTerm}" class="w-full py-2 px-4 rounded-full text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition" onclick="searchProducts()"><i class="fas fa-search"></i></button>
                <button class="ml-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full transition" onclick="startBarcodeScan()"><i class="fas fa-barcode"></i></button>
            </div>
            <div id="product-list" class="space-y-3"></div>
            <div id="pagination-container" class="flex justify-center items-center space-x-2 py-6"></div>
        `;
        document.getElementById('product-search').addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchProducts();
            }
        });
    }

    const productListContainer = document.getElementById('product-list');
    const paginationContainer = document.getElementById('pagination-container');
    productListContainer.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';
    paginationContainer.innerHTML = '';

    try {
        const response = await authenticatedFetch(`/api/admin?action=getProducts&page=${page}&limit=10&search=${encodeURIComponent(searchTerm)}&_=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const { products, totalPages } = await response.json();

        productListContainer.innerHTML = ''; // Очищаем список перед добавлением новых товаров

        if (products.length === 0) {
            productListContainer.innerHTML = '<p class="text-center text-gray-500 py-10">Товары не найдены.</p>';
            return;
        }

        products.forEach(product => {
            const productCard = document.createElement('div');
            // Адаптивный класс для мобильных и десктопных устройств
            productCard.className = 'bg-white shadow rounded-lg p-3 flex items-center cursor-pointer hover:bg-gray-50 transition lg:hover:shadow-md lg:hover:scale-[1.02]';
            productCard.onclick = () => navigateToEditPage(product.id);
            productCard.innerHTML = `
                <img src="${product.imageUrl || 'https://via.placeholder.com/150?text=No+Image'}" alt="${product.name}" class="w-16 h-16 lg:w-20 lg:h-20 object-cover rounded-md mr-4">
                <div class="flex-grow">
                    <h3 class="font-semibold text-gray-800 lg:text-lg">${product.name}</h3>
                    <p class="text-sm text-gray-600 lg:text-base">${product.price} руб. - ${product.quantity}</p>
                    <p class="text-xs text-gray-400 lg:text-sm">${product.category}</p>
                </div>
                <!-- Кнопка редактирования удалена, так как клик по товару уже открывает редактирование -->
            `;
            productListContainer.appendChild(productCard);
        });

        renderPagination(totalPages, page, searchTerm);

    } catch (error) {
        console.error('Failed to load products:', error);
        productListContainer.innerHTML = '<p class="text-center text-red-500 py-10">Не удалось загрузить товары.</p>';
    }
}

function renderPagination(totalPages, currentPage, search) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';
    // Добавляем классы для адаптивности на мобильных устройствах
    paginationContainer.className = 'flex justify-center items-center flex-wrap gap-2 py-6';

    if (totalPages <= 1) return;

    const createButton = (text, page, enabled = true, active = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = !enabled;
        // Стили для кнопок пагинации
        button.className = `px-3 py-2 rounded-md text-sm font-medium transition shadow-sm ${
            active 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
        } ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`;
        if (enabled) {
            button.onclick = () => loadProducts(page, search);
        }
        return button;
    };

    // Кнопка "Назад"
    paginationContainer.appendChild(createButton('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage > 1));

    // Кнопки страниц
    for (let i = 1; i <= totalPages; i++) {
        // Логика для отображения ограниченного количества страниц, если их много
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationContainer.appendChild(createButton(i, i, true, i === currentPage));
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'px-4 py-2 text-gray-500';
            paginationContainer.appendChild(dots);
        }
    }

    // Кнопка "Вперед"
    paginationContainer.appendChild(createButton('<i class="fas fa-chevron-right"></i>', currentPage + 1, currentPage < totalPages));
}

function searchProducts() {
    const searchTerm = document.getElementById('product-search').value;
    loadProducts(1, searchTerm);
}

function navigateToEditPage(productId) {
    window.location.href = `/admin/edit.html?id=${productId}`;
}

function navigateToCreatePage() {
    window.location.href = '/admin/edit.html';
}

async function deleteProduct(productId) {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        await authenticatedFetch(`/api/admin?action=deleteProduct&productId=${productId}`, {
            method: 'POST'
        });
        loadProducts(currentProductsPage); // Обновляем ТЕКУЩУЮ страницу товаров
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await authenticatedFetch(`/api/admin?action=updateOrderStatus&orderId=${orderId}&status=${encodeURIComponent(status)}`, {
            method: 'POST'
        });
        // authenticatedFetch уже обрабатывает !response.ok и выводит тост
        showToast(`Статус заказа #${orderId} обновлен на "${status}"`, 'success');
        
        // Обновляем заказ в локальном кэше
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
        }

        // Если модальное окно открыто, обновляем его, иначе обновляем список
        const modal = document.getElementById('order-modal');
        if (!modal.classList.contains('hidden')) {
            openOrderModal(orderId);
        } else {
            renderOrders();
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        // showToast уже выведен в authenticatedFetch
    }
}

async function updateItemStatus(orderId, productId, newStatus, buttonElement) {
    const buttonContainer = buttonElement.parentElement;
    const originalButtons = buttonContainer.innerHTML;
    buttonContainer.innerHTML = `<div class="flex justify-center items-center w-full py-2"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>`;

    try {
        const url = `/api/admin?action=updateItemStatus&orderId=${orderId}&productId=${productId}&status=${encodeURIComponent(newStatus)}`;

        await authenticatedFetch(url, {
            method: 'POST'
        });

        // Обновляем статус в локальном кэше allOrders
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            const item = order.items.find(i => i.productId === productId);
            if (item) {
                item.availabilityStatus = (newStatus === 'Мало') ? 'В наличии' : newStatus;
            }

            // Проверяем, все ли товары в заказе теперь проверены
            const allItemsChecked = order.items.every(i => i.availabilityStatus !== 'Не проверено');
            if (allItemsChecked && order.status === 'Новый') {
                // Автоматически меняем статус заказа на "В обработке"
                await updateOrderStatus(orderId, 'В обработке');
                // После обновления статуса заказа, нужно обновить и модальное окно
                openOrderModal(orderId);
                return;
            }
        }

        // Если модальное окно открыто, обновляем его, иначе обновляем список
        const modal = document.getElementById('order-modal');
        if (!modal.classList.contains('hidden')) {
            openOrderModal(orderId);
        } else {
            renderOrders();
        }

    } catch (error) {
        console.error('Error updating item status:', error);
        buttonContainer.innerHTML = originalButtons; // Возвращаем кнопки в случае ошибки
        showToast('Ошибка обновления', 'error');
    }
}

let selectedReportStatus = null;
let scannedProductId = null;

function loadReportsView() {
    scannedProductId = null;
    selectedReportStatus = null;
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <h2 class="text-xl font-semibold mb-4">Отчеты</h2>
            <div class="space-y-2">
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showQuickReport()">
                    <i class="fas fa-bolt mr-2"></i>Быстрый отчет по остаткам
                </button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showBarcodeStatusReport()">
                    <i class="fas fa-barcode mr-2"></i>Отчет по сканеру
                </button>
            </div>
        </div>
    `;
}

function showBarcodeStatusReport() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="loadReportsView()"><i class="fas fa-arrow-left mr-2"></i>Назад к отчетам</button>
            <h2 class="text-xl font-semibold mb-4">1. Выберите статус</h2>
            <div class="space-y-2">
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="startBarcodeScanForReport(0)">Закончился</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="startBarcodeScanForReport(5)">Мало</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="startBarcodeScanForReport(10)">Много</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showCustomQuantityForBarcodeReport()">Свое количество</button>
            </div>
        </div>
    `;
}

function showCustomQuantityForBarcodeReport() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="showBarcodeStatusReport()"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">Укажите количество</h2>
            <div class="flex items-center space-x-2 mb-4">
                <input type="number" id="barcode-custom-quantity" placeholder="Введите количество" class="flex-grow p-2 border rounded">
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" onclick="startBarcodeScanForReport(document.getElementById('barcode-custom-quantity').value)">Применить</button>
            </div>
        </div>
    `;
}

async function showProductConfirmation(productId, status) {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="showBarcodeStatusReport()"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">2. Выберите товар</h2>
            <div class="flex justify-between items-center mb-4">
                <div class="relative flex-grow">
                    <input type="text" id="report-product-search" placeholder="Поиск товаров..." class="w-full py-2 px-4 rounded-full text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button class="ml-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition" onclick="searchReportProductsForBarcode(${status}, '${productId}')"><i class="fas fa-search"></i></button>
            </div>
            <div id="report-product-list" class="space-y-3"></div>
        </div>
    `;
    document.getElementById('report-product-search').value = productId;
    await searchReportProductsForBarcode(status, productId);
}

async function searchReportProductsForBarcode(status, productId) {
    const searchTerm = document.getElementById('report-product-search').value;
    const productListContainer = document.getElementById('report-product-list');
    productListContainer.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

    try {
        const response = await authenticatedFetch(`/api/admin?action=getProducts&search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const { products } = await response.json();

        if (products.length === 0) {
            productListContainer.innerHTML = '<p class="text-center text-gray-500 py-10">Товары не найдены.</p>';
            return;
        }

        let productsHtml = '';
            products.forEach(product => {
                productsHtml += `
                    <div class="bg-white shadow rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50" onclick="applyStatusToProduct('${product.id}', ${status}, this)">
                    <div class="flex items-center">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/150?text=No+Image'}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                        <div class="flex-grow">
                            <h3 class="font-semibold text-gray-800">${product.name}</h3>
                            <p class="text-sm text-gray-600">${product.price} руб.</p>
                            <p class="text-xs text-gray-400">Текущий остаток: ${product.quantity}</p>
                        </div>
                    </div>
                    <i class="fas fa-check-circle text-green-500 hidden"></i>
                </div>
            `;
        });
        productListContainer.innerHTML = productsHtml;

    } catch (error) {
        console.error('Failed to search products for report:', error);
        productListContainer.innerHTML = '<p class="text-center text-red-500 py-10">Ошибка поиска.</p>';
    }
}

function getStatusText(status) {
    if (status === 0) return 'Закончился';
    if (status === 5) return 'Мало';
    if (status === 10) return 'Много';
    return status;
}

function showCustomQuantityForScannedProduct() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="showStatusSelectionForProduct(scannedProductId)"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">Укажите количество</h2>
            <div class="flex items-center space-x-2 mb-4">
                <input type="number" id="scanned-custom-quantity" placeholder="Введите количество" class="flex-grow p-2 border rounded">
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" onclick="applyStatusToScannedProduct(document.getElementById('scanned-custom-quantity').value)">Применить</button>
            </div>
        </div>
    `;
}

async function applyStatusToScannedProduct(quantity) {
    if (!scannedProductId) return;
    
    quantity = parseInt(quantity);
    if (isNaN(quantity)) {
        alert('Укажите корректное количество.');
        return;
    }

    try {
        await updateStockStatus(scannedProductId, quantity);
        showToast('Статус обновлен', 'success');
        showBarcodeStatusReport(); // Возвращаем к началу
    } catch (error) {
        console.error('Error updating stock status:', error);
        showToast('Ошибка обновления статуса', 'error');
    }
}

async function startBarcodeScanForReport(status) {
    scannerContainer = document.getElementById('barcode-scanner-container');
    videoElement = document.getElementById('barcode-video');
    barcodeResultElement = document.getElementById('barcode-result');

    scannerContainer.classList.remove('hidden');
    barcodeResultElement.textContent = 'Наведите камеру на штрихкод товара...';

    if (!codeReader) {
        barcodeResultElement.textContent = 'Ошибка инициализации сканера.';
        return;
    }

    try {
        if (selectedDeviceId === null) {
            const devices = await codeReader.listVideoInputDevices();
            if (devices.length > 0) {
                const rearCamera = devices.find(d => d.label.toLowerCase().includes('back'));
                selectedDeviceId = rearCamera ? rearCamera.deviceId : devices[0].deviceId;
            } else {
                barcodeResultElement.textContent = 'Камера не найдена.';
                return;
            }
        }

        await codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, async (result, err) => {
            if (result) {
                const scannedText = result.text.trim();
                if (/^\d+$/.test(scannedText)) {
                    stopBarcodeScan();
                    showProductConfirmation(scannedText, status);
                } else {
                    barcodeResultElement.textContent = 'Неверный формат. Сканируйте штрихкод товара.';
                }
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                barcodeResultElement.textContent = 'Ошибка сканирования.';
            }
        });
    } catch (err) {
        barcodeResultElement.textContent = 'Ошибка доступа к камере.';
    }
}

async function applyStatusToProduct(productId, status, productElement) {
    status = parseInt(status);
    if (isNaN(status)) {
        showToast('Укажите корректное количество', 'error');
        return;
    }

    const originalContent = productElement.innerHTML;
    productElement.innerHTML = `<div class="flex items-center justify-center w-full h-full"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>`;

    try {
        const response = await authenticatedFetch(`/api/admin?action=updateStockStatus&productId=${productId}&quantity=${status}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update stock');
        }
        
        productElement.innerHTML = `<div class="flex items-center justify-center w-full h-full text-green-500"><i class="fas fa-check-circle mr-2"></i>Количество обновлено</div>`;
        
        setTimeout(() => {
            showBarcodeStatusReport();
            showToast(`Статус товара обновлен: ${getStatusText(status)}`, 'success');
        }, 1500);
    } catch (error) {
        console.error('Error updating stock status:', error);
        productElement.innerHTML = originalContent;
        showToast(error.message || 'Не удалось обновить количество', 'error');
    }
}

function showCustomQuantityForBarcode() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="showBarcodeStatusReport()"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">Укажите количество</h2>
            <div class="flex items-center space-x-2 mb-4">
                <input type="number" id="barcode-custom-quantity" placeholder="Введите количество" class="flex-grow p-2 border rounded">
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" onclick="startBarcodeScanWithStatus(document.getElementById('barcode-custom-quantity').value)">Применить</button>
            </div>
        </div>
    `;
}


function showQuickReport() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="loadReportsView()"><i class="fas fa-arrow-left mr-2"></i>Назад к отчетам</button>
            <h2 class="text-xl font-semibold mb-4">1. Выберите статус</h2>
            <div class="space-y-2">
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showReportSearch(0)">Закончился</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showReportSearch(5)">Мало</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showReportSearch(10)">Много</button>
                <button class="w-full text-left p-3 rounded-md bg-gray-100 hover:bg-gray-200" onclick="showCustomQuantityInput()">Свое количество</button>
            </div>
        </div>
    `;
}

function showCustomQuantityInput() {
    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="showQuickReport()"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">Укажите количество</h2>
            <div class="flex items-center space-x-2 mb-4">
                <input type="number" id="custom-quantity" placeholder="Введите количество" class="flex-grow p-2 border rounded">
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" onclick="showReportSearch(document.getElementById('custom-quantity').value)">Применить</button>
            </div>
        </div>
    `;
}

function showReportSearch(quantity) {
    selectedReportStatus = quantity;
    let statusText = '';
    if (quantity === 0) statusText = 'Закончился';
    else if (quantity === 5) statusText = 'Мало';
    else if (quantity === 10) statusText = 'Много';
    else statusText = quantity; // Для пользовательского ввода

    const reportsContainer = document.getElementById('reports');
    reportsContainer.innerHTML = `
        <div class="p-4">
            <button class="mb-4 text-blue-500" onclick="loadReportsView()"><i class="fas fa-arrow-left mr-2"></i>Назад к выбору статуса</button>
            <h2 class="text-xl font-semibold mb-4">2. Найдите товар для статуса: ${statusText}</h2>
            <div class="flex justify-between items-center mb-4">
                <div class="relative flex-grow">
                    <input type="text" id="report-product-search" placeholder="Поиск товаров..." class="w-full py-2 px-4 rounded-full text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button class="ml-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition" onclick="searchReportProducts()"><i class="fas fa-search"></i></button>
            </div>
            <div id="report-product-list" class="space-y-3"></div>
        </div>
    `;
    document.getElementById('report-product-search').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            searchReportProducts();
        }
    });
}

async function searchReportProducts() {
    const searchTerm = document.getElementById('report-product-search').value;
    const productListContainer = document.getElementById('report-product-list');
    productListContainer.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

    try {
        const response = await authenticatedFetch(`/api/admin?action=getProducts&search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const { products } = await response.json();

        if (products.length === 0) {
            productListContainer.innerHTML = '<p class="text-center text-gray-500 py-10">Товары не найдены.</p>';
            return;
        }

        let productsHtml = '';
        products.forEach(product => {
            productsHtml += `
                <div class="bg-white shadow rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50" onclick="updateStockStatus('${product.id}', selectedReportStatus, this)">
                    <div class="flex items-center">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/150?text=No+Image'}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                        <div class="flex-grow">
                            <h3 class="font-semibold text-gray-800">${product.name}</h3>
                            <p class="text-sm text-gray-600">${product.price} руб.</p>
                            <p class="text-xs text-gray-400">Текущий остаток: ${product.quantity}</p>
                        </div>
                    </div>
                    <i class="fas fa-check-circle text-green-500 hidden"></i>
                </div>
            `;
        });
        productListContainer.innerHTML = productsHtml;

    } catch (error) {
        console.error('Failed to search products for report:', error);
        productListContainer.innerHTML = '<p class="text-center text-red-500 py-10">Ошибка поиска.</p>';
    }
}

async function updateStockStatus(productId, quantity, element) {
    quantity = parseInt(quantity);
    if (isNaN(quantity)) {
        alert('Укажите корректное количество.');
        return;
    }
    
    const originalContent = element.innerHTML;
    element.innerHTML = `<div class="flex items-center justify-center w-full h-full"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>`;

    try {
        const response = await authenticatedFetch(`/api/admin?action=updateStockStatus&productId=${productId}&quantity=${quantity}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to update stock');
        
        element.innerHTML = `<div class="flex items-center justify-center w-full h-full text-green-500"><i class="fas fa-check-circle mr-2"></i>Количество обновлено</div>`;
        
        setTimeout(() => {
            showQuickReport();
            let statusText = '';
            if (quantity === 0) statusText = 'Закончился';
            else if (quantity === 5) statusText = 'Мало';
            else statusText = 'Много';
            showToast(`Статус товара обновлен: ${statusText}`, 'success');
        }, 1500);
    } catch (error) {
        console.error('Error updating stock status:', error);
        element.innerHTML = originalContent;
        showToast('Не удалось обновить количество', 'error');
    }
}

// Barcode scanning logic
let codeReader;
let videoElement;
let barcodeResultElement;
let scannerContainer;
let selectedDeviceId = null; // Переменная для хранения ID выбранной камеры

function setupStatusFilterScroll() {
    const scrollContainer = document.querySelector('.status-filter-container');
    if (!scrollContainer) return;

    const scrollContent = scrollContainer.querySelector('.status-filter-scroll');
    const leftBtn = scrollContainer.querySelector('.left-scroll-btn');
    const rightBtn = scrollContainer.querySelector('.right-scroll-btn');

    function updateScrollButtons() {
        if (!scrollContent) return;
        const maxScrollLeft = scrollContent.scrollWidth - scrollContent.clientWidth;
        
        // Небольшой допуск (например, 1 пиксель) для точности
        leftBtn.classList.toggle('hidden', scrollContent.scrollLeft <= 1);
        rightBtn.classList.toggle('hidden', scrollContent.scrollLeft >= maxScrollLeft - 1);
    }

    leftBtn.addEventListener('click', () => {
        scrollContent.scrollLeft -= 150;
    });

    rightBtn.addEventListener('click', () => {
        scrollContent.scrollLeft += 150;
    });

    scrollContent.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    // Первоначальная проверка при загрузке
    // Небольшая задержка, чтобы DOM успел отрисоваться
    setTimeout(updateScrollButtons, 100);
}


    // Функция для проверки версии приложения и перезагрузки
    function checkAppVersionAndReload() {
        const currentBuildVersion = document.querySelector('meta[name="build-version"]').getAttribute('content');
        const lastKnownAdminBuildVersion = localStorage.getItem('lastKnownAdminBuildVersion');

        if (lastKnownAdminBuildVersion && lastKnownAdminBuildVersion !== currentBuildVersion) {
            console.log('[Admin SW] Обнаружена новая версия. Перезагрузка страницы.');
            // Очищаем только кэш, который может быть несовместим.
            // adminToken не удаляем, так как он должен сохраняться между версиями.
            // allOrders и orderFormData также не должны приводить к полной перезагрузке.
            localStorage.removeItem('allOrders'); // Очищаем кэш заказов, чтобы получить свежие данные
            // localStorage.removeItem('orderFormData'); // Очищать только если формат данных несовместим

            localStorage.setItem('lastKnownAdminBuildVersion', currentBuildVersion); // Сохраняем новую версию перед перезагрузкой
            window.location.reload(true); // Принудительная перезагрузка с сервера
        } else if (!lastKnownAdminBuildVersion) {
            localStorage.setItem('lastKnownAdminBuildVersion', currentBuildVersion);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        checkAppVersionAndReload(); // Сначала проверяем версию и перезагружаем, если нужно

        // Если страница перезагрузилась, то код ниже не выполнится.
        // Если не перезагрузилась, то продолжаем обычную инициализацию.

        // Обработчик закрытия модального окна заказа
        const closeOrderModalBtn = document.getElementById('close-order-modal');
        if (closeOrderModalBtn) {
            closeOrderModalBtn.addEventListener('click', closeOrderModal);
        }

        // Инициализация фильтра заказов
        const statusFilterButtons = document.getElementById('status-filter-buttons');
        if (statusFilterButtons) {
            statusFilterButtons.addEventListener('click', (event) => {
                const target = event.target.closest('.status-filter-btn');
                if (target) {
                    // Убираем активный класс со всех кнопок
                    statusFilterButtons.querySelectorAll('.status-filter-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    // Добавляем активный класс на нажатую кнопку
                    target.classList.add('active');
                    renderOrders();
                }
            });
        }

        const deliveryTabs = document.getElementById('delivery-tabs');
        if (deliveryTabs) {
            deliveryTabs.addEventListener('click', (event) => {
                const target = event.target.closest('.delivery-tab-btn');
                if (target) {
                    deliveryTabs.querySelectorAll('.delivery-tab-btn').forEach(btn => {
                        btn.classList.remove('border-blue-500', 'text-gray-700');
                        btn.classList.add('border-transparent', 'text-gray-500');
                    });
                    target.classList.add('border-blue-500', 'text-gray-700');
                    target.classList.remove('border-transparent', 'text-gray-500');
                    
                    // Обновляем фильтры и затем рендерим заказы
                    updateStatusFilters(target.dataset.delivery);
                    renderOrders();
                }
            });
        }
        
        setupStatusFilterScroll();

        document.getElementById('scan-btn').addEventListener('click', startSaleScan);
        document.getElementById('login-btn').addEventListener('click', handleLogin);
        
        
        // Обработчик для кнопки выхода в сайдбаре
        const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
        if (logoutBtnSidebar) {
            logoutBtnSidebar.addEventListener('click', logout);
        }

        // Pre-initialize the barcode reader for faster startup
        const hints = new Map();
        const formats = [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.QR_CODE];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        codeReader = new ZXing.BrowserMultiFormatReader(hints);

        checkAuth(); // Проверяем аутентификацию при загрузке страницы
        updateStatusFilters('pickup'); // Инициализируем фильтры для вкладки по умолчанию
        
    });

function updateStatusFilters(deliveryType) {
    const deliveryStatuses = ['Новый', 'В обработке', 'Ожидает подтверждения', 'Сборка', 'Поиск курьера', 'Ожидание курьера', 'Вручен курьеру', 'Доставлен', 'Отменен'];
    const pickupStatuses = ['Новый', 'В обработке', 'Собран', 'Готов к выдаче', 'Выдан', 'Отменен'];
    const statuses = deliveryType === 'pickup' ? pickupStatuses : deliveryStatuses;
    
    const filterContainer = document.getElementById('status-filter-buttons');
    filterContainer.innerHTML = ''; // Очищаем старые фильтры

    statuses.forEach(status => {
        const button = document.createElement('button');
        button.dataset.status = status;
        button.className = 'status-filter-btn';
        button.textContent = status;
        filterContainer.appendChild(button);
    });

    // Добавляем кнопку "Все"
    const allButton = document.createElement('button');
    allButton.dataset.status = 'all';
    allButton.className = 'status-filter-btn';
    allButton.textContent = 'Все';
    filterContainer.appendChild(allButton);

    // Устанавливаем активный класс на первый фильтр (или "Новый")
    const firstFilter = filterContainer.querySelector(`[data-status="Новый"]`);
    if (firstFilter) {
        firstFilter.classList.add('active');
    }
}

async function startBarcodeScan() {
    scannerContainer = document.getElementById('barcode-scanner-container');
    videoElement = document.getElementById('barcode-video');
    barcodeResultElement = document.getElementById('barcode-result');

    scannerContainer.classList.remove('hidden');
    barcodeResultElement.textContent = 'Наведите камеру на штрихкод...';

    if (!codeReader) {
        console.error("Barcode reader is not initialized.");
        barcodeResultElement.textContent = 'Ошибка инициализации сканера.';
        return;
    }

    try {
        if (selectedDeviceId === null) {
            // Если ID камеры еще не выбран, получаем список устройств
            const devices = await codeReader.listVideoInputDevices();
            if (devices.length > 0) {
                // Пытаемся найти заднюю камеру по названию
                const rearCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
                );
                if (rearCamera) {
                    selectedDeviceId = rearCamera.deviceId;
                    console.log('Выбрана задняя камера с ID:', selectedDeviceId);
                } else {
                    // Если задняя камера не найдена по названию, выбираем первую доступную
                    selectedDeviceId = devices[0].deviceId;
                    console.log('Задняя камера не найдена по названию, выбрана первая доступная камера с ID:', selectedDeviceId);
                }
            } else {
                barcodeResultElement.textContent = 'Камера не найдена.';
                console.error('Камера не найдена.');
                return; // Прекращаем выполнение, если нет камер
            }
        }

        // Используем выбранный ID камеры для сканирования
        await codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
            if (result) {
                console.log('Штрихкод найден:', result.text);
                const scannedText = result.text.trim();

                // Проверяем, является ли отсканированный текст числом (ID товара)
                if (/^\d+$/.test(scannedText)) {
                    barcodeResultElement.textContent = `Найден ID товара: ${scannedText}`;
                    stopBarcodeScan();
                    // Использовать найденный штрихкод для поиска товара
                    document.getElementById('product-search').value = scannedText;
                    searchProducts();
                } else {
                    // Игнорируем нечисловые результаты
                    barcodeResultElement.textContent = 'Отсканирован неверный формат. Наведите на штрихкод товара.';
                    console.warn('Отсканирован нечисловой результат:', scannedText);
                }
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
                barcodeResultElement.textContent = 'Ошибка сканирования.';
            }
        });
    } catch (err) {
        console.error(err);
        barcodeResultElement.textContent = 'Ошибка доступа к камере.';
    }
}

function stopBarcodeScan() {
    if (codeReader) {
        codeReader.reset();
    }
    if (scannerContainer) {
        scannerContainer.classList.add('hidden');
    }
    // Не сбрасываем selectedDeviceId, чтобы использовать ту же камеру при следующем запуске
}

async function startSaleScan() {
    scannerContainer = document.getElementById('barcode-scanner-container');
    videoElement = document.getElementById('barcode-video');
    barcodeResultElement = document.getElementById('barcode-result');

    scannerContainer.classList.remove('hidden');
    barcodeResultElement.textContent = 'Наведите камеру на штрихкод товара...';

    if (!codeReader) {
        barcodeResultElement.textContent = 'Ошибка инициализации сканера.';
        return;
    }

    try {
        if (selectedDeviceId === null) {
            const devices = await codeReader.listVideoInputDevices();
            if (devices.length > 0) {
                const rearCamera = devices.find(d => d.label.toLowerCase().includes('back'));
                selectedDeviceId = rearCamera ? rearCamera.deviceId : devices[0].deviceId;
            } else {
                barcodeResultElement.textContent = 'Камера не найдена.';
                return;
            }
        }

        await codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, async (result, err) => {
            if (result) {
                const scannedText = result.text.trim();
                if (/^\d+$/.test(scannedText)) {
                    stopBarcodeScan();
                    // Вместо немедленной продажи, получаем инфо о товаре
                    await fetchProductForSale(scannedText);
                } else {
                    barcodeResultElement.textContent = 'Неверный формат. Сканируйте штрихкод товара.';
                }
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                barcodeResultElement.textContent = 'Ошибка сканирования.';
            }
        });
    } catch (err) {
        barcodeResultElement.textContent = 'Ошибка доступа к камере.';
    }
}

async function fetchProductForSale(productId) {
    try {
        // Используем существующий эндпоинт getProducts с поиском по ID
        const response = await authenticatedFetch(`/api/admin?action=getProducts&search=${productId}`);
        if (!response.ok) throw new Error('Товар не найден');
        const data = await response.json();
        if (data.products && data.products.length > 0) {
            showSaleConfirmationModal(data.products[0]);
        } else {
            showToast('Товар не найден', 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showSaleConfirmationModal(product) {
    const modal = document.getElementById('sale-modal');
    const modalContent = document.getElementById('sale-modal-content');
    const productInfo = document.getElementById('sale-product-info');
    const quantityInput = document.getElementById('sale-quantity');
    const decreaseBtn = document.getElementById('decrease-quantity');
    const increaseBtn = document.getElementById('increase-quantity');
    const confirmBtn = document.getElementById('confirm-sale');
    const cancelBtn = document.getElementById('cancel-sale');

    productInfo.innerHTML = `
        <img src="${product.imageUrl || 'https://via.placeholder.com/150?text=No+Image'}" alt="${product.name}" class="w-24 h-24 object-cover rounded-lg mx-auto mb-4">
        <h3 class="text-xl font-semibold text-gray-800">${product.name}</h3>
        <p class="text-gray-600">Текущий остаток: ${product.quantity}</p>
    `;

    quantityInput.value = 1;
    const maxQuantity = parseInt(product.quantity.match(/\d+/)?.[0] || '0', 10);
    quantityInput.max = maxQuantity;

    // --- Event Listeners ---
    const decreaseHandler = () => {
        let currentVal = parseInt(quantityInput.value);
        if (currentVal > 1) quantityInput.value = currentVal - 1;
    };

    const increaseHandler = () => {
        let currentVal = parseInt(quantityInput.value);
        if (currentVal < maxQuantity) quantityInput.value = currentVal + 1;
    };

    const confirmHandler = () => {
        const quantityToSell = parseInt(quantityInput.value);
        if (quantityToSell > 0 && quantityToSell <= maxQuantity) {
            closeModal();
            processSale(product.id, quantityToSell);
        } else {
            showToast('Некорректное количество', 'error');
        }
    };
    
    const cancelHandler = () => closeModal();

    const closeModal = () => {
        modal.classList.add('hidden');
        modalContent.classList.add('scale-95');
        // Удаляем обработчики, чтобы избежать дублирования
        decreaseBtn.removeEventListener('click', decreaseHandler);
        increaseBtn.removeEventListener('click', increaseHandler);
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };

    decreaseBtn.addEventListener('click', decreaseHandler);
    increaseBtn.addEventListener('click', increaseHandler);
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);

    modal.classList.remove('hidden');
    setTimeout(() => modalContent.classList.remove('scale-95'), 10); // для анимации
}


async function processSale(productId, quantity) {
    showToast('Обработка продажи...', 'info');
    try {
        const response = await authenticatedFetch(`/api/admin?action=sellProduct&productId=${productId}&quantity=${quantity}`, {
            method: 'POST'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка при продаже товара');
        }
        const data = await response.json();
        
        showToast(`Продано: ${data.soldProduct.name} (${quantity} шт.). Остаток: ${data.soldProduct.quantity}`, 'success');

        // Обновляем список товаров, чтобы показать актуальный остаток
        loadProducts(currentProductsPage, document.getElementById('product-search')?.value);

    } catch (error) {
        console.error('Failed to process sale:', error);
        showToast(error.message, 'error');
        loadProducts(currentProductsPage, document.getElementById('product-search')?.value);
    }
}

function showDemoWarning() {
    showToast('Demo режим: Изменения не сохраняются', 'info');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 ${bgColor} text-white py-3 px-6 rounded-lg shadow-xl z-50 text-center transition-opacity duration-300`;
    toast.textContent = message;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function loadSettings() {
    try {
        const response = await authenticatedFetch('/api/admin?action=getSettings');
        if (!response.ok) throw new Error('Failed to load settings');
        const settings = await response.json();
        document.getElementById('store-address').value = settings.storeAddress || '';
        document.getElementById('store-hours').value = settings.storeHours || '';
        document.getElementById('delivery-toggle').checked = settings.deliveryEnabled;
        
        // Обновляем видимость вкладки "Доставка"
        const deliveryTab = document.querySelector('[data-delivery="delivery"]');
        if (deliveryTab) {
            deliveryTab.style.display = settings.deliveryEnabled ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Не удалось загрузить настройки', 'error');
    }
}

async function saveSettings() {
    const storeAddress = document.getElementById('store-address').value;
    const storeHours = document.getElementById('store-hours').value;
    const deliveryEnabled = document.getElementById('delivery-toggle').checked;
    try {
        const response = await authenticatedFetch('/api/admin?action=saveSettings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeAddress, storeHours, deliveryEnabled })
        });
        if (!response.ok) throw new Error('Failed to save settings');
        showToast('Настройки сохранены', 'success');
        // Обновляем интерфейс после сохранения
        loadSettings();
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Ошибка сохранения настроек', 'error');
    }
}

    document.addEventListener('DOMContentLoaded', () => {
        const saveBtn = document.getElementById('save-settings-btn');
        if(saveBtn) {
            saveBtn.addEventListener('click', saveSettings);
        }

        const logoutBtn = document.getElementById('logout-btn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }

        // Инициализация подсказок DaData для поля адреса магазина в админке
        const storeAddressInput = $("#store-address");
        storeAddressInput.suggestions({
            token: "a0109719d33e23422ca2771981d42c98b8123099", // Ваш DaData API ключ
            type: "ADDRESS",
            onSelect: function(suggestion) {
                // При выборе подсказки, просто устанавливаем значение
                storeAddressInput.val(suggestion.value);
            }
        });
        initializePWAInstall();
    });

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

function openExternalSite() {
    const targetUrl = window.location.href;
    const isAndroid = /android/i.test(navigator.userAgent);

    if (isAndroid) {
        const intentUrl = `intent://${targetUrl.replace(/^https?:\/\//, '')}#Intent;package=com.android.chrome;scheme=https;S.browser_fallback_url=${encodeURIComponent(targetUrl)};end;`;
        window.location.href = intentUrl;
    } else {
        // Для других браузеров просто открываем ссылку, они сами предложат установку, если поддерживают PWA
        window.location.href = targetUrl;
    }
}

// Функция для настройки ограничений демо-режима
function setupDemoRestrictions() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'demo') {
        // Просто показываем уведомление при загрузке
        setTimeout(() => {
            showToast('Demo режим: изменения не сохраняются', 'info');
        }, 1000);
        
        // Добавляем легкий индикатор демо-режима в заголовок
        const title = document.querySelector('h1');
        if (title) {
            const demoBadge = document.createElement('span');
            demoBadge.className = 'ml-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded';
            demoBadge.textContent = 'DEMO';
            title.appendChild(demoBadge);
        }
    }
}

// Обновляем функцию выхода для демо-режима
function logout() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'demo') {
        // Для демо-режима очищаем все токены и перенаправляем на /demo
        localStorage.removeItem('adminToken');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isDemo');
        window.location.href = '/demo';
    } else {
        // Для обычного выхода
        localStorage.removeItem('adminToken');
        localStorage.removeItem('userRole');
        checkAuth();
        showToast('Вы вышли из системы', 'info');
    }
}

function initializePWAInstall() {
    const installButton = document.getElementById('install-admin-app-btn');
    if (!installButton) return;

    if (isStandalone()) {
        installButton.classList.add('hidden');
        return;
    }

    installButton.classList.remove('hidden');
    installButton.addEventListener('click', openExternalSite);
}

// Функция для обновления стоимости доставки
async function updateDeliveryCost(orderId) {
    const deliveryCostInput = document.getElementById('delivery-cost-input');
    const newDeliveryCost = parseInt(deliveryCostInput.value);
    
    if (isNaN(newDeliveryCost) || newDeliveryCost < 0) {
        showToast('Введите корректную стоимость доставки', 'error');
        return;
    }

    try {
        const response = await authenticatedFetch(`/api/admin?action=updateDeliveryCost&orderId=${orderId}&deliveryCost=${newDeliveryCost}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to update delivery cost');
        
        // Обновляем заказ в локальном кэше
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            order.deliveryCost = newDeliveryCost;
            order.totalAmount = Math.max(0, Math.floor(order.totalAmount - (order.deliveryCost || 0))) + newDeliveryCost;
        }
        
        // Обновляем отображение итоговой суммы
        const totalAmountDisplay = document.getElementById('total-amount-display');
        if (totalAmountDisplay) {
            totalAmountDisplay.textContent = `${order.totalAmount} руб.`;
        }
        
        showToast('Стоимость доставки обновлена', 'success');
        
    } catch (error) {
        console.error('Error updating delivery cost:', error);
        showToast('Ошибка обновления стоимости доставки', 'error');
    }
}
