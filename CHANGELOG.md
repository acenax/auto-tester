# สิ่งที่เปลี่ยนแปลงจากเวอร์ชันเดิม

## แก้บักที่พบในโค้ดเดิม

- **Browser leak** — เพิ่ม `finally { browser.close() }` ทุกกรณี ทั้งสำเร็จและพัง
- **Stealth ไม่ครอบ Firefox** — เพิ่ม `firefoxExtra.use(stealthPlugin())` และเตือนอัตโนมัติถ้าเลือก Safari
- **Port validation** — ตรวจ port ต้องเป็นตัวเลข 1024–65535 ก่อนส่งเข้า CDP

## Actions ใหม่

| Action | ใช้ทำอะไร |
|---|---|
| Scroll | เลื่อนหน้าจอไปที่ element หรือระบุ x,y |
| Screenshot | ถ่ายภาพหน้าจอ (ใส่ "full" ใน value = เต็มหน้า) |
| Extract Text | ดึงข้อความจาก element มาแสดงใน log |
| Wait for URL | รอจนกว่า URL จะตรงกับที่ระบุ (หลัง redirect) |
| Wait for Element | รอให้ element ปรากฏ กำหนด timeout เองได้ |

## HTML → Selector (เขียนใหม่ทั้งหมด)

ลำดับความสำคัญของการแปล:
1. `id` → `#my-id` (แม่นที่สุด)
2. `name` → `input[name="email"]`
3. `data-testid` → `[data-testid="submit"]`
4. `aria-label` → `button[aria-label="Close"]`
5. `placeholder` → `input[placeholder="ค้นหา"]`
6. `text content` → `button:has-text("ยืนยัน")` (สำหรับ button/a/label)
7. `type` + class → `input[type="password"].form-input`
8. `class` → `button.btn-primary`

พร้อมสร้าง XPath ควบคู่กัน

## UI ที่ปรับใหม่

- Dark theme เต็มรูปแบบ
- ปุ่มเลื่อน step ขึ้น/ลง + duplicate step
- Stealth toggle แสดงสถานะชัดเจน (ON/OFF)
- Log แสดงสีตามประเภท (error/success/warning/extract)
- Export/Import preset เป็น JSON ไฟล์
- Label hint แสดงใต้ทุก action ว่า field ไหนใส่อะไร
