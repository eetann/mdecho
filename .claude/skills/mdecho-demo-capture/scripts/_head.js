  // 録画フレームの下端約87pxが灰色になるため、録画中だけ縦を伸ばして後で1440x900に切り出す
  const REC = { width: 1440, height: 990 };
  const SHOT = { width: 1440, height: 900 };

  // 疑似カーソル・クリックの波紋・押したキーのバッジをページに差し込む
  // 録画は下を切り落とすので、カーソル行がその帯に隠れないようスクロールの余白をとる
  const decorate = (PAD) => {
    if (window.__decorated) return;
    window.__decorated = true;
    const install = () => {
      const style = document.createElement('style');
      style.textContent = `
        #__cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);will-change:transform}
        .__ripple{position:fixed;z-index:2147483646;pointer-events:none;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(239,68,68,.35);border:2px solid rgba(239,68,68,.8);animation:__rip .6s ease-out forwards}
        #__cursor.__held::before{content:'';position:absolute;left:-13px;top:-14px;width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,.25);border:2px solid rgba(239,68,68,.85)}
        html{scroll-padding-bottom:${PAD}px}
        @media (min-height:${PAD + 900}px){.mdecho-table-modal{bottom:${PAD}px !important}}
        @keyframes __rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
        #__keys{position:fixed;right:28px;bottom:120px;z-index:2147483647;pointer-events:none;display:flex;gap:8px}
        .__key{font:600 22px/1 ui-monospace,Menlo,monospace;color:#fff;background:rgba(17,24,39,.82);padding:10px 16px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.25);animation:__key 1s ease-out forwards}
        @keyframes __key{0%{opacity:0;transform:translateY(6px)}10%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0}}
      `;
      document.documentElement.appendChild(style);
      const cursor = document.createElement('div');
      cursor.id = '__cursor';
      cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.2 3.9 7.3-2.6 1.4-3.9-7.3L4 20z" fill="#111827" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.documentElement.appendChild(cursor);
      const keys = document.createElement('div');
      keys.id = '__keys';
      document.documentElement.appendChild(keys);
      // 吹き出しのドラッグはpointerdownでpreventDefaultされmouse系が来ないので、pointer系で追う
      addEventListener('pointermove', (e) => {
        cursor.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
      }, true);
      addEventListener('pointerdown', (e) => {
        const r = document.createElement('div');
        r.className = '__ripple';
        r.style.left = `${e.clientX}px`;
        r.style.top = `${e.clientY}px`;
        document.documentElement.appendChild(r);
        setTimeout(() => r.remove(), 700);
        cursor.classList.add('__held');
      }, true);
      addEventListener('pointerup', () => cursor.classList.remove('__held'), true);
      const LABEL = { Enter: 'Enter', Escape: 'Esc', ArrowDown: '↓', ArrowUp: '↑', j: 'j', k: 'k' };
      addEventListener('keydown', (e) => {
        const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
        if (!(e.key in LABEL)) return;
        if (typing && !(e.ctrlKey || e.metaKey) && e.key !== 'Escape') return;
        const k = document.createElement('div');
        k.className = '__key';
        k.textContent = (e.ctrlKey ? 'Ctrl + ' : e.metaKey ? '⌘ + ' : '') + LABEL[e.key];
        keys.replaceChildren(k);
      }, true);
    };
    if (document.documentElement) install();
    else document.addEventListener('DOMContentLoaded', install);
  };
  if (!page.__decorated) {
    await page.addInitScript(decorate, REC.height - SHOT.height);
    page.__decorated = true;
  }

  let pos = { x: 1400, y: 880 };
  const moveTo = async (x, y, steps = 30) => {
    await page.mouse.move(x, y, { steps });
    pos = { x, y };
  };
  const centerOf = async (locator) => {
    const b = await locator.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const clickOn = async (locator, pause = 250) => {
    const c = await centerOf(locator);
    await moveTo(c.x, c.y);
    await page.waitForTimeout(pause);
    await page.mouse.down();
    await page.mouse.up();
  };
  const press = async (key, wait = 350) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(wait);
  };
  // 録画用の状態に整える。clearでコメントとカーソル位置を消す
  const prepare = async ({ clear = true } = {}) => {
    await page.setViewportSize(REC);
    await page.goto(URL);
    if (clear) {
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(URL);
    }
    await page.waitForTimeout(600);
    await page.mouse.move(pos.x, pos.y);
  };
  const record = (name) => page.screencast.start({ path: `${ROOT}/videos/raw/${name}.webm`, size: REC, fps: 30 });
  const shot = async (name) => {
    await page.setViewportSize(SHOT);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ROOT}/shots/${name}.png` });
    await page.setViewportSize(REC);
  };
  // 静止画には疑似カーソルとキーバッジを写さない
  const hideDecor = (hidden) => page.evaluate((h) => {
    for (const id of ['__cursor', '__keys']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = h ? 'hidden' : '';
    }
  }, hidden);

