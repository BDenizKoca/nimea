// This script will run when the CMS is loaded
// It adds some additional functionality to ensure content changes are properly reflected

window.addEventListener('DOMContentLoaded', (event) => {
  console.log('🚀 CMS Script loaded - DOM ready');
  
  // Wait for CMS to be available
  const waitForCMS = () => {
    if (window.CMS) {
      console.log('✅ Decap CMS is available, initializing enhancements...');
      initializeCMSEnhancements();
    } else {
      console.log('⏳ Waiting for Decap CMS to load...');
      setTimeout(waitForCMS, 500);
    }
  };
  
  waitForCMS();
});

function initializeCMSEnhancements() {
  // Initialize CMS
  if (window.CMS) {
    console.log('🎯 Setting up CMS event listeners...');
    
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

    // Setup enhancements with just the floating button
    setTimeout(() => {
      console.log('🔧 Setting up simple floating image button...');
      setupImageInsertionHelper();
      setupImageEditingHelper();
      enhanceSyncScroll();
    }, 2000);
  }
}

function setupImageInsertionHelper() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addFloatingImageButton();
  }, 2000);
}

function addFloatingImageButton() {
  console.log('🖼️ Adding floating image insertion button...');
  
  // Remove any existing floating button
  const existingButton = document.querySelector('.floating-enhanced-image-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create a single, clean floating button
  const floatingButton = document.createElement('button');
  floatingButton.className = 'floating-enhanced-image-button';
  floatingButton.innerHTML = '🖼️ Enhanced Image Insert';
  floatingButton.title = 'Insert image with alignment and sizing options';
  floatingButton.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 10001;
    background: linear-gradient(135deg, #3f51b5, #5c6bc0);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    transition: all 0.2s ease;
  `;
  
  floatingButton.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🎯 Floating enhanced image button clicked');
    
    // Find any available editor
    const editor = document.querySelector('.CodeMirror') ||
                  document.querySelector('textarea') ||
                  document.querySelector('[contenteditable]');
    
    if (editor) {
      showImageInsertionModal(editor);
    } else {
      alert('Please open an entry for editing first, then use this button to insert images.');
    }
  });
  
  // Add hover effects
  floatingButton.addEventListener('mouseenter', () => {
    floatingButton.style.transform = 'translateY(-2px)';
    floatingButton.style.boxShadow = '0 6px 16px rgba(63, 81, 181, 0.4)';
  });
  
  floatingButton.addEventListener('mouseleave', () => {
    floatingButton.style.transform = 'translateY(0)';
    floatingButton.style.boxShadow = '0 4px 12px rgba(63, 81, 181, 0.3)';
  });
  
  document.body.appendChild(floatingButton);
  console.log('✅ Added clean floating enhanced image button');
}

function setupImageEditingHelper() {
  console.log('🚀 Setting up image editing helper...');
  // Wait for the editor to be ready, then set up click handlers
  setTimeout(() => {
    console.log('⏰ Timeout reached, adding image click handlers...');
    addImageClickHandlers();
  }, 3000);
}

function addImageInsertionButton() {
  console.log('🖼️ Adding image insertion buttons...');
  
  // First try the standard approach
  const markdownEditors = document.querySelectorAll(
    '[data-testid="richtext"] .CodeMirror, .CodeMirror, ' +
    '.nc-controlPane-widget .CodeMirror, ' +
    '.cms-editor-visual .CodeMirror, ' +
    'div[data-testid="markdown"] .CodeMirror'
  );
  
  console.log(`📝 Found ${markdownEditors.length} CodeMirror editors`);
  
  // Also try to find editors without CodeMirror
  const textAreas = document.querySelectorAll(
    'textarea[data-testid="markdown"], ' +
    '.nc-controlPane-widget textarea, ' +
    '.cms-editor-visual textarea'
  );
  
  console.log(`📝 Found ${textAreas.length} textareas`);
  
  // New approach: Look for any container that might hold an editor
  const possibleEditorContainers = document.querySelectorAll(
    '.nc-controlPane-widget, ' +
    '[data-testid="richtext"], ' +
    '.cms-editor-visual, ' +
    'div[class*="editor"], ' +
    'div[class*="markdown"], ' +
    'div[class*="widget"]'
  );
  
  console.log(`📦 Found ${possibleEditorContainers.length} possible editor containers`);
  
  const allTargets = [...markdownEditors, ...textAreas, ...possibleEditorContainers];
  
  allTargets.forEach((target, index) => {
    if (target.dataset.imageHelperAdded) {
      console.log(`⏭️ Target ${index} already has image helper`);
      return;
    }
    target.dataset.imageHelperAdded = 'true';
    
    console.log(`➕ Adding image insertion button to target ${index}`, target);
    
    // Create image insertion button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'enhanced-image-button-container';
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10000 !important;
      background: #fff;
      border: 2px solid #3f51b5;
      border-radius: 6px;
      padding: 3px;
      box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    `;
    
    const imageButton = document.createElement('button');
    imageButton.innerHTML = '🖼️ Enhanced Image Insert';
    imageButton.type = 'button';
    imageButton.title = 'Insert image with alignment and sizing options';
    imageButton.className = 'enhanced-image-button';
    imageButton.style.cssText = `
      background: linear-gradient(135deg, #3f51b5, #5c6bc0);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
    `;
    
    imageButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎯 Enhanced image button clicked, opening modal...');
      
      // Find the best editor target
      const editor = target.querySelector('.CodeMirror') || 
                    target.querySelector('textarea') ||
                    target.querySelector('[contenteditable]') ||
                    target;
      
      showImageInsertionModal(editor);
    });
    
    // Add hover effects
    imageButton.addEventListener('mouseenter', () => {
      imageButton.style.transform = 'translateY(-1px)';
      imageButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    });
    
    imageButton.addEventListener('mouseleave', () => {
      imageButton.style.transform = 'translateY(0)';
      imageButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    });
    
    buttonContainer.appendChild(imageButton);
    
    // Try multiple approaches to add the button
    target.style.position = 'relative';
    target.appendChild(buttonContainer);
    
    console.log(`✅ Successfully added image button to target ${index}`);
  });
  
  // If we didn't find any suitable targets, try a fallback approach
  if (allTargets.length === 0) {
    console.log('🚨 No suitable targets found, trying fallback approach...');
    
    // Add button to the body as a floating button
    const existingFloatingButton = document.querySelector('.floating-enhanced-image-button');
    if (!existingFloatingButton) {
      const floatingButton = document.createElement('button');
      floatingButton.className = 'floating-enhanced-image-button';
      floatingButton.innerHTML = '🖼️ Enhanced Image Insert';
      floatingButton.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 10001;
        background: linear-gradient(135deg, #3f51b5, #5c6bc0);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
        transition: all 0.2s ease;
      `;
      
      floatingButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🎯 Floating enhanced image button clicked');
        
        // Find any available editor
        const editor = document.querySelector('.CodeMirror') ||
                      document.querySelector('textarea') ||
                      document.querySelector('[contenteditable]');
        
        if (editor) {
          showImageInsertionModal(editor);
        } else {
          alert('Please open an entry for editing first, then use this button to insert images.');
        }
      });
      
      document.body.appendChild(floatingButton);
      console.log('✅ Added floating enhanced image button');
    }
  }
  
  // Re-run periodically to catch new editors
  setTimeout(addImageInsertionButton, 3000);
  
  // Show helpful notification about enhanced image insertion
  setTimeout(showImageInsertionNotification, 5000);
}

function overrideDefaultImageInsertion() {
  console.log('🔧 Setting up default image insertion override...');
  
  // Override any existing image buttons with our enhanced workflow
  const checkAndOverride = () => {
    // Get ALL buttons on the page
    const allButtons = document.querySelectorAll('button');
    console.log(`🔍 Scanning ${allButtons.length} buttons for image functionality...`);
    
    allButtons.forEach((button, index) => {
      if (button.dataset.overridden === 'true') return;
      
      // Check if this is likely an image insertion button
      const buttonText = button.textContent?.toLowerCase() || '';
      const buttonTitle = button.title?.toLowerCase() || '';
      const buttonClass = button.className?.toLowerCase() || '';
      const buttonAriaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
      const buttonHTML = button.innerHTML.toLowerCase();
      
      // More aggressive detection - look for any SVG with path elements (common for icons)
      const hasSVG = buttonHTML.includes('<svg') && buttonHTML.includes('<path');
      const hasImageKeywords = 
        buttonText.includes('image') || 
        buttonTitle.includes('image') || 
        buttonClass.includes('image') || 
        buttonAriaLabel.includes('image');
      
      // Check if this might be a toolbar button (common location for image buttons)
      const isToolbarButton = 
        buttonClass.includes('toolbar') ||
        buttonClass.includes('nc-') ||
        button.closest('.toolbar') ||
        button.closest('[class*="toolbar"]') ||
        button.closest('[class*="nc-"]');
      
      // If it has an SVG and is in a toolbar-like context, it might be an image button
      const mightBeImageButton = hasImageKeywords || (hasSVG && isToolbarButton);
      
      if (mightBeImageButton) {
        console.log(`🎯 Potentially overriding button ${index}:`, {
          text: buttonText.substring(0, 30),
          title: buttonTitle,
          class: buttonClass.substring(0, 50),
          hasSVG: hasSVG,
          isToolbarButton: isToolbarButton,
          element: button
        });
        
        button.dataset.overridden = 'true';
        
        // Create a wrapper to intercept clicks
        const originalClick = button.onclick;
        const originalListeners = button.cloneNode(true);
        
        // Override ALL click events
        button.addEventListener('click', (e) => {
          // Check if this might actually be an image button by looking at the context
          const isLikelyImageButton = 
            hasImageKeywords || 
            (hasSVG && (isToolbarButton || button.closest('.editor')));
          
          if (isLikelyImageButton) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('🚫 Intercepted potential image button click, opening enhanced modal');
            
            // Find any available editor
            const editor = findNearestEditor(button) || 
                          document.querySelector('.CodeMirror') ||
                          document.querySelector('textarea') ||
                          document.querySelector('[contenteditable]');
            
            if (editor) {
              showImageInsertionModal(editor);
            } else {
              console.error('❌ No editor found');
              alert('Enhanced image insertion available! Please look for the "🖼️ Enhanced Image Insert" button in the editor.');
            }
            
            return false;
          }
        }, { capture: true, passive: false });
        
        // Visual enhancement to make it clear this is enhanced
        if (!button.querySelector('.enhanced-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'enhanced-indicator';
          indicator.textContent = '✨';
          indicator.style.cssText = `
            position: absolute;
            top: -3px;
            right: -3px;
            font-size: 8px;
            background: #3f51b5;
            color: white;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            pointer-events: none;
          `;
          button.style.position = 'relative';
          button.appendChild(indicator);
        }
      }
    });
  };
  
  // Run immediately and very frequently to catch dynamic content
  checkAndOverride();
  setInterval(checkAndOverride, 1000);
}

function findNearestEditor(button) {
  console.log('🔍 Finding nearest editor for button:', button);
  
  // Try to find the closest CodeMirror editor
  let element = button;
  while (element && element !== document.body) {
    // Look for CodeMirror in current element
    const codeMirror = element.querySelector('.CodeMirror');
    if (codeMirror) {
      console.log('✅ Found CodeMirror editor');
      return codeMirror;
    }
    
    // Check if current element is CodeMirror
    if (element.classList?.contains('CodeMirror')) {
      console.log('✅ Current element is CodeMirror editor');
      return element;
    }
    
    element = element.parentElement;
  }
  
  // Fallback: find any CodeMirror editor on the page
  const allEditors = document.querySelectorAll('.CodeMirror');
  if (allEditors.length > 0) {
    console.log('⚠️ Using fallback: first available editor');
    return allEditors[0];
  }
  
  console.log('❌ No CodeMirror editor found');
  return null;
}

function showImageInsertionNotification() {
  // Only show if we haven't shown it before in this session
  if (sessionStorage.getItem('imageNotificationShown')) return;
  
  console.log('💡 Showing image insertion notification...');
  
  // Create notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #3f51b5, #5c6bc0);
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 350px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <span style="font-size: 24px;">🖼️</span>
      <div>
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">Enhanced Image Insertion Available!</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.4; opacity: 0.9;">
          Look for the <strong>"🖼️ Enhanced Image Insert"</strong> button in the top-right corner of editors for advanced image options.
        </p>
        <button onclick="this.parentElement.parentElement.parentElement.remove(); sessionStorage.setItem('imageNotificationShown', 'true');" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Got it!
        </button>
      </div>
    </div>
  `;
  
  // Add animation styles
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          sessionStorage.setItem('imageNotificationShown', 'true');
        }
      }, 300);
    }
  }, 8000);
}

