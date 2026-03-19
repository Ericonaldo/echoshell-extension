const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    'service-worker': './src/background/service-worker.js',
    'offscreen': './src/offscreen/offscreen.js',
    'content': './src/content/content.js',
    'sidepanel': './src/sidepanel/sidepanel.js',
    'popup': './src/popup/popup.js',
    'settings': './src/settings/settings.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/sidepanel/sidepanel.html', to: 'sidepanel.html' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/settings/settings.html', to: 'settings.html' },
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' }
      ]
    })
  ],
  resolve: {
    extensions: ['.js']
  }
};
