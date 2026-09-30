// Custom macOS signing hook for electron-builder (see "build.mac.sign" in package.json).
// electron-builder only picks identities macOS trusts, so the self-signed "rsedykh-apps"
// certificate is handed to @electron/osx-sign directly. Without that certificate in the
// keychain the app is ad-hoc signed, so the bundle always carries a valid signature.
const { execFileSync } = require('child_process');
const { signAsync } = require('@electron/osx-sign');

const IDENTITY = process.env.MAC_SIGN_IDENTITY || 'rsedykh-apps';

module.exports = async function sign(options) {
  const identities = execFileSync('security', ['find-identity', '-p', 'codesigning'], { encoding: 'utf8' });
  const identity = identities.includes(`"${IDENTITY}"`) ? IDENTITY : '-';
  console.log(`  • signing app  identity=${identity}`);
  await signAsync({ ...options, identity });
};
