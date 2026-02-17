const fs = require('fs');
const path = require('path');

const ALAPI_TOKEN = process.env.ALAPI_TOKEN;
const API_URL = 'https://v3.alapi.cn/api/zaobao';
const OUTPUT_DIR = path.join(__dirname, '../../source/zaobao');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'data.json');

async function fetchNews() {
    if (!ALAPI_TOKEN) {
        console.error('❌ 错误：缺少 ALAPI_TOKEN 环境变量');
        process.exit(1);
    }

    try {
        console.log('🔄 正在获取每日早报数据...');
        const response = await fetch(`${API_URL}?token=${ALAPI_TOKEN}&format=json`);
        const result = await response.json();

        if (result.code === 200) {
            // 确保目录存在
            if (!fs.existsSync(OUTPUT_DIR)) {
                fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            }

            // 格式化数据以匹配前端期望的结构
            // 注意：ALAPI 返回的字段可能略有不同，这里做了一层适配
            const formattedData = {
                code: 200,
                data: {
                    date: result.data.date || new Date().toLocaleDateString('zh-CN'),
                    news: result.data.list || [], // 适配前端期望的 news 数组
                    head_image: result.data.image || '', // 适配头部图片
                    audio: result.data.audio || '',     // 适配音频
                    weiyu: result.data.weiyu || ''      // 适配微语
                }
            };

            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(formattedData, null, 2));
            console.log('✅ 数据已成功保存至', OUTPUT_FILE);
        } else {
            console.error('❌ API 请求失败:', result.msg);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 发生错误:', error.message);
        process.exit(1);
    }
}

fetchNews();