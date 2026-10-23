  // j/kで青いカーソル行が動き、目次の現在位置も追いかける
  // 上から順に読み下ろし、下の方で「少し前から読み直そう」と2行戻る
  await prepare();
  await moveTo(1300, 860, 1);
  await page.evaluate(() => { document.getElementById('__cursor').style.display = 'none'; });
  const cursorLine = () => page.evaluate(() => Number(document.querySelector('[data-mdecho-cursor]')?.getAttribute('data-line') ?? 0));

  await record('06-cursor-line');
  await page.waitForTimeout(1000);
  while ((await cursorLine()) < 70) await press('j', 260);
  await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) await press('k', 600);
  await page.waitForTimeout(1500);
  await page.screencast.stop();

  await hideDecor(true);
  await shot('06-cursor-line');
  await hideDecor(false);
  await page.evaluate(() => { document.getElementById('__cursor').style.display = ''; });
