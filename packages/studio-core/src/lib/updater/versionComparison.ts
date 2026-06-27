import { APP_VERSION, compareSemver } from '../appVersion';
import { RemoteVersionInfo } from './releaseMetadata';

export interface VersionComparisonResult {
  updateAvailable: boolean;
  isDowngrade: boolean;
  isUpgrade: boolean;
  isUpToDate: boolean;
}

export function compareVersions(
  remote: RemoteVersionInfo,
  localVersionName: string = APP_VERSION,
  localVersionCode?: number,
): VersionComparisonResult {
  const nameComparison = compareSemver(remote.version, localVersionName);
  
  let isDowngrade = nameComparison < 0;
  let isUpgrade = nameComparison > 0;
  let isUpToDate = nameComparison === 0;

  if (localVersionCode !== undefined && remote.versionCode !== undefined) {
    if (remote.versionCode > localVersionCode) {
      isUpgrade = true;
      isDowngrade = false;
      isUpToDate = false;
    } else if (remote.versionCode < localVersionCode) {
      isDowngrade = true;
      isUpgrade = false;
      isUpToDate = false;
    }
  }

  return {
    updateAvailable: isUpgrade || isDowngrade,
    isDowngrade,
    isUpgrade,
    isUpToDate,
  };
}
