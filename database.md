# Database Design — บัญชีรายรับรายจ่าย

## Overview

ระบบนี้ใช้ **PostgreSQL** เป็น primary database โดยออกแบบให้รองรับ multi-user และสามารถ migrate จาก localStorage ได้โดยตรง

---

## ERD (Entity Relationship)

```
users
  └─< budget_plans       (1 user : many plans)
        └─< budget_groups     (1 plan : many groups)
              └─< budget_items    (1 group : many items)

users
  └─< monthly_expenses   (1 user : many months)
        ├─< payment_methods  (1 expense config : many methods)
        └─< transactions     (1 expense config : many transactions)
```

---

## Tables

### `users`
ผู้ใช้งานระบบ

| Column        | Type           | Constraints              | Description              |
|---------------|----------------|--------------------------|--------------------------|
| id            | UUID           | PK, default gen_random_uuid() | Primary key         |
| username      | VARCHAR(50)    | UNIQUE, NOT NULL         | ชื่อผู้ใช้ (login)       |
| display_name  | VARCHAR(100)   | NOT NULL                 | ชื่อที่แสดง              |
| password_hash | VARCHAR(255)   | NOT NULL                 | bcrypt hash              |
| created_at    | TIMESTAMPTZ    | DEFAULT now()            | วันที่สร้าง              |
| updated_at    | TIMESTAMPTZ    | DEFAULT now()            | วันที่แก้ไขล่าสุด        |

---

### `budget_plans`
แผนงบประมาณรายเดือน (1 plan ต่อ 1 เดือนต่อ 1 user)

| Column         | Type        | Constraints                        | Description                        |
|----------------|-------------|------------------------------------|------------------------------------|
| id             | UUID        | PK                                 | Primary key                        |
| user_id        | UUID        | FK → users.id, NOT NULL            | เจ้าของแผน                        |
| month          | CHAR(7)     | NOT NULL                           | รูปแบบ `YYYY-MM` เช่น `2026-06`   |
| monthly_extras | NUMERIC(12,2) | NOT NULL DEFAULT 0               | งบสำรองรายเดือน (บาท)              |
| created_at     | TIMESTAMPTZ | DEFAULT now()                      |                                    |
| updated_at     | TIMESTAMPTZ | DEFAULT now()                      |                                    |

**Unique constraint:** `(user_id, month)`

---

### `budget_groups`
หมวดงบประมาณ (รายได้ / รายจ่าย) ภายใน plan

| Column      | Type         | Constraints                         | Description                         |
|-------------|--------------|-------------------------------------|-------------------------------------|
| id          | UUID         | PK                                  | Primary key                         |
| plan_id     | UUID         | FK → budget_plans.id, NOT NULL      | แผนที่สังกัด                        |
| name        | VARCHAR(100) | NOT NULL                            | ชื่อหมวด เช่น "รายได้", "Saving"    |
| type        | CHAR(1)      | NOT NULL CHECK (type IN ('+', '-')) | `+` = รายรับ, `-` = รายจ่าย        |
| emoji       | VARCHAR(10)  | NOT NULL DEFAULT '📌'              | emoji ที่แสดง                       |
| color       | VARCHAR(20)  | NOT NULL DEFAULT 'blue'             | สี (key: blue/emerald/red/…)        |
| sort_order  | SMALLINT     | NOT NULL DEFAULT 0                  | ลำดับการแสดงผล                      |

---

### `budget_items`
รายการย่อยภายใน group

| Column     | Type           | Constraints                          | Description               |
|------------|----------------|--------------------------------------|---------------------------|
| id         | UUID           | PK                                   | Primary key               |
| group_id   | UUID           | FK → budget_groups.id, NOT NULL      | group ที่สังกัด           |
| label      | VARCHAR(100)   | NOT NULL                             | ชื่อรายการ เช่น "PVD"     |
| amount     | NUMERIC(12,2)  | NOT NULL DEFAULT 0                   | จำนวนเงิน (บาท)           |
| sort_order | SMALLINT       | NOT NULL DEFAULT 0                   | ลำดับการแสดงผล            |

---

### `monthly_expenses`
การตั้งค่าการบันทึกค่าใช้จ่ายรายเดือน (1 config ต่อ 1 เดือนต่อ 1 user)

| Column        | Type           | Constraints                   | Description                      |
|---------------|----------------|-------------------------------|----------------------------------|
| id            | UUID           | PK                            | Primary key                      |
| user_id       | UUID           | FK → users.id, NOT NULL       | เจ้าของ                          |
| month         | CHAR(7)        | NOT NULL                      | รูปแบบ `YYYY-MM`                 |
| limit_per_day | NUMERIC(10,2)  | NOT NULL DEFAULT 0            | งบต่อวัน (บาท)                   |
| monthly_extras| NUMERIC(12,2)  | NOT NULL DEFAULT 0            | งบสำรองรายเดือน (บาท)            |
| created_at    | TIMESTAMPTZ    | DEFAULT now()                 |                                  |
| updated_at    | TIMESTAMPTZ    | DEFAULT now()                 |                                  |

**Unique constraint:** `(user_id, month)`

---

### `payment_methods`
ช่องทางชำระเงิน (กำหนดต่อ monthly_expense)

| Column     | Type         | Constraints                              | Description                      |
|------------|--------------|------------------------------------------|----------------------------------|
| id         | UUID         | PK                                       | Primary key                      |
| expense_id | UUID         | FK → monthly_expenses.id, NOT NULL       | config ที่สังกัด                 |
| label      | VARCHAR(50)  | NOT NULL                                 | ชื่อ เช่น "Money", "CC-Shopee"   |
| sort_order | SMALLINT     | NOT NULL DEFAULT 0                       | ลำดับการแสดงผล                   |

