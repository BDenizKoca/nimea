module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("overlays");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("data");
  eleventyConfig.addPassthroughCopy("map");
  eleventyConfig.addPassthroughCopy("map.webp");

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site"
    }
  };
};
