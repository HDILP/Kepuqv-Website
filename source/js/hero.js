window.addEventListener('load', () => {
  const hero = document.getElementById('hero');

  // 1. 文本内容（你之后可以随便改）
  const leftText = "在细碎之间";
  const rightText = "遇见万物";

  // 2. 创建结构
  hero.classList.add('hero-container');

  const left = document.createElement('span');
  left.className = 'line left';
  left.innerText = leftText;

  const right = document.createElement('span');
  right.className = 'line right';
  right.innerText = rightText;

  hero.appendChild(left);
  hero.appendChild(right);

  // 3. 触发动画（稍微延迟一下更有“呼吸感”）
  setTimeout(() => {
    hero.classList.add('show');
  }, 200);
});