let APP_SHELL_CACHE_NAME;
let DATA_CACHE_NAME;
let CURRENT_VERSION = '%%VERCEL_BUILD_VERSION%%'; // Будет заменено Vercel'ом

// Инициализация имен кэшей сразу с CURRENT_VERSION
APP_SHELL_CACHE_NAME = `ikeber-app-shell-${CURRENT_VERSION}`;
DATA_CACHE_NAME = `ikeber-data-cache-${CURRENT_VERSION}`;

const urlsToCache = [
  './', // Добавим корневой путь, так как index.html может быть запрошен как '/'
  './index.html',
  './manifest.json',
  './icons/icon.png'
  // Внешние ресурсы убраны для надежности установки.
  // Они будут кэшироваться при первом использовании через обработчик 'fetch'.
];

// 1. Установка Service Worker и кэширование оболочки приложения
self.addEventListener('install', event => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(APP_SHELL_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование основных файлов приложения...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW] Ошибка при кэшировании оболочки приложения:', err);
      })
  );
});

// 2. Активация Service Worker и очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const cacheWhitelist = [APP_SHELL_CACHE_NAME, DATA_CACHE_NAME];
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`[SW] Удаление старого кэша: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      ).then(() => self.clients.claim());
    })
  );
});

// 3. Перехват запросов (Fetch)
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Игнорируем запросы, которые не являются http или https
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }

  // Стратегия для API запросов: "Сначала сеть, потом кеш" с обходом HTTP-кеша
  if (requestUrl.pathname.includes('/api/')) {
    // Не кэшируем POST-запросы
    if (event.request.method !== 'GET') {
      return event.respondWith(fetch(event.request));
    }

    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(new Request(event.request, { cache: 'reload' }));
          if (networkResponse.ok) {
            console.log(`[SW] Кэширование успешного ответа для: ${event.request.url}`);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.log(`[SW] Сеть недоступна для ${requestUrl.pathname}. Поиск в кэше...`);
          const cachedResponse = await cache.match(event.request);
          return cachedResponse || Response.error();
        }
      })
    );
  }
  // Стратегия для index.html и админки: принудительное обновление при изменении версии
  else if (requestUrl.pathname === '/' ||
           requestUrl.pathname === '/index.html' ||
           requestUrl.pathname.includes('/admin/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE_NAME);
        try {
          // Всегда пытаемся получить свежую версию
          const networkResponse = await fetch(new Request(event.request, { cache: 'reload' }));
          if (networkResponse.ok) {
            console.log(`[SW] Обновление кеша для: ${event.request.url}`);
            await cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.log(`[SW] Сеть недоступна. Используем кешированную версию для ${requestUrl.pathname}`);
          const cachedResponse = await cache.match(event.request);
          return cachedResponse || Response.error();
        }
      })()
    );
  }
  // Стратегия для остальных статичных ресурсов: "Сначала кеш, потом сеть"
  else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Если ресурс есть в кэше, отдаем его
        if (cachedResponse) {
          return cachedResponse;
        }

        // Иначе, идем в сеть
        return fetch(event.request.clone()).then(networkResponse => {
          // Кэшируем только валидные GET-запросы
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      }).catch(error => {
        console.error(`[SW] Ошибка при обработке запроса для ${requestUrl.pathname}:`, error);
        // Возвращаем стандартную ошибку, чтобы избежать "Failed to convert value to 'Response'"
        return Response.error();
      })
    );
  }
});


// 4. Слушатель для принудительной очистки кэша данных
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_DATA_CACHE') {
    console.log('[SW] Получена команда на очистку кэша данных.');
    caches.delete(DATA_CACHE_NAME).then(() => {
      console.log(`[SW] Кэш данных (${DATA_CACHE_NAME}) успешно удален.`);
      // Оповещаем клиента, что кэш очищен
      event.ports[0].postMessage({ status: 'cache_cleared' });
    });
  }
});
