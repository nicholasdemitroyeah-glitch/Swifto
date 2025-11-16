'use client';

export async function requestGeoPermission(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    try {
      // Safari/iOS requires a user gesture; call this from a button click
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } catch (e) {
      reject(e);
    }
  });
}

export async function checkPermissionState(): Promise<PermissionState | 'unsupported'> {
  try {
    // Not supported in Safari iOS < 16.4
    // @ts-ignore
    if (!navigator.permissions) return 'unsupported';
    // @ts-ignore
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state as PermissionState;
  } catch {
    return 'unsupported';
  }
}


