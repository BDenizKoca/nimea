# Images Guide for Nimea Wiki

## Cover Images

Every wiki page can now have a cover image! When creating or editing content through the CMS:

1. Look for the **"Cover Image"** field
2. Click to upload an image (JPG, PNG, or GIF)
3. The image will appear at the top of your page

## Inline Images in Content

You can add images anywhere in your content using markdown syntax:

### Basic Image
```markdown
![Alt text](path/to/image.jpg)
```

### Image with Custom CSS Classes
You can add CSS classes for different image alignments:

```markdown
![Description](image.jpg){.image-left}
Some text that will wrap around the left-aligned image.

![Description](image.jpg){.image-right}
Some text that will wrap around the right-aligned image.

![Description](image.jpg){.image-center}
A centered image.
```

### Image Upload Options

1. **Direct Upload**: Upload images through the CMS media library
2. **External URLs**: Use images hosted elsewhere (make sure you have permission)
3. **Local Images**: Place images in the `images/` folder

### Best Practices

- **Cover Images**: Use landscape orientation, minimum 800x300px for best results
- **Inline Images**: Keep file sizes reasonable (under 1MB) for fast loading
- **Alt Text**: Always include descriptive alt text for accessibility
- **Naming**: Use descriptive filenames like `varkas-portrait.jpg` instead of `IMG_001.jpg`

### Image Folder Structure

```
images/
├── characters/
│   ├── varkas-portrait.jpg
│   └── skribas-studying.png
├── locations/
│   ├── aurelium-cityscape.jpg
│   └── dragon-lair-entrance.png
├── nations/
│   └── aurelius-flag.png
└── misc/
    └── ancient-artifact.jpg
```

## Technical Notes

- Images are automatically resized to fit the content area
- Cover images are cropped to 300px height (200px on mobile)
- All images get a subtle border and shadow for the medieval aesthetic
- Images are responsive and work on all device sizes