// 创建并添加元素
function createDengContainer() {
    const container = document.createElement('div');
    container.className = 'deng-container';

    const scriptSrc = document.currentScript.src;
    const urlParams = new URLSearchParams(scriptSrc.split('?')[1]);
    const customText = urlParams.get('text');
    const texts = customText ? customText.split('') : ['新', '年', '快', '乐'];

    texts.forEach((text, index) => {
        const box = document.createElement('div');
        box.className = `deng-box deng-box${index + 1}`;

        const line = document.createElement('div');
        line.className = 'deng-line';

        const card = document.createElement('div');
        card.className = 'deng-card';

        const shine = document.createElement('div');
        shine.className = 'deng-shine';

        const textSpan = document.createElement('span');
        textSpan.className = 'deng-text';
        textSpan.textContent = text;

        const tassel = document.createElement('div');
        tassel.className = 'deng-tassel';

        card.appendChild(shine);
        card.appendChild(textSpan);
        card.appendChild(tassel);

        box.appendChild(line);
        box.appendChild(card);
        container.appendChild(box);
    });

    document.body.appendChild(container);
}

// 添加完整 CSS 样式
function addStyles() {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = `
        :root {
            --deng-red: #E63946;
            --deng-gold: #FFD166;
            --deng-white: #F1FAEE;
        }

        .deng-container {
            position: relative;
            z-index: 9999;
            pointer-events: none;
        }

        .deng-box {
            position: fixed;
            top: -20px; /* 稍微埋进顶部一点点，更自然 */
            transform-origin: top center;
            animation: swing 4s infinite ease-in-out;
        }

        /* 桌面端间距与位置 */
        .deng-box1 { left: 5%; }
        .deng-box2 { left: calc(5% + 80px); animation-delay: 0.4s; }
        .deng-box3 { right: calc(5% + 80px); animation-delay: 0.8s; }
        .deng-box4 { right: 5%; animation-delay: 1.2s; }

        /* 加长版提线 - 避开导航栏 */
        .deng-line {
            width: 2px;
            height: 80px; /* 减小高度 */
            background-color: var(--deng-gold);
            margin: 0 auto;
            position: relative;
        }
        /* 顶部挂钩装饰 */
        .deng-line::before {
            content: '';
            position: absolute;
            top: 20px;
            left: -4px;
            width: 10px;
            height: 2px;
            background: var(--deng-gold);
            border-radius: 2px;
        }

        /* 灯笼主体 */
        .deng-card {
            position: relative;
            width: 70px;
            height: 60px;
            background-color: var(--deng-red);
            border-radius: 18px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 0 rgba(0,0,0,0.1); 
            border: 2px solid var(--deng-gold);
        }

        .deng-card::before, .deng-card::after {
            content: '';
            position: absolute;
            width: 38px;
            height: 6px;
            background-color: var(--deng-gold);
            border-radius: 4px;
            left: 50%;
            transform: translateX(-50%);
        }
        .deng-card::before { top: -5px; }
        .deng-card::after { bottom: -5px; }

        .deng-shine {
            position: absolute;
            top: 8px;
            left: 8px;
            width: 10px;
            height: 10px;
            background-color: rgba(255,255,255,0.25);
            border-radius: 50%;
        }

        .deng-text {
            font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 1.8rem;
            font-weight: 900;
            color: var(--deng-white);
            user-select: none;
        }

        /* 几何穗子 */
        .deng-tassel {
            position: absolute;
            bottom: -32px;
            left: 50%;
            transform: translateX(-50%);
            width: 2px;
            height: 28px;
            background-color: var(--deng-gold);
        }
        .deng-tassel::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 10px;
            height: 10px;
            background-color: var(--deng-red);
            border-radius: 4px; /* 方形圆角，更现代 */
            border: 2px solid var(--deng-gold);
        }

        /* 摆动动画 - 角度缩小，更显高级 */
        @keyframes swing {
            0% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
            100% { transform: rotate(-5deg); }
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
            .deng-box { transform: scale(0.7); top: -25px; } /* 稍微调大点比例，因为底数变小了 */
            .deng-line { height: 50px; } /* 绳子缩短 */
            .deng-box1 { left: 2%; }
            .deng-box2 { left: 20%; }
            .deng-box3 { right: 20%; }
            .deng-box4 { right: 2%; }
        }
    `;
    document.head.appendChild(style);
}

function init() {
    addStyles();
    createDengContainer();
}

init();
