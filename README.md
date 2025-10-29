# Magazin1 - Интернет-магазин

Фронтенд для интернет-магазина, адаптированный для деплоя на GitHub Pages.

## Особенности

- **SPA (Single Page Application)** - одностраничное приложение
- **PWA (Progressive Web App)** - поддерживает установку как приложение
- **Адаптивный дизайн** - работает на всех устройствах
- **Офлайн-режим** - работает без интернета через Service Worker
- **Быстрая загрузка** - оптимизированная производительность

## Технологии

- HTML5, CSS3, JavaScript (ES6+)
- Tailwind CSS для стилей
- Font Awesome для иконок
- jQuery для DOM манипуляций
- Service Worker для кеширования

## Структура проекта

```
├── index.html          # Главная страница SPA
├── 404.html            # Страница для SPA роутинга
├── manifest.json       # PWA манифест
├── sw.js              # Service Worker
├── DEPLOYMENT.md      # Инструкции по деплою
├── README.md          # Эта документация
├── admin/             # Панель администратора
├── courier/           # Интерфейс курьера
├── demo/              # Демо версия
├── icons/             # Иконки приложения
└── lib/               # Внешние библиотеки
```

## API

Фронтенд работает с бэкендом на Vercel:
- **Бэкенд URL**: `https://ikeber-pricelist.vercel.app`
- **API Endpoints**: `/api/products`, `/api/categories`, `/api/submit-order` и др.

## Деплой на GitHub Pages

### Автоматический деплой:
1. Загрузите файлы в репозиторий GitHub
2. Настройте GitHub Pages в Settings → Pages
3. Выберите ветку `main` и папку `/ (root)`
4. Сайт будет доступен по адресу: `https://username.github.io/magazin1`

### Ручной деплой:
```bash
# Клонировать репозиторий
git clone https://github.com/username/magazin1.git

# Загрузить изменения
git add .
git commit -m "Update"
git push origin main
```

## Локальная разработка

```bash
# Запуск через локальный сервер
npx serve .
# или
python -m http.server 8000
```

## SPA Роутинг

Приложение использует механизм SPA роутинга через `404.html`:
- Все маршруты перенаправляются на `index.html`
- Клиентский JavaScript обрабатывает маршруты

## PWA Функциональность

- Установка как приложение
- Офлайн-работа
- Push-уведомления
- Быстрая загрузка

## Поддерживаемые браузеры

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Лицензия

MIT License