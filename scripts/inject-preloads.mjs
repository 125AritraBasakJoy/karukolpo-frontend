// inject-preloads.mjs: Disabled blanket modulepreload of lazy chunks to prevent
// downloading 9+ MB of non-critical JavaScript on initial page load.
console.log('inject-preloads: skipped blanket preloads for optimal performance');
process.exit(0);
