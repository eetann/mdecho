  // 本文をドラッグで範囲選択すると返信ボタンが出て、選んだ部分を引用してコメントできる
  await prepare({ clear: false });
  const target = '記事タイトルに一致したものを上位に出す';
  const rectOf = () => page.evaluate((text) => {
    const walker = document.createTreeWalker(document.querySelector('.markdown-body'), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const i = walker.currentNode.textContent.indexOf(text);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(walker.currentNode, i);
      r.setEnd(walker.currentNode, i + text.length);
      const b = r.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    }
    return null;
  }, target);
  const r0 = await rectOf();
  await page.evaluate((dy) => window.scrollBy(0, dy), r0.y - 420);
  await page.waitForTimeout(500);
  const r = await rectOf();

  await record('04-select-quote');
  await page.waitForTimeout(800);
  await moveTo(r.x + 1, r.y + r.h / 2);
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.mouse.move(r.x + r.w - 1, r.y + r.h / 2, { steps: 35 });
  await page.mouse.up();
  await page.waitForTimeout(900);

  const reply = page.locator('.mdecho-reply-button');
  await hideDecor(true);
  await page.screenshot({ path: `${ROOT}/shots/04-select-quote-button.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await hideDecor(false);
  await clickOn(reply, 400);
  await page.waitForTimeout(700);
  await page.getByRole('textbox').pressSequentially(' はPagefindのどのオプションで設定する？手順にも入れておいて', { delay: 60 });
  await page.waitForTimeout(400);
  await press('Control+Enter', 600);
  await moveTo(1300, 860, 20);
  await page.waitForTimeout(1600);
  await page.screencast.stop();

  await hideDecor(true);
  await shot('04-select-quote-saved');
  await hideDecor(false);
