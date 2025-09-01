// Netlify configuration for live CMS
// Set your build hook URL here to enable automatic rebuilds
// when DM makes changes to the repository

// Get this from: Netlify Dashboard → Site Settings → Build & Deploy → Build Hooks
// Create a build hook and copy the URL here
window.NETLIFY_BUILD_HOOK = 'https://api.netlify.com/build_hooks/YOUR_BUILD_HOOK_ID_HERE';

// You can also set this via environment variable in production
if (typeof process !== 'undefined' && process.env.NETLIFY_BUILD_HOOK) {
    window.NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK;
}