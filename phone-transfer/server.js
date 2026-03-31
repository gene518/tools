const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// ─── 解析命令行参数 ───
const args = process.argv.slice(2);
let PORT = 3000;
// Windows 和 macOS 都有 ~/Pictures 目录
let SAVE_DIR = path.join(os.homedir(), 'Pictures', '手机传输');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--dir' && args[i + 1]) {
    SAVE_DIR = args[i + 1];
    i++;
  }
}

// ─── 允许的文件类型 ───
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.gif', '.webp',
  '.mp4', '.mov', '.avi', '.mkv'
]);

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// ─── 获取局域网 IP ───
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── 获取今日日期目录名 ───
function getTodayDir() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── 安全净化文件名 ───
function sanitizeFilename(name) {
  // 移除路径穿越字符和不安全字符
  return name
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '');
}

// ─── 处理重名文件 ───
function getUniqueFilePath(dir, originalName) {
  const safeName = sanitizeFilename(originalName);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  let filePath = path.join(dir, safeName);
  let counter = 1;

  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${base}(${counter})${ext}`);
    counter++;
  }
  return filePath;
}

// ─── 格式化文件大小 ───
function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}

// ─── 静态资源目录（兼容 pkg 打包） ───
function getPublicDir() {
  // pkg 打包后 __dirname 指向 snapshot 文件系统
  const snapshotDir = path.join(__dirname, 'public');
  if (fs.existsSync(snapshotDir)) {
    return snapshotDir;
  }
  return path.join(process.cwd(), 'public');
}

// ─── 配置 Multer ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 50 // 一次最多50个文件
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

// ─── 创建 Express 应用 ───
const app = express();

// 限制请求体大小
app.use(express.json({ limit: '1mb' }));

// 静态文件
app.use(express.static(getPublicDir()));

// ─── QR Code API（供前端展示） ───
app.get('/api/qrcode', async (req, res) => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;
  try {
    const dataUrl = await qrcode.toDataURL(url, { width: 256, margin: 2 });
    res.json({ url, qrcode: dataUrl });
  } catch (err) {
    res.status(500).json({ error: '生成二维码失败' });
  }
});

// ─── 服务信息 API ───
app.get('/api/info', (req, res) => {
  res.json({
    ip: getLocalIP(),
    port: PORT,
    saveDir: SAVE_DIR
  });
});

// ─── 文件上传 API ───
app.post('/api/upload', (req, res) => {
  upload.array('files', 50)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: '文件大小超过限制 (最大 500MB)' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: '一次最多上传 50 个文件' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有选择文件' });
    }

    const todayDir = path.join(SAVE_DIR, getTodayDir());
    // 确保目录存在
    fs.mkdirSync(todayDir, { recursive: true });

    const results = [];

    for (const file of req.files) {
      try {
        const destPath = getUniqueFilePath(todayDir, file.originalname);
        fs.writeFileSync(destPath, file.buffer);

        const savedName = path.basename(destPath);
        const size = formatSize(file.size);
        console.log(`  ✅ 已接收 ${savedName} (${size})`);

        results.push({
          originalName: file.originalname,
          savedName,
          size: file.size,
          sizeFormatted: size,
          success: true
        });
      } catch (writeErr) {
        console.error(`  ❌ 保存失败 ${file.originalname}: ${writeErr.message}`);
        results.push({
          originalName: file.originalname,
          success: false,
          error: '保存文件失败'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      message: `上传完成：${successCount} 成功${failCount > 0 ? `，${failCount} 失败` : ''}`,
      results
    });
  });
});

// ─── 单文件上传 API（支持进度） ───
app.post('/api/upload-single', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过限制 (最大 500MB)' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: '没有选择文件' });
    }

    const todayDir = path.join(SAVE_DIR, getTodayDir());
    fs.mkdirSync(todayDir, { recursive: true });

    try {
      const destPath = getUniqueFilePath(todayDir, req.file.originalname);
      fs.writeFileSync(destPath, req.file.buffer);

      const savedName = path.basename(destPath);
      const size = formatSize(req.file.size);
      console.log(`  ✅ 已接收 ${savedName} (${size})`);

      res.json({
        originalName: req.file.originalname,
        savedName,
        savePath: todayDir,
        size: req.file.size,
        sizeFormatted: size,
        success: true
      });
    } catch (writeErr) {
      console.error(`  ❌ 保存失败 ${req.file.originalname}: ${writeErr.message}`);
      res.status(500).json({ error: '保存文件失败' });
    }
  });
});

// ─── 启动服务 ───
const ip = getLocalIP();
const url = `http://${ip}:${PORT}`;

app.listen(PORT, '0.0.0.0', () => {
  // 写入 ip-config.js 供使用说明.html 读取本机 IP
  try {
    const configContent = `window.__LOCAL_IP__='${ip}';window.__PORT__=${PORT};`;
    fs.writeFileSync(path.join(process.cwd(), 'ip-config.js'), configContent);
  } catch (e) {
    // 写入失败不影响主功能
  }

  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       📱 手机文件传输工具已启动           ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  📡 局域网地址: ${url}`);
  console.log(`  📂 保存目录:   ${SAVE_DIR}`);
  console.log('');
  console.log('  📱 请用手机扫描下方二维码:');
  console.log('');

  // 终端打印二维码
  qrcodeTerminal.generate(url, { small: true }, (qr) => {
    console.log(qr);
    console.log('');
    console.log('  等待手机连接...');
    console.log('  ─────────────────────────────────────────');
    console.log('');
  });

  // 自动打开使用说明.html
  try {
    const manualPath = path.join(process.cwd(), '使用说明.html');
    if (fs.existsSync(manualPath)) {
      const openCmd = process.platform === 'win32'
        ? `start "" "${manualPath}"`
        : `open "${manualPath}"`;
      exec(openCmd);
    }
  } catch (e) {
    // 打开失败不影响主功能
  }
});
