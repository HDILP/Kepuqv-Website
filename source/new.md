---
date: '2025-03-18T21:54:02.074344+08:00'
layout: page
title: 科普区文章自助添加
updated: '2025-03-18T21:54:04.216+08:00'
---
```
        }

        button:active {
            transform: translateY(0);
        }

        #result {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.95rem;
            padding: 1rem;
            border-radius: 0.75rem;
        }

        @media (max-width: 640px) {
            body {
                padding: 1rem;
            }

            .container {
                padding: 1.5rem;
                border-radius: 1rem;
            }

            h1 {
                font-size: 1.5rem;
            }

            input, textarea {
                padding: 0.75rem 1rem;
            }
        }

        @media (max-width: 480px) {
            h1 .material-icons {
                display: none;
            }

            .container {
                padding: 1.25rem;
            }

            button {
                padding: 0.875rem;
            }
        }

        .loading {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <span class="material-icons">science</span>
            科普文章自助发布
        </h1>
  
        <p class="intro-text">
            您提交的科普文章会在12小时内同步至疯狂刷题平台科普账号。
        </p>

        <form id="issueForm">
            <div class="form-group">
                <label for="title">文章标题</label>
                <input type="text" id="title" placeholder="请输入文章标题（可缩填）" required>
            </div>

            <div class="form-group">
                <label for="url">原文的分享链接</label>
                <input type="url" id="url" placeholder="https://www.yaerxing.com/shuati/verifyShareNote..." required>
            </div>

            <div class="form-group">
                <label for="author">作者信息</label>
                <input type="text" id="author" placeholder="请输入作者名称（首字母缩写）" required>
            </div>

            <div class="form-group">
                <label for="date">发布日期</label>
                <input type="text" id="date" required>
            </div>

            <button type="submit" id="submitBtn">
                <span class="material-icons">publish</span>
                立即发布
            </button>
        </form>

        <p id="result"></p>
    </div>

    <script>
    const form = document.getElementById('issueForm');
    const submitBtn = document.getElementById('submitBtn');
    const result = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
  
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="material-icons loading">autorenew</span> 提交中...`;
  
        try {
            const bodyContent = `<url: ${document.getElementById('url').value}>\n\n` +
                          `<author: ${document.getElementById('author').value}>\n\n` +
                          `<data: ${document.getElementById('date').value}>`;

            const response = await fetch('https://new.kepuqv.hdilp.top/api/create-issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: document.getElementById('title').value,
                    body: bodyContent
                }),
            });

            if (response.ok) {
                result.textContent = '✅ 提交成功！文章已进入处理队列，通常会在30秒内完成处理。';
                result.style.color = '#16a34a';
                result.style.backgroundColor = '#f0fdf4';
  
                // 保存当前日期值并重置表单
                const dateValue = document.getElementById('date').value;
                form.reset();
                document.getElementById('date').value = dateValue; // 恢复日期值
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            result.textContent = '❌ 提交失败：' + error.message;
            result.style.color = '#dc2626';
            result.style.backgroundColor = '#fef2f2';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-icons">publish</span> 立即发布`;
            setTimeout(() => {
                result.textContent = '';
                result.style.backgroundColor = 'transparent';
            }, 5000);
        }
    });

    // 设置默认日期
    document.getElementById('date').value = new Date().toLocaleDateString('en-CA');
</script>
</body>
</html>
```
