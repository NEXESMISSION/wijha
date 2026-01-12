# Fix for Vite WebSocket Connection Issues

## The Problem

Vite uses WebSockets for Hot Module Replacement (HMR). If the WebSocket connection fails, you'll see errors like:
- "WebSocket connection to 'ws://localhost:3000/?token=...' failed"
- "[vite] failed to connect to websocket"

## Solutions

### Solution 1: Updated Vite Config (Already Applied)

The `vite.config.js` has been updated with:
- `hmr.clientPort: 3000` - Ensures WebSocket uses the same port
- `watch.usePolling: true` - Uses polling instead of native file system events (more reliable)

### Solution 2: Restart Dev Server

1. Stop the current dev server (Ctrl+C)
2. Run `npm run dev` again
3. The WebSocket should connect properly

### Solution 3: Clear Browser Cache

1. Open browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Solution 4: Check Firewall/Antivirus

Sometimes firewalls or antivirus software block WebSocket connections:
- Temporarily disable firewall/antivirus
- Add exception for port 3000
- Or use a different port

### Solution 5: Use Different Port

If port 3000 has issues, you can change it:

```js
// vite.config.js
server: {
  port: 3001, // Change to different port
  strictPort: true,
}
```

Then access the app at `http://localhost:3001`

## What This Affects

- **HMR (Hot Module Replacement)**: Code changes won't auto-refresh
- **Fast Refresh**: React components won't update automatically
- **The app will still work**: Just need to manually refresh the page

## Note

This is a **development-only** issue. It doesn't affect the production build. The WebSocket is only used for development hot-reloading.

If the error persists but the app works, you can ignore it - just manually refresh the page when you make changes.

