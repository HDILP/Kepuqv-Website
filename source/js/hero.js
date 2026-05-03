/* hero.js — 仿 web2a4 布局，保留原有文字 */
window.addEventListener('load', () => {
  const hero = document.getElementById('hero');

  // ── 原有文字不动 ──
  const line1 = '在细碎之间';
  const line2 = '遇见万物';
  const sub   = 'YOU MAY BEGIN ANYWHERE';
  const sign  = '科普区';

  hero.classList.add('hero');

  /* ════════════════════════════════════════
     按 web2a4 结构生成 DOM
  ════════════════════════════════════════ */

  // headline-wrap
  const wrap = document.createElement('div');
  wrap.className = 'headline-wrap';

  // title-block-outer > title-block
  const outer = document.createElement('div');
  outer.className = 'title-block-outer';
  const block = document.createElement('div');
  block.className = 'title-block';

  // ── 第一行 ──
  const el1 = document.createElement('span');
  el1.className = 'title-line title-line-1';
  el1.textContent = line1;
  block.appendChild(el1);

  // ── 第二行（含 colophon 落款） ──
  const el2 = document.createElement('span');
  el2.className = 'title-line title-line-2';

  const poem = document.createElement('span');
  poem.className = 'poem-text';
  poem.textContent = line2;
  el2.appendChild(poem);

  // colophon
  const colophon = document.createElement('span');
  colophon.className = 'colophon';

  const bridge = document.createElement('span');
  bridge.className = 'colophon-bridge';
  colophon.appendChild(bridge);

  const ct = document.createElement('span');
  ct.className = 'colophon-text';
  ct.textContent = sign;
  colophon.appendChild(ct);

  const dot = document.createElement('span');
  dot.className = 'colophon-dot';
  colophon.appendChild(dot);

  el2.appendChild(colophon);
  block.appendChild(el2);

  outer.appendChild(block);
  wrap.appendChild(outer);

  // ── 英文副标题 ──
  const en = document.createElement('span');
  en.className = 'title-en';
  en.textContent = sub;
  wrap.appendChild(en);

  hero.appendChild(wrap);
});
