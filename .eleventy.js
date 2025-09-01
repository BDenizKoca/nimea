module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("overlays");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("data");
  eleventyConfig.addPassthroughCopy("map");
  eleventyConfig.addPassthroughCopy("map.webp");
  eleventyConfig.addPassthroughCopy(".nojekyll");

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