// Add a simple debug indicator that the script is loaded
function addDebugIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #4CAF50;
    color: white;
    padding: 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: monospace;
  `;
  indicator.textContent = '✅ Enhanced Image Insertion Ready';
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentElement) {
      indicator.remove();
    }
  }, 3000);
}

// Call debug indicator when script loads
setTimeout(addDebugIndicator, 1000);

// Show notification about the floating button
setTimeout(() => {
  showImageInsertionNotification();
}, 5000);

function showImageInsertionModal(editor) {
  console.log('🎬 Opening image insertion modal...');
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #333; font-family: sans-serif;">🖼️ Insert Image</h2>
    <p style="color: #666; margin-bottom: 25px;">Add an image to your content with custom alignment and sizing options.</p>
    
    <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL or Path:</label>
        <input type="text" id="imageUrl" placeholder="/images/filename.jpg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <small style="color: #666; font-size: 12px;">Upload images first via the media library, then reference them here</small>
      </div>
      <div style="display: flex; align-items: end;">
        <button type="button" id="browseMediaBtn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap;">
          📁 Browse Media
        </button>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text (Required):</label>
      <input type="text" id="altText" placeholder="Describe the image for accessibility" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      <small style="color: #666; font-size: 12px;">Describes the image for screen readers and SEO</small>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alignment:</label>
        <select id="alignment" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="">Default (full width)</option>
          <option value="image-left">Float Left (text wraps right)</option>
          <option value="image-right">Float Right (text wraps left)</option>
          <option value="image-center">Center (no text wrapping)</option>
        </select>
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Size:</label>
        <select id="size" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="">Default (auto-size)</option>
          <option value="image-small">Small (max 200px wide)</option>
          <option value="image-medium">Medium (max 400px wide)</option>
          <option value="image-large">Large (max 600px wide)</option>
        </select>
      </div>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">📋 Markdown Preview:</h3>
      <div id="previewContainer" style="background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; color: #495057; border: 1px solid #e9ecef; word-break: break-all;">
        ![Alt text](/images/filename.jpg)
      </div>
      <small style="color: #666; font-size: 12px;">This is the markdown that will be inserted into your content</small>
    </div>
    
    <div style="display: flex; gap: 15px; justify-content: flex-end;">
      <button id="cancelBtn" style="padding: 12px 24px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; color: #666;">Cancel</button>
      <button id="insertBtn" style="padding: 12px 24px; border: none; background: #3f51b5; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">Insert Image</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  console.log('✅ Modal created and added to DOM');
  console.log('✅ Modal created and added to DOM');
  
  // Set up event listeners
  const imageUrlInput = modal.querySelector('#imageUrl');
  const altTextInput = modal.querySelector('#altText');
  const alignmentSelect = modal.querySelector('#alignment');
  const sizeSelect = modal.querySelector('#size');
  const previewContainer = modal.querySelector('#previewContainer');
  const cancelBtn = modal.querySelector('#cancelBtn');
  const insertBtn = modal.querySelector('#insertBtn');
  const browseMediaBtn = modal.querySelector('#browseMediaBtn');
  
  // Media library integration
  browseMediaBtn.addEventListener('click', () => {
    console.log('📁 Browse media button clicked');
    
    // Try to trigger the CMS media library
    if (window.CMS && window.CMS.getWidget) {
      try {
        // This is a simplified approach - the actual implementation may vary
        // depending on how Decap CMS exposes the media library
        console.log('🔧 Attempting to open CMS media library...');
        
        // Try to find and click the existing media library button
        const mediaButtons = document.querySelectorAll('button[title*="media" i], button[aria-label*="media" i], button:has(svg)');
        let mediaLibraryOpened = false;
        
        for (let btn of mediaButtons) {
          const btnText = btn.textContent?.toLowerCase() || '';
          const btnHTML = btn.innerHTML.toLowerCase();
          
          if (btnText.includes('media') || btnHTML.includes('folder') || btnHTML.includes('upload')) {
            console.log('🎯 Found potential media button, clicking...', btn);
            btn.click();
            mediaLibraryOpened = true;
            break;
          }
        }
        
        if (!mediaLibraryOpened) {
          // Fallback: show a helpful message
          alert('📁 Media Library Tip:\\n\\n1. Click "Choose an image" or the media button in the normal CMS interface\\n2. Upload or select your image\\n3. Copy the image path (e.g., /images/filename.jpg)\\n4. Paste it back into this enhanced modal\\n\\nThis gives you the best of both worlds: easy media management + enhanced alignment/sizing options!');
        }
        
      } catch (error) {
        console.error('❌ Error accessing media library:', error);
        alert('📁 To use the media library:\\n\\n1. Close this modal\\n2. Use the regular CMS image button to upload/select an image\\n3. Copy the image path\\n4. Reopen this enhanced modal and paste the path\\n\\nThis ensures you get the upload functionality plus our enhanced options!');
      }
    } else {
      alert('📁 Media Library Integration:\\n\\n1. Close this modal temporarily\\n2. Use the regular CMS interface to upload your image\\n3. Copy the image path (e.g., /images/filename.jpg)\\n4. Reopen this enhanced modal and paste the path\\n\\nThis workflow gives you both upload capability and enhanced formatting options!');
    }
  });
  
  // Update preview function
  function updatePreview() {
    const url = imageUrlInput.value.trim() || '/images/filename.jpg';
    const alt = altTextInput.value.trim() || 'Alt text';
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    previewContainer.textContent = markdown;
    
    // Update insert button state
    const hasRequiredFields = url && alt;
    insertBtn.disabled = !hasRequiredFields;
    insertBtn.style.opacity = hasRequiredFields ? '1' : '0.5';
    insertBtn.style.cursor = hasRequiredFields ? 'pointer' : 'not-allowed';
  }
  
  // Set up event listeners for real-time preview
  imageUrlInput.addEventListener('input', updatePreview);
  altTextInput.addEventListener('input', updatePreview);
  alignmentSelect.addEventListener('change', updatePreview);
  sizeSelect.addEventListener('change', updatePreview);
  
  // Initial preview update
  updatePreview();
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    console.log('❌ Image insertion cancelled');
    document.body.removeChild(modal);
  });
  
  // Insert button
  insertBtn.addEventListener('click', () => {
    const url = imageUrlInput.value.trim();
    const alt = altTextInput.value.trim();
    
    console.log('🔍 Validating image insertion...', { url, alt });
    
    if (!url) {
      alert('⚠️ Please enter an image URL or path');
      imageUrlInput.focus();
      return;
    }
    
    if (!alt) {
      alert('⚠️ Please enter alt text for accessibility');
      altTextInput.focus();
      return;
    }
    
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    console.log('📝 Inserting markdown:', markdown);
    
    // Insert into editor
    const success = insertTextIntoEditor(editor, markdown);
    
    if (success) {
      console.log('✅ Image successfully inserted');
      // Close modal
      document.body.removeChild(modal);
    } else {
      console.error('❌ Failed to insert image');
      alert('❌ Failed to insert image. Please try again.');
    }
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      console.log('🖱️ Modal closed by clicking overlay');
      document.body.removeChild(modal);
    }
  });
  
  // Focus the URL input and show helpful tip
  imageUrlInput.focus();
  
  // Add helpful keyboard shortcuts
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      insertBtn.click();
    }
  });
  
  console.log('🎮 Event listeners set up, modal ready for interaction');
}

function insertTextIntoEditor(editor, text) {
  console.log('📝 Attempting to insert text into editor:', text);
  
  // Get CodeMirror instance
  let codeMirror;
  if (editor.CodeMirror) {
    codeMirror = editor.CodeMirror;
    console.log('✅ Found CodeMirror instance on editor element');
  } else {
    // Try to find CodeMirror instance
    const cmElement = editor.closest('.CodeMirror');
    if (cmElement && cmElement.CodeMirror) {
      codeMirror = cmElement.CodeMirror;
      console.log('✅ Found CodeMirror instance on parent element');
    }
  }
  
  if (codeMirror) {
    try {
      // Insert at cursor position
      const cursor = codeMirror.getCursor();
      console.log('📍 Cursor position:', cursor);
      
      // Add some spacing if not at beginning of line
      let textToInsert = text;
      if (cursor.ch > 0) {
        textToInsert = '\n\n' + text + '\n\n';
      } else {
        textToInsert = text + '\n\n';
      }
      
      codeMirror.replaceRange(textToInsert, cursor);
      codeMirror.focus();
      
      console.log('✅ Successfully inserted text via CodeMirror');
      return true;
    } catch (error) {
      console.error('❌ Error inserting text via CodeMirror:', error);
    }
  } else {
    console.log('⚠️ CodeMirror not found, trying fallback methods...');
    
    // Fallback: try to find textarea and insert
    const textarea = editor.querySelector('textarea') || 
                     editor.closest('.form-control') || 
                     document.querySelector('textarea[data-testid="markdown"]') ||
                     document.querySelector('textarea');
    
    if (textarea) {
      try {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        // Add some spacing
        let textToInsert = text;
        if (start > 0 && value[start - 1] !== '\n') {
          textToInsert = '\n\n' + text + '\n\n';
        } else {
          textToInsert = text + '\n\n';
        }
        
        textarea.value = value.substring(0, start) + textToInsert + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
        textarea.focus();
        
        // Trigger change event
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log('✅ Successfully inserted text via textarea fallback');
        return true;
      } catch (error) {
        console.error('❌ Error inserting text via textarea fallback:', error);
      }
    }
  }
  
  console.error('❌ Could not find any editor to insert text into');
  return false;
}

function addImageClickHandlers() {
  console.log('🔧 Setting up image click handlers...');
  
  // Find all CodeMirror editors
  const editors = document.querySelectorAll('.CodeMirror');
  console.log(`📝 Found ${editors.length} CodeMirror editors`);
  
  editors.forEach((editor, index) => {
    if (editor.dataset.imageClickHandlerAdded) return;
    editor.dataset.imageClickHandlerAdded = 'true';
    
    const codeMirror = editor.CodeMirror;
    if (!codeMirror) {
      console.log(`⚠️ No CodeMirror instance found for editor ${index}`);
      return;
    }
    
    console.log(`✅ Adding click handlers to editor ${index}`);
    
    // Add click handler to CodeMirror
    codeMirror.on('cursorActivity', (cm) => {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      const imageMatch = findImageAtCursor(line, cursor.ch);
      
      if (imageMatch) {
        // Add visual indicator that this image is clickable
        addImageClickIndicator(cm, cursor.line, imageMatch);
      }
    });
    
    // Add single click handler for better UX
    codeMirror.on('mousedown', (cm, event) => {
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖼️ Image clicked:', imageMatch);
        // Set a timeout to distinguish between single and double clicks
        setTimeout(() => {
          if (!event.detail || event.detail === 1) {
            console.log('👆 Single click detected on image');
            // For single click, just show visual feedback
            addImageClickIndicator(cm, pos.line, imageMatch);
          }
        }, 200);
      }
    });
    
    // Add double-click handler
    codeMirror.on('dblclick', (cm, event) => {
      console.log('👆👆 Double click detected');
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖼️ Image double-clicked, opening edit modal:', imageMatch);
        event.preventDefault();
        showImageEditModal(cm, pos.line, imageMatch);
      }
    });
    
    // Also add a more direct click handler to the DOM element
    editor.addEventListener('click', (event) => {
      const cm = editor.CodeMirror;
      if (!cm) return;
      
      const pos = cm.coordsChar({left: event.clientX, top: event.clientY});
      const line = cm.getLine(pos.line);
      const imageMatch = findImageAtCursor(line, pos.ch);
      
      if (imageMatch) {
        console.log('🖱️ Direct DOM click on image detected');
        // Show edit modal on any click within image markdown
        if (event.detail === 2) { // Double click
          event.preventDefault();
          showImageEditModal(cm, pos.line, imageMatch);
        }
      }
    });
  });
  
  // Re-run periodically to catch new editors
  setTimeout(addImageClickHandlers, 4000);
}

function findImageAtCursor(line, cursorPos) {
  // Regex to match markdown images with optional CSS classes
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;
  let match;
  
  console.log(`🔍 Searching for images in line: "${line}" at position ${cursorPos}`);
  
  while ((match = imageRegex.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    
    console.log(`📍 Found image: "${match[0]}" from ${start} to ${end}`);
    
    if (cursorPos >= start && cursorPos <= end) {
      const imageMatch = {
        fullMatch: match[0],
        alt: match[1],
        url: match[2],
        classes: match[3] || '',
        start: start,
        end: end,
        line: line
      };
      console.log('✅ Cursor is within image bounds:', imageMatch);
      return imageMatch;
    }
  }
  
  console.log('❌ No image found at cursor position');
  return null;
}

function addImageClickIndicator(codeMirror, lineNumber, imageMatch) {
  // Add a subtle highlight to indicate the image is clickable
  const from = { line: lineNumber, ch: imageMatch.start };
  const to = { line: lineNumber, ch: imageMatch.end };
  
  // Clear any existing markers first
  const markers = codeMirror.findMarks(from, to);
  markers.forEach(marker => marker.clear());
  
  // Add a subtle background highlight
  codeMirror.markText(from, to, {
    className: 'clickable-image-highlight',
    title: 'Double-click to edit image properties'
  });
  
  // Add CSS for the highlight if it doesn't exist
  if (!document.querySelector('#image-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'image-highlight-style';
    style.textContent = `
      .clickable-image-highlight {
        background-color: rgba(63, 81, 181, 0.1);
        border-radius: 3px;
        cursor: pointer;
      }
      .clickable-image-highlight:hover {
        background-color: rgba(63, 81, 181, 0.2);
      }
    `;
    document.head.appendChild(style);
  }
}

function showImageEditModal(codeMirror, lineNumber, imageMatch) {
  // Parse existing classes
  const existingClasses = imageMatch.classes.replace(/\./g, '').split(' ').filter(c => c);
  
  // Determine current alignment and size
  let currentAlignment = '';
  let currentSize = '';
  
  existingClasses.forEach(cls => {
    if (['image-left', 'image-right', 'image-center'].includes(cls)) {
      currentAlignment = cls;
    }
    if (['image-small', 'image-medium', 'image-large'].includes(cls)) {
      currentSize = cls;
    }
  });
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #333; font-family: sans-serif;">✏️ Edit Image</h2>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL:</label>
      <input type="text" id="editImageUrl" value="${imageMatch.url}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text:</label>
      <input type="text" id="editAltText" value="${imageMatch.alt}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alignment:</label>
      <select id="editAlignment" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="" ${!currentAlignment ? 'selected' : ''}>Default (block)</option>
        <option value="image-left" ${currentAlignment === 'image-left' ? 'selected' : ''}>Float Left</option>
        <option value="image-right" ${currentAlignment === 'image-right' ? 'selected' : ''}>Float Right</option>
        <option value="image-center" ${currentAlignment === 'image-center' ? 'selected' : ''}>Center</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Size:</label>
      <select id="editSize" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="" ${!currentSize ? 'selected' : ''}>Default</option>
        <option value="image-small" ${currentSize === 'image-small' ? 'selected' : ''}>Small (200px)</option>
        <option value="image-medium" ${currentSize === 'image-medium' ? 'selected' : ''}>Medium (400px)</option>
        <option value="image-large" ${currentSize === 'image-large' ? 'selected' : ''}>Large (600px)</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Preview:</h3>
      <div id="editPreviewContainer" style="background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #333;">
        ${imageMatch.fullMatch}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: space-between;">
      <button id="deleteImageBtn" style="padding: 10px 20px; border: 1px solid #f44336; background: #f44336; color: white; border-radius: 4px; cursor: pointer;">Delete Image</button>
      <div style="display: flex; gap: 10px;">
        <button id="editCancelBtn" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="updateImageBtn" style="padding: 10px 20px; border: none; background: #3f51b5; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Update Image</button>
      </div>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Set up event listeners
  const editImageUrlInput = modal.querySelector('#editImageUrl');
  const editAltTextInput = modal.querySelector('#editAltText');
  const editAlignmentSelect = modal.querySelector('#editAlignment');
  const editSizeSelect = modal.querySelector('#editSize');
  const editPreviewContainer = modal.querySelector('#editPreviewContainer');
  const editCancelBtn = modal.querySelector('#editCancelBtn');
  const updateImageBtn = modal.querySelector('#updateImageBtn');
  const deleteImageBtn = modal.querySelector('#deleteImageBtn');
  
  // Update preview function
  function updateEditPreview() {
    const url = editImageUrlInput.value || '/images/filename.jpg';
    const alt = editAltTextInput.value || 'Alt text';
    const alignment = editAlignmentSelect.value;
    const size = editSizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    editPreviewContainer.textContent = markdown;
  }
  
  // Set up event listeners for real-time preview
  editImageUrlInput.addEventListener('input', updateEditPreview);
  editAltTextInput.addEventListener('input', updateEditPreview);
  editAlignmentSelect.addEventListener('change', updateEditPreview);
  editSizeSelect.addEventListener('change', updateEditPreview);
  
  // Cancel button
  editCancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Delete button
  deleteImageBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this image?')) {
      const from = { line: lineNumber, ch: imageMatch.start };
      const to = { line: lineNumber, ch: imageMatch.end };
      codeMirror.replaceRange('', from, to);
      document.body.removeChild(modal);
    }
  });
  
  // Update button
  updateImageBtn.addEventListener('click', () => {
    const url = editImageUrlInput.value.trim();
    const alt = editAltTextInput.value.trim();
    
    if (!url) {
      alert('Please enter an image URL or path');
      return;
    }
    
    if (!alt) {
      alert('Please enter alt text for accessibility');
      return;
    }
    
    const alignment = editAlignmentSelect.value;
    const size = editSizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const newMarkdown = `![${alt}](${url})${classString}`;
    
    // Replace the image in the editor
    const from = { line: lineNumber, ch: imageMatch.start };
    const to = { line: lineNumber, ch: imageMatch.end };
    codeMirror.replaceRange(newMarkdown, from, to);
    
    // Close modal
    document.body.removeChild(modal);
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  // Focus the URL input
  editImageUrlInput.focus();
}

function enhanceSyncScroll() {
  // Wait for the CMS interface to load
  setTimeout(() => {
    setupSyncScrollEnhancement();
  }, 3000);
}

function setupSyncScrollEnhancement() {
  // Look for editor and preview panes
  const editorPane = document.querySelector('[data-testid="editor-pane"]') || 
                     document.querySelector('.cms-editor-visual-root') ||
                     document.querySelector('.CodeMirror-scroll');
  
  const previewPane = document.querySelector('[data-testid="preview-pane"]') || 
                      document.querySelector('.cms-preview-pane') ||
                      document.querySelector('.cms-editor-preview');
  
  if (editorPane && previewPane) {
    console.log('🔄 Sync scroll enhancement: Editor and preview panes found');
    
    // Check if sync scroll button exists
    const syncButton = document.querySelector('[data-testid="sync-scroll-button"]') ||
                       document.querySelector('.cms-editor-sync-scroll') ||
                       Array.from(document.querySelectorAll('button')).find(btn => 
                         btn.textContent.includes('sync') || btn.title?.includes('sync')
                       );
    
    if (syncButton) {
      console.log('✅ Sync scroll button found and should be working');
      
      // Add visual feedback to sync button
      syncButton.style.transition = 'all 0.2s ease';
      
      // Enhance the sync button with better visual feedback
      const originalBg = getComputedStyle(syncButton).backgroundColor;
      
      syncButton.addEventListener('mouseenter', () => {
        if (!syncButton.classList.contains('active')) {
          syncButton.style.backgroundColor = '#3f51b5';
          syncButton.style.color = 'white';
        }
      });
      
      syncButton.addEventListener('mouseleave', () => {
        if (!syncButton.classList.contains('active')) {
          syncButton.style.backgroundColor = originalBg;
          syncButton.style.color = '';
        }
      });
    } else {
      console.log('⚠️ Sync scroll button not found - may be using different interface');
      
      // Try to create our own sync scroll functionality
      implementCustomSyncScroll(editorPane, previewPane);
    }
  } else {
    console.log('ℹ️ Editor or preview pane not found yet, retrying...');
    // Retry after a delay
    setTimeout(setupSyncScrollEnhancement, 2000);
  }
}

function implementCustomSyncScroll(editorPane, previewPane) {
  console.log('🔧 Implementing custom sync scroll functionality');
  
  let isScrolling = false;
  
  // Add scroll listeners
  editorPane.addEventListener('scroll', () => {
    if (isScrolling) return;
    isScrolling = true;
    
    const scrollPercent = editorPane.scrollTop / (editorPane.scrollHeight - editorPane.clientHeight);
    const targetScrollTop = scrollPercent * (previewPane.scrollHeight - previewPane.clientHeight);
    
    previewPane.scrollTop = targetScrollTop;
    
    setTimeout(() => { isScrolling = false; }, 50);
  });
  
  previewPane.addEventListener('scroll', () => {
    if (isScrolling) return;
    isScrolling = true;
    
    const scrollPercent = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight);
    const targetScrollTop = scrollPercent * (editorPane.scrollHeight - editorPane.clientHeight);
    
    editorPane.scrollTop = targetScrollTop;
    
    setTimeout(() => { isScrolling = false; }, 50);
  });
  
  console.log('✅ Custom sync scroll implemented');
}