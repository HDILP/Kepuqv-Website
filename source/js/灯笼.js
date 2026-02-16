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
        .deng-box2 { left: calc(5% + 100px); animation-delay: 0.4s; }
        .deng-box3 { right: calc(5% + 100px); animation-delay: 0.8s; }
        .deng-box4 { right: 5%; animation-delay: 1.2s; }

        /* 加长版提线 - 避开导航栏 */
        .deng-line {
            width: 2px;
            height: 100px; /* 增加到100px，让灯笼下沉 */
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
            width: 85px;
            height: 75px;
            background-color: var(--deng-red);
            border-radius: 22px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 6px 0 rgba(0,0,0,0.1); 
            border: 3px solid var(--deng-gold);
        }

        .deng-card::before, .deng-card::after {
            content: '';
            position: absolute;
            width: 45px;
            height: 8px;
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
            width: 12px;
            height: 12px;
            background-color: rgba(255,255,255,0.25);
            border-radius: 50%;
        }

        .deng-text {
            font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 2.2rem;
            font-weight: 900;
            color: var(--deng-white);
            user-select: none;
        }

        /* 几何穗子 */
        .deng-tassel {
            position: absolute;
            bottom: -40px;
            left: 50%;
            transform: translateX(-50%);
            width: 3px;
            height: 35px;
            background-color: var(--deng-gold);
        }
        .deng-tassel::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 14px;
            height: 14px;
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
            .deng-box { transform: scale(0.6); top: -30px; }
            .deng-line { height: 70px; } /* 移动端绳子稍短一点，避免挡住手机屏内容 */
            .deng-box1 { left: 2%; }
            .deng-box2 { left: 18%; }
            .deng-box3 { right: 18%; }
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
