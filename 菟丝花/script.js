// 菟丝花 - script.js

document.addEventListener('DOMContentLoaded', () => {
  const 输入框 = document.getElementById('困境输入');
  const 按钮 = document.getElementById('寻找按钮');
  const 加载区 = document.getElementById('loading');
  const 结果区 = document.getElementById('结果区域');
  const 匹配结果 = document.getElementById('匹配结果');
  const 弹窗 = document.getElementById('弹窗');
  const 弹窗关闭 = document.getElementById('弹窗关闭');
  const 弹窗主体 = document.getElementById('弹窗主体');

  let characters = [];

  // 加载人物数据
  fetch('characters.json')
    .then(r => r.json())
    .then(data => { characters = data.characters; })
    .catch(console.error);

  // 点击寻找
  按钮.addEventListener('click', async () => {
    const 输入 = 输入框.value.trim();
    if (!输入) return;

    按钮.disabled = true;
    加载区.classList.remove('hidden');
    结果区.classList.add('hidden');
    匹配结果.innerHTML = '';

    try {
      const 结果 = await 调用匹配(输入);
      显示结果(结果);
    } catch (e) {
      匹配结果.innerHTML = '<p style="text-align:center;color:#A88;">暂时找不到匹配的同行者，请稍后再试。</p>';
    } finally {
      加载区.classList.add('hidden');
      按钮.disabled = false;
    }
  });

  // 调用后端匹配
  async function 调用匹配(用户困境) {
    const res = await fetch('/.netlify/functions/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 用户困境,
        characters: characters
      })
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
  }

  // 显示结果卡片
  function 显示结果(结果) {
    结果区.classList.remove('hidden');
    结果.forEach(item => {
      const 卡片 = document.createElement('div');
      const 级别 = item.level === 'high' ? '高度匹配'
                 : item.level === 'medium' ? '中度匹配'
                 : '低度匹配';
      const 标签 = item.level === 'high' ? '🔴'
                 : item.level === 'medium' ? '🟡'
                 : '🟢';

      卡片.className = `匹配卡片 ${item.level === 'high' ? '高度匹配' : item.level === 'medium' ? '中度匹配' : '低度匹配'}`;
      卡片.innerHTML = `
        <span class="匹配标签">${标签} ${级别}</span>
        <div class="人物名">${item.name}</div>
        <div class="人物年代">${item.era} · ${item.nationality}</div>
        <div class="人物简介">${item.intro}</div>
      `;
      卡片.addEventListener('click', () => 打开弹窗(item));
      匹配结果.appendChild(卡片);
    });
  }

  // 打开弹窗
  function 打开弹窗(item) {
    弹窗主体.innerHTML = `
      <div class="弹窗标题">${item.name}</div>
      <div class="弹窗年代">${item.era} · ${item.nationality}</div>

      <div class="弹窗区块">
        <div class="弹窗区块标题">相似之处</div>
        <div class="弹窗区块内容">${item.similarity}</div>
      </div>

      <div class="弹窗区块">
        <div class="弹窗区块标题">她的故事</div>
        <div class="弹窗区块内容">${item.story}</div>
      </div>

      <div class="弹窗区块">
        <div class="弹窗区块标题">她如何走过来</div>
        <div class="弹窗区块内容">${item.howSheSurvived}</div>
      </div>

      <div class="弹窗区块">
        <div class="弹窗区块标题">给你的建议</div>
        <div class="弹窗区块内容">${item.suggestion}</div>
      </div>

      <div class="弹窗原话">"${item.quote}"</div>
    `;
    弹窗.classList.add('active');
  }

  // 关闭弹窗
  弹窗关闭.addEventListener('click', () => 弹窗.classList.remove('active'));
  弹窗.addEventListener('click', e => {
    if (e.target === 弹窗) 弹窗.classList.remove('active');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') 弹窗.classList.remove('active');
  });
});

// 悬停呼吸效果（可选）
const cards = document.querySelectorAll('.匹配卡片');
cards.forEach(card => {
  card.addEventListener('mouseenter', () => card.style.transform = 'translateX(6px)');
  card.addEventListener('mouseleave', () => card.style.transform = '');
});