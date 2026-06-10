// stepRunner.js — steps + assert + Wait Queue + Notify LINE พร้อมรูป

import { readFileSync } from 'fs';

// ── format time elapsed ───────────────────────────────────────────────────────
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}ชม ${m % 60}น ${s % 60}ว`;
  if (m > 0) return `${m}น ${s % 60}ว`;
  return `${s}ว`;
}

// ── apply template variables ──────────────────────────────────────────────────
function applyTemplate(tpl, vars) {
  return tpl
    .replace(/{worker}/g,   vars.worker   || '')
    .replace(/{url}/g,      vars.url      || '')
    .replace(/{step}/g,     vars.step     || '')
    .replace(/{time}/g,     vars.time     || new Date().toLocaleString('th-TH'))
    .replace(/{elapsed}/g,  vars.elapsed  || '')
    .replace(/{pass}/g,     String(vars.pass    ?? ''))
    .replace(/{fail}/g,     String(vars.fail    ?? ''))
    .replace(/{passRate}/g, String(vars.passRate ?? ''));
}

// ── send LINE (รูป + ข้อความ) ─────────────────────────────────────────────────
async function sendLine(lineConfig, message, screenshotPath) {
  if (!lineConfig?.token || !lineConfig?.userId) return;

  const body = { token: lineConfig.token, userId: lineConfig.userId, message };

  // อ่านรูปเป็น base64 ถ้ามี path และเปิด sendScreenshot
  if (screenshotPath && lineConfig.imgbbKey && lineConfig.sendScreenshot) {
    try {
      const buf    = readFileSync(screenshotPath);
      body.screenshotBase64 = buf.toString('base64');
      body.imgbbKey         = lineConfig.imgbbKey;
    } catch {}
  }

  try {
    await fetch(`${lineConfig.baseUrl || 'http://localhost:3000'}/api/notify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch {}
}

