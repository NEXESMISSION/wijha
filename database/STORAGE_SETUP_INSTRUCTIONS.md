# Storage Bucket Setup Instructions

## Problem
You're getting the error: `StorageApiError: Bucket not found` when trying to upload payment proofs.

## Solution

### Step 1: Create the Storage Bucket (Manual Step)

1. Go to your **Supabase Dashboard**
2. Click on **Storage** in the left sidebar
3. Click the **"New bucket"** button
4. Enter the bucket name: **`payment-proofs`** (exactly as shown, with hyphen)
5. Choose **PRIVATE** (not public) - this keeps payment proofs secure
6. Click **"Create bucket"**

### Step 2: Run the SQL Script

After creating the bucket, run this SQL script in the Supabase SQL Editor:

**File:** `database/CREATE_PAYMENT_PROOFS_BUCKET_SIMPLE.sql`

This will set up the necessary policies to allow:
- Students to upload payment proofs
- Authenticated users to view payment proofs
- Proper access control

### Step 3: Verify

After setup, try uploading a payment proof again. The error should be resolved.

## Alternative: Public Bucket (Simpler but Less Secure)

If you want a simpler setup and don't mind payment proofs being publicly accessible:

1. Create the bucket as **PUBLIC** instead of PRIVATE
2. The code will work with public URLs
3. Less secure but easier to implement

## Current Code Behavior

The code stores the file path in the database. For private buckets, you'll need to generate signed URLs when displaying. The current implementation works best with a public bucket, or you can update the code to generate signed URLs for private buckets.

## Files Modified

- `src/pages/CourseDetail.jsx` - Updated to store file path instead of public URL
- `database/CREATE_PAYMENT_PROOFS_BUCKET_SIMPLE.sql` - SQL policies for the bucket

