import { APP_VERSION, compareSemver } from '../appVersion';
import { shouldUseAndroidApkUpdater } from '../capgoUpdater';
import { otaDebugLogs } from './diagnostics';
import { StructuredReleaseNotes } from './stateMachine';

export interface RemoteVersionInfo {
  version: string;
  versionCode?: number;
  changelog?: string;
  mandatory?: boolean;
  downloadUrl?: string;
  updateType?: 'ota' | 'apk' | 'both' | 'none';
  apkUrl?: string;
  apkSha256?: string;
  manualApkUrl?: string;
  fallbackApkUrl?: string;
  releaseNotes?: string[] | StructuredReleaseNotes;
  requiredApkVersion?: string;
  requiredVersionCode?: number;
  platform?: string;
  reinstallRequired?: boolean;
  signatureChanged?: boolean;
  previousSignatureSha256?: string;
  newSignatureSha256?: string;
  installMode?: 'reinstall-required';
  packageName?: string;
  signatures?: string;
}

const FETCH_TIMEOUT_MS = 6000;

export function versionJsonUrls(): string[] {
  const t = Date.now();
  const override = (import.meta.env.VITE_OTA_VERSION_URL as string | undefined)?.trim();
  if (override) {
    const sep = override.includes('?') ? '&' : '?';
    return [`${override}${sep}t=${t}`];
  }

  const remoteBase = (import.meta.env.VITE_OTA_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'https://studio-30f44.web.app';
  const urls: string[] = [];

  if (shouldUseAndroidApkUpdater()) {
    urls.push(`${remoteBase}/app-release.json?t=${t}`);
  } else {
    const localBase = import.meta.env.BASE_URL || '/';
    urls.push(`${localBase}version.json?t=${t}`);
  }

  return urls;
}

async function fetchOne(
  url: string,
  signal: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
    if (!res.ok) {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = `HTTP Error ${res.status}`;
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = `HTTP Error ${res.status}`;
      return null;
    }
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = 'Malformed JSON';
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = 'Malformed JSON';
      return null;
    }
    const obj = json as Record<string, unknown>;
    if (typeof obj.version !== 'string' || !obj.version.trim()) {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = 'Missing version field';
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = 'Missing version field';
      return null;
    }
    
    if (url.includes('version.json')) {
      otaDebugLogs.fetchedVersionJson = obj.version;
    } else if (url.includes('app-release.json')) {
      otaDebugLogs.fetchedAppReleaseJson = obj.version;
    }

    const changelog = typeof obj.description === 'string' ? obj.description : (typeof obj.changelog === 'string' ? obj.changelog : undefined);
    const downloadUrl = typeof obj.downloadUrl === 'string' ? obj.downloadUrl : (typeof obj.ota_download_url === 'string' ? obj.ota_download_url : undefined);
    const updateType = (obj.update_type === 'ota' || obj.update_type === 'apk' || obj.update_type === 'both' || obj.update_type === 'none') 
      ? obj.update_type 
      : ((obj.updateType === 'ota' || obj.updateType === 'apk' || obj.updateType === 'both' || obj.updateType === 'none') ? obj.updateType : undefined);
    const apkUrl = typeof obj.download_url === 'string' ? obj.download_url : (typeof obj.apkUrl === 'string' ? obj.apkUrl : undefined);
    const apkSha256 = typeof obj.sha256 === 'string' ? obj.sha256 : (typeof obj.apkSha256 === 'string' ? obj.apkSha256 : undefined);
    const manualApkUrl = typeof obj.manual_download_url === 'string' ? obj.manual_download_url : (typeof obj.manualApkUrl === 'string' ? obj.manualApkUrl : undefined);
    const fallbackApkUrl = typeof obj.fallback_download_url === 'string' ? obj.fallback_download_url : (typeof obj.fallbackApkUrl === 'string' ? obj.fallbackApkUrl : undefined);
    
    const reinstallRequired = !!(obj.reinstallRequired || obj.reinstall_required);
    const signatureChanged = !!(obj.signatureChanged || obj.signature_changed);
    const previousSignatureSha256 = typeof obj.previousSignatureSha256 === 'string' ? obj.previousSignatureSha256 : (typeof obj.previous_signature_sha256 === 'string' ? obj.previous_signature_sha256 : undefined);
    const newSignatureSha256 = typeof obj.newSignatureSha256 === 'string' ? obj.newSignatureSha256 : (typeof obj.new_signature_sha256 === 'string' ? obj.new_signature_sha256 : undefined);
    const installMode = (obj.installMode === 'reinstall-required' || obj.install_mode === 'reinstall-required') ? 'reinstall-required' : undefined;
    const packageName = typeof obj.packageName === 'string' ? obj.packageName : (typeof obj.package_name === 'string' ? obj.package_name : undefined);
    const signatures = typeof obj.signatures === 'string' ? obj.signatures : (typeof obj.signature === 'string' ? obj.signature : undefined);
    
    const requiredApkVersion = typeof obj.required_apk_version === 'string'
      ? obj.required_apk_version
      : (typeof obj.requiredApkVersion === 'string' ? obj.requiredApkVersion : undefined);
    const requiredVersionCode = typeof obj.required_version_code === 'number'
      ? obj.required_version_code
      : (typeof obj.requiredVersionCode === 'number' ? obj.requiredVersionCode : (typeof obj.required_version_code === 'string' ? parseInt(obj.required_version_code, 10) : (typeof obj.requiredVersionCode === 'string' ? parseInt(obj.requiredVersionCode, 10) : undefined)));
    const versionCode = typeof obj.versionCode === 'number'
      ? obj.versionCode
      : (typeof obj.version_code === 'number' ? obj.version_code : (typeof obj.versionCode === 'string' ? parseInt(obj.versionCode, 10) : (typeof obj.version_code === 'string' ? parseInt(obj.version_code, 10) : undefined)));

    let parsedReleaseNotes: string[] | StructuredReleaseNotes | undefined = undefined;
    if (obj.releaseNotes) {
      if (Array.isArray(obj.releaseNotes)) {
        parsedReleaseNotes = obj.releaseNotes.filter((item: any) => typeof item === 'string') as string[];
      } else if (typeof obj.releaseNotes === 'object') {
        const rnObj = obj.releaseNotes as any;
        const notesObj: StructuredReleaseNotes = {};
        if (Array.isArray(rnObj.added)) {
          notesObj.added = rnObj.added.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.improved)) {
          notesObj.improved = rnObj.improved.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.fixed)) {
          notesObj.fixed = rnObj.fixed.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.changed)) {
          notesObj.changed = rnObj.changed.filter((item: any) => typeof item === 'string') as string[];
        }
        if (notesObj.added || notesObj.improved || notesObj.fixed || notesObj.changed) {
          parsedReleaseNotes = notesObj;
        }
      }
    }

    return {
      version: obj.version,
      changelog,
      mandatory: obj.mandatory === true,
      downloadUrl,
      updateType,
      apkUrl,
      apkSha256,
      manualApkUrl,
      fallbackApkUrl,
      releaseNotes: parsedReleaseNotes,
      requiredApkVersion,
      requiredVersionCode,
      versionCode,
      platform: typeof obj.platform === 'string' ? obj.platform : undefined,
      reinstallRequired,
      signatureChanged,
      previousSignatureSha256,
      newSignatureSha256,
      installMode,
      packageName,
      signatures,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = `Error: ${errMsg}`;
    if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = `Error: ${errMsg}`;
    return null;
  }
}

