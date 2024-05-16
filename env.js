const dotenv = require('dotenv');
const fs = require('fs');
const path = require("path");

// 加载 .env 文件
const envFilePath = path.resolve(__dirname, '.env');
dotenv.config({path: envFilePath});

// 加载 .env.*.local 文件并覆盖同名环境变量
const nodeEnv = process.env?.NODE_ENV
const envLocalFilePath = `${envFilePath}${nodeEnv ? `.${nodeEnv}` : ''}.local`;
if (fs.existsSync(envLocalFilePath)) {
    dotenv.config({path: envLocalFilePath, override: true});
}