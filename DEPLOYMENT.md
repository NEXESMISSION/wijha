# Deployment Guide

This guide covers deployment configuration for different hosting platforms to fix 404 errors in Single Page Applications (SPAs).

## Problem

When deploying a React SPA, direct navigation to routes like `/courses` or `/login` results in 404 errors because the server tries to find those files. In an SPA, all routes should serve `index.html` and let React Router handle routing.

## Solution

Configuration files have been created for common hosting platforms:

### 1. Vercel (vercel.json)
- ✅ Already configured
- The `vercel.json` file rewrites all routes to `index.html`
- Just deploy and it should work

### 2. Netlify (netlify.toml)
- ✅ Already configured
- The `netlify.toml` file includes redirect rules
- The `public/_redirects` file is also included as a backup
- Deploy and it should work automatically

### 3. Apache (.htaccess)
- ✅ Already configured
- Copy the `.htaccess` file to your server's root directory
- Make sure mod_rewrite is enabled

### 4. Nginx (nginx.conf)
- ✅ Configuration file provided
- Copy the configuration to your Nginx server
- Adjust paths as needed for your setup

### 5. Other Platforms
- For other platforms, ensure all routes redirect to `index.html`
- The pattern is: `/* -> /index.html` with a 200 status code

## Build Output

The build output is in the `dist/` folder:
- `dist/index.html` - Main HTML file
- `dist/assets/` - CSS and JS files
- `dist/_redirects` - Netlify redirects file (auto-copied)

## Deployment Steps

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to your hosting platform

3. **Verify the configuration:**
   - For Vercel: Check that `vercel.json` is in the root
   - For Netlify: Check that `netlify.toml` is in the root
   - For Apache: Ensure `.htaccess` is in the `dist/` folder
   - For Nginx: Use the provided `nginx.conf` configuration

## Testing

After deployment, test these routes:
- `/` - Should load the landing page
- `/login` - Should load the login page (not 404)
- `/courses` - Should load the courses page (not 404)
- `/creator/dashboard` - Should redirect to login if not authenticated

All routes should work without 404 errors.

## Troubleshooting

If you still get 404 errors:

1. **Check the configuration file exists** in the root directory
2. **Verify the build output** includes `index.html` in the root
3. **Check server logs** for any configuration errors
4. **Ensure the hosting platform** supports the configuration format you're using

For Vercel specifically:
- The `vercel.json` file must be in the project root
- Redeploy after adding the configuration file
- Check Vercel dashboard for deployment logs

