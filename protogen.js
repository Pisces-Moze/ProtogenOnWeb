import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mime from 'mime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 1146;
const DATA_ROOT = path.join(__dirname, 'data');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public'), {
  cacheControl: true,
  maxAge: '7d'
}));
app.use('/data', express.static(DATA_ROOT, { fallthrough: true }));
function ensureUserDirs(username) {
  const safe = sanitizeUsername(username);
  const userDir = path.join(DATA_ROOT, safe);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  for (let i = 0; i <= 9; i++) {
    const slot = path.join(userDir, String(i));
    if (!fs.existsSync(slot)) fs.mkdirSync(slot, { recursive: true });
  }
  return userDir;
}

function sanitizeUsername(name) {
  return String(name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function requireLogin(req, res, next) {
  const u = req.cookies?.username;
  if (!u) return res.status(401).json({ ok: false, error: 'NO_COOKIE' });
  req.user = sanitizeUsername(u);
  next();
}

app.post('/api/login', (req, res) => {
  const { username } = req.body || {};
  const safe = sanitizeUsername(username);
  if (!safe) return res.status(400).json({ ok: false, error: 'BAD_USERNAME' });
  ensureUserDirs(safe);
  res.cookie('username', safe, {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365 
  });
  res.json({ ok: true, username: safe });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('username');
  res.json({ ok: true });
});

app.get('/api/whoami', (req, res) => {
  const u = req.cookies?.username || null;
  res.json({ username: u ? sanitizeUsername(u) : null });
});

app.get('/api/expressions/:slot', requireLogin, (req, res) => {
  const slot = String(req.params.slot || '');
  if (!/^[0-9]$/.test(slot)) return res.status(400).json({ ok: false, error: 'BAD_SLOT' });
  const dir = path.join(DATA_ROOT, req.user, slot);
  try {
    const files = fs.readdirSync(dir)
      .filter(f => /^(\d+)\.(png|jpg|jpeg)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        return na - nb;
      })
      .map(f => ({
        name: f,
        url: `/data/${encodeURIComponent(req.user)}/${slot}/${encodeURIComponent(f)}`,
        type: mime.getType(f) || 'image/*'
      }));
    res.json({ ok: true, files });
  } catch (e) {
    res.json({ ok: true, files: [] });
  }
});

// 清空某槽位的文件
app.delete('/api/expressions/:slot', requireLogin, (req, res) => {
  const slot = String(req.params.slot || '');
  if (!/^[0-9]$/.test(slot)) return res.status(400).json({ ok: false, error: 'BAD_SLOT' });
  const dir = path.join(DATA_ROOT, req.user, slot);
  try {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'CLEAR_FAILED' });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slot = req.params.slot;
    const user = req.user;
    if (!/^[0-9]$/.test(slot)) return cb(new Error('BAD_SLOT'));
    const dir = path.join(DATA_ROOT, user, slot);
    ensureUserDirs(user);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // 必须形如 0.jpg/png ~ n.jpg/png
    const orig = file.originalname;
    const m = orig.match(/^(\d+)\.(png|jpg|jpeg)$/i);
    if (!m) return cb(new Error('BAD_FILENAME'));
    cb(null, `${m[1]}.${m[2].toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 100 }, // 单文件≤20MB，总数≤100
  fileFilter: (req, file, cb) => {
    const ok = /image\/(png|jpe?g)/i.test(file.mimetype) && /^(\d+)\.(png|jpg|jpeg)$/i.test(file.originalname);
    cb(ok ? null : new Error('BAD_FILETYPE'), ok);
  }
});

app.post('/api/upload/:slot', requireLogin, upload.array('files', 100), (req, res) => {
  res.json({ ok: true, count: req.files?.length || 0 });
});

app.get('/', (req, res) => res.redirect('/public/index.html'));
app.get('/left-face', (req, res) => res.sendFile(path.join(__dirname, 'public', 'left.html')));
app.get('/right-face', (req, res) => res.sendFile(path.join(__dirname, 'public', 'right.html')));
app.get('/control', (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));

app.listen(PORT, () => {

  
  // 显示科幻风格的加载条
  const loadingChars = ['▒', '█'];
  const loadingLength = 40;
  const loadingSteps = 20;
  
  // 定义同步延时函数
  function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
  
  console.log('\n系统初始化中...');
  
  for (let i = 0; i <= loadingSteps; i++) {
    const progress = Math.floor((i / loadingSteps) * loadingLength);
    const loadingBar = loadingChars[1].repeat(progress) + loadingChars[0].repeat(loadingLength - progress);
    const percent = Math.floor((i / loadingSteps) * 100);
    
    process.stdout.write(`\r[${loadingBar}] ${percent}% - 加载系统核心组件...`);
    
    // 添加延时，模拟真实加载过程
    sleep(100);
    
    // 完成时换行
    if (i === loadingSteps) {
      process.stdout.write('\n');
    }
  }
  
  // 显示系统初始化信息
  const systemMessages = [
    '正在初始化神经网络连接...',
    '正在校准情感模拟引擎...',
    '正在加载表情数据库...',
    '正在连接主控制系统...',
    '所有系统正常，准备就绪!'
  ];
  
  // 逐行显示系统信息，添加延时效果
  systemMessages.forEach((msg, index) => {
    console.log(`[${index + 1}/${systemMessages.length}] ${msg}`);
    // 每条信息之间添加延时
    sleep(300);
  });
  
  // 逐字显示欢迎信息
  const welcomeMessage = `欢迎 沫泽 主人登录Protogen Terminal! v1.0.1 Beta: http://localhost:${PORT}`;
  let displayedMessage = '';
  
  console.log('\n');
  
  // 使用前面定义的sleep函数
  
  for (let i = 0; i < welcomeMessage.length; i++) {
    displayedMessage += welcomeMessage[i];
    process.stdout.write(`\r${displayedMessage}`);
    // 添加延时，模拟打字效果
    sleep(50);
  }
  console.log('\n');
});