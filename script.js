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
}



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
document.getElementById('submitMood').addEventListener('click', async () => {
    const text = document.getElementById('moodInput').value.trim();
    if (!text) return;

    document.getElementById('moodResult').textContent = 'AI分析中...✨';

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 你的API_KEY'  // 替换这里
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: 10,
                messages: [{
                    role: 'user',
                    content: `根据这句话判断情绪，只回复happy、normal或sad三个词之一，不要回复其他任何内容：${text}`
                }]
            })
        });

        const data = await response.json();
        const mood = data.choices[0].message.content.trim().toLowerCase();

        const moodData = loadMoodData();
        moodData[selectedDate] = mood;
        saveMoodData(moodData);

        closeMoodModal();
        renderCalendar();

    } catch (error) {
        document.getElementById('moodResult').textContent = '分析失败，请重试';
    }
});

renderCalendar();
