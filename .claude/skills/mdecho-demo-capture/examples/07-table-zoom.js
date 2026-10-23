  // 横に長い表を拡大し、拡大したままj/kとEnterでコメントする
  await prepare();
  const expand = page.locator('.mdecho-table-expand').first();
  const box = await expand.boundingBox();
  await page.evaluate((dy) => window.scrollBy(0, dy), box.y - 130);
  await page.waitForTimeout(500);

  await record('07-table-zoom');
  await page.waitForTimeout(1500);
  await clickOn(expand, 500);
  await page.waitForTimeout(1200);
  await moveTo(1300, 860, 20);
  await press('j', 500);
  await press('j', 500);
  await page.waitForTimeout(400);
  await hideDecor(true);
  await page.screenshot({ path: `${ROOT}/shots/07-table-zoom.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await hideDecor(false);
  await press('Enter', 600);
  await page.getByRole('textbox').pressSequentially('無料枠の上限(レコード数と月間リクエスト数)を書き足して', { delay: 60 });
  await page.waitForTimeout(400);
  await press('Control+Enter', 1200);
  await hideDecor(true);
  await page.screenshot({ path: `${ROOT}/shots/07-table-zoom-comment.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await hideDecor(false);
  await press('Escape', 1500);
  await page.screencast.stop();