// ── Main runner ───────────────────────────────────────────────────────────────
export async function runSteps(page, steps, workerId, workerName, emit, lineConfig) {
  const label     = workerName || (workerId ? `จอที่ ${workerId}` : 'CDP');
  const prefix    = `[${label}]`;
  const results   = [];
  let   lastSsPath = null; // เก็บ path screenshot ล่าสุด

  const push = async (msg, status = 'info', idx = null) => {
    await emit(msg, status);
    results.push({ stepIndex: idx, message: msg, status });
  };

  for (let i = 0; i < steps.length; i++) {
    const step    = steps[i];
    const delayMs = parseFloat(step.delay) * 1000 || 0;
    const timeout = 8000;
    const slabel  = `Step ${i + 1} [${step.action}]`;

    try {
      switch (step.action) {

        // ── Actions ──────────────────────────────────────────────────────────
        case 'Click':
          await page.waitForSelector(step.target, { timeout });
          await page.click(step.target);
          await push(`${prefix} ✅ ${slabel} Click → ${step.target}`, 'pass', i);
          break;

        case 'Input Text':
          await page.waitForSelector(step.target, { timeout });
          await page.fill(step.target, step.value || '');
          await push(`${prefix} ✅ ${slabel} Input → "${step.value}"`, 'pass', i);
          break;

        case 'Check Box':
          await page.waitForSelector(step.target, { timeout });
          await page.check(step.target);
          await push(`${prefix} ✅ ${slabel} Check → ${step.target}`, 'pass', i);
          break;

        case 'Uncheck Box':
          await page.waitForSelector(step.target, { timeout });
          await page.uncheck(step.target);
          await push(`${prefix} ✅ ${slabel} Uncheck → ${step.target}`, 'pass', i);
          break;

        case 'Select Dropdown':
          await page.waitForSelector(step.target, { timeout });
          await page.selectOption(step.target, step.value || '');
          await push(`${prefix} ✅ ${slabel} Select → "${step.value}"`, 'pass', i);
          break;

        case 'Press Key':
          await page.waitForSelector(step.target, { timeout });
          await page.press(step.target, step.value || 'Enter');
          await push(`${prefix} ✅ ${slabel} Press → "${step.value}"`, 'pass', i);
          break;

        case 'Hover':
          await page.waitForSelector(step.target, { timeout });
          await page.hover(step.target);
          await push(`${prefix} ✅ ${slabel} Hover → ${step.target}`, 'pass', i);
          break;

        case 'Scroll':
          if (step.target?.trim()) {
            await page.waitForSelector(step.target, { timeout });
            await page.evaluate(s => document.querySelector(s)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), step.target);
            await push(`${prefix} ✅ ${slabel} Scroll → ${step.target}`, 'pass', i);
          } else {
            const [sx, sy] = (step.value || '0,600').split(',').map(Number);
            await page.evaluate(([x, y]) => window.scrollBy(x, y), [sx || 0, sy || 600]);
            await push(`${prefix} ✅ ${slabel} Scroll x:${sx||0} y:${sy||600}`, 'pass', i);
          }
          break;

        case 'Screenshot': {
          const fullPage = (step.value || '').toLowerCase() === 'full';
          const ssPath   = `/tmp/ss_${label.replace(/\s/g,'_')}_s${i}_${Date.now()}.png`;
          await page.screenshot({ path: ssPath, fullPage });
          lastSsPath = ssPath;
          await push(`${prefix} 📸 ${slabel} Screenshot → ${ssPath}`, 'info', i);
          break;
        }

        case 'Extract Text': {
          await page.waitForSelector(step.target, { timeout });
          const text = await page.textContent(step.target);
          await push(`${prefix} 📋 ${slabel} Extract → "${text?.trim()}"`, 'info', i);
          break;
        }

        case 'Wait for URL':
          await page.waitForURL(step.value || step.target, { timeout: 15000 });
          await push(`${prefix} ✅ ${slabel} URL ตรง → "${step.value || step.target}"`, 'pass', i);
          break;

        case 'Wait for Element':
          await page.waitForSelector(step.target, { timeout: (parseFloat(step.value) || 10) * 1000 });
          await push(`${prefix} ✅ ${slabel} Element ปรากฏ → ${step.target}`, 'pass', i);
          break;

        case 'Wait (Sec)':
          await page.waitForTimeout((parseFloat(step.value) || 2) * 1000);
          await push(`${prefix} ⏳ ${slabel} รอ ${step.value || 2}s`, 'info', i);
          break;

        // ── Wait Queue ────────────────────────────────────────────────────────
        // รอจน element หายไปแบบไม่มี timeout
        // target = selector ที่บอกว่า "ยังอยู่ในคิว" เช่น .queue-spinner
        // value  = ว่างหรือ "notify" (ส่ง LINE ทุก 10 นาที ขณะรอ)
        case 'Wait Queue': {
          const notifyWhileWait = (step.value || '').toLowerCase().includes('notify');
          const pollMs          = 3000;   // ตรวจทุก 3 วินาที
          const notifyEveryMs   = 10 * 60 * 1000; // แจ้ง LINE ทุก 10 นาที
          const startedAt       = Date.now();
          let   lastNotifyAt    = startedAt;
          let   lastProgressAt  = startedAt;

          await push(`${prefix} ⏳ ${slabel} รอคิว "${step.target}" หายไป...`, 'info', i);

          while (true) {
            const visible = await page.isVisible(step.target).catch(() => false);

            if (!visible) {
              // คิวผ่านแล้ว!
              const elapsed = fmtElapsed(Date.now() - startedAt);
              await push(`${prefix} ✅ ${slabel} คิวผ่านแล้ว! รอทั้งหมด ${elapsed}`, 'pass', i);

              // ส่ง LINE แจ้งว่าผ่านคิว
              if (lineConfig) {
                const msg = applyTemplate(
                  lineConfig.queuePassTemplate || lineConfig.defaultTemplate || '✅ คิวผ่านแล้ว!\n👤 {worker}\n🌐 {url}\n⏱ {elapsed}\n🕐 {time}',
                  { worker: label, url: page.url(), elapsed, time: new Date().toLocaleString('th-TH') }
                );
                // ถ่ายรูปหน้าปัจจุบันก่อนส่ง
                const ssPath = `/tmp/queue_pass_${label.replace(/\s/g,'_')}_${Date.now()}.png`;
                await page.screenshot({ path: ssPath }).catch(() => {});
                lastSsPath = ssPath;
                await sendLine(lineConfig, msg, ssPath);
              }
              break;
            }

            const now = Date.now();

            // progress log ทุก 15 วินาที
            if (now - lastProgressAt >= 15000) {
              const elapsed = fmtElapsed(now - startedAt);
              await push(`${prefix} ⏳ ยังรอคิว... ผ่านมา ${elapsed}`, 'info', null);
              lastProgressAt = now;
            }

            // ส่ง LINE ทุก 10 นาที ถ้าเปิด notify
            if (notifyWhileWait && now - lastNotifyAt >= notifyEveryMs && lineConfig) {
              const elapsed = fmtElapsed(now - startedAt);
              const msg = applyTemplate(
                lineConfig.queueFailTemplate || '⏱ ยังรอคิวอยู่\n👤 {worker}\n🌐 {url}\n⏱ {elapsed}\n🕐 {time}',
                { worker: label, url: page.url(), elapsed, time: new Date().toLocaleString('th-TH') }
              );
              const ssPath = `/tmp/queue_wait_${label.replace(/\s/g,'_')}_${Date.now()}.png`;
              await page.screenshot({ path: ssPath }).catch(() => {});
              await sendLine(lineConfig, msg, ssPath);
              lastNotifyAt = now;
            }

            await page.waitForTimeout(pollMs);
          }
          break;
        }

        // ── Notify LINE ───────────────────────────────────────────────────────
        // value = ข้อความ custom (ว่าง = ใช้ template defaultTemplate)
        // ถ้ามี screenshot ก่อนหน้าจะแนบรูปไปด้วย
        case 'Notify LINE': {
          if (!lineConfig?.token || !lineConfig?.userId) {
            await push(`${prefix} ⚠️ ${slabel} ยังไม่ตั้งค่า LINE — ไปที่ Settings`, 'warn', i);
            break;
          }

          const customMsg = step.value?.trim();
          const msg = customMsg
            ? applyTemplate(customMsg, {
                worker:  label,
                url:     page.url(),
                step:    slabel,
                time:    new Date().toLocaleString('th-TH'),
              })
            : applyTemplate(
                lineConfig.defaultTemplate || '🤖 Auto Tester\n👤 {worker}\n🌐 {url}\n📌 {step}\n🕐 {time}',
                { worker: label, url: page.url(), step: slabel, time: new Date().toLocaleString('th-TH') }
              );

          // ถ่ายรูปตอนนี้ก่อนส่ง (ถ้าเปิด sendScreenshot)
          let ssPath = lastSsPath;
          if (lineConfig.sendScreenshot) {
            const newPath = `/tmp/notify_${label.replace(/\s/g,'_')}_s${i}_${Date.now()}.png`;
            await page.screenshot({ path: newPath }).catch(() => {});
            ssPath = newPath;
          }

          await sendLine(lineConfig, msg, ssPath);
          await push(`${prefix} 📲 ${slabel} ส่ง LINE แล้ว`, 'pass', i);
          break;
        }

        // ── Asserts ──────────────────────────────────────────────────────────
        case 'Assert Text': {
          await page.waitForSelector(step.target, { timeout });
          const actual = (await page.textContent(step.target))?.trim() || '';
          if (actual.includes(step.value || '')) {
            await push(`${prefix} ✅ ${slabel} Assert Text PASS → "${step.value}"`, 'pass', i);
          } else {
            await push(`${prefix} ❌ ${slabel} Assert Text FAIL → คาด "${step.value}" แต่ได้ "${actual}"`, 'fail', i);
            if (step.stopOnFail) throw new Error('Assert text fail');
          }
          break;
        }

        case 'Assert URL': {
          const cur = page.url();
          if (cur.includes(step.value || '')) {
            await push(`${prefix} ✅ ${slabel} Assert URL PASS`, 'pass', i);
          } else {
            await push(`${prefix} ❌ ${slabel} Assert URL FAIL → คาด "${step.value}" แต่ได้ "${cur}"`, 'fail', i);
            if (step.stopOnFail) throw new Error('Assert URL fail');
          }
          break;
        }

        case 'Assert Visible': {
          await page.waitForSelector(step.target, { timeout });
          const v = await page.isVisible(step.target);
          if (v) { await push(`${prefix} ✅ ${slabel} Assert Visible PASS`, 'pass', i); }
          else   { await push(`${prefix} ❌ ${slabel} Assert Visible FAIL`, 'fail', i); if (step.stopOnFail) throw new Error(''); }
          break;
        }

        case 'Assert Hidden': {
          const h = await page.isHidden(step.target);
          if (h) { await push(`${prefix} ✅ ${slabel} Assert Hidden PASS`, 'pass', i); }
          else   { await push(`${prefix} ❌ ${slabel} Assert Hidden FAIL`, 'fail', i); if (step.stopOnFail) throw new Error(''); }
          break;
        }

        case 'Assert Title': {
          const t = await page.title();
          if (t.includes(step.value || '')) { await push(`${prefix} ✅ ${slabel} Assert Title PASS → "${t}"`, 'pass', i); }
          else { await push(`${prefix} ❌ ${slabel} Assert Title FAIL → "${t}"`, 'fail', i); if (step.stopOnFail) throw new Error(''); }
          break;
        }

        case 'Assert Count': {
          const count = await page.locator(step.target).count();
          const exp   = parseInt(step.value) || 0;
          if (count === exp) { await push(`${prefix} ✅ ${slabel} Assert Count PASS → ${count}`, 'pass', i); }
          else { await push(`${prefix} ❌ ${slabel} Assert Count FAIL → คาด ${exp} นับได้ ${count}`, 'fail', i); if (step.stopOnFail) throw new Error(''); }
          break;
        }

        default:
          await push(`${prefix} ⚠️ ไม่รู้จัก action: "${step.action}"`, 'info', i);
      }

    } catch (err) {
      await push(`${prefix} ❌ ${slabel} พัง: ${err.message}`, 'fail', i);
      if (step.stopOnError || step.stopOnFail) break;
    }

    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
      await push(`${prefix} ⏳ delay ${step.delay}s`, 'info', null);
    }
  }

  return results;
}
