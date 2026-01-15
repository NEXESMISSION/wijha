# DODO Dynamic Pricing Setup Guide

## ✅ Solution: Use "Pay What You Want" (PWYW) Product

DODO Payments supports **dynamic pricing** for one-time payments! This means you can use **ONE product** for ALL your courses, regardless of their different prices.

## How It Works

1. **Create ONE product** in DODO dashboard with "Pay What You Want" enabled
2. **Set price range** (min/max) that covers all your course prices
3. **Pass the actual course price** when creating checkout - DODO will use that price!

## Step-by-Step Setup

### Step 1: Create Dynamic Pricing Product in DODO Dashboard

1. **Go to DODO Dashboard**: https://test.dodopayments.com
2. **Login** with your account
3. **Navigate to Products** section
4. **Click "Create Product"** or "New Product"
5. **Fill in the form**:
   - **Name**: `Course Purchase` (or any name you like)
   - **Type**: Select **"One-time payment"**
   - **Enable "Pay What You Want"** or **"Dynamic Pricing"** option
   - **Minimum Price**: Set to `1` (or your lowest course price)
   - **Maximum Price**: Set to `10000` (or your highest course price + buffer)
   - **Currency**: TND (Tunisian Dinar) or your currency
6. **Save the product**
7. **Copy the Product ID** - it will look like `pdt_DtODezpQ1nrHqSvM`

### Step 2: Set Product ID in Supabase

✅ **Already configured!** Your product ID is: `pdt_0NWJOiCkDHp0N6rNFFxkG`

The secret has been set in Supabase. If you need to update it, run:

```powershell
$env:Path = "$env:USERPROFILE\scoop\shims;" + $env:Path
supabase secrets set DODO_PRODUCT_ID="pdt_0NWJOiCkDHp0N6rNFFxkG"
```

### Step 3: Test It!

Now when a user selects VISA/MASTERCARD payment:
- The system will pass the **actual course price** to DODO
- DODO will charge that exact amount
- Each course can have a different price!

## How It Works in Code

When creating checkout, the code does this:

```typescript
product_cart: [{
  product_id: "pdt_0NWJOiCkDHp0N6rNFFxkG",  // Your configured product ID
  quantity: 1,
  amount: course_price * 100  // Price in cents
}]
```

The `amount` field tells DODO to charge this specific price (within your min/max range).

## Example

- **Course A**: 50 TND → DODO charges 50 TND
- **Course B**: 100 TND → DODO charges 100 TND  
- **Course C**: 250 TND → DODO charges 250 TND

All using the **same product** in DODO!

## Important Notes

1. ✅ **One-time payments only** - Dynamic pricing works for one-time payments, not subscriptions
2. ✅ **Price must be in range** - The course price must be between your min/max bounds
3. ✅ **Price in cents** - The code automatically converts TND to cents (multiplies by 100)
4. ✅ **No enrollment until payment succeeds** - Enrollment is only created when webhook confirms payment

## Troubleshooting

### Error: "Product not found"
- Make sure you created the product in DODO dashboard
- Verify the Product ID is correct
- Check that you set the `DODO_PRODUCT_ID` secret

### Error: "Amount out of range"
- Check your course price is between min/max bounds
- Adjust min/max in DODO dashboard if needed

### Error: "Invalid amount"
- Make sure price is a valid number
- Check currency conversion (TND to cents)

## Summary

✅ **One product** handles all courses  
✅ **Different prices** for each course  
✅ **Automatic price passing** from your database  
✅ **No manual product creation** needed for each course  

This is the perfect solution for your course marketplace! 🎉

