import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { runSteps } from '../stepRunner.js';

chromium.use(stealthPlugin());

export async function POST(req) {
  const body = await req.json();
  const { port, steps, lineConfig = null, workerName = 'CDP' } = body;

  const portNum = parseInt(port);
  if (!port || isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return new Response(
      `event: log\ndata: ${JSON.stringify({ msg: '❌ Debug Port ต้องเป็นตัวเลข 1024–65535', status: 'fail' })}\n\nevent: done\ndata: {}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const encoder = new TextEncoder();
  const stream  = new TransformStream();
  const writer  = stream.writable.getWriter();
  const send    = async (type, data) => {
    try { await writer.write(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
  };

  (async () => {
    try {
      await send('log', { msg: `🌐 เชื่อมต่อ CDP → localhost:${portNum}`, status: 'info' });
      const browser  = await chromium.connectOverCDP(`http://localhost:${portNum}`);
      const contexts = browser.contexts();
      if (!contexts.length) throw new Error('ไม่พบ context — เปิด Chrome ด้วย --remote-debugging-port ก่อน');
      const pages = contexts[0].pages();
      if (!pages.length) throw new Error('ไม่มีแท็บเปิดอยู่');
      const page = pages[0];
      await send('log', { msg: `✅ เชื่อมต่อสำเร็จ — URL: ${page.url()}`, status: 'pass' });

      // ส่ง signature ครบ: page, steps, workerId, workerName, emit, lineConfig
      const results = await runSteps(
        page, steps, null, workerName,
        async (msg, status) => await send('log', { msg, status: status || 'info' }),
        lineConfig ? { ...lineConfig, baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' } : null
      );

      const pass     = results.filter(r => r.status === 'pass').length;
      const fail     = results.filter(r => r.status === 'fail').length;
      const total    = pass + fail;
      const passRate = total > 0 ? Math.round((pass/total)*100) : 100;
      await send('summary', { pass, fail, info: results.filter(r => r.status==='info').length, total, passRate, results, timestamp: new Date().toISOString() });
      await send('log', { msg: '🎉 เสร็จสิ้น — browser ยังเปิดอยู่', status: 'pass' });
      await browser.disconnect();
    } catch (err) {
      await send('log', { msg: `❌ ${err.message}`, status: 'fail' });
      await send('summary', { pass: 0, fail: 1, total: 1, passRate: 0, results: [], timestamp: new Date().toISOString() });
    } finally {
      await send('done', {});
      await writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
