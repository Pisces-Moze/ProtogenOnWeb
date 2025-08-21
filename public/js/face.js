const isRight = window.__IS_RIGHT__ || false; // 右脸需要镜像 class 已在 HTML 中
const faceImg = document.getElementById('face');
const loginOverlay = document.getElementById('login');
const usernameInput = document.getElementById('username');
const btnLogin = document.getElementById('btnLogin');

const bc = new BroadcastChannel('protogen-face-sync');
let currentSlot = 0;
let playingTimer = null;
let frames = []; // {url}
let frameIndex = 0;
let isPaused = false; // 新增暂停状态标记
let isMobileDevice = false; // 移动设备标记

// 检测是否为移动设备
function checkMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         (window.innerWidth <= 768);
}

init();

// 添加点击事件监听器，实现点击暂停/播放功能
faceImg.addEventListener('click', (e) => {
  e.preventDefault();
  togglePlayPause();
});

// 监听窗口大小变化，更新移动设备状态
window.addEventListener('resize', () => {
  const wasMobile = isMobileDevice;
  isMobileDevice = checkMobileDevice();
  
  // 如果设备类型发生变化，更新UI
  if (wasMobile !== isMobileDevice) {
    const mobileHint = document.querySelector('.mobile-hint');
    if (mobileHint) {
      mobileHint.style.display = isMobileDevice ? 'block' : 'none';
    }
  }
});

async function init() {
  // 检测是否为移动设备
  isMobileDevice = checkMobileDevice();
  
  // 根据设备类型设置UI
  const mobileHint = document.querySelector('.mobile-hint');
  if (mobileHint) {
    mobileHint.style.display = isMobileDevice ? 'block' : 'none';
  }
  
  const user = await whoami();
  if (!user) {
    showLogin();
  } else {
    welcome(user);
    await loadAndPlay(currentSlot);
  }
}

function showLogin() {
  loginOverlay.hidden = false;
  usernameInput?.focus();
  btnLogin?.addEventListener('click', doLogin);
  usernameInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const v = (usernameInput.value || '').trim();
  if (!v) return;
  const res = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: v })
  }).then(r => r.json());
  if (res.ok) {
    loginOverlay.hidden = true;
    welcome(res.username);
    await loadAndPlay(currentSlot);
  }
}

function welcome(user) {
  const motd = document.getElementById('motd');
  if (motd) {
    motd.textContent = `WELCOME ${user}!\n- 按住 Shift + 0..9 切换表情\n- /control 可上传表情素材`;
  }
}

async function whoami() {
  const r = await fetch('/api/whoami').then(r => r.json());
  return r.username || null;
}

// 加载某槽位 frames，并以 5FPS 播放
async function loadAndPlay(slot) {
  stopPlaying();
  frameIndex = 0;
  isPaused = false; // 重置暂停状态
  currentSlot = Number(slot) || 0;
  const res = await fetch(`/api/expressions/${currentSlot}`).then(r => r.json());
  frames = (res.files || []);
  if (!frames.length) {
    faceImg.src = '';
    faceImg.alt = `oh!沫泽没找到你的资源QWQ ${currentSlot}`;
    return;
  }
  faceImg.src = frames[0].url;
  startPlaying();
}

function startPlaying() {
  if (isPaused || !frames.length) return;
  
  playingTimer = setInterval(() => {
    if (!frames.length) return;
    frameIndex = (frameIndex + 1) % frames.length; // 循环
    faceImg.src = frames[frameIndex].url;
  }, 1000 / 5);
}

function stopPlaying() {
  if (playingTimer) clearInterval(playingTimer);
  playingTimer = null;
}

function togglePlayPause() {
  isPaused = !isPaused;
  
  if (isPaused) {
    stopPlaying();
  } else {
    startPlaying();
  }
  
  // 显示暂停/播放状态提示
  const hint = document.querySelector('.mobile-hint');
  if (hint) {
    hint.textContent = isPaused ? '▶ 点击继续播放' : '← 左右滑动切换表情 →';
  }
}

// 热键：Shift + 0..9
window.addEventListener('keydown', (e) => {
  if (!e.shiftKey) return;
  const m = e.code.match(/^Digit(\d)$/);
  if (!m) return;
  const slot = Number(m[1]);
  bc.postMessage({ type: 'slot', slot }); // 广播同步
  loadAndPlay(slot);
});

// 移动端触摸支持 - 添加滑动切换表情功能
let touchStartX = 0;
let touchEndX = 0;

window.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

window.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 50; // 滑动阈值
  
  if (touchEndX < touchStartX - swipeThreshold) {
    // 向左滑动，切换到下一个表情
    const nextSlot = (currentSlot + 1) % 10;
    bc.postMessage({ type: 'slot', slot: nextSlot });
    loadAndPlay(nextSlot);
  }
  
  if (touchEndX > touchStartX + swipeThreshold) {
    // 向右滑动，切换到上一个表情
    const prevSlot = (currentSlot - 1 + 10) % 10;
    bc.postMessage({ type: 'slot', slot: prevSlot });
    loadAndPlay(prevSlot);
  }
}

// 接收同步
bc.addEventListener('message', (evt) => {
  const { type, slot } = evt.data || {};
  if (type === 'slot') {
    loadAndPlay(slot);
  }
});