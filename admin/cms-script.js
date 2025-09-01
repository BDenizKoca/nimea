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

    // Custom Image Insertion Helper
    setupImageInsertionHelper();
    
    // Image Click-to-Edit functionality
    setupImageEditingHelper();
  }
});

function setupImageInsertionHelper() {
  // Wait for the editor to be ready
  setTimeout(() => {
    addImageInsertionButton();
  }, 2000);
}

function setupImageEditingHelper() {
  // Wait for the editor to be ready, then set up click handlers
  setTimeout(() => {
    addImageClickHandlers();
  }, 3000);
}

function addImageInsertionButton() {
  // Find all markdown editors
  const markdownEditors = document.querySelectorAll('[data-testid="richtext"] .CodeMirror, .CodeMirror');
  
  markdownEditors.forEach((editor, index) => {
    if (editor.dataset.imageHelperAdded) return; // Don't add multiple times
    editor.dataset.imageHelperAdded = 'true';
    
    // Create image insertion button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 2px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    const imageButton = document.createElement('button');
    imageButton.innerHTML = '🖼️ Insert Image';
    imageButton.type = 'button';
    imageButton.style.cssText = `
      background: #3f51b5;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    
    imageButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showImageInsertionModal(editor);
    });
    
    buttonContainer.appendChild(imageButton);
    
    // Add to editor container
    const editorContainer = editor.closest('.CodeMirror') || editor;
    editorContainer.style.position = 'relative';
    editorContainer.appendChild(buttonContainer);
  });
  
  // Re-run periodically to catch new editors
  setTimeout(addImageInsertionButton, 3000);
}

function showImageInsertionModal(editor) {
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
    <h2 style="margin-top: 0; color: #333; font-family: sans-serif;">🖼️ Insert Image</h2>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Image URL or Path:</label>
      <input type="text" id="imageUrl" placeholder="/images/filename.jpg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      <small style="color: #666; font-size: 12px;">Upload images first, then reference them like: /images/filename.jpg</small>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alt Text (Description):</label>
      <input type="text" id="altText" placeholder="Describe the image" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Alignment:</label>
      <select id="alignment" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="">Default (block)</option>
        <option value="image-left">Float Left</option>
        <option value="image-right">Float Right</option>
        <option value="image-center">Center</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Size:</label>
      <select id="size" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="">Default</option>
        <option value="image-small">Small (200px)</option>
        <option value="image-medium">Medium (400px)</option>
        <option value="image-large">Large (600px)</option>
      </select>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Preview:</h3>
      <div id="previewContainer" style="background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #333;">
        ![Alt text](/images/filename.jpg)
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="cancelBtn" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
      <button id="insertBtn" style="padding: 10px 20px; border: none; background: #3f51b5; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Insert Image</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Set up event listeners
  const imageUrlInput = modal.querySelector('#imageUrl');
  const altTextInput = modal.querySelector('#altText');
  const alignmentSelect = modal.querySelector('#alignment');
  const sizeSelect = modal.querySelector('#size');
  const previewContainer = modal.querySelector('#previewContainer');
  const cancelBtn = modal.querySelector('#cancelBtn');
  const insertBtn = modal.querySelector('#insertBtn');
  
  // Update preview function
  function updatePreview() {
    const url = imageUrlInput.value || '/images/filename.jpg';
    const alt = altTextInput.value || 'Alt text';
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    previewContainer.textContent = markdown;
  }
  
  // Set up event listeners for real-time preview
  imageUrlInput.addEventListener('input', updatePreview);
  altTextInput.addEventListener('input', updatePreview);
  alignmentSelect.addEventListener('change', updatePreview);
  sizeSelect.addEventListener('change', updatePreview);
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Insert button
  insertBtn.addEventListener('click', () => {
    const url = imageUrlInput.value.trim();
    const alt = altTextInput.value.trim();
    
    if (!url) {
      alert('Please enter an image URL or path');
      return;
    }
    
    if (!alt) {
      alert('Please enter alt text for accessibility');
      return;
    }
    
    const alignment = alignmentSelect.value;
    const size = sizeSelect.value;
    
    let classes = [];
    if (alignment) classes.push(alignment);
    if (size) classes.push(size);
    
    const classString = classes.length > 0 ? `{.${classes.join(' .')}}` : '';
    const markdown = `![${alt}](${url})${classString}`;
    
    // Insert into editor
    insertTextIntoEditor(editor, markdown);
    
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
  imageUrlInput.focus();
}

function insertTextIntoEditor(editor, text) {
  // Get CodeMirror instance
  let codeMirror;
  if (editor.CodeMirror) {
    codeMirror = editor.CodeMirror;
  } else {
    // Try to find CodeMirror instance
    const cmElement = editor.closest('.CodeMirror');
    if (cmElement && cmElement.CodeMirror) {
      codeMirror = cmElement.CodeMirror;
    }
  }
  
  if (codeMirror) {
    // Insert at cursor position
    const cursor = codeMirror.getCursor();
    codeMirror.replaceRange(text, cursor);
    codeMirror.focus();
  } else {
    // Fallback: try to find textarea and insert
    const textarea = editor.querySelector('textarea') || 
                     editor.closest('.form-control') || 
                     document.querySelector('textarea[data-testid="markdown"]');
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      textarea.value = value.substring(0, start) + text + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
      
      // Trigger change event
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

function addImageClickHandlers() {
  // Find all CodeMirror editors
  const editors = document.querySelectorAll('.CodeMirror');
  
  editors.forEach(editor => {
    if (editor.dataset.imageClickHandlerAdded) return;
    editor.dataset.imageClickHandlerAdded = 'true';
    
    const codeMirror = editor.CodeMirror;
    if (!codeMirror) return;
    
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
    
    // Add double-click handler
    codeMirror.on('dblclick', (cm, event) => {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      const imageMatch = findImageAtCursor(line, cursor.ch);
      
      if (imageMatch) {
        event.preventDefault();
        showImageEditModal(cm, cursor.line, imageMatch);
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
  
  while ((match = imageRegex.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    
    if (cursorPos >= start && cursorPos <= end) {
      return {
        fullMatch: match[0],
        alt: match[1],
        url: match[2],
        classes: match[3] || '',
        start: start,
        end: end,
        line: line
      };
    }
  }
  
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