const guZhenRenQuotes = [
    "既然选择了远方，便只顾风雨兼程。",
    "天道酬勤，一分耕耘一分收获。",
    "不要在该奋斗的年纪选择安逸。",
    "你的潜力远超你的想象。",
    "困难只是暂时的，熬过去就是光明。",
    "每一次挫折都是成长的契机。",
    "相信自己，你比想象中更强大。",
    "路虽远行则将至，事虽难做则必成。",
    "乾坤未定，你我皆是黑马。",
    "逆水行舟，不进则退。坚持下去！",
    "莫愁前路无知己，天下谁人不识君。",
    "千磨万击还坚劲，任尔东西南北风。",
    "长风破浪会有时，直挂云帆济沧海。",
    "宝剑锋从磨砺出，梅花香自苦寒来。",
    "有志者事竟成，破釜沉舟百二秦关终属楚。"
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