// This script will run when the CMS is loaded
// It adds some additional functionality to ensure content changes are properly reflected

window.addEventListener('DOMContentLoaded', (event) => {
  // Initialize CMS
  
  // If using NetlifyCMS/DecapCMS
  if (window.CMS) {
    // Add a listener for new entry creation
    window.CMS.registerEventListener({
      name: 'prePublish',
      handler: async ({ entry }) => {
        return entry;
      },
    });
    
    // Register a successful callback when entry is saved
    window.CMS.registerEventListener({
      name: 'preSave',
      handler: async ({ entry }) => {
        const entryData = entry.get('data').toJS();
        
        if (!entryData.slug) {
          alert('Please provide a slug (URL-friendly name) for this entry.');
          return Promise.reject('Missing slug in entry data!');
        }
        
        return entry;
      },
    });
    
    window.CMS.registerEventListener({
      name: 'postSave',
      handler: async ({ entry }) => {
        const entryData = entry.get('data').toJS();
        const collection = entry.get('collection');
        
        alert(`'${entryData.name}' in ${collection} was saved successfully. The admin page will now reload to reflect the latest changes.`);
        // Force the browser to refresh to pick up the new file
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      },
    });
  }
});