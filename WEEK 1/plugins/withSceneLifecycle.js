const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * iOS 27 kills apps at launch unless they adopt the UIScene life cycle
 * (UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo 57 ships the scene delegate
 * (`ExpoAppSceneDelegate`) but the generated AppDelegate still creates its own window, so:
 * - register Expo's scene delegate in Info.plist, and
 * - let the AppDelegate only build the React Native factory; the scene delegate makes the window
 *   and starts React Native into it.
 */
const MARKER = 'ExpoReactNativeFactoryProvider';

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    };
    return mod;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes(MARKER)) return mod;
    const before = src;
    src = src.replace('class AppDelegate: ExpoAppDelegate {', `class AppDelegate: ExpoAppDelegate, ${MARKER} {`);
    // The scene delegate creates the window and starts React Native; doing it here too would start it twice
    src = src.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      '\n',
    );
    if (src === before || src.includes('factory.startReactNative(')) {
      throw new Error('withSceneLifecycle: the AppDelegate template changed; update the plugin.');
    }
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
