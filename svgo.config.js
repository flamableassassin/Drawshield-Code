// svgo.config.js
module.exports = {
  multipass: true, // boolean. false by default
  plugins: [
    "cleanupAttrs",
    "cleanupEnableBackground",
    "removeComments",
    "removeDesc",
    "removeDoctype",
    "removeEditorsNSData",
    "removeEmptyAttrs",
    "removeEmptyContainers",
    "removeEmptyText",
    "removeMetadata",
    "removeScriptElement",
    "removeTitle",

  ],
};