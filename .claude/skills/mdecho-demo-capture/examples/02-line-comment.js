  // 本文のダブルクリックで1行にコメントする
  await prepare();
  await record('02-line-comment');
  await page.waitForTimeout(1000);

  // 吹き出しを押さなくても、本文のダブルクリックでコメントを始められる
  const text = page.locator('[data-line="13"]').first();
  const tb = await text.boundingBox();
  await moveTo(tb.x + 260, tb.y + tb.height / 2);
  await page.waitForTimeout(500);
  await page.mouse.dblclick(tb.x + 260, tb.y + tb.height / 2, { delay: 80 });
  await page.waitForTimeout(500);
  await page.getByRole('textbox').pressSequentially('「月に数件」だと根拠として弱いので、直近3か月の件数を書いてほしい', { delay: 70 });
  await page.waitForTimeout(600);
  await clickOn(page.getByRole('button', { name: 'save' }));
  await page.waitForTimeout(400);
  await moveTo(1300, 860, 20);
  await page.waitForTimeout(1800);
  await page.screencast.stop();

  await hideDecor(true);
  await shot('02-line-comment-saved');
  await hideDecor(false);