---

### `transactions`
รายการค่าใช้จ่าย / รายรับ

| Column           | Type           | Constraints                              | Description                                      |
|------------------|----------------|------------------------------------------|--------------------------------------------------|
| id               | UUID           | PK                                       | Primary key                                      |
| expense_id       | UUID           | FK → monthly_expenses.id, NOT NULL       | config เดือนที่สังกัด                           |
| payment_method_id| UUID           | FK → payment_methods.id, NULLABLE        | ช่องทางชำระ (NULL = ไม่ระบุ)                    |
| day              | SMALLINT       | NOT NULL CHECK (day BETWEEN 1 AND 31)    | วันที่ในเดือน (1–31)                             |
| name             | VARCHAR(200)   | NOT NULL DEFAULT ''                      | ชื่อรายการ เช่น "ข้าวกลางวัน"                  |
| description      | TEXT           | NOT NULL DEFAULT ''                      | คำอธิบายเพิ่มเติม                               |
| amount           | NUMERIC(12,2)  | NOT NULL                                 | จำนวนเงิน: บวก = จ่าย, ลบ = รับเงินคืน/รายรับ  |
| created_at       | TIMESTAMPTZ    | DEFAULT now()                            |                                                  |
| updated_at       | TIMESTAMPTZ    | DEFAULT now()                            |                                                  |

**Indexes:**
- `(expense_id, day)` — query ตามวัน
- `(expense_id, payment_method_id)` — query ตามช่องทาง

---

## DDL (PostgreSQL)

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE budget_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month           CHAR(7)      NOT NULL,               -- 'YYYY-MM'
  monthly_extras  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE TABLE budget_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID         NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        CHAR(1)      NOT NULL CHECK (type IN ('+', '-')),
  emoji       VARCHAR(10)  NOT NULL DEFAULT '📌',
  color       VARCHAR(20)  NOT NULL DEFAULT 'blue',
  sort_order  SMALLINT     NOT NULL DEFAULT 0
);

CREATE TABLE budget_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID           NOT NULL REFERENCES budget_groups(id) ON DELETE CASCADE,
  label       VARCHAR(100)   NOT NULL,
  amount      NUMERIC(12,2)  NOT NULL DEFAULT 0,
  sort_order  SMALLINT       NOT NULL DEFAULT 0
);

CREATE TABLE monthly_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month           CHAR(7)       NOT NULL,
  limit_per_day   NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_extras  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE TABLE payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID        NOT NULL REFERENCES monthly_expenses(id) ON DELETE CASCADE,
  label       VARCHAR(50) NOT NULL,
  sort_order  SMALLINT    NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id        UUID           NOT NULL REFERENCES monthly_expenses(id) ON DELETE CASCADE,
  payment_method_id UUID           REFERENCES payment_methods(id) ON DELETE SET NULL,
  day               SMALLINT       NOT NULL CHECK (day BETWEEN 1 AND 31),
  name              VARCHAR(200)   NOT NULL DEFAULT '',
  description       TEXT           NOT NULL DEFAULT '',
  amount            NUMERIC(12,2)  NOT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_transactions_expense_day    ON transactions(expense_id, day);
CREATE INDEX idx_transactions_expense_method ON transactions(expense_id, payment_method_id);
CREATE INDEX idx_budget_groups_plan          ON budget_groups(plan_id, sort_order);
CREATE INDEX idx_budget_items_group          ON budget_items(group_id, sort_order);
CREATE INDEX idx_payment_methods_expense     ON payment_methods(expense_id, sort_order);
```

---

## Key Queries

**ยอดรวมรายวันต่อช่องทาง (สำหรับตารางสรุป)**
```sql
SELECT
  t.day,
  t.payment_method_id,
  SUM(t.amount) AS total
FROM transactions t
WHERE t.expense_id = $1
GROUP BY t.day, t.payment_method_id;
```

**Month Remain (cumulative)**
```sql
WITH daily AS (
  SELECT
    generate_series(1, 30) AS day,
    COALESCE(SUM(t.amount), 0) AS spent
  FROM generate_series(1, 30) g(day)
  LEFT JOIN transactions t
    ON t.expense_id = $1 AND t.day = g.day
  GROUP BY g.day
)
SELECT
  day,
  me.monthly_extras + SUM(me.limit_per_day - spent) OVER (ORDER BY day) AS month_remain
FROM daily
JOIN monthly_expenses me ON me.id = $1;
```

---

## Notes

- `payment_method_id` เป็น `NULLABLE` เพราะ transaction อาจไม่ระบุช่องทาง (`'' = ไม่ระบุ` ใน localStorage → `NULL` ใน DB)
- `amount` บวก = จ่ายเงิน, ลบ = รับเงิน/คืนเงิน (เหมือน app ปัจจุบัน)
- `budget_plans.monthly_extras` และ `monthly_expenses.monthly_extras` เป็นคนละตัว — plan ใช้คำนวณงบ, expense ใช้คำนวณ Month Remain
- `ON DELETE CASCADE` ทุก FK เพื่อให้ลบ user / plan / group ได้โดยไม่มี orphan rows
- ควรเพิ่ม `updated_at` trigger (หรือ handle ที่ application layer) เพื่ออัปเดตอัตโนมัติ