export async function fetchRemoteVersion(
  signal?: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  const urls = versionJsonUrls();
  if (urls.length === 0) return null;

  const ctrl = signal ? null : new AbortController();
  const sig = signal ?? ctrl!.signal;

  return new Promise<RemoteVersionInfo | null>((resolve) => {
    let completed = false;

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        console.warn('[OTA] fetchRemoteVersion timed out (6s). Aborting fetches.');
        if (ctrl) {
          try {
            ctrl.abort();
          } catch (_) {}
        }
        resolve(null);
      }
    }, FETCH_TIMEOUT_MS);

    let resolved = false;
    let failedCount = 0;
    let fallbackRes: RemoteVersionInfo | null = null;
    const total = urls.length;

    urls.forEach((url) => {
      fetchOne(url, sig)
        .then((res) => {
          if (resolved || completed) return;
          if (res) {
            if (compareSemver(res.version, APP_VERSION) > 0) {
              resolved = true;
              completed = true;
              clearTimeout(timer);
              resolve(res);
            } else {
              fallbackRes = res;
              failedCount++;
              if (failedCount === total) {
                completed = true;
                clearTimeout(timer);
                resolve(fallbackRes);
              }
            }
          } else {
            failedCount++;
            if (failedCount === total) {
              completed = true;
              clearTimeout(timer);
              resolve(fallbackRes);
            }
          }
        })
        .catch(() => {
          if (resolved || completed) return;
          failedCount++;
          if (failedCount === total) {
            completed = true;
            clearTimeout(timer);
            resolve(fallbackRes);
          }
        });
    });
  });
}
