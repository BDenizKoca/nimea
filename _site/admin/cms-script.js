// This script will run when the CMS is loaded
// It adds some additional functionality to ensure content changes are properly reflected

window.addEventListener('DOMContentLoaded', (event) => {
  // Initialize CMS
  console.log('Admin page loaded, setting up CMS extensions...');
  
  // If using NetlifyCMS/DecapCMS
  if (window.CMS) {
    // Add a listener for new entry creation
    window.CMS.registerEventListener({
      name: 'prePublish',
      handler: async ({ entry }) => {
        console.log('Pre-publish event triggered');
        const slug = entry.get('slug');
        const collection = entry.get('collection');
        
        console.log(`Preparing to publish: ${collection}/${slug}`);
        return entry;
      },
    });
    
    // Register a successful callback when entry is saved
    window.CMS.registerEventListener({
      name: 'preSave',
      handler: async ({ entry }) => {
        console.log('Pre-save event triggered');
        const entryData = entry.get('data').toJS();
        const collection = entry.get('collection');
        
        if (!entryData.slug) {
          console.error('Missing slug in entry data!');
          alert('Please provide a slug (URL-friendly name) for this entry.');
          return false;
        }
        
        console.log(`Content about to be saved: ${collection}/${entryData.slug}`);
        return entry;
      },
    });
    
    window.CMS.registerEventListener({
      name: 'postSave',
      handler: async ({ entry }) => {
        const entryData = entry.get('data').toJS();
        const collection = entry.get('collection');
        
        console.log(`Content saved successfully: ${collection}/${entryData.slug}`);
        // Force the browser to refresh after a short delay to pick up the new file
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      },
    });
    
    console.log('CMS event handlers registered');
  }
});