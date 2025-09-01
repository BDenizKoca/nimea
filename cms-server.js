const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 8081;

// In-memory data store for our test repo
let contentStore = {};

// Initialize by loading existing files
const initializeStore = () => {
  const wikiPath = path.join(__dirname, 'wiki');
  if (fs.existsSync(wikiPath)) {
    const collections = fs.readdirSync(wikiPath);
    collections.forEach(collection => {
      const collectionPath = path.join(wikiPath, collection);
      if (fs.statSync(collectionPath).isDirectory()) {
        const files = fs.readdirSync(collectionPath);
        files.forEach(file => {
          if (file.endsWith('.md') && file !== 'index.md') {
            const slug = file.replace('.md', '');
            const filePath = path.join(collectionPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            // We would need to parse the markdown to get the actual content
            // But for now, just store a placeholder
            contentStore[`${collection}/${slug}`] = {
              slug: slug,
              path: filePath,
              collection: collection
            };
            console.log(`Loaded ${collection}/${slug} from file`);
          }
        });
      }
    });
  }
};

// Initialize the store
initializeStore();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper function to convert content to markdown
const convertToMarkdown = (content) => {
  // Extract the body content
  const bodyContent = content.body || '';
  
  // Create frontmatter
  let frontmatter = '---\n';
  
  // Add all properties except body to frontmatter
  Object.entries(content).forEach(([key, value]) => {
    if (key !== 'body') {
      if (typeof value === 'string') {
        frontmatter += `${key}: "${value}"\n`;
      } else if (value === null || value === undefined) {
        // Skip null or undefined values
      } else {
        frontmatter += `${key}: ${value}\n`;
      }
    }
  });
  
  frontmatter += '---\n\n';
  
  // Return the complete markdown
  return frontmatter + bodyContent;
};

// Helper function to save content to file
const saveToFile = (collection, slug, content) => {
  try {
    const folderPath = path.join(__dirname, 'wiki', collection);
    const filePath = path.join(folderPath, `${slug}.md`);
    
    // Ensure the folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`Created folder: ${folderPath}`);
    }
    
    // Convert content to markdown
    const markdown = convertToMarkdown(content);
    
    // Write to file
    fs.writeFileSync(filePath, markdown);
    console.log(`Saved file to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error saving file: ${error.message}`);
    return false;
  }
};

// GET endpoint to retrieve content
app.get('/api/v1/content/:collection/:slug', (req, res) => {
  const { collection, slug } = req.params;
  const key = `${collection}/${slug}`;
  
  console.log(`GET request for ${key}`);
  
  if (contentStore[key]) {
    res.json(contentStore[key]);
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

// POST endpoint to save content
app.post('/api/v1/content/:collection', (req, res) => {
  const { collection } = req.params;
  const content = req.body;
  
  console.log(`POST request for collection ${collection}`);
  console.log(`Request body keys:`, Object.keys(content));
  
  // Ensure slug exists
  const slug = content.slug || Date.now().toString();
  const key = `${collection}/${slug}`;
  
  // Store in memory
  contentStore[key] = { ...content, slug };
  console.log(`Saved content to memory: ${key}`);
  
  // Save to file
  const saved = saveToFile(collection, slug, content);
  
  if (saved) {
    res.json({ id: slug, ...content });
  } else {
    res.status(500).json({ error: 'Failed to save content to file' });
  }
});

// PUT endpoint to update content
app.put('/api/v1/content/:collection/:slug', (req, res) => {
  const { collection, slug } = req.params;
  const content = req.body;
  const key = `${collection}/${slug}`;
  
  console.log(`PUT request for ${key}`);
  
  // Update in memory
  contentStore[key] = { ...content, slug };
  console.log(`Updated content in memory: ${key}`);
  
  // Save to file
  const saved = saveToFile(collection, slug, content);
  
  if (saved) {
    res.json({ id: slug, ...content });
  } else {
    res.status(500).json({ error: 'Failed to save content to file' });
  }
});

// List all content in a collection
app.get('/api/v1/content/:collection', (req, res) => {
  const { collection } = req.params;
  
  console.log(`GET request for collection ${collection}`);
  
  // Filter and map the content store
  const collectionItems = Object.entries(contentStore)
    .filter(([key]) => key.startsWith(`${collection}/`))
    .map(([_, value]) => value);
  
  console.log(`Returning ${collectionItems.length} items for collection ${collection}`);
  
  res.json(collectionItems);
});

// Delete content
app.delete('/api/v1/content/:collection/:slug', (req, res) => {
  const { collection, slug } = req.params;
  const key = `${collection}/${slug}`;
  
  console.log(`DELETE request for ${key}`);
  
  if (contentStore[key]) {
    // Remove from memory
    delete contentStore[key];
    console.log(`Deleted content from memory: ${key}`);
    
    // Delete file if it exists
    const filePath = path.join(__dirname, 'wiki', collection, `${slug}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file ${filePath}`);
    }
    
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

// Handle options requests (important for CORS)
app.options('*', cors());

app.listen(port, () => {
  console.log(`CMS persistence server running at http://localhost:${port}`);
  console.log(`Content store initialized with ${Object.keys(contentStore).length} entries`);
});