const { withMainApplication } = require('expo/config-plugins');

/**
 * Expo config plugin to register OnnxruntimePackage in MainApplication.kt
 * since onnxruntime-react-native lacks standard autolinking.
 */
module.exports = function withOnnxruntime(config) {
  return withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (!contents.includes('OnnxruntimePackage')) {
      const manualAnchor = '// Packages that cannot be autolinked yet can be added manually here:';
      if (contents.includes(manualAnchor)) {
        contents = contents.replace(
          manualAnchor,
          `${manualAnchor}\n          add(ai.onnxruntime.reactnative.OnnxruntimePackage())`
        );
      } else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply {\n          add(ai.onnxruntime.reactnative.OnnxruntimePackage())\n        }'
        );
      }
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
