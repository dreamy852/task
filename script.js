// Data storage
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let breakdowns = JSON.parse(localStorage.getItem('breakdowns')) || {};
let urls = JSON.parse(localStorage.getItem('urls')) || [];
let data = JSON.parse(localStorage.getItem('data')) || [];
let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
let currentLanguage = localStorage.getItem('language') || 'en';
// API Configuration - Using Cloudflare Worker
const DEEPSEEK_API_URL = 'https://fancy-sunset-b576.dreamy852.workers.dev/';

// Timer intervals
const timerIntervals = {};
const stepTimerIntervals = {};
// Timer states (running or paused)
const timerStates = {};
const stepTimerStates = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Convert old 'pending' status to 'incomplete'
    tasks = tasks.map(task => {
        if (task.status === 'pending') {
            task.status = 'incomplete';
        }
        // Initialize timer state if not set
        if (!timerStates[task.id] && task.status === 'incomplete') {
            timerStates[task.id] = 'paused';
        }
        return task;
    });
    saveTasks();
    
    // Reset completed sections at start of new day (optional - can be removed if you want persistent tracking)
    // For now, we'll keep it persistent across sessions
    
    loadTasks();
    loadUrls();
    loadData();
    updateStats();
    updateTaskSelector();
    
    // Event listeners
    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('addStepBtn').addEventListener('click', addStep);
    document.getElementById('startBreakdownBtn').addEventListener('click', startBreakdown);
    document.getElementById('addUrlBtn').addEventListener('click', addUrl);
    document.getElementById('addDataBtn').addEventListener('click', addData);
    document.getElementById('quoteBtn').addEventListener('click', getQuote);
    document.getElementById('clearAllTasksBtn').addEventListener('click', clearAllTasks);
    document.getElementById('clearAllUrlsBtn').addEventListener('click', clearAllUrls);
    document.getElementById('clearAllDataBtn').addEventListener('click', clearAllData);
    
    // Music player controls
    setupMusicPlayer();
    
    // Chat functionality
    setupChat();
    
    // Language functionality
    setupLanguage();
    updateLanguage();
    
    // Show initial random quote
    showInitialQuote();
});

// Show initial random quote on page load
function showInitialQuote() {
    const quoteDisplay = document.getElementById('quoteDisplay');
    const quotes = preMadeQuotes[currentLanguage] || preMadeQuotes.en;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    quoteDisplay.textContent = `"${randomQuote}"`;
}

// Music Player
function setupMusicPlayer() {
    const audio = document.getElementById('lofiAudio');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const audioStatus = document.getElementById('audioStatus');
    
    function updateMusicPlayerText() {
        const lang = translations[currentLanguage];
        if (audio.paused) {
            playPauseBtn.textContent = `▶️ ${lang.play}`;
            audioStatus.textContent = lang.paused;
        } else {
            playPauseBtn.textContent = `⏸️ ${lang.pause}`;
            audioStatus.textContent = lang.playing;
        }
    }
    
    playPauseBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
        updateMusicPlayerText();
    });
    
    // Update button when audio ends or is paused
    audio.addEventListener('pause', () => {
        updateMusicPlayerText();
    });
    
    audio.addEventListener('play', () => {
        updateMusicPlayerText();
    });
    
    // Initial update
    updateMusicPlayerText();
}

// Task Management
function addTask() {
    const name = document.getElementById('taskName').value.trim();
    const estimate = parseInt(document.getElementById('taskEstimate').value);
    
    if (!name || !estimate || estimate <= 0) {
        alert('Please enter a valid task name and estimated time.');
        return;
    }
    
    const taskId = Date.now();
    const task = {
        id: taskId,
        name,
        estimate: estimate * 60, // Convert to seconds
        remaining: estimate * 60,
        status: 'incomplete',
        startTime: Date.now()
    };
    
    tasks.push(task);
    timerStates[taskId] = 'paused'; // Initialize as paused
    saveTasks();
    loadTasks();
    updateStats();
    updateTaskSelector();
    
    document.getElementById('taskName').value = '';
    document.getElementById('taskEstimate').value = '';
}

function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        // Remove from tasks
        tasks = tasks.filter(t => t.id !== id);
        // Stop timer if running
        if (timerIntervals[id]) {
            clearInterval(timerIntervals[id]);
            delete timerIntervals[id];
        }
        delete timerStates[id];
        saveTasks();
        loadTasks();
        updateStats();
        updateTaskSelector();
    }
}

function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task && task.status === 'incomplete') {
        task.status = 'complete';
        // Stop timer if running
        if (timerIntervals[id]) {
            clearInterval(timerIntervals[id]);
            delete timerIntervals[id];
        }
        delete timerStates[id];
        saveTasks();
        loadTasks();
        updateStats();
        updateTaskSelector();
    }
}

