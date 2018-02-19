
const path = require('path');

module.exports = {
  make_targets: {
        win32: ["squirrel"],
        darwin: ["zip"],
        linux: ["deb"]
  },
  electronPackagerConfig: {
    packageManager: "npm",
    asar: true,
    prune: true,
    overwrite: true,
    icon: path.resolve(__dirname, "/src/Vectors/Icon/256x256.png")
  },
  electronWinstallerConfig: {
    name: "tmgr"
  },
  electronInstallerDebian: {},
  electronInstallerRedhat: {},
  github_repository: {
    owner: "",
    name: ""
  },
  windowsStoreConfig: {
    packageName: "",
    name: "tmgr"
  }
}