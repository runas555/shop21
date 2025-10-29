// Вспомогательная функция для выполнения аутентифицированных запросов
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('adminToken');
    const headers = {
        'X-Admin-Token': token,
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        showToast('Сессия истекла или недействительна. Пожалуйста, войдите снова.', 'error');
        window.location.href = '/demo/index.html'; // Перенаправляем на демо-страницу
        throw new Error('Unauthorized');
    } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
        showToast(`Ошибка: ${errorData.error || errorData.message || 'Неизвестная ошибка'}`, 'error');
        throw new Error(errorData.error || errorData.message || 'Network response was not ok');
    }

    return response;
}

let selectedFile = null; // Глобальная переменная для выбранного файла
let cameraMode = 'productImage'; // 'productImage' или 'ocr'

// Функция для управления лимитами демо-режима
function getDemoLimits() {
    const limits = JSON.parse(localStorage.getItem('demoLimits') || '{}');
    
    // Инициализация лимитов при первом использовании
    if (!limits.initialized) {
        limits.initialized = true;
        limits.ocrUsed = 0;
        limits.voiceUsed = 0;
        limits.descGenUsed = 0;
        limits.nameGenUsed = 0;
        limits.maxUses = 10; // Увеличиваем лимит для полноценного тестирования
        localStorage.setItem('demoLimits', JSON.stringify(limits));
    }
    
    return limits;
}

function updateDemoLimit(type) {
    const limits = getDemoLimits();
    if (limits[type] < limits.maxUses) {
        limits[type]++;
        localStorage.setItem('demoLimits', JSON.stringify(limits));
        return true;
    }
    return false;
}

function getRemainingUses(type) {
    const limits = getDemoLimits();
    return Math.max(0, limits.maxUses - limits[type]);
}

