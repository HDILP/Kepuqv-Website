window.addEventListener('load', () => {
  const hero = document.getElementById('hero');

  const line1 = "在细碎之间";
  const line2 = "遇见万物";
  const sub = "YOU MAY BEGIN ANYWHERE"; // 英文小字（可改可删）
  const sign = "科普区"; // 右侧署名（可以换）

  hero.classList.add('hero');

  function createLine(text, className, delayBase = 0) {
    const line = document.createElement('div');
    line.className = 'hero-line ' + className;

    text.split('').forEach((char, i) => {
      const span = document.createElement('span');
      span.innerText = char;
      span.style.setProperty('--delay', `${delayBase + i * 0.08}s`);
      line.appendChild(span);
    });

    return line;
  }

  // 主两行
  hero.appendChild(createLine(line1, 'line-top', 0));
  hero.appendChild(createLine(line2, 'line-bottom', 0.6));

  // 英文副标题
  const subEl = document.createElement('div');
  subEl.className = 'hero-sub';
  subEl.innerText = sub;
  hero.appendChild(subEl);

  // 右侧竖排
  const signEl = document.createElement('div');
  signEl.className = 'hero-sign';
  signEl.innerText = sign;
  hero.appendChild(signEl);

  setTimeout(() => {
    hero.classList.add('show');
  }, 300);
});