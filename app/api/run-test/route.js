import { chromium as chromiumExtra, firefox as firefoxExtra } from 'playwright-extra';
import { chromium, firefox, webkit } from 'playwright';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { runSteps } from './stepRunner.js';

chromiumExtra.use(stealthPlugin());
firefoxExtra.use(stealthPlugin());

export async function POST(req) {
  const body = await req.json();
  const {
    url, steps, useStealth = true,
    workers = 1, browserType = 'chromium',
    workerNames = [],   // ชื่อแต่ละ worker จาก config
    lineConfig = null,  // LINE config พร้อม templates
  } = body;
  const workerCount = Math.min(Math.max(1, parseInt(workers) || 1), 10);

  const encoder = new TextEncoder();
  const stream  = new TransformStream();
  const writer  = stream.writable.getWriter();

  const send = async (type, data) => {
    try { await writer.write(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
  };

  (async () => {
    let browser = null;
    const allResults = [];

    try {
      let engine;
      const launchOptions = { headless: false };
      if (browserType === 'firefox')       engine = useStealth ? firefoxExtra : firefox;
      else if (browserType === 'webkit')   { engine = webkit; if (useStealth) await send('log', { msg: '⚠️ Safari ไม่รองรับ Stealth', status: 'warn' }); }
      else if (browserType === 'chrome')   { engine = chromiumExtra; launchOptions.channel = 'chrome'; }
      else                                  engine = useStealth ? chromiumExtra : chromium;

      if (useStealth) await send('log', { msg: '🛡️ Stealth Mode เปิด', status: 'info' });
      await send('log', { msg: `🚀 เริ่มรัน [${browserType.toUpperCase()}] ${workerCount} worker(s)`, status: 'info' });

      browser = await engine.launch(launchOptions);

      const runWorker = async (workerId) => {
        // ชื่อ worker จาก config หรือ default
        const workerName = workerNames[workerId - 1] || `จอที่ ${workerId}`;
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'th-TH' });
        const page    = await context.newPage();

        await send('log', { msg: `[${workerName}] 🟢 เปิด session`, status: 'info' });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await send('log', { msg: `[${workerName}] 🌐 โหลด: ${url}`, status: 'info' });

          const results = await runSteps(
            page, steps, workerId, workerName,
            async (msg, status) => await send('log', { msg, status: status || 'info' }),
            lineConfig ? { ...lineConfig, baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' } : null
          );

          allResults.push(...results);
          await send('log', { msg: `[${workerName}] 🎉 เสร็จสิ้น`, status: 'pass' });
        } catch (err) {
          await send('log', { msg: `[${workerName}] ❌ หยุด: ${err.message}`, status: 'fail' });
        } finally {
          await context.close();
        }
      };

      await Promise.all(Array.from({ length: workerCount }, (_, i) => runWorker(i + 1)));

      const pass     = allResults.filter(r => r.status === 'pass').length;
      const fail     = allResults.filter(r => r.status === 'fail').length;
      const total    = pass + fail;
      const passRate = total > 0 ? Math.round((pass / total) * 100) : 100;
      const summary  = { pass, fail, info: allResults.filter(r => r.status === 'info').length, total, passRate, results: allResults, timestamp: new Date().toISOString(), url, browserType, workers: workerCount };

      // ส่ง LINE แจ้งสรุปเมื่อ test เสร็จ
      if (lineConfig?.token && lineConfig?.userId && lineConfig?.testCompleteTemplate) {
        const workerLabel = workerNames[0] || 'All workers';
        const msg = lineConfig.testCompleteTemplate
          .replace(/{worker}/g,   workerLabel)
          .replace(/{url}/g,      url)
          .replace(/{pass}/g,     String(pass))
          .replace(/{fail}/g,     String(fail))
          .replace(/{passRate}/g, String(passRate))
          .replace(/{time}/g,     new Date().toLocaleString('th-TH'));
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: lineConfig.token, userId: lineConfig.userId, message: msg }),
          });
        } catch {}
      }

      await send('summary', summary);

    } catch (err) {
      await send('log', { msg: `❌ ${err.message}`, status: 'fail' });
      await send('summary', { pass: 0, fail: 1, total: 1, passRate: 0, results: [], timestamp: new Date().toISOString() });
    } finally {
      if (browser) await browser.close().catch(() => {});
      await send('done', {});
      await writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
