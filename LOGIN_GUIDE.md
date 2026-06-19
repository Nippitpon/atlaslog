# คู่มือการใช้งาน Login — Atlaslog

## ภาพรวม

Atlaslog ใช้ระบบ Email + Password ผ่าน Supabase Auth  
ข้อมูล workout history และ custom programs จะ sync กับ cloud อัตโนมัติหลัง login

---

## 1. สมัครสมาชิก (Sign Up)

1. เปิด app → หน้า **Login** จะแสดงอัตโนมัติ
2. กรอก Email และ Password (อย่างน้อย 6 ตัวอักษร)
3. กด **Sign Up**
4. ระบบส่ง confirmation email ไปที่ inbox ของคุณ
5. เปิด email → กดลิงก์ **Confirm your email**
6. กลับมาที่ app → กด **Sign In** ด้วย email + password เดิม

> ⚠️ ต้อง confirm email ก่อน — ถ้ายังไม่ confirm จะ login ไม่ได้

---

## 2. เข้าสู่ระบบ (Sign In)

1. กรอก Email และ Password
2. กด **Sign In**
3. App โหลดข้อมูลจาก cloud (workout history + custom programs) มาให้อัตโนมัติ
4. หน้า Dashboard จะแสดงขึ้นมา

---

## 3. ออกจากระบบ (Sign Out)

1. ไปที่ **Profile** (ไอคอนด้านล่างขวา)
2. กด **Sign Out**
3. ข้อมูลใน device ถูกล้าง — ข้อมูลยังเก็บอยู่ใน cloud

---

## 4. Data Sync

| สถานการณ์ | พฤติกรรม |
|-----------|----------|
| บันทึก workout | sync ขึ้น cloud ทันที (fire & forget) |
| Import custom program | sync ขึ้น cloud ทันที |
| Sign in ใหม่ | ดึง workout history + custom programs จาก cloud มาโหลด |
| Sign out | ล้าง local state — ข้อมูลยังอยู่ใน Supabase |
| ใช้หลาย device | login ด้วย account เดิม → ข้อมูลเหมือนกัน |

---

## 5. แก้ปัญหาเบื้องต้น

**ไม่ได้รับ confirmation email**
- เช็ค spam/junk folder
- รอ 1-2 นาที แล้วลองใหม่

**Login แล้วข้อมูลหาย**
- ตรวจสอบว่า login ด้วย email เดิม
- ข้อมูลจะโหลดอัตโนมัติหลัง SIGNED_IN event — รอสักครู่

**"Invalid login credentials"**
- ตรวจสอบ email และ password
- ถ้าลืม password ให้ใช้ "Forgot password" (ยังไม่มีใน UI — ติดต่อ admin)

---

## 6. สำหรับ Developer — Environment Variables

ต้องมีค่าเหล่านี้ก่อน app จะทำงานได้:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Local dev:** สร้างไฟล์ `apps/web/.env.local`  
**Production:** ใส่ใน Vercel → Settings → Environment Variables → Redeploy
