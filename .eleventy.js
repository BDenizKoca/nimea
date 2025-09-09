module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("overlays");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("data");
  eleventyConfig.addPassthroughCopy("map");
  eleventyConfig.addPassthroughCopy("en/map");
  eleventyConfig.addPassthroughCopy("en/overlays");
  eleventyConfig.addPassthroughCopy("en/images");
  eleventyConfig.addPassthroughCopy("map.webp");
  // myicon.png remains in repo as source for generator; not needed to pass-through at runtime.
  eleventyConfig.addPassthroughCopy("manifest.webmanifest");
  eleventyConfig.addPassthroughCopy("service-worker.js");
  eleventyConfig.addPassthroughCopy("offline.html");
  // Remove GitHub Pages specific files
  // eleventyConfig.addPassthroughCopy(".nojekyll");
  // eleventyConfig.addPassthroughCopy("auth.html");
  // eleventyConfig.addPassthroughCopy("auth-redirect.html");
  // eleventyConfig.addPassthroughCopy("callback.html");

  // Add global i18n data
  eleventyConfig.addGlobalData("i18n", () => {
    return require("./_data/i18n.json");
  });

  // Add i18n helper function
  eleventyConfig.addShortcode("t", function(key, lang = "tr") {
    const i18n = require("./_data/i18n.json");
    const keys = key.split('.');
    let value = i18n[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  });

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

  // English collections  
  eleventyConfig.addCollection("charactersEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/characters/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("locationsEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/locations-regions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("nationsEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/nations-factions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("playerCharactersEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/player-characters/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("godsEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/gods-religions/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  eleventyConfig.addCollection("magicEn", function(collection) {
    return collection.getFilteredByGlob("en/wiki/magic-powers/*.md").filter(item => !item.inputPath.includes('index.md'));
  });

  // Remove GitHub Pages specific path prefix
  // const pathPrefix = process.env.GITHUB_ACTIONS ? '/nimea/' : '/';

  return {
    // pathPrefix,
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site"
    }
  };
};
