// Simple CMS Image Alignment Tools
// This script adds basic image alignment buttons for existing images

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

    // Setup simple image alignment buttons
    setTimeout(() => {
      console.log('🔧 Setting up simple image alignment buttons...');
      setupImageAlignmentButtons();
    }, 2000);
  }
}

function setupImageAlignmentButtons() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addImageAlignmentButtons();
  }, 2000);
}

function addImageAlignmentButtons() {
  console.log('🖼️ Adding image alignment buttons...');
  
  // Remove any existing buttons
  const existingButtons = document.querySelectorAll('.image-alignment-toolbar');
  existingButtons.forEach(btn => btn.remove());
  
  // Create a simple toolbar for image alignment
  const toolbar = document.createElement('div');
  toolbar.className = 'image-alignment-toolbar';
  toolbar.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    z-index: 10001;
    background: white;
    border: 2px solid #3f51b5;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
    display: flex;
    gap: 8px;
    flex-direction: column;
  `;
  
  toolbar.innerHTML = `
    <div style="font-size: 12px; font-weight: bold; color: #3f51b5; text-align: center; margin-bottom: 5px;">
      🖼️ Image Tools
    </div>
    <button class="img-btn" data-action="left" style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      ← Float Left
    </button>
    <button class="img-btn" data-action="right" style="background: #FF9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      Float Right →
    </button>
    <button class="img-btn" data-action="center" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      📍 Center
    </button>
    <button class="img-btn" data-action="small" style="background: #9C27B0; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔸 Small
    </button>
    <button class="img-btn" data-action="medium" style="background: #E91E63; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔹 Medium
    </button>
    <button class="img-btn" data-action="large" style="background: #795548; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
      🔶 Large
    </button>
  `;
  
  // Add click handlers
  toolbar.querySelectorAll('.img-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      console.log(`🎯 Image ${action} button clicked`);
      applyImageAlignment(action);
    });
    
    // Add hover effects
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });
  });
  
  document.body.appendChild(toolbar);
  console.log('✅ Added image alignment toolbar');
  
  // Re-run periodically to ensure it stays available
  setTimeout(addImageAlignmentButtons, 5000);
}

function applyImageAlignment(action) {
  console.log(`🔧 Applying image alignment: ${action}`);
  
  // Find the active editor
  const editor = findActiveEditor();
  if (!editor) {
    alert('Please click in the editor first, then select some text containing an image before using image alignment tools.');
    return;
  }
  
  let success = false;
  
  // Try CodeMirror first
  if (editor.CodeMirror) {
    success = applyAlignmentToCodeMirror(editor.CodeMirror, action);
  } else {
    // Try textarea fallback
    const textarea = editor.querySelector('textarea') || document.querySelector('textarea');
    if (textarea) {
      success = applyAlignmentToTextarea(textarea, action);
    }
  }
  
  if (success) {
    showAlignmentSuccess(action);
  } else {
    alert(`❌ No image found at cursor position. Please:\n1. Select text containing an image\n2. Or place cursor on an image line\n3. Then try the ${action} alignment again.`);
  }
}

function findActiveEditor() {
  // Look for CodeMirror editors
  const codeMirrorEditors = document.querySelectorAll('.CodeMirror');
  for (let editor of codeMirrorEditors) {
    if (editor.CodeMirror && editor.CodeMirror.hasFocus && editor.CodeMirror.hasFocus()) {
      return editor;
    }
  }
  
  // Fallback: find any CodeMirror
  if (codeMirrorEditors.length > 0) {
    return codeMirrorEditors[0];
  }
  
  // Fallback: find focused textarea
  const textareas = document.querySelectorAll('textarea');
  for (let textarea of textareas) {
    if (document.activeElement === textarea) {
      return textarea;
    }
  }
  
  // Last resort: any textarea
  return textareas[0] || null;
}

function applyAlignmentToCodeMirror(cm, action) {
  const cursor = cm.getCursor();
  const selection = cm.getSelection();
  
  // If there's a selection, work with that
  if (selection.trim()) {
    return processImageText(selection, action, (newText) => {
      cm.replaceSelection(newText);
      return true;
    });
  }
  
  // Otherwise, work with the current line
  const line = cm.getLine(cursor.line);
  return processImageText(line, action, (newText) => {
    cm.setLine(cursor.line, newText);
    return true;
  });
}

function applyAlignmentToTextarea(textarea, action) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  
  // If there's a selection, work with that
  if (selectedText.trim()) {
    return processImageText(selectedText, action, (newText) => {
      textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
  }
  
  // Otherwise, work with the current line
  const lines = textarea.value.split('\n');
  const currentLineIndex = textarea.value.substring(0, start).split('\n').length - 1;
  const currentLine = lines[currentLineIndex];
  
  return processImageText(currentLine, action, (newText) => {
    lines[currentLineIndex] = newText;
    textarea.value = lines.join('\n');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
}

function processImageText(text, action, updateCallback) {
  // Regex to match markdown images with optional CSS classes
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/g;
  let hasImages = false;
  
  const newText = text.replace(imageRegex, (match, alt, url, existingClasses) => {
    hasImages = true;
    console.log(`🖼️ Found image: ${match}`);
    
    // Parse existing classes
    let classes = [];
    if (existingClasses) {
      classes = existingClasses.split(/[\s.]+/).filter(c => c && c !== '');
    }
    
    // Remove existing alignment and size classes
    classes = classes.filter(c => !c.match(/^image-(left|right|center|small|medium|large)$/));
    
    // Add new class based on action
    const classMap = {
      'left': 'image-left',
      'right': 'image-right', 
      'center': 'image-center',
      'small': 'image-small',
      'medium': 'image-medium',
      'large': 'image-large'
    };
    
    if (classMap[action]) {
      classes.push(classMap[action]);
    }
    
    // Build the new image markdown
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const newImage = `![${alt}](${url})${classString}`;
    
    console.log(`✅ Updated image: ${newImage}`);
    return newImage;
  });
  
  if (hasImages) {
    return updateCallback(newText);
  }
  
  return false;
}

function showAlignmentSuccess(action) {
  // Create success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10002;
    font-family: sans-serif;
    font-size: 14px;
    font-weight: bold;
  `;
  
  const actionNames = {
    'left': '← Float Left',
    'right': 'Float Right →',
    'center': '📍 Center',
    'small': '🔸 Small Size',
    'medium': '🔹 Medium Size',
    'large': '🔶 Large Size'
  };
  
  notification.textContent = `✅ Applied ${actionNames[action]} to image(s)`;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 2000);
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
  indicator.textContent = '✅ Image Alignment Tools Ready';
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