function showDemoLimitWarning(type) {
    const remaining = getRemainingUses(type);
    const functionNames = {
        'ocrUsed': 'OCR распознавание',
        'voiceUsed': 'голосовое распознавание',
        'descGenUsed': 'генерация описания',
        'nameGenUsed': 'генерация названий'
    };
    
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-yellow-500 text-white py-3 px-6 rounded-lg shadow-xl z-50 text-center transition-opacity duration-300';
    toast.textContent = `Demo режим: ${functionNames[type]} недоступно. Лимит: ${remaining}/${getDemoLimits().maxUses}`;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('userRole');
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const pageTitle = document.getElementById('edit-page-title');
    const nameInput = document.getElementById('edit-name');
    const clearNameBtn = document.getElementById('clear-name-btn');
    
    // Обновляем текст кнопок AI для демо-режима
    if (userRole === 'demo') {
        const ocrBtn = document.getElementById('ocr-name-btn');
        const voiceBtn = document.getElementById('start-voice-recognition');
        const descBtn = document.getElementById('generate-description-btn');
        const nameBtn = document.getElementById('generate-name-btn');
        
        if (ocrBtn) {
            const remaining = getRemainingUses('ocrUsed');
            ocrBtn.title = `OCR распознавание (осталось: ${remaining})`;
        }
        if (voiceBtn) {
            const remaining = getRemainingUses('voiceUsed');
            voiceBtn.title = `Голосовой ввод (осталось: ${remaining})`;
        }
        if (descBtn) {
            const remaining = getRemainingUses('descGenUsed');
            descBtn.title = `Генерация описания (осталось: ${remaining})`;
        }
        if (nameBtn) {
            const remaining = getRemainingUses('nameGenUsed');
            nameBtn.title = `Генерация названий (осталось: ${remaining})`;
        }
    }
    
    // Адаптация интерфейса для demo режима
    if (userRole === 'demo') {
        const saveButton = document.querySelector('button[onclick="saveProduct()"]');
        if (saveButton) {
            saveButton.textContent = 'Просмотр (Demo режим)';
            saveButton.classList.add('bg-gray-500', 'cursor-not-allowed');
            saveButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            saveButton.onclick = showDemoWarning;
        }
        
        // Добавляем надпись "Демо" в правом верхнем углу
        const demoLabel = document.createElement('div');
        demoLabel.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold z-30 shadow-md';
        demoLabel.textContent = 'Демо';
        document.body.appendChild(demoLabel);
    }

    // Логика для кнопки очистки поля названия
    nameInput.addEventListener('input', () => {
        clearNameBtn.classList.toggle('hidden', !nameInput.value);
    });

    clearNameBtn.addEventListener('click', () => {
        nameInput.value = '';
        clearNameBtn.classList.add('hidden');
        nameInput.focus();
    });


    if (productId) {
        pageTitle.textContent = 'Редактирование товара';
        // Загрузка данных о товаре
        authenticatedFetch(`/api/products?id=${productId}`) // Используем прямой эндпоинт для получения одного товара
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(product => {
                if (product) {
                    document.getElementById('edit-product-id').value = product.id;
                    document.getElementById('edit-name').value = product.name;
                    // После установки значения нужно проверить, показывать ли крестик
                    clearNameBtn.classList.toggle('hidden', !product.name);
                    document.getElementById('edit-description').value = product.description;
                    document.getElementById('edit-price').value = product.price;
                    document.getElementById('edit-discount-percentage').value = product.discountPercentage || '';
                    document.getElementById('edit-quantity').value = product.quantityRaw;
                    document.getElementById('edit-category').value = product.category;
                    document.getElementById('edit-image-url').value = product.imageUrl || '';
                    document.getElementById('edit-barcode').value = product.barcode || product.id; // Используем ID как fallback для штрихкода
                    if (product.imageUrl) {
                        const preview = document.getElementById('image-preview');
                        const placeholderIcon = document.getElementById('image-placeholder-icon');
                        preview.src = product.imageUrl;
                        preview.classList.remove('hidden');
                        placeholderIcon.classList.add('hidden');
                    }
                } else {
                     console.error('Product not found:', productId);
                     pageTitle.textContent = 'Ошибка: Товар не найден';
                }
            })
            .catch(error => {
                console.error('Failed to fetch product:', error);
                pageTitle.textContent = 'Ошибка загрузки товара';
            });
    } else {
        pageTitle.textContent = 'Создание товара';
    }

    // --- Новая логика для загрузки изображений ---
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const attachPhotoBtn = document.getElementById('attach-photo-btn');
    const capturePhotoInput = document.getElementById('capture-photo-input');
    const attachPhotoInput = document.getElementById('attach-photo-input');
    const imagePreview = document.getElementById('image-preview');
    const imagePlaceholderIcon = document.getElementById('image-placeholder-icon');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // --- Новая логика для камеры с getUserMedia ---
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const takePictureBtn = document.getElementById('take-picture-btn');
    const closeCameraModalBtn = document.getElementById('close-camera-modal-btn');
    const ocrNameBtn = document.getElementById('ocr-name-btn');
    let stream;

    capturePhotoBtn.addEventListener('click', () => {
        cameraMode = 'productImage';
        openCamera();
    });
    
    ocrNameBtn.addEventListener('click', () => {
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'demo') {
            if (!updateDemoLimit('ocrUsed')) {
                showDemoLimitWarning('ocrUsed');
                return;
            }
            // Обновляем подсказку после использования
            const remaining = getRemainingUses('ocrUsed');
            ocrNameBtn.title = `OCR распознавание (осталось: ${remaining})`;
        }
        cameraMode = 'ocr';
        openCamera();
    });

    attachPhotoBtn.addEventListener('click', () => attachPhotoInput.click());

    async function openCamera() {
        if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
            alert('Ваш браузер не поддерживает доступ к камере. Попробуйте прикрепить файл.');
            return;
        }

        try {
            const constraints = {
                video: {
                    facingMode: { exact: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraVideo.srcObject = stream;
            cameraModal.classList.remove('hidden');
        } catch (err) {
            console.error("Ошибка доступа к задней камере, пробую любую:", err);
            try {
                 const anyCameraConstraints = { video: true };
                 stream = await navigator.mediaDevices.getUserMedia(anyCameraConstraints);
                 cameraVideo.srcObject = stream;
                 cameraModal.classList.remove('hidden');
            } catch (finalErr) {
                alert('Не удалось получить доступ к камере. Проверьте разрешения в настройках браузера.');
                console.error("Не удалось получить доступ ни к одной камере:", finalErr);
            }
        }
    }

    function closeCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        cameraModal.classList.add('hidden');
    }

    closeCameraModalBtn.addEventListener('click', closeCamera);

    takePictureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        canvas.getContext('2d').drawImage(cameraVideo, 0, 0);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
            if (cameraMode === 'ocr') {
                handleOcrFile(file);
            } else {
                handleFileSelect(file);
            }
            closeCamera();
        }, 'image/jpeg', 0.95);
    });
    // --- Конец новой логики для камеры ---

    capturePhotoInput.addEventListener('change', (event) => handleFileSelect(event.target.files[0]));
    attachPhotoInput.addEventListener('change', (event) => handleFileSelect(event.target.files[0]));

    function handleFileSelect(file) {
        if (!file) return;

        selectedFile = file;
        document.getElementById('edit-image-url').value = ''; // Очищаем URL, если выбран файл

        const reader = new FileReader();
        
        reader.onloadstart = () => {
            loadingSpinner.classList.remove('hidden');
            imagePreview.classList.add('hidden');
            imagePlaceholderIcon.classList.add('hidden');
        };

        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        };

        reader.onerror = () => {
            loadingSpinner.classList.add('hidden');
            imagePlaceholderIcon.classList.remove('hidden');
            showToast('Не удалось прочитать файл.', 'error');
        };

        reader.readAsDataURL(file);
    }

    async function handleOcrFile(file) {
        if (!file) return;

        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.classList.remove('hidden');

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await authenticatedFetch('/api/admin?action=recognizeTitleFromImage', {
                method: 'POST',
                body: formData,
            });
            
            const data = await response.json();

            if (data.recognizedTitle) {
                nameInput.value = data.recognizedTitle;
                clearNameBtn.classList.toggle('hidden', !nameInput.value);
            } else {
                alert('Не удалось распознать название. Попробуйте сделать фото более четким.');
            }
        } catch (error) {
            console.error('Error recognizing title from image:', error);
            alert(`Ошибка при распознавании: ${error.message}`);
        } finally {
            loadingOverlay.classList.add('hidden');
            cameraMode = 'productImage'; // Сбрасываем режим по умолчанию
        }
    }
    // --- Конец новой логики ---

    // Pre-initialize the barcode reader for the edit page
    const hints = new Map();
    const formats = [ZXing.BarcodeFormat.EAN_13];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    codeReaderEdit = new ZXing.BrowserMultiFormatReader(hints);

    const voiceButton = document.getElementById('start-voice-recognition');
    // const nameInput = document.getElementById('edit-name'); // Уже объявлено выше

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceButton.style.display = 'none';
        console.log('Speech Recognition API не поддерживается в этом браузере.');
    } else {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let isRecognizing = false;

        voiceButton.addEventListener('click', () => {
            const userRole = localStorage.getItem('userRole');
            if (userRole === 'demo') {
                if (!updateDemoLimit('voiceUsed')) {
                    showDemoLimitWarning('voiceUsed');
                    return;
                }
                // Обновляем подсказку после использования
                const remaining = getRemainingUses('voiceUsed');
                voiceButton.title = `Голосовой ввод (осталось: ${remaining})`;
            }
            if (isRecognizing) {
                recognition.stop();
                return;
            }
            recognition.start();
        });

        // Функция для воспроизведения звукового сигнала
        function playStartSound() {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.value = 880; // A5 note
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        }

        recognition.onstart = () => {
            isRecognizing = true;
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            voiceButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            voiceButton.classList.add('bg-red-500', 'hover:bg-red-600');
            playStartSound(); // Воспроизводим звук, когда распознавание началось
        };

        recognition.onend = () => {
            isRecognizing = false;
            voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceButton.classList.remove('bg-red-500', 'hover:bg-red-600');
            voiceButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            
            // Показываем индикатор загрузки
            voiceButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            voiceButton.disabled = true;

            // Отправляем текст на сервер для коррекции
            authenticatedFetch(`/api/admin?action=correctTitle&text=${encodeURIComponent(transcript)}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.correctedText) {
                    nameInput.value = data.correctedText;
                } else {
                    console.error('Correction failed:', data.error);
                    alert('Не удалось скорректировать название.');
                    nameInput.value = transcript; // Вставляем исходный текст в случае ошибки
                }
            })
            .catch(error => {
                console.error('Error correcting title:', error);
                alert('Ошибка при коррекции названия.');
                nameInput.value = transcript; // Вставляем исходный текст в случае ошибки
            })
            .finally(() => {
                // Возвращаем кнопку в исходное состояние
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceButton.disabled = false;
            });
        };

        recognition.onerror = (event) => {
            console.error('Ошибка распознавания речи:', event.error);
            alert(`Ошибка распознавания: ${event.error}`);
        };

        // Автоматически останавливаем распознавание, когда пользователь перестал говорить
        recognition.onspeechend = () => {
            recognition.stop();
        };
    }

    const generateDescBtn = document.getElementById('generate-description-btn');
    const descriptionInput = document.getElementById('edit-description');

    generateDescBtn.addEventListener('click', () => {
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'demo') {
            if (!updateDemoLimit('descGenUsed')) {
                showDemoLimitWarning('descGenUsed');
                return;
            }
            // Обновляем подсказку после использования
            const remaining = getRemainingUses('descGenUsed');
            generateDescBtn.title = `Генерация описания (осталось: ${remaining})`;
        }
        
        const productName = nameInput.value;
        if (!productName) {
            alert('Пожалуйста, сначала введите название товара.');
            return;
        }

        const originalBtnText = generateDescBtn.textContent;
        generateDescBtn.textContent = 'Генерация...';
        generateDescBtn.disabled = true;

        authenticatedFetch(`/api/admin?action=generateDescription&name=${encodeURIComponent(productName)}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.description) {
                descriptionInput.value = data.description;
            } else {
                console.error('Description generation failed:', data.error);
                alert('Не удалось сгенерировать описание.');
            }
        })
        .catch(error => {
            console.error('Error generating description:', error);
            alert('Ошибка при генерации описания.');
        })
        .finally(() => {
            generateDescBtn.textContent = originalBtnText;
            generateDescBtn.disabled = false;
        });
    });

    // Обработчики для кнопок +/-
    document.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', () => {
            const fieldId = button.dataset.field;
            const action = button.dataset.action;
            const step = parseInt(button.dataset.step, 10);
            const input = document.getElementById(fieldId);
            
            let currentValue = parseInt(input.value, 10) || 0;

            if (action === 'increment') {
                currentValue += step;
            } else {
                currentValue -= step;
            }

            if (currentValue < 0) {
                currentValue = 0;
            }

            input.value = currentValue;
        });
    });

    // Валидация для поля "Количество" - только цифры
    const quantityInput = document.getElementById('edit-quantity');
    quantityInput.addEventListener('input', () => {
        quantityInput.value = quantityInput.value.replace(/[^0-9]/g, '');
    });

    // Валидация для поля "Цена" - только цифры
    const priceInput = document.getElementById('edit-price');
    priceInput.addEventListener('input', () => {
        priceInput.value = priceInput.value.replace(/[^0-9]/g, '');
    });

    // Валидация для поля "Штрихкод" - только цифры
    const barcodeInput = document.getElementById('edit-barcode');
    barcodeInput.addEventListener('input', () => {
        barcodeInput.value = barcodeInput.value.replace(/[^0-9]/g, '');
    });

    // Логика модального окна категорий
    const categoryModal = document.getElementById('category-modal');
    const openCategoryModalBtn = document.getElementById('open-category-modal-btn');
    const closeCategoryModalBtn = document.getElementById('close-category-modal-btn');
    const categoryListDiv = document.getElementById('category-list');
    const categoryInput = document.getElementById('edit-category');

    async function loadCategories() {
        try {
            const response = await authenticatedFetch('/api/categories');
            const categories = await response.json();
            categoryListDiv.innerHTML = ''; // Очищаем список
            categories.forEach(category => {
                const categoryItem = document.createElement('button');
                categoryItem.type = 'button';
                categoryItem.className = 'w-full text-left p-2 rounded-md hover:bg-gray-100';
                categoryItem.textContent = category;
                categoryItem.addEventListener('click', () => {
                    categoryInput.value = category;
                    categoryModal.classList.add('hidden');
                });
                categoryListDiv.appendChild(categoryItem);
            });
        } catch (error) {
            console.error('Failed to load categories:', error);
            categoryListDiv.innerHTML = '<p class="text-red-500">Не удалось загрузить категории.</p>';
        }
    }

    openCategoryModalBtn.addEventListener('click', () => {
        categoryModal.classList.remove('hidden');
        loadCategories(); // Загружаем категории при каждом открытии
    });

    closeCategoryModalBtn.addEventListener('click', () => {
        categoryModal.classList.add('hidden');
    });

    // Закрытие модального окна по клику на оверлей
    categoryModal.addEventListener('click', (event) => {
        if (event.target === categoryModal) {
            categoryModal.classList.add('hidden');
        }
    });

    // Логика модального окна поиска изображений
    const imageSearchModal = document.getElementById('image-search-modal');
    const openImageSearchModalBtn = document.getElementById('open-image-search-modal-btn');
    const closeImageSearchModalBtn = document.getElementById('close-image-search-modal-btn');
    const imageSearchResultsDiv = document.getElementById('image-search-results');
    const imageUrlInput = document.getElementById('edit-image-url');

    openImageSearchModalBtn.addEventListener('click', async () => {
        const productName = nameInput.value;
        if (!productName) {
            alert('Пожалуйста, сначала введите название товара.');
            return;
        }

        imageSearchResultsDiv.innerHTML = '<p>Ищем изображения...</p>';
        imageSearchModal.classList.remove('hidden');

        try {
            // Единый запрос на сервер, который генерирует ключи и ищет картинки (с кэшем)
            const response = await authenticatedFetch(`/api/admin?action=searchImages&productName=${encodeURIComponent(productName)}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.images && data.images.length > 0) {
                imageSearchResultsDiv.innerHTML = '';
                data.images.forEach(image => {
                    const imgElement = document.createElement('img');
                    imgElement.src = image.link; // Используем полную ссылку для лучшего качества
                    imgElement.className = 'w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-75 transition';
                    imgElement.addEventListener('click', () => {
                        imageUrlInput.value = image.link;

                        // Прямое обновление превью
                        const preview = document.getElementById('image-preview');
                        const placeholderIcon = document.getElementById('image-placeholder-icon');
                        preview.src = image.link;
                        preview.classList.remove('hidden');
                        placeholderIcon.classList.add('hidden');

                        // Сбрасываем выбранные файлы, чтобы избежать конфликтов
                        document.getElementById('capture-photo-input').value = '';
                        document.getElementById('attach-photo-input').value = '';
                        
                        // Правильно сбрасываем локальный файл
                        selectedFile = null;

                        imageSearchModal.classList.add('hidden');
                    });
                    imageSearchResultsDiv.appendChild(imgElement);
                });
            } else {
                imageSearchResultsDiv.innerHTML = '<p>Изображения не найдены.</p>';
            }
        } catch (error) {
            console.error('Failed to search images:', error);
            imageSearchResultsDiv.innerHTML = '<p class="text-red-500">Не удалось выполнить поиск.</p>';
        }
    });

    closeImageSearchModalBtn.addEventListener('click', () => {
        imageSearchModal.classList.add('hidden');
    });

    imageSearchModal.addEventListener('click', (event) => {
        if (event.target === imageSearchModal) {
            imageSearchModal.classList.add('hidden');
        }
    });

    // Логика модального окна для предложений названий
    const nameSuggestionsModal = document.getElementById('name-suggestions-modal');
    const generateNameBtn = document.getElementById('generate-name-btn');
    const closeNameSuggestionsModalBtn = document.getElementById('close-name-suggestions-modal-btn');
    const nameSuggestionsList = document.getElementById('name-suggestions-list');

    generateNameBtn.addEventListener('click', async () => {
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'demo') {
            if (!updateDemoLimit('nameGenUsed')) {
                showDemoLimitWarning('nameGenUsed');
                return;
            }
            // Обновляем подсказку после использования
            const remaining = getRemainingUses('nameGenUsed');
            generateNameBtn.title = `Генерация названий (осталось: ${remaining})`;
        }
        
        const keywords = nameInput.value;
        if (!keywords) {
            alert('Пожалуйста, введите ключевые слова для генерации названия.');
            return;
        }

        const originalBtnText = generateNameBtn.textContent;
        generateNameBtn.textContent = 'Думаем...';
        generateNameBtn.disabled = true;

        try {
            const response = await authenticatedFetch(`/api/admin?action=generateTitles&keywords=${encodeURIComponent(keywords)}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                nameSuggestionsList.innerHTML = '';
                data.suggestions.forEach(suggestion => {
                    const suggestionItem = document.createElement('button');
                    suggestionItem.type = 'button';
                    suggestionItem.className = 'w-full text-left p-2 rounded-md hover:bg-gray-100';
                    suggestionItem.textContent = suggestion;
                    suggestionItem.addEventListener('click', () => {
                        nameInput.value = suggestion;
                        nameSuggestionsModal.classList.add('hidden');
                        // Обновляем состояние кнопки "очистить"
                        clearNameBtn.classList.toggle('hidden', !nameInput.value);
                    });
                    nameSuggestionsList.appendChild(suggestionItem);
                });
                nameSuggestionsModal.classList.remove('hidden');
            } else {
                alert('Не удалось сгенерировать варианты названий. Попробуйте изменить ключевые слова.');
            }
        } catch (error) {
            console.error('Error generating titles:', error);
            alert('Произошла ошибка при генерации названий.');
        } finally {
            generateNameBtn.textContent = originalBtnText;
            generateNameBtn.disabled = false;
        }
    });

    closeNameSuggestionsModalBtn.addEventListener('click', () => {
        nameSuggestionsModal.classList.add('hidden');
    });

    nameSuggestionsModal.addEventListener('click', (event) => {
        if (event.target === nameSuggestionsModal) {
            nameSuggestionsModal.classList.add('hidden');
        }
    });
});

