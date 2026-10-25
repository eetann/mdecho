  // 1行目の吹き出しを押したまま最終行までドラッグして複数行にコメントする(02のコメントは残す)
  await prepare({ clear: false });
  const from = page.getByRole('button', { name: '29行目にコメントする' });
  const to = page.getByRole('button', { name: '31行目にコメントする' });
  const box = await from.boundingBox();
  await page.evaluate((dy) => window.scrollBy(0, dy), box.y - 380);
  await page.waitForTimeout(500);

  await record('03-multiline');
  await page.waitForTimeout(1000);
  const a = await centerOf(from);
  const b = await centerOf(to);
  await moveTo(a.x + 80, a.y);
  await page.waitForTimeout(300);
  await moveTo(a.x, a.y, 15);
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.waitForTimeout(500);
  // 押したまま1行ずつ下へ引っ張る。範囲が伸びていくのが見えるよう行ごとに止める
  const mid = await centerOf(page.getByRole('button', { name: '30行目にコメントする' }));
  for (const p of [mid, b]) {
    await page.mouse.move(p.x, p.y, { steps: 25 });
    await page.waitForTimeout(450);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.getByRole('textbox').pressSequentially('Algoliaが無料枠に収まるなら、比べるのは運用の手間だけになるはず。無料枠の上限も書いておいて', { delay: 60 });
  await page.waitForTimeout(500);
  await press('Control+Enter', 600);
  await moveTo(1300, 860, 20);
  await page.waitForTimeout(1800);
  await page.screencast.stop();

  await hideDecor(true);
  await shot('03-multiline-saved');
  await hideDecor(false);
