# Database Seeding Instructions

This directory contains SQL scripts to seed your database with sample data. Run them in order:

## Step-by-Step Instructions

### Step 1: Clean Data
**File:** `SEED_STEP_1_CLEAN_DATA.sql`
- Deletes all existing courses, modules, lessons, enrollments, etc.
- Keeps profiles (they will be updated in step 3)
- **Run this first**

### Step 2: Create Categories
**File:** `SEED_STEP_2_CREATE_CATEGORIES.sql`
- Creates 8 categories (برمجة وتطوير, تصميم جرافيكي, etc.)
- Safe to run multiple times (uses ON CONFLICT)

### Step 3: Create/Update Profile
**File:** `SEED_STEP_3_CREATE_PROFILE.sql`
- Creates or updates the profile for `saifelleuchi127@gmail.com`
- Sets professional bio, images, and profile slug
- **Important:** Make sure the user exists in Supabase Auth first!

### Step 4: Create Courses 1-3
**File:** `SEED_STEP_4_CREATE_COURSES_1-3.sql`
- Creates first 3 courses:
  1. تطوير تطبيقات الويب المتقدمة
  2. تصميم UI/UX احترافي
  3. التسويق الرقمي الشامل

### Step 5: Create Courses 4-6
**File:** `SEED_STEP_5_CREATE_COURSES_4-6.sql`
- Creates courses 4-6:
  4. إدارة المشاريع الاحترافية
  5. الإنجليزية للأعمال
  6. التصوير الفوتوغرافي الاحترافي

### Step 6: Create Courses 7-10
**File:** `SEED_STEP_6_CREATE_COURSES_7-10.sql`
- Creates the remaining 4 courses:
  7. تطوير الذات والقيادة
  8. الاستثمار والمالية الشخصية
  9. Python للبيانات والذكاء الاصطناعي
  10. إنتاج الفيديو الاحترافي

## Quick Start

Run these scripts in order in Supabase SQL Editor:

1. `SEED_STEP_1_CLEAN_DATA.sql`
2. `SEED_STEP_2_CREATE_CATEGORIES.sql`
3. `SEED_STEP_3_CREATE_PROFILE.sql`
4. `SEED_STEP_4_CREATE_COURSES_1-3.sql`
5. `SEED_STEP_5_CREATE_COURSES_4-6.sql`
6. `SEED_STEP_6_CREATE_COURSES_7-10.sql`

## Troubleshooting

- **"User not found" error**: Make sure `saifelleuchi127@gmail.com` exists in Supabase Auth (Authentication > Users)
- **"query returned more than one row"**: This shouldn't happen with the segmented scripts, but if it does, check for duplicate data
- **Categories already exist**: Step 2 uses `ON CONFLICT DO NOTHING`, so it's safe to run multiple times

## Notes

- Each script is independent and can be run separately
- If a step fails, you can fix the issue and re-run just that step
- The scripts use `LIMIT 1` on all SELECT INTO statements to prevent multiple row errors
- All courses are created with status 'published' and are ready to view

