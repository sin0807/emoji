const guZhenRenQuotes = [
    "人活一世，总要为了自己的利益算计些什么。",
    "这世上没有无缘无故的恨，也没有无缘无故的爱。",
    "天下熙熙，皆为利来；天下攘攘，皆为利往。",
    "想要得到，就必须先学会舍弃。",
    "所谓的感情，不过是弱者自我安慰的借口。",
    "我不是针对谁，我是说在座的各位都是棋子。",
    "不要轻易相信任何人，包括你自己。",
    "只要能达到目的，可以不择手段。",
    "这个世界本就是弱肉强食，没有什么公平可言。",
    "活着，比什么都重要。死了，就什么都没了。",
    "别人给你的，永远不是真正属于你的。",
    "想要改变命运，先要认清命运。",
    "所谓的正义，不过是胜利者的谎言。",
    "没有永远的朋友，也没有永远的敌人，只有永远的利益。",
    "心若不动，风又奈何？你若不伤，岁月无恙。"
];

function getRandomQuote() {
    return guZhenRenQuotes[Math.floor(Math.random() * guZhenRenQuotes.length)];
}

const calendar = document.getElementById('calendar');
const monthYear = document.getElementById('monthYear');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');
const moodModal = document.getElementById('moodModal');
const cancelMood = document.getElementById('cancelMood');
const analyzeMoodBtn = document.getElementById('analyzeMoodBtn');
const moodTextInput = document.getElementById('moodTextInput');
const moodResult = document.getElementById('moodResult');
const aiReply = document.getElementById('aiReply');

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
    moodTextInput.value = '';
    moodResult.textContent = '';
    aiReply.textContent = '';
    analyzeMoodBtn.style.display = 'block';
    cancelMood.style.display = 'block';
}

function closeMoodModal() {
    selectedDate = null;
    moodModal.classList.remove('active');
}

analyzeMoodBtn.addEventListener('click', async () => {
    const text = moodTextInput.value.trim();

    if (!text) {
        alert('请输入一句话描述你的心情');
        return;
    }

    analyzeMoodBtn.disabled = true;
    analyzeMoodBtn.textContent = '分析中...';
    moodResult.textContent = '';
    aiReply.textContent = '';

    try {
        const response = await fetch('/.netlify/functions/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const mood = data.mood;

        if (mood && moodIcons[mood]) {
            moodResult.textContent = moodIcons[mood];
            aiReply.textContent = getRandomQuote();
            analyzeMoodBtn.style.display = 'none';
            cancelMood.textContent = '点击任意处关闭';

            const moodData = loadMoodData();
            moodData[selectedDate] = mood;
            saveMoodData(moodData);
        } else {
            throw new Error('无效的情绪数据');
        }
    } catch (err) {
        alert('分析失败，请重试');
        analyzeMoodBtn.disabled = false;
        analyzeMoodBtn.textContent = '🤖 让AI分析情绪';
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