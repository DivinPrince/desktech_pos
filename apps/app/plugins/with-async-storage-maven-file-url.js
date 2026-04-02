const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { withGradleProperties } = require("expo/config-plugins");

const GRADLE_PROP = "android.extraMavenRepos";

/**
 * Async Storage 3.x depends on a vendored AAR in android/local_repo. expo-build-properties
 * writes a relative extraMavenRepo; Expo applies it in allprojects.repositories and Gradle
 * resolves that path per subproject, so :app looks under android/node_modules and the
 * artifact is missing. Use an absolute file URL instead (and resolve the package for hoisting).
 */
function withAsyncStorageMavenFileUrl(config) {
  return withGradleProperties(config, (cfg) => {
    let localRepo;
    try {
      const pkg = require.resolve("@react-native-async-storage/async-storage/package.json", {
        paths: [cfg.modRequest.projectRoot],
      });
      localRepo = path.join(path.dirname(pkg), "android", "local_repo");
    } catch {
      localRepo = path.join(
        cfg.modRequest.projectRoot,
        "node_modules",
        "@react-native-async-storage",
        "async-storage",
        "android",
        "local_repo"
      );
    }

    const fileUrl = pathToFileURL(localRepo).href.replace(/\/$/, "");
    const value = JSON.stringify([{ url: fileUrl }]);

    const props = cfg.modResults;
    const idx = props.findIndex((p) => p.type === "property" && p.key === GRADLE_PROP);
    if (idx >= 0) {
      props[idx].value = value;
    } else {
      props.push({ type: "property", key: GRADLE_PROP, value });
    }
    return cfg;
  });
}

module.exports = withAsyncStorageMavenFileUrl;
