import { NextResponse } from 'next/server';

// อัปโหลดรูปขึ้น imgbb แล้วได้ URL กลับมา
async function uploadToImgbb(apiKey, base64Image) {
  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('image', base64Image); // base64 ไม่มี prefix

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.success) throw new Error('imgbb upload failed: ' + JSON.stringify(data.error));
  return data.data.url;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { token, userId, message, screenshotBase64, imgbbKey } = body;

    if (!token || !userId) {
      return NextResponse.json({ success: false, error: 'ขาด token หรือ userId' }, { status: 400 });
    }

    const messages = [];

    // ถ้ามีรูปและมี imgbb key → อัปโหลดก่อน แล้วส่งเป็น image message
    if (screenshotBase64 && imgbbKey) {
      try {
        const imageUrl = await uploadToImgbb(imgbbKey, screenshotBase64);
        // LINE image message ต้องมี originalContentUrl และ previewImageUrl
        messages.push({
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl,
        });
      } catch (e) {
        // ถ้าอัปโหลดรูปไม่ได้ ข้ามรูปแล้วส่งแค่ข้อความ
        messages.push({ type: 'text', text: `⚠️ อัปโหลดรูปไม่สำเร็จ: ${e.message}` });
      }
    }

    // ส่งข้อความเสมอ
    if (message) {
      messages.push({ type: 'text', text: message });
    }

    if (!messages.length) {
      return NextResponse.json({ success: false, error: 'ไม่มีข้อความหรือรูปที่จะส่ง' }, { status: 400 });
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ to: userId, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ success: false, error: err.message || `LINE error ${res.status}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
