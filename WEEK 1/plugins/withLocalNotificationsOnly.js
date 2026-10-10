const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * TrailKit only schedules local notifications (off-route alerts), never push. expo-notifications
 * adds the push entitlement anyway, and free personal Apple teams can't sign an app that has it.
 * Listed first in app.json: Expo runs mods in reverse, so this runs after expo-notifications.
 */
module.exports = function withLocalNotificationsOnly(config) {
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) mod.modResults.UIBackgroundModes = modes.filter((m) => m !== 'remote-notification');
    return mod;
  });
};