async function saveProduct() {
    const userRole = localStorage.getItem('userRole');
    
    // Проверка demo режима
    if (userRole === 'demo') {
        showDemoWarning();
        return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    const saveButton = document.querySelector('button[onclick="saveProduct()"]');

    // Показываем оверлей и блокируем кнопку
    loadingOverlay.classList.remove('hidden');
    saveButton.disabled = true;
    saveButton.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        const productId = document.getElementById('edit-product-id').value;
        let imageUrl = document.getElementById('edit-image-url').value;

        // Приоритет у локально выбранного файла
        if (selectedFile) {
            const formData = new FormData();
            formData.append('image', selectedFile);
            const response = await authenticatedFetch('/api/admin?action=uploadImage', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки изображения');
            }
            imageUrl = data.imageUrl;
        }

        const productData = {
            id: productId,
                name: document.getElementById('edit-name').value,
                description: document.getElementById('edit-description').value,
                price: document.getElementById('edit-price').value,
                discountPercentage: document.getElementById('edit-discount-percentage').value,
                quantity: document.getElementById('edit-quantity').value,
                category: document.getElementById('edit-category').value,
                imageUrl: imageUrl,
                barcode: document.getElementById('edit-barcode').value
            };

            const action = productId ? 'updateProduct' : 'createProduct';
            
            const saveResponse = await authenticatedFetch(`/api/admin?action=${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });

            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                throw new Error(errorData.error || 'Ошибка сохранения товара');
            }

            window.location.href = '/demo/index.html';

        } catch (error) {
            console.error('Save product error:', error);
            alert(`Не удалось сохранить товар: ${error.message}`);
            // Скрываем оверлей и разблокируем кнопку в случае ошибки
            loadingOverlay.classList.add('hidden');
            saveButton.disabled = false;
            saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function showDemoWarning() {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-yellow-500 text-white py-3 px-6 rounded-lg shadow-xl z-50 text-center transition-opacity duration-300';
        toast.textContent = 'Demo режим: Изменения не сохраняются';
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

// Barcode scanning logic for edit page
let codeReaderEdit;
let videoElementEdit;
let barcodeResultElementEdit;
let scannerContainerEdit;
let selectedDeviceIdEdit = null; // Переменная для хранения ID выбранной камеры



async function startBarcodeScanEdit() {
    scannerContainerEdit = document.getElementById('barcode-scanner-container-edit');
    videoElementEdit = document.getElementById('barcode-video-edit');
    barcodeResultElementEdit = document.getElementById('barcode-result-edit');

    scannerContainerEdit.classList.remove('hidden');
    barcodeResultElementEdit.textContent = 'Наведите камеру на штрихкод...';

    if (!codeReaderEdit) {
        console.error("Barcode reader on edit page is not initialized.");
        barcodeResultElementEdit.textContent = 'Ошибка инициализации сканера.';
        return;
    }

    try {
        if (selectedDeviceIdEdit === null) {
            // Если ID камеры еще не выбран, получаем список устройств
            const devices = await codeReaderEdit.listVideoInputDevices();
            if (devices.length > 0) {
                 // Пытаемся найти заднюю камеру по названию
                const rearCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
                );
                if (rearCamera) {
                    selectedDeviceIdEdit = rearCamera.deviceId;
                    console.log('Выбрана задняя камера с ID:', selectedDeviceIdEdit);
                } else {
                    // Если задняя камера не найдена по названию, выбираем первую доступную
                    selectedDeviceIdEdit = devices[0].deviceId;
                    console.log('Задняя камера не найдена по названию, выбрана первая доступная камера с ID:', selectedDeviceIdEdit);
                }
            } else {
                barcodeResultElementEdit.textContent = 'Камера не найдена.';
                console.error('Камера не найдена.');
                return; // Прекращаем выполнение, если нет камер
            }
        }

        // Используем выбранный ID камеры для сканирования
        await codeReaderEdit.decodeFromVideoDevice(selectedDeviceIdEdit, videoElementEdit, (result, err) => {
            if (result) {
                console.log('Штрихкод найден:', result.text);
                const scannedText = result.text.trim();

                // Проверяем, является ли отсканированный текст числом (ID товара)
                if (/^\d+$/.test(scannedText)) {
                    barcodeResultElementEdit.textContent = `Найден штрихкод: ${scannedText}`;
                    // Устанавливаем найденный штрихкод в поле ввода
                    document.getElementById('edit-barcode').value = scannedText;
                    stopBarcodeScanEdit();
                } else {
                    // Игнорируем нечисловые результаты
                    barcodeResultElementEdit.textContent = 'Отсканирован неверный формат. Наведите на штрихкод товара.';
                    console.warn('Отсканирован нечисловой результат:', scannedText);
                }
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
                barcodeResultElementEdit.textContent = 'Ошибка сканирования.';
            }
        });
    } catch (err) {
        console.error(err);
        barcodeResultElementEdit.textContent = 'Ошибка доступа к камере.';
    }
}

function stopBarcodeScanEdit() {
    if (codeReaderEdit) {
        codeReaderEdit.reset();
    }
    if (scannerContainerEdit) {
        scannerContainerEdit.classList.add('hidden');
    }
    // Не сбрасываем selectedDeviceIdEdit, чтобы использовать ту же камеру при следующем запуске
}
