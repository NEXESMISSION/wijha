# Environment Variables Setup

## Create .env file

Create a `.env` file in the root directory with the following content:

```env
VITE_SUPABASE_URL=https://mxsydpljfseanvwxsrgj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTI2NDUsImV4cCI6MjA4Mzc4ODY0NX0.Gq7kucrncLprWG_liibYGsK6U8S2--E8GcmAxbhV0gg
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjY0NSwiZXhwIjoyMDgzNzg4NjQ1fQ._ZrANBUpHlGP-hBhcJYdpiFV2X-YhxXxAE6wM3fRCws
```

## Quick Setup (Windows PowerShell)

Run this command in PowerShell from the project root:

```powershell
@"
VITE_SUPABASE_URL=https://mxsydpljfseanvwxsrgj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTI2NDUsImV4cCI6MjA4Mzc4ODY0NX0.Gq7kucrncLprWG_liibYGsK6U8S2--E8GcmAxbhV0gg
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjY0NSwiZXhwIjoyMDgzNzg4NjQ1fQ._ZrANBUpHlGP-hBhcJYdpiFV2X-YhxXxAE6wM3fRCws
"@ | Out-File -FilePath .env -Encoding utf8
```

## Quick Setup (Linux/Mac)

Run this command in terminal from the project root:

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://mxsydpljfseanvwxsrgj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTI2NDUsImV4cCI6MjA4Mzc4ODY0NX0.Gq7kucrncLprWG_liibYGsK6U8S2--E8GcmAxbhV0gg
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3lkcGxqZnNlYW52d3hzcmdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMjY0NSwiZXhwIjoyMDgzNzg4NjQ1fQ._ZrANBUpHlGP-hBhcJYdpiFV2X-YhxXxAE6wM3fRCws
EOF
```

## Notes

- The `.env` file is already in `.gitignore` and won't be committed to git
- All environment variables must start with `VITE_` to be accessible in the frontend
- Restart the dev server after creating/updating the `.env` file