function loadTasks() {
    const tbody = document.getElementById('tasksBody');
    tbody.innerHTML = '';
    const lang = translations[currentLanguage];
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        const isRunning = timerStates[task.id] === 'running';
        const statusText = task.status === 'complete' ? lang.complete : lang.incomplete;
        
        row.innerHTML = `
            <td>${task.name}</td>
            <td>${Math.floor(task.estimate / 60)}m</td>
            <td>
                <div class="timer-controls">
                    <span class="timer" id="timer-${task.id}">${formatTime(task.remaining)}</span>
                    ${task.status === 'incomplete' ? `
                        <button class="timer-btn" id="play-pause-${task.id}" onclick="toggleTimer(${task.id})">
                            ${isRunning ? `⏸️ ${lang.pause}` : `▶️ ${lang.play}`}
                        </button>
                    ` : ''}
                </div>
            </td>
            <td><span class="status ${task.status}">${statusText}</span></td>
            <td>
                ${task.status === 'incomplete' ? `<button class="action-btn btn-complete" onclick="completeTask(${task.id})">${lang.completeBtn}</button>` : ''}
                <button class="action-btn btn-delete" onclick="deleteTask(${task.id})">${lang.deleteBtn}</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function toggleTimer(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'incomplete') return;
    
    if (timerStates[taskId] === 'running') {
        // Pause timer
        if (timerIntervals[taskId]) {
            clearInterval(timerIntervals[taskId]);
            delete timerIntervals[taskId];
        }
        timerStates[taskId] = 'paused';
        updatePlayPauseButton(taskId);
    } else {
        // Start timer
        startTimer(taskId);
        timerStates[taskId] = 'running';
        updatePlayPauseButton(taskId);
    }
}

function updatePlayPauseButton(taskId) {
    const btn = document.getElementById(`play-pause-${taskId}`);
    if (btn) {
        btn.textContent = timerStates[taskId] === 'running' ? '⏸️ Pause' : '▶️ Play';
    }
}

function startTimer(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'incomplete') return;
    
    if (timerIntervals[taskId]) {
        clearInterval(timerIntervals[taskId]);
    }
    
    timerIntervals[taskId] = setInterval(() => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status !== 'incomplete' || timerStates[taskId] !== 'running') {
            clearInterval(timerIntervals[taskId]);
            delete timerIntervals[taskId];
            return;
        }
        
        if (task.remaining > 0) {
            task.remaining--;
            const timerEl = document.getElementById(`timer-${taskId}`);
            if (timerEl) {
                timerEl.textContent = formatTime(task.remaining);
            }
            saveTasks();
            updateStats();
        } else {
            clearInterval(timerIntervals[taskId]);
            delete timerIntervals[taskId];
            timerStates[taskId] = 'paused';
            updatePlayPauseButton(taskId);
        }
    }, 1000);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Stats - Track completed sections
let completedSections = JSON.parse(localStorage.getItem('completedSections')) || [];
const SECTION_TIME = 30 * 60; // 30 minutes in seconds
const TOTAL_SECTIONS = 16;

// Congratulatory messages
const congratMessages = {
    en: [
        { quote: "Great start! You're building momentum!", type: "nourishing" },
        { quote: "Keep going! Every minute counts!", type: "pushing" },
        { quote: "You're on fire! Don't stop now!", type: "pushing" },
        { quote: "Two hours down! You're making real progress!", type: "nourishing" },
        { quote: "Halfway to your first milestone! Keep pushing!", type: "pushing" },
        { quote: "You're in the zone! Maintain this energy!", type: "nourishing" },
        { quote: "Three hours! Your dedication is showing!", type: "nourishing" },
        { quote: "Keep the momentum! You're unstoppable!", type: "pushing" },
        { quote: "Four hours! You're a productivity machine!", type: "nourishing" },
        { quote: "Past the halfway point! Push through!", type: "pushing" },
        { quote: "Five hours! Your consistency is impressive!", type: "nourishing" },
        { quote: "Almost there! Don't let up now!", type: "pushing" },
        { quote: "Six hours! You're in elite territory!", type: "nourishing" },
        { quote: "Final stretch! Give it everything!", type: "pushing" },
        { quote: "Seven hours! You're almost at the finish line!", type: "nourishing" },
        { quote: "Eight hours complete! You're a productivity champion! 🏆", type: "nourishing" }
    ],
    zh: [
        { quote: "很好的開始！你正在建立動力！", type: "nourishing" },
        { quote: "繼續前進！每一分鐘都很重要！", type: "pushing" },
        { quote: "你火力全開！不要停下來！", type: "pushing" },
        { quote: "兩小時完成！你正在取得真正的進展！", type: "nourishing" },
        { quote: "達到第一個里程碑的一半了！繼續努力！", type: "pushing" },
        { quote: "你進入狀態了！保持這股能量！", type: "nourishing" },
        { quote: "三小時了！你的奉獻精神正在展現！", type: "nourishing" },
        { quote: "保持動力！你勢不可擋！", type: "pushing" },
        { quote: "四小時了！你是生產力機器！", type: "nourishing" },
        { quote: "超過一半了！堅持下去！", type: "pushing" },
        { quote: "五小時了！你的持續性令人印象深刻！", type: "nourishing" },
        { quote: "快到了！現在不要鬆懈！", type: "pushing" },
        { quote: "六小時了！你進入了精英領域！", type: "nourishing" },
        { quote: "最後衝刺！全力以赴！", type: "pushing" },
        { quote: "七小時了！你快要到達終點了！", type: "nourishing" },
        { quote: "八小時完成！你是生產力冠軍！🏆", type: "nourishing" }
    ]
};

// Stats
function updateStats() {
    let completeTime = 0;
    
    // Only count completed tasks
    tasks.forEach(task => {
        if (task.status === 'complete') {
            completeTime += task.estimate;
        }
    });
    
    const completeHours = Math.floor(completeTime / 3600);
    const completeMinutes = Math.floor((completeTime % 3600) / 60);
    
    document.getElementById('completeTime').textContent = `${completeHours}h ${completeMinutes}m`;
    
    // Calculate how many sections are completed (each section = 30 minutes)
    const sectionsCompleted = Math.floor(completeTime / SECTION_TIME);
    const currentSection = Math.min(sectionsCompleted - 1, TOTAL_SECTIONS - 1);
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    const progressPercent = Math.min((completeTime / (TOTAL_SECTIONS * SECTION_TIME)) * 100, 100);
    progressFill.style.width = `${progressPercent}%`;
    
    // Update section highlights
    const sections = document.querySelectorAll('.progress-section');
    sections.forEach((section, index) => {
        if (index <= currentSection && sectionsCompleted > 0) {
            section.classList.add('completed');
        } else {
            section.classList.remove('completed');
        }
    });
    
    // Check for new section completion and show congratulatory message
    if (sectionsCompleted > 0 && sectionsCompleted <= TOTAL_SECTIONS) {
        const sectionIndex = sectionsCompleted - 1;
        if (!completedSections.includes(sectionIndex)) {
            completedSections.push(sectionIndex);
            localStorage.setItem('completedSections', JSON.stringify(completedSections));
            showCongratMessage(sectionIndex);
        }
    }
}

function showCongratMessage(sectionIndex) {
    const messages = congratMessages[currentLanguage] || congratMessages.en;
    if (sectionIndex >= 0 && sectionIndex < messages.length) {
        const message = messages[sectionIndex];
        const messageEl = document.getElementById('congratMessage');
        const hours = Math.floor((sectionIndex + 1) * 30 / 60);
        const minutes = ((sectionIndex + 1) * 30) % 60;
        const timeText = currentLanguage === 'zh' 
            ? `${hours}小時 ${minutes}分鐘`
            : `${hours}h ${minutes}m`;
        const completeText = currentLanguage === 'zh' ? '完成！' : 'Complete!';
        
        messageEl.innerHTML = `
            <div class="congrat-content">
                <div class="congrat-icon">🎉</div>
                <div class="congrat-text">
                    <div class="congrat-title">${timeText} ${completeText}</div>
                    <div class="congrat-quote">${message.quote}</div>
                </div>
            </div>
        `;
        messageEl.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 5000);
    }
}

// Task Breakdown
function updateTaskSelector() {
    const selector = document.getElementById('taskSelector');
    selector.innerHTML = '<option value="">Select a task...</option>';
    
    tasks.filter(t => t.status === 'incomplete').forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        selector.appendChild(option);
    });
}

function startBreakdown() {
    const taskId = parseInt(document.getElementById('taskSelector').value);
    if (!taskId) {
        alert('Please select a task first.');
        return;
    }
    
    if (!breakdowns[taskId]) {
        breakdowns[taskId] = [];
    }
    
    document.getElementById('breakdownArea').style.display = 'block';
    loadSteps(taskId);
}

function addStep() {
    const taskId = parseInt(document.getElementById('taskSelector').value);
    if (!taskId) {
        alert('Please select a task first.');
        return;
    }
    
    const name = document.getElementById('stepName').value.trim();
    const estimate = parseInt(document.getElementById('stepEstimate').value);
    
    if (!name || !estimate || estimate <= 0) {
        alert('Please enter a valid step name and estimated time.');
        return;
    }
    
    if (!breakdowns[taskId]) {
        breakdowns[taskId] = [];
    }
    
    const step = {
        id: Date.now(),
        name,
        estimate: estimate * 60,
        remaining: estimate * 60
    };
    
    breakdowns[taskId].push(step);
    saveBreakdowns();
    loadSteps(taskId);
    
    document.getElementById('stepName').value = '';
    document.getElementById('stepEstimate').value = '';
}

function deleteStep(taskId, stepId) {
    if (breakdowns[taskId]) {
        breakdowns[taskId] = breakdowns[taskId].filter(s => s.id !== stepId);
        if (stepTimerIntervals[stepId]) {
            clearInterval(stepTimerIntervals[stepId]);
            delete stepTimerIntervals[stepId];
        }
        delete stepTimerStates[stepId];
        saveBreakdowns();
        loadSteps(taskId);
    }
}

function loadSteps(taskId) {
    const tbody = document.getElementById('stepsBody');
    tbody.innerHTML = '';
    
    if (!breakdowns[taskId] || breakdowns[taskId].length === 0) {
        return;
    }
    
    breakdowns[taskId].forEach(step => {
        const row = document.createElement('tr');
        const isRunning = stepTimerStates[step.id] === 'running';
        
        row.innerHTML = `
            <td>${step.name}</td>
            <td>${Math.floor(step.estimate / 60)}m</td>
            <td>
                <div class="timer-controls">
                    <span class="timer" id="step-timer-${step.id}">${formatTime(step.remaining)}</span>
                    <button class="timer-btn" id="step-play-pause-${step.id}" onclick="toggleStepTimer(${taskId}, ${step.id})">
                        ${isRunning ? '⏸️ Pause' : '▶️ Play'}
                    </button>
                </div>
            </td>
            <td>
                <button class="action-btn btn-complete" onclick="deleteStep(${taskId}, ${step.id})">Complete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function toggleStepTimer(taskId, stepId) {
    const steps = breakdowns[taskId];
    if (!steps) return;
    
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    
    if (stepTimerStates[stepId] === 'running') {
        // Pause timer
        if (stepTimerIntervals[stepId]) {
            clearInterval(stepTimerIntervals[stepId]);
            delete stepTimerIntervals[stepId];
        }
        stepTimerStates[stepId] = 'paused';
        updateStepPlayPauseButton(stepId);
    } else {
        // Start timer
        startStepTimer(taskId, stepId);
        stepTimerStates[stepId] = 'running';
        updateStepPlayPauseButton(stepId);
    }
}

function updateStepPlayPauseButton(stepId) {
    const btn = document.getElementById(`step-play-pause-${stepId}`);
    if (btn) {
        btn.textContent = stepTimerStates[stepId] === 'running' ? '⏸️ Pause' : '▶️ Play';
    }
}

function startStepTimer(taskId, stepId) {
    const steps = breakdowns[taskId];
    if (!steps) return;
    
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    
    if (stepTimerIntervals[stepId]) {
        clearInterval(stepTimerIntervals[stepId]);
    }
    
    stepTimerIntervals[stepId] = setInterval(() => {
        const steps = breakdowns[taskId];
        if (!steps) {
            clearInterval(stepTimerIntervals[stepId]);
            delete stepTimerIntervals[stepId];
            return;
        }
        
        const step = steps.find(s => s.id === stepId);
        if (!step || stepTimerStates[stepId] !== 'running') {
            clearInterval(stepTimerIntervals[stepId]);
            delete stepTimerIntervals[stepId];
            return;
        }
        
        if (step.remaining > 0) {
            step.remaining--;
            const timerEl = document.getElementById(`step-timer-${stepId}`);
            if (timerEl) {
                timerEl.textContent = formatTime(step.remaining);
            }
            saveBreakdowns();
        } else {
            clearInterval(stepTimerIntervals[stepId]);
            delete stepTimerIntervals[stepId];
            stepTimerStates[stepId] = 'paused';
            updateStepPlayPauseButton(stepId);
        }
    }, 1000);
}

function saveBreakdowns() {
    localStorage.setItem('breakdowns', JSON.stringify(breakdowns));
}

// URL Management
function addUrl() {
    const name = document.getElementById('urlName').value.trim();
    const url = document.getElementById('urlValue').value.trim();
    
    if (!name || !url) {
        alert('Please enter both name and URL.');
        return;
    }
    
    // Add http:// if no protocol
    let fullUrl = url;
    if (!url.match(/^https?:\/\//)) {
        fullUrl = 'https://' + url;
    }
    
    urls.push({ id: Date.now(), name, url: fullUrl });
    saveUrls();
    loadUrls();
    
    document.getElementById('urlName').value = '';
    document.getElementById('urlValue').value = '';
}

function deleteUrl(id) {
    urls = urls.filter(u => u.id !== id);
    saveUrls();
    loadUrls();
}

function loadUrls() {
    const tbody = document.getElementById('urlsBody');
    tbody.innerHTML = '';
    
    urls.forEach(url => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${url.name}</td>
            <td><a href="${url.url}" target="_blank">${url.url}</a></td>
            <td>
                <button class="action-btn btn-delete" onclick="deleteUrl(${url.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function saveUrls() {
    localStorage.setItem('urls', JSON.stringify(urls));
}

// Data Management
function addData() {
    const name = document.getElementById('dataName').value.trim();
    const value = document.getElementById('dataValue').value.trim();
    
    if (!name || !value) {
        alert('Please enter both name and value.');
        return;
    }
    
    data.push({ id: Date.now(), name, value });
    saveData();
    loadData();
    
    document.getElementById('dataName').value = '';
    document.getElementById('dataValue').value = '';
}

function deleteData(id) {
    data = data.filter(d => d.id !== id);
    saveData();
    loadData();
}

function loadData() {
    const tbody = document.getElementById('dataBody');
    tbody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.value}</td>
            <td>
                <button class="action-btn btn-delete" onclick="deleteData(${item.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function saveData() {
    localStorage.setItem('data', JSON.stringify(data));
}

// Clear functions - Manual only, never automatic
function clearAllTasks() {
    const lang = translations[currentLanguage];
    const confirmMsg = currentLanguage === 'zh' 
        ? '確定要清除所有任務嗎？此操作無法復原。'
        : 'Are you sure you want to clear all tasks? This action cannot be undone.';
    
    if (confirm(confirmMsg)) {
        // Stop all timers
        Object.keys(timerIntervals).forEach(id => {
            clearInterval(timerIntervals[id]);
            delete timerIntervals[id];
        });
        Object.keys(timerStates).forEach(id => {
            delete timerStates[id];
        });
        
        tasks = [];
        breakdowns = {};
        saveTasks();
        saveBreakdowns();
        loadTasks();
        updateStats();
        updateTaskSelector();
    }
}

function clearAllUrls() {
    const lang = translations[currentLanguage];
    const confirmMsg = currentLanguage === 'zh' 
        ? '確定要清除所有連結嗎？此操作無法復原。'
        : 'Are you sure you want to clear all URLs? This action cannot be undone.';
    
    if (confirm(confirmMsg)) {
        urls = [];
        saveUrls();
        loadUrls();
    }
}

function clearAllData() {
    const lang = translations[currentLanguage];
    const confirmMsg = currentLanguage === 'zh' 
        ? '確定要清除所有資料嗎？此操作無法復原。'
        : 'Are you sure you want to clear all data? This action cannot be undone.';
    
    if (confirm(confirmMsg)) {
        data = [];
        saveData();
        loadData();
    }
}

// Pre-made motivational quotes (fallback)
const preMadeQuotes = {
    en: [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "Productivity is never an accident. It is always the result of a commitment to excellence. - Paul J. Meyer",
        "Focus on being productive instead of busy. - Tim Ferriss",
        "The way to get started is to quit talking and begin doing. - Walt Disney",
        "Your work is going to fill a large part of your life. - Steve Jobs",
        "Success is the sum of small efforts repeated day in and day out. - Robert Collier",
        "The future depends on what you do today. - Mahatma Gandhi",
        "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
        "The secret of getting ahead is getting started. - Mark Twain",
        "You don't have to be great to start, but you have to start to be great. - Zig Ziglar",
        "Work hard in silence, let your success be your noise. - Frank Ocean",
        "The only place where success comes before work is in the dictionary. - Vidal Sassoon",
        "Do something today that your future self will thank you for. - Unknown",
        "Productivity is being able to do things that you were never able to do before. - Franz Kafka",
        "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb"
    ],
    zh: [
        "做偉大工作的唯一方法就是熱愛你所做的事。 - 史蒂夫·賈伯斯",
        "生產力絕非偶然，它總是對卓越承諾的結果。 - 保羅·J·邁耶",
        "專注於高效而非忙碌。 - 提姆·費里斯",
        "開始的方法就是停止空談，開始行動。 - 華特·迪士尼",
        "你的工作將填滿你生活的大部分。 - 史蒂夫·賈伯斯",
        "成功是日復一日小努力的總和。 - 羅伯特·科利爾",
        "未來取決於你今天做什麼。 - 甘地",
        "不要看時鐘，做時鐘做的事。繼續前進。 - 山姆·利文森",
        "領先的秘訣就是開始。 - 馬克·吐溫",
        "你不必一開始就很優秀，但你必須開始才能變得優秀。 - 齊格·齊格勒",
        "默默努力，讓成功成為你的聲音。 - 法蘭克·歐遜",
        "成功在字典中排在工作之前，這是唯一的地方。 - 維達·沙宣",
        "今天做一些未來的自己會感謝你的事。 - 未知",
        "生產力就是能夠做以前從未做過的事情。 - 法蘭茲·卡夫卡",
        "種樹的最佳時機是20年前，第二好的時機就是現在。 - 中國諺語"
    ]
};

// Quote Generator
async function getQuote() {
    const quoteDisplay = document.getElementById('quoteDisplay');
    quoteDisplay.textContent = currentLanguage === 'zh' ? '載入中...' : 'Loading...';
    
    try {
        // Prepare system message based on current language
        const systemMessage = currentLanguage === 'zh'
            ? '你是一個勵志名言生成器。生成關於工作、生產力和成功的簡短、單行勵志名言。保持簡單和鼓舞人心。'
            : 'You are a motivational quote generator. Generate short, one-line motivational quotes about work, productivity, and success. Keep them simple and inspiring.';
        
        const userMessage = currentLanguage === 'zh'
            ? '給我一句關於工作和生產力的勵志名言。'
            : 'Give me a one-line motivational quote about work and productivity.';
        
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                max_tokens: 50,
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const result = await response.json();
        if (result.choices && result.choices[0] && result.choices[0].message) {
            const quote = result.choices[0].message.content.trim();
            quoteDisplay.textContent = `"${quote}"`;
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching quote:', error);
        // Use pre-made quote as fallback based on current language
        const quotes = preMadeQuotes[currentLanguage] || preMadeQuotes.en;
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        quoteDisplay.textContent = `"${randomQuote}"`;
    }
}

// Translation system
const translations = {
    en: {
        title: 'Work Task Dashboard',
        getMotivated: '💡 Get Motivated',
        switchTo: 'Switch to 繁體中文',
        lofiMusic: '🎵 Lofi Music',
        play: 'Play',
        pause: 'Pause',
        playing: 'Playing',
        paused: 'Paused',
        dailyStats: '📊 Daily Statistics',
        completeTime: 'Complete Time:',
        progressLabel: '8 Hour Goal (30 min sections)',
        dailyTasks: '📋 Daily Tasks',
        taskName: 'Task name',
        estTime: 'Est. time (minutes)',
        addTask: 'Add Task',
        taskNameCol: 'Task Name',
        estimatedTime: 'Estimated Time',
        timer: 'Timer',
        status: 'Status',
        actions: 'Actions',
        incomplete: 'incomplete',
        complete: 'complete',
        completeBtn: 'Complete',
        deleteBtn: 'Delete',
        taskBreakdown: '🔨 Task Breakdown',
        selectTask: 'Select a task...',
        startBreakdown: 'Start Breakdown',
        stepName: 'Step name',
        addStep: 'Add Step',
        stepNameCol: 'Step Name',
        quickLinks: '🔗 Quick Links',
        linkName: 'Link name',
        url: 'URL',
        addLink: 'Add Link',
        quickData: '💾 Quick Data',
        dataName: 'Data name',
        value: 'Value',
        addData: 'Add Data',
        name: 'Name',
        localStorageDisclaimer: 'ℹ️ This app uses localStorage to save your data locally in your browser.',
        chatPlaceholder: 'Type your message...',
        send: 'Send',
        howCanIHelp: 'How can I help you?',
        thinking: 'Thinking...',
        errorMessage: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
        clearAllTasks: 'Clear All Tasks',
        clearAllUrls: 'Clear All URLs',
        clearAllData: 'Clear All Data',
        clearChat: 'Clear Chat'
    },
    zh: {
        title: '工作任務儀表板',
        getMotivated: '💡 獲取動力',
        switchTo: 'Switch to English',
        lofiMusic: '🎵 輕音樂',
        play: '播放',
        pause: '暫停',
        playing: '播放中',
        paused: '已暫停',
        dailyStats: '📊 每日統計',
        completeTime: '完成時間：',
        progressLabel: '8小時目標（30分鐘區段）',
        dailyTasks: '📋 每日任務',
        taskName: '任務名稱',
        estTime: '預計時間（分鐘）',
        addTask: '新增任務',
        taskNameCol: '任務名稱',
        estimatedTime: '預計時間',
        timer: '計時器',
        status: '狀態',
        actions: '操作',
        incomplete: '未完成',
        complete: '已完成',
        completeBtn: '完成',
        deleteBtn: '刪除',
        taskBreakdown: '🔨 任務分解',
        selectTask: '選擇任務...',
        startBreakdown: '開始分解',
        stepName: '步驟名稱',
        addStep: '新增步驟',
        stepNameCol: '步驟名稱',
        quickLinks: '🔗 快速連結',
        linkName: '連結名稱',
        url: '網址',
        addLink: '新增連結',
        quickData: '💾 快速資料',
        dataName: '資料名稱',
        value: '數值',
        addData: '新增資料',
        name: '名稱',
        localStorageDisclaimer: 'ℹ️ 此應用程式使用 localStorage 在您的瀏覽器中本地儲存資料。',
        chatPlaceholder: '輸入您的訊息...',
        send: '發送',
        howCanIHelp: '我能為您做些什麼？',
        thinking: '思考中...',
        errorMessage: '抱歉，我現在無法連接。請稍後再試。',
        clearAllTasks: '清除所有任務',
        clearAllUrls: '清除所有連結',
        clearAllData: '清除所有資料',
        clearChat: '清除聊天'
    }
};

function setupLanguage() {
    const langSwitchBtn = document.getElementById('langSwitchBtn');
    langSwitchBtn.addEventListener('click', () => {
        currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
        localStorage.setItem('language', currentLanguage);
        updateLanguage();
    });
}

function updateLanguage() {
    const lang = translations[currentLanguage];
    const langSwitchBtn = document.getElementById('langSwitchBtn');
    
    // Update button text
    langSwitchBtn.textContent = lang.switchTo;
    
    // Update all text elements
    document.querySelector('h1').textContent = lang.title;
    document.getElementById('quoteBtn').textContent = lang.getMotivated;
    document.getElementById('chatTitle').textContent = '小助手李 Sir';
    document.querySelector('.music-player h2').textContent = lang.lofiMusic;
    
    const audio = document.getElementById('lofiAudio');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const audioStatus = document.getElementById('audioStatus');
    playPauseBtn.textContent = audio.paused ? `▶️ ${lang.play}` : `⏸️ ${lang.pause}`;
    audioStatus.textContent = audio.paused ? lang.paused : lang.playing;
    
    document.querySelector('.stats-section h2').textContent = lang.dailyStats;
    document.querySelector('.stat-label').textContent = lang.completeTime;
    document.querySelector('.progress-label').textContent = lang.progressLabel;
    document.querySelector('.tasks-section h2').textContent = lang.dailyTasks;
    document.getElementById('taskName').placeholder = lang.taskName;
    document.getElementById('taskEstimate').placeholder = lang.estTime;
    document.getElementById('addTaskBtn').textContent = lang.addTask;
    document.querySelector('.breaker-section h2').textContent = lang.taskBreakdown;
    document.getElementById('startBreakdownBtn').textContent = lang.startBreakdown;
    document.getElementById('stepName').placeholder = lang.stepName;
    document.getElementById('stepEstimate').placeholder = lang.estTime;
    document.getElementById('addStepBtn').textContent = lang.addStep;
    document.querySelector('.urls-section h2').textContent = lang.quickLinks;
    document.getElementById('urlName').placeholder = lang.linkName;
    document.getElementById('urlValue').placeholder = lang.url;
    document.getElementById('addUrlBtn').textContent = lang.addLink;
    document.querySelector('.data-section h2').textContent = lang.quickData;
    document.getElementById('dataName').placeholder = lang.dataName;
    document.getElementById('dataValue').placeholder = lang.value;
    document.getElementById('addDataBtn').textContent = lang.addData;
    document.querySelector('.disclaimer small').textContent = lang.localStorageDisclaimer;
    document.getElementById('chatInput').placeholder = lang.chatPlaceholder;
    document.getElementById('sendChatBtn').textContent = lang.send;
    document.getElementById('clearAllTasksBtn').textContent = lang.clearAllTasks;
    document.getElementById('clearAllUrlsBtn').textContent = lang.clearAllUrls;
    document.getElementById('clearAllDataBtn').textContent = lang.clearAllData;
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.textContent = lang.clearChat;
    }
    
    // Update table headers
    const taskHeaders = document.querySelectorAll('#tasksTable thead th');
    if (taskHeaders.length >= 5) {
        taskHeaders[0].textContent = lang.taskNameCol;
        taskHeaders[1].textContent = lang.estimatedTime;
        taskHeaders[2].textContent = lang.timer;
        taskHeaders[3].textContent = lang.status;
        taskHeaders[4].textContent = lang.actions;
    }
    
    const stepHeaders = document.querySelectorAll('#stepsTable thead th');
    if (stepHeaders.length >= 4) {
        stepHeaders[0].textContent = lang.stepNameCol;
        stepHeaders[1].textContent = lang.estimatedTime;
        stepHeaders[2].textContent = lang.timer;
        stepHeaders[3].textContent = lang.actions;
    }
    
    const urlHeaders = document.querySelectorAll('#urlsTable thead th');
    if (urlHeaders.length >= 3) {
        urlHeaders[0].textContent = lang.name;
        urlHeaders[1].textContent = lang.url;
        urlHeaders[2].textContent = lang.actions;
    }
    
    const dataHeaders = document.querySelectorAll('#dataTable thead th');
    if (dataHeaders.length >= 3) {
        dataHeaders[0].textContent = lang.name;
        dataHeaders[1].textContent = lang.value;
        dataHeaders[2].textContent = lang.actions;
    }
    
    // Reload tasks to update status labels
    loadTasks();
    const selectedTaskId = document.getElementById('taskSelector').value;
    if (selectedTaskId) {
        loadSteps(parseInt(selectedTaskId));
    }
    
    // Update quote to match new language
    showInitialQuote();
}

// Language detection function
function detectLanguage(text) {
    // Check for Chinese characters
    const chinesePattern = /[\u4e00-\u9fff]/;
    if (chinesePattern.test(text)) {
        return 'zh';
    }
    return 'en';
}

// Chat Functionality
function setupChat() {
    const avatarBtn = document.getElementById('avatarBtn');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    
    // Open/close chat window
    avatarBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            chatInput.focus();
            loadChatHistory();
        }
    });
    
    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.remove('open');
    });
    
    // Clear chat
    clearChatBtn.addEventListener('click', () => {
        const lang = translations[currentLanguage];
        const confirmMsg = currentLanguage === 'zh' 
            ? '確定要清除所有聊天記錄嗎？此操作無法復原。'
            : 'Are you sure you want to clear all chat history? This action cannot be undone.';
        
        if (confirm(confirmMsg)) {
            chatHistory = [];
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
            chatMessages.innerHTML = '';
            addMessageToChat('assistant', lang.howCanIHelp, false);
        }
    });
    
    // Send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addMessageToChat('user', message);
        chatInput.value = '';
        
        // Get AI response
        getAIResponse(message);
    }
    
    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Load chat history or show initial message
    function loadChatHistory() {
        chatMessages.innerHTML = '';
        const lang = translations[currentLanguage];
        
        if (chatHistory.length === 0) {
            // First time - show initial message
            addMessageToChat('assistant', lang.howCanIHelp, false);
        } else {
            // Load previous messages
            chatHistory.forEach(msg => {
                addMessageToChat(msg.role, msg.content, false);
            });
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Add message to chat
    function addMessageToChat(role, content, save = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        
        // Save to history
        if (save) {
            chatHistory.push({ role, content });
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Get AI response
    async function getAIResponse(userMessage) {
        const lang = translations[currentLanguage];
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message assistant loading';
        loadingDiv.textContent = lang.thinking;
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Detect language from user message
            const detectedLang = detectLanguage(userMessage);
            const langInstruction = detectedLang === 'zh' 
                ? '請用繁體中文回應。您是一個工作生產力儀表板的助手。回應要簡潔（3-5句），格式：1) 表達理解，2) 給予實用建議，3) 提出激勵問題。要鼓勵、實用，專注於生產力和個人成長。'
                : 'You are a helpful and supportive assistant for a work productivity dashboard. Your responses should be concise (3-5 sentences) and follow this format: 1) Show understanding of the user\'s situation, 2) Give practical advice, 3) Ask an inspiring question to motivate them. Be encouraging, practical, and focused on productivity and personal growth.';
            
            // Build conversation history for API
            const messages = [
                {
                    role: 'system',
                    content: langInstruction
                }
            ];
            
            // Add chat history (last 10 messages for context)
            const recentHistory = chatHistory.slice(-10);
            recentHistory.forEach(msg => {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
            
            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });
            
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    max_tokens: 150,
                    temperature: 0.7
                })
            });
            
            const result = await response.json();
            const aiResponse = result.choices[0].message.content.trim();
            
            // Remove loading indicator
            loadingDiv.remove();
            
            // Add AI response
            addMessageToChat('assistant', aiResponse);
        } catch (error) {
            console.error('Error fetching AI response:', error);
            const lang = translations[currentLanguage];
            loadingDiv.remove();
            addMessageToChat('assistant', lang.errorMessage);
        }
    }
}
