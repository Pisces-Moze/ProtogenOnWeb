const grid = document.getElementById('grid');
const who = document.getElementById('who');

init();

async function init() {
  const user = await whoami();
  if (!user) {
    document.body.innerHTML = '<div class="panel"><h2>欸欸欸？！你还没注册/登录owo</h2><p>请先在 /left-face 或 /right-face 登录以注册。</p></div>';
    return;
  }
  who.textContent = `当前用户：${user}`;
  renderGrid();
}

async function whoami() {
  const r = await fetch('/api/whoami').then(r => r.json());
  return r.username || null;
}

function renderGrid() {
  grid.innerHTML = '';
  for (let i = 0; i <= 9; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>槽位 ${i}</h3>
      <div class="files" id="files-${i}">加载中…</div>
      <div class="row">
        <label>
          选择文件
          <input id="file-${i}" type="file" accept="image/png,image/jpeg" multiple />
        </label>
        <button id="upload-${i}">上传</button>
        <button id="clear-${i}">清空</button>
      </div>
    `;
    grid.appendChild(card);
    bindSlot(i);
    refreshList(i);
  }
}

function bindSlot(i) {
  const input = document.getElementById(`file-${i}`);
  const btnUpload = document.getElementById(`upload-${i}`);
  const btnClear = document.getElementById(`clear-${i}`);

  btnUpload.addEventListener('click', async () => {
    if (!input.files || input.files.length === 0) return alert('请先选择文件');
    // 校验文件名 0.jpg/png ~ n.jpg/png
    for (const f of input.files) {
      if (!/^(\d+)\.(png|jpg|jpeg)$/i.test(f.name)) {
        alert(`文件名不合法：${f.name}（应为 0.jpg/png ~ n.jpg/png）`);
        return;
      }
    }
    const fd = new FormData();
    for (const f of input.files) fd.append('files', f, f.name);
    const res = await fetch(`/api/upload/${i}`, { method: 'POST', body: fd }).then(r => r.json());
    if (res.ok) {
      input.value = '';
      refreshList(i);
    } else {
      alert('上传失败');
    }
  });

  btnClear.addEventListener('click', async () => {
    if (!confirm(`确定清空槽位 ${i} 的所有文件？`)) return;
    const res = await fetch(`/api/expressions/${i}`, { method: 'DELETE' }).then(r => r.json());
    if (res.ok) refreshList(i);
  });
}

async function refreshList(i) {
  const box = document.getElementById(`files-${i}`);
  box.textContent = '加载中…';
  const res = await fetch(`/api/expressions/${i}`).then(r => r.json());
  if (!res.ok) {
    box.textContent = '加载失败（可能未登录）';
    return;
  }
  if (!res.files.length) {
    box.textContent = '（未装载）建议上传 0.png / 0.jpg 起始的连续编号文件';
    return;
  }
  box.innerHTML = res.files.map(f => `<div>${f.name}</div>`).join('');
}