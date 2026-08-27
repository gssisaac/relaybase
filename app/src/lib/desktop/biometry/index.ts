export type { BiometryStatus, BiometryType } from "./types";
export { biometryLabel } from "./label";
export { isSystemCanceledBiometry, isUserDismissedBiometry } from "./dismiss";
export {
  desktopAuthenticateBiometry,
  desktopCheckBiometry,
} from "./plugin";
