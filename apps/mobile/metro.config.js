const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)

const backendWorkspace = path.resolve(__dirname, '../api')
config.watchFolders = config.watchFolders.filter(folder => path.resolve(folder) !== backendWorkspace)
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo')
config.resolver.assetExts = config.resolver.assetExts.filter(extension => extension !== 'svg')
config.resolver.sourceExts.push('svg')

module.exports = config
