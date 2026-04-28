const calendar = document.getElementById('calendar');
const monthYear = document.getElementById('monthYear');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');
const moodModal = document.getElementById('moodModal');
const cancelMood = document.getElementById('cancelMood');

let currentDate = new Date();
let selectedDate = null;

const moodIcons = {
    happy: '😊',
    normal: '😐',
    sad: '😢'
};

function loadMoodData() {
    const data = localStorage.getItem('moodData');
    return data ? JSON.parse(data) : {};
}

function saveMoodData(data) {
    localStorage.setItem('moodData', JSON.stringify(data));
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthYear.textContent = `${year}年 ${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    calendar.innerHTML = '';
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.classList.add('day', 'empty');
        calendar.appendChild(empty);
    }
    
    const moodData = loadMoodData();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('day');
        
        const dateKey = `${year}-${month + 1}-${day}`;
        
        if (today.getDate() === day && 
            today.getMonth() === month && 
            today.getFullYear() === year) {
            dayEl.classList.add('today');
        }
        
        if (moodData[dateKey]) {
            const moodSpan = document.createElement('span');
            moodSpan.classList.add('mood');
            moodSpan.textContent = moodIcons[moodData[dateKey]];
            dayEl.appendChild(moodSpan);
        }
        
        dayEl.appendChild(document.createTextNode(day));
        
        dayEl.addEventListener('click', () => openMoodModal(dateKey));
        
        calendar.appendChild(dayEl);
    }
}

function openMoodModal(dateKey) {
    selectedDate = dateKey;
    moodModal.classList.add('active');
}

function closeMoodModal() {
    selectedDate = null;
    moodModal.classList.remove('active');
    const aiInput = document.getElementById('aiMoodInput');
    const aiResult = document.getElementById('aiMoodResult');
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiInput) aiInput.value = '';
    if (aiResult) aiResult.textContent = '';
    if (aiBtn) aiBtn.disabled = false;
}

// ===== 新增：AI 分析情绪 =====
async function analyzeMoodByAI(text) {
    const response = await fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    });
    const data = await response.json();
    return data.mood;
}

document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const mood = btn.dataset.mood;
        const aiInput = document.getElementById('aiMoodInput');
        const aiResult = document.getElementById('aiMoodResult');
        const aiBtn = document.getElementById('aiAnalyzeBtn');

        // 如果点了 AI 分析后的情绪按钮
        if (aiInput && aiInput.value.trim() && aiResult.textContent) {
            const moodData = loadMoodData();
            moodData[selectedDate] = aiResult.textContent;
            saveMoodData(moodData);
            closeMoodModal();
            renderCalendar();
            return;
        }

        // 普通手动选择
        const moodData = loadMoodData();
        moodData[selectedDate] = mood;
        saveMoodData(moodData);
        closeMoodModal();
        renderCalendar();
    });
});

// AI 分析按钮事件
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'aiAnalyzeBtn') {
        const aiInput = document.getElementById('aiMoodInput');
        const aiResult = document.getElementById('aiMoodResult');
        const aiBtn = document.getElementById('aiAnalyzeBtn');
        const text = aiInput.value.trim();
        
        if (!text) {
            alert('请输入想说的话');
            return;
        }
        
        aiBtn.disabled = true;
        aiResult.textContent = '分析中...';
        
        try {
            const mood = await analyzeMoodByAI(text);
            aiResult.textContent = mood;
        } catch (err) {
            aiResult.textContent = 'error';
            alert('分析失败，请重试');
        } finally {
            aiBtn.disabled = false;
        }
    }
});

cancelMood.addEventListener('click', closeMoodModal);

moodModal.addEventListener('click', (e) => {
    if (e.target === moodModal) closeMoodModal();
});

prevBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

renderCalendar();
