const { withPodfile, withXcodeProject } = require('expo/config-plugins');

/**
 * This repo lives under "Hacktoberfest 2026/WEEK 1", and two generated iOS build scripts split
 * their paths at that space. Both fixes quote the path instead of renaming the repo.
 */
const MARKER = '# trailkit: quote pod script paths';

// 1. expo-constants' pod runs `bash -l -c "$PODS_TARGET_SRCROOT/..."`; pass the script as a quoted argument
function withQuotedPodScript(config) {
  return withPodfile(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) return mod;
    mod.modResults.contents = mod.modResults.contents.replace(
      'post_install do |installer|',
      `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        phase.shell_script = phase.shell_script.gsub('bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"', 'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"')
      end
    end`,
    );
    return mod;
  });
}

// 2. The "Bundle React Native code and images" phase runs `node --print ...` in backticks; quote the result
function withQuotedBundlePhase(config) {
  return withXcodeProject(config, (mod) => {
    const phases = mod.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const phase of Object.values(phases)) {
      if (typeof phase !== 'object' || typeof phase.shellScript !== 'string') continue;
      phase.shellScript = phase.shellScript.replace(/`(\\"\$NODE_BINARY\\" --print [^`]*)`/, '\\"$($1)\\"');
    }
    return mod;
  });
}

module.exports = (config) => withQuotedBundlePhase(withQuotedPodScript(config));
