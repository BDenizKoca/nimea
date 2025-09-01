# 🏰 Nimea Live CMS Setup Guide

Your DM mode now includes **Live CMS functionality** that saves changes directly back to the GitHub repository! This means your map edits automatically update the live site.

## 🚀 How It Works

When you're in DM mode and authenticated:
1. **Add/edit markers** → Automatically saved to `data/markers.json` in repository
2. **Paint terrain** → Automatically saved to `data/terrain.geojson` in repository  
3. **Bulk import** → All markers saved to repository
4. **Site rebuilds** → Changes go live automatically

## 🔧 Setup Instructions

### 1. Enable Netlify Identity (if not already done)
1. Go to your Netlify site dashboard
2. Go to **Identity** tab
3. Click **Enable Identity**
4. Under **Registration preferences**, set to "Invite only" (recommended)
5. Invite yourself and any other DMs via email

### 2. Enable Git Gateway
1. In Netlify Identity settings
2. Go to **Services** → **Git Gateway**
3. Click **Enable Git Gateway**
4. This allows the map to save directly to your repository

### 3. Optional: Auto-Rebuild Setup
1. Go to **Site Settings** → **Build & Deploy** → **Build Hooks**
2. Click **Add build hook**
3. Name it "DM Map Updates" 
4. Copy the webhook URL
5. Update `map/config.js` with your webhook URL:
   ```javascript
   window.NETLIFY_BUILD_HOOK = 'https://api.netlify.com/build_hooks/YOUR_HOOK_ID';
   ```

## 🎮 DM Workflow

### Authentication
1. Go to `yoursite.com/map/?dm=true`
2. Click the **👤** button in top-right
3. Login with your Netlify Identity account
4. Status indicator **📡** turns green when connected

### Live Editing
- **Authenticated Mode**: Changes save automatically to repository
- **Offline Mode**: Use "Export" button to download files manually

### Status Indicators
- **👤✓**: Logged in and ready for live editing
- **📡✓**: Live CMS active - auto-saving enabled
- **👤**: Click to login
- **📡**: Offline mode - export manually

## 📂 File Structure

The live CMS maintains these files in your repository:

```
data/
├── markers.json     # All map markers (auto-generated from DM edits)
├── terrain.geojson  # Terrain data (roads, difficult, blocked)
└── config.json      # Map configuration
```

## 🔒 Security Notes

- Only authenticated users can edit via DM mode
- All changes are committed with the editor's name/email
- Full audit trail via Git history
- Can revert changes using Git if needed

## 🐛 Troubleshooting

### "Failed to save" errors
1. Check internet connection
2. Verify you're logged in (👤✓ should be green)
3. Check Git Gateway is enabled in Netlify
4. Try logging out and back in

### Changes not appearing on live site
1. Check if auto-rebuild is set up (optional)
2. Manually trigger deploy in Netlify dashboard
3. Wait a few minutes for build to complete

### Authentication issues
1. Verify Netlify Identity is enabled
2. Check you're invited to the site
3. Clear browser cache and try again

## 💡 Pro Tips

- **Backup Strategy**: Live CMS auto-commits, but keep periodic exports
- **Team Workflow**: Each DM gets their own Netlify Identity account
- **Version Control**: Use Git history to see all changes and revert if needed
- **Testing**: Test changes in DM mode before sharing with players

## 🎯 Benefits

✅ **Instant Updates**: Edit map → changes go live immediately  
✅ **No File Management**: No more downloading/uploading JSON files  
✅ **Team Collaboration**: Multiple DMs can edit safely  
✅ **Full History**: Git tracks every change with timestamps  
✅ **Secure**: Only authenticated users can edit  
✅ **Backup**: Everything stored safely in Git repository  

Your Nimea map is now a **professional live CMS** for world-building! 🏰✨