const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optimize Metro bundler for faster startup and better performance
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

// Enable aggressive caching
config.resetCache = false;

// Optimize resolver to exclude unnecessary files
config.resolver = {
  ...config.resolver,
  blockList: [
    // Exclude documentation files from bundling
    /.*\.md$/,
    /.*\.sql$/,
    /.*\.backup$/,
    /.*test.*\.js$/,
    /.*test.*\.ts$/,
  ],
  sourceExts: [...(config.resolver?.sourceExts || []), 'mjs', 'cjs'],
  // Fix safe-regex-test resolution issue
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'safe-regex-test') {
      return {
        filePath: require.resolve('safe-regex-test'),
        type: 'sourceFile',
      };
    }
    // Default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

// Optimize watcher to ignore non-essential files
config.watchFolders = config.watchFolders || [];
config.watcher = {
  ...config.watcher,
  watchman: {
    deferStates: ['hg.update'],
  },
  healthCheck: {
    enabled: true,
  },
};

module.exports = config;





