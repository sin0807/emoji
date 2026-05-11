const guZhenRenQuotes = [
    "横眉冷对千夫指，俯首甘为孺子牛。 ——鲁迅",
    "其实地上本没有路，走的人多了，也便成了路。 ——鲁迅",
    "不在沉默中爆发，就在沉默中灭亡。 ——鲁迅",
    "时间就像海绵里的水，只要愿意挤，总还是有的。 ——鲁迅",
    "我向来不惮以最坏的恶意揣测中国人。 ——鲁迅",
    "你若爱，生活哪里都可爱。你若恨，生活哪里都可恨。 ——丰子恺",
    "不乱于心，不困于情，不畏将来，不念过往，如此，安好。 ——丰子恺",
    "你是一树一树的花开，是燕在梁间呢喃。你是爱，是暖，是希望，你是人间的四月天。 ——林徽因",
    "答案很长，我准备用一生来回答，你准备听了吗？ ——林徽因",
    "我们要在安静中，不慌不忙地坚强。 ——林徽因",
    "轻轻的我走了，正如我轻轻的来。 ——徐志摩",
    "悄悄是别离的笙箫，夏虫也为我沉默，沉默是今晚的康桥。 ——徐志摩",
    "我将于茫茫人海中访我唯一灵魂之伴侣，得之，我幸；不得，我命。 ——徐志摩",
    "卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭。 ——北岛",
    "面朝大海，春暖花开。 ——海子",
    "一个人至少拥有一个梦想，有一个理由去坚强。 ——三毛",
    "读书不是为了拿文凭或者发财，而是成为一个有温度懂情绪会思考的人。 ——杨绛",
    "我们曾如此期盼外界的认可，到最后才知道，世界是自己的，与他人毫无关系。 ——杨绛"
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
const chartTitle = document.getElementById('chartTitle');

let currentDate = new Date();
let selectedDate = null;
let moodChart = null;

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

function getMonthStats() {
    const moodData = loadMoodData();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const counts = { happy: 0, normal: 0, sad: 0 };

    for (const [key, mood] of Object.entries(moodData)) {
        const [y, m] = key.split('-').map(Number);
        if (y === year && m === month) {
            if (counts[mood] !== undefined) counts[mood]++;
        }
    }
    return counts;
}

function renderChart() {
    const counts = getMonthStats();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    chartTitle.textContent = `${year}年${month}月情绪统计`;

    const ctx = document.getElementById('moodChart').getContext('2d');

    if (moodChart) {
        moodChart.destroy();
    }

    moodChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['😊 开心', '😐 普通', '😢 难过'],
            datasets: [{
                data: [counts.happy, counts.normal, counts.sad],
                backgroundColor: ['#4CAF50', '#FFC107', '#2196F3'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 13 } }
                }
            }
        }
    });
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

            setTimeout(() => {
                closeMoodModal();
                renderCalendar();
                renderChart();
            }, 3000);
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
    renderChart();
});

nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    renderChart();
});

renderCalendar();
renderChart();