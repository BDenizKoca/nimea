module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("overlays");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("data");
  eleventyConfig.addPassthroughCopy("map");
  eleventyConfig.addPassthroughCopy("map.webp");
  eleventyConfig.addPassthroughCopy(".nojekyll");

  // Add collections for wiki sections
  eleventyConfig.addCollection("characters", function(collection) {
    return collection.getFilteredByGlob("wiki/characters/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("locations", function(collection) {
    return collection.getFilteredByGlob("wiki/locations-regions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("nations", function(collection) {
    return collection.getFilteredByGlob("wiki/nations-factions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("playerCharacters", function(collection) {
    return collection.getFilteredByGlob("wiki/player-characters/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("gods", function(collection) {
    return collection.getFilteredByGlob("wiki/gods-religions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("magic", function(collection) {
    return collection.getFilteredByGlob("wiki/magic-powers/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  // Add a pathPrefix if we're deploying to GitHub Pages
  const pathPrefix = process.env.GITHUB_ACTIONS ? '/nimea/' : '/';

  return {
    pathPrefix,
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site"
    }
  };
};
