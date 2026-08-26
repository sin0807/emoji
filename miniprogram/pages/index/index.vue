<template>
  <view class="page">
    <!-- 顶部：月份切换 -->
    <view class="header">
      <text class="arrow" @tap="changeMonth(-1)">‹</text>
      <text class="title">{{ monthYear }}</text>
      <text class="arrow" @tap="changeMonth(1)">›</text>
    </view>

    <!-- 星期表头 -->
    <view class="weekdays">
      <text v-for="d in weekdays" :key="d" class="weekday">{{ d }}</text>
    </view>

    <!-- 日历格子 -->
    <view class="calendar">
      <view
        v-for="(cell, i) in cells"
        :key="i"
        class="day"
        :class="{ empty: !cell.day, today: cell.isToday }"
        @tap="onCellTap(cell)"
      >
        <text v-if="cell.mood" class="mood">{{ moodIcons[cell.mood] }}</text>
        <text v-if="cell.day" class="num">{{ cell.day }}</text>
      </view>
    </view>

    <!-- 图例 -->
    <view class="legend">
      <text class="legend-item">😊 开心</text>
      <text class="legend-item">😐 普通</text>
      <text class="legend-item">😢 难过</text>
    </view>

    <!-- 月度统计：用 CSS 柱状图，不引入图表库 -->
    <view class="chart-section">
		
      <text class="chart-title">{{ monthYear }}情绪统计</text>
      <view class="bar-row">
        <text class="bar-label">😊 开心</text>
        <view class="bar-track">
          <view class="bar" :style="{ width: barPercent(monthStats.happy) }"></view>
        </view>
		<view class="footer">
		  <text>总共记录了 {{ totalRecords }} 条心情</text>
		</view>
        <text class="bar-num">{{ monthStats.happy }}</text>
      </view>
      <view class="bar-row">
        <text class="bar-label">😐 普通</text>
        <view class="bar-track">
          <view class="bar normal" :style="{ width: barPercent(monthStats.normal) }"></view>
        </view>
        <text class="bar-num">{{ monthStats.normal }}</text>
      </view>
      <view class="bar-row">
        <text class="bar-label">😢 难过</text>
        <view class="bar-track">
          <view class="bar sad" :style="{ width: barPercent(monthStats.sad) }"></view>
        </view>
        <text class="bar-num">{{ monthStats.sad }}</text>
      </view>
    </view>

    <!-- 记录心情弹窗 -->
    <view v-if="showModal" class="mask" @tap="closeModal">
      <view class="modal" @tap.stop>
        <text class="modal-title">今天感觉怎么样？</text>
        <input
          v-model="moodText"
          class="mood-input"
          type="text"
          :maxlength="500"
          placeholder="输入一句话描述你的心情..."
        />
        <button class="analyze-btn" :disabled="loading" @tap="analyze">
          {{ loading ? '分析中...' : '🤖 让AI分析情绪' }}
        </button>
        <text v-if="moodResult" class="mood-result">{{ moodResult }}</text>
        <text v-if="aiReply" class="ai-reply">{{ aiReply }}</text>
        <text v-if="modelName" class="model-name">{{ modelName }}</text>
        <button class="cancel-btn" @tap="closeModal">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { analyzeMood } from '../../utils/api.js';

// ---------- 数据 ----------
const moodIcons = { happy: '😊', normal: '😐', sad: '😢' };

// 语录兜底：和网页版一致，按情绪分类
const moodQuotes = {
  happy: [
    '你若爱，生活哪里都可爱。你若恨，生活哪里都可恨。 ——丰子恺',
    '你是一树一树的花开，是燕在梁间呢喃。你是爱，是暖，是希望，你是人间的四月天。 ——林徽因',
    '答案很长，我准备用一生来回答，你准备听了吗？ ——林徽因',
    '面朝大海，春暖花开。 ——海子',
    '一个人至少拥有一个梦想，有一个理由去坚强。 ——三毛'
  ],
  normal: [
    '横眉冷对千夫指，俯首甘为孺子牛。 ——鲁迅',
    '其实地上本没有路，走的人多了，也便成了路。 ——鲁迅',
    '不在沉默中爆发，就在沉默中灭亡。 ——鲁迅',
    '时间就像海绵里的水，只要愿意挤，总还是有的。 ——鲁迅',
    '不乱于心，不困于情，不畏将来，不念过往，如此，安好。 ——丰子恺',
    '我们要在安静中，不慌不忙地坚强。 ——林徽因',
    '读书不是为了拿文凭或者发财，而是成为一个有温度懂情绪会思考的人。 ——杨绛',
    '我们曾如此期盼外界的认可，到最后才知道，世界是自己的，与他人毫无关系。 ——杨绛'
  ],
  sad: [
    '轻轻的我走了，正如我轻轻的来。 ——徐志摩',
    '悄悄是别离的笙箫，夏虫也为我沉默，沉默是今晚的康桥。 ——徐志摩',
    '我将于茫茫人海中访我唯一灵魂之伴侣，得之，我幸；不得，我命。 ——徐志摩',
    '卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭。 ——北岛',
    '我向来不惮以最坏的恶意揣测中国人。 ——鲁迅'
  ]
};

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const currentDate = ref(new Date());
const moodData = ref(loadData());
const selectedDate = ref('');
const showModal = ref(false);
const moodText = ref('');
const moodResult = ref('');
const aiReply = ref('');
const modelName = ref('');
const loading = ref(false);

// ---------- 本地存储（网页版用 localStorage，小程序用 uni.xxx）----------
function loadData() {
  try {
    return uni.getStorageSync('moodData') || {};
  } catch {
    return {};
  }
}

function saveData() {
  uni.setStorageSync('moodData', moodData.value);
}

// ---------- 计算属性 ----------
const monthYear = computed(() => {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return `${y}年${m + 1}月（共${daysInMonth}天）`;
});
// 日历格子：月初前面补空位，每天一格
const cells = computed(() => {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const list = [];
  for (let i = 0; i < firstDay; i++) list.push({ day: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${m + 1}-${d}`;
    list.push({
      day: d,
      key,
      mood: moodData.value[key] || '',
      isToday: today.getDate() === d && today.getMonth() === m && today.getFullYear() === y
    });
  }
  return list;
});

// 当月三种情绪各有多少天
const monthStats = computed(() => {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth() + 1;
  const counts = { happy: 0, normal: 0, sad: 0 };
  for (const [key, mood] of Object.entries(moodData.value)) {
    const [yy, mm] = key.split('-').map(Number);
    if (yy === y && mm === m && counts[mood] !== undefined) counts[mood]++;
  }
  return counts;
});
// 总记录数：moodData 有几个日期 key，就是几条记录
const totalRecords = computed(() => Object.keys(moodData.value).length);


function barPercent(count) {
  const max = Math.max(monthStats.value.happy, monthStats.value.normal, monthStats.value.sad, 1);
  return Math.round((count / max) * 100) + '%';
}

// ---------- 交互 ----------
function changeMonth(delta) {
  const d = currentDate.value;
  currentDate.value = new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function onCellTap(cell) {
  if (cell.day) openModal(cell.key);
}

function openModal(key) {
  selectedDate.value = key;
  moodText.value = '';
  moodResult.value = '';
  aiReply.value = '';
  modelName.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

function getRandomQuote(mood) {
  const list = moodQuotes[mood] || moodQuotes.normal;
  return list[Math.floor(Math.random() * list.length)];
}

async function analyze() {
  const text = moodText.value.trim();
  if (!text) {
    uni.showToast({ title: '请输入一句话描述你的心情', icon: 'none' });
    return;
  }
  if (text.length > 500) {
    uni.showToast({ title: '最多输入500字哦', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const data = await analyzeMood(text);
    const mood = data.mood;
    if (mood && moodIcons[mood]) {
      moodResult.value = moodIcons[mood];
      aiReply.value = data.reply || getRandomQuote(mood);
      modelName.value = data.model ? `模型：${data.model}` : '';
      moodData.value[selectedDate.value] = mood;
      saveData();
      setTimeout(() => closeModal(), 3000);
    } else {
      uni.showToast({ title: '无效的情绪数据', icon: 'none' });
    }
  } catch (err) {
    uni.showToast({ title: err.message || '分析失败，请重试', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.arrow {
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  background: #667eea;
  color: #fff;
  border-radius: 50%;
  font-size: 44rpx;
}

.weekdays {
  display: flex;
}

.weekday {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #666;
  padding: 16rpx 0;
}

.calendar {
  display: flex;
  flex-wrap: wrap;
  background: #fff;
  border-radius: 24rpx;
  padding: 12rpx;
}

.day {
  width: 14.28%;
  height: 96rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 16rpx;
  box-sizing: border-box;
}

.day.today {
  background: #667eea;
  color: #fff;
}

.num {
  font-size: 28rpx;
}

.mood {
  font-size: 32rpx;
  line-height: 1;
}

.legend {
  display: flex;
  justify-content: center;
  padding: 24rpx 0 8rpx;
}

.legend-item {
  font-size: 24rpx;
  color: #666;
  margin: 0 20rpx;
}

.chart-section {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-top: 20rpx;
}

.chart-title {
  display: block;
  text-align: center;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
}

.bar-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.bar-label {
  width: 120rpx;
  font-size: 24rpx;
  color: #333;
}

.bar-track {
  flex: 1;
  height: 24rpx;
  background: #f0f0f5;
  border-radius: 12rpx;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: #4caf50;
  border-radius: 12rpx;
}

.bar.normal {
  background: #ffc107;
}

.bar.sad {
  background: #2196f3;
}

.bar-num {
  width: 60rpx;
  text-align: right;
  font-size: 24rpx;
  color: #666;
}

/* 弹窗 */
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal {
  width: 620rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  text-align: center;
}

.modal-title {
  display: block;
  font-size: 32rpx;
  color: #333;
  margin-bottom: 24rpx;
}

.mood-input {
  width: 100%;
  height: 80rpx;
  border: 1rpx solid #ccc;
  border-radius: 12rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}

.analyze-btn {
  width: 100%;
  background: #6c5ce7;
  color: #fff;
  font-size: 30rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.analyze-btn[disabled] {
  opacity: 0.6;
  color: #fff;
  background: #6c5ce7;
}

.mood-result {
  display: block;
  font-size: 56rpx;
  margin: 16rpx 0;
}

.ai-reply {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.model-name {
  display: block;
  font-size: 22rpx;
  color: #aaa;
  margin-bottom: 12rpx;
}

.cancel-btn {
  background: transparent;
  color: #999;
  font-size: 26rpx;
  border: none;
}
</style>
