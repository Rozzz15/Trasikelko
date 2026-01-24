# Supabase Database Migrations

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the contents of the migration file
6. Paste into the query editor
7. Click **Run** to execute

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

### Option 3: Manual SQL Execution

Connect to your database using any PostgreSQL client and execute the SQL file.

---

## Available Migrations

### `add_discount_verification_columns.sql`

**Purpose:** Adds discount verification support for Senior Citizen and PWD discounts.

**What it adds:**
- `discount_type` - Type of discount (none/senior/pwd)
- `discount_verification_status` - Status (none/pending/approved/rejected)
- `senior_id_photo` - URL to Senior Citizen ID photo
- `pwd_id_photo` - URL to PWD ID photo
- `discount_requested_at` - Request timestamp
- `discount_verified_at` - Verification timestamp
- `discount_verified_by` - Admin user who verified
- `discount_rejection_reason` - Rejection reason if rejected

**Indexes created:**
- `idx_passengers_discount_status` - For filtering by status
- `idx_passengers_discount_type` - For filtering by type

**Safe to run multiple times:** Yes (uses `IF NOT EXISTS`)

---

## Verification

After running the migration, verify it worked:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'passengers'
AND column_name LIKE 'discount%';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'passengers'
AND indexname LIKE 'idx_passengers_discount%';
```

Expected result: Should show 8 discount-related columns and 2 indexes.

---

## Rollback (if needed)

To rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_passengers_discount_status;
DROP INDEX IF EXISTS idx_passengers_discount_type;

-- Remove columns
ALTER TABLE passengers
DROP COLUMN IF EXISTS discount_type,
DROP COLUMN IF EXISTS discount_verification_status,
DROP COLUMN IF EXISTS senior_id_photo,
DROP COLUMN IF EXISTS pwd_id_photo,
DROP COLUMN IF EXISTS discount_requested_at,
DROP COLUMN IF EXISTS discount_verified_at,
DROP COLUMN IF EXISTS discount_verified_by,
DROP COLUMN IF EXISTS discount_rejection_reason;
```

**⚠️ Warning:** Rolling back will delete all discount verification data!
