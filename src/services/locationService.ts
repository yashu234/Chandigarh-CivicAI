/**
 * Chandigarh CivicAI — Location & Geolocation Service
 *
 * Provides reliable, permission-aware device coordinate collection
 * and validation for municipal grievances.
 *
 * ETHICAL & CIVIC OPERATIONAL PRINCIPLES:
 * 1. Location permission is ONLY requested on explicit user gesture (button click).
 * 2. GPS coordinates are strictly advisory; missing or denied GPS NEVER blocks complaint submission.
 * 3. Never fabricate or simulate coordinates for citizen submissions.
 * 4. All collected coordinates are strictly validated for numeric range (-90..90, -180..180).
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED';

export interface GeolocationResult {
  success: boolean;
  coordinates?: GeoCoordinates;
  error?: string;
  errorCode?: GeolocationErrorCode;
}

/**
 * Validates that latitude and longitude are valid finite numbers within geographical bounds.
 */
export function isValidCoordinates(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Formats coordinates into standard geographical representation (e.g. 30.7333° N, 76.7794° E).
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  if (!isValidCoordinates(latitude, longitude)) {
    return 'Invalid coordinates';
  }
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lngDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lngDir}`;
}

/**
 * Standard sector centroids for the Union Territory of Chandigarh.
 * Used strictly for advisory proximity suggestions when GPS is obtained.
 */
const CHANDIGARH_SECTOR_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Sector 1': { lat: 30.7583, lng: 76.8041 },
  'Sector 2': { lat: 30.7554, lng: 76.8001 },
  'Sector 3': { lat: 30.7505, lng: 76.7955 },
  'Sector 4': { lat: 30.7481, lng: 76.7902 },
  'Sector 7': { lat: 30.7315, lng: 76.8012 },
  'Sector 8': { lat: 30.7388, lng: 76.7941 },
  'Sector 9': { lat: 30.7431, lng: 76.7865 },
  'Sector 10': { lat: 30.7475, lng: 76.7792 },
  'Sector 11': { lat: 30.7521, lng: 76.7715 },
  'Sector 14': { lat: 30.7601, lng: 76.7665 },
  'Sector 15': { lat: 30.7551, lng: 76.7621 },
  'Sector 16': { lat: 30.7485, lng: 76.7725 },
  'Sector 17': { lat: 30.7408, lng: 76.7828 }, // City Centre
  'Sector 18': { lat: 30.7345, lng: 76.7905 },
  'Sector 19': { lat: 30.7285, lng: 76.7981 },
  'Sector 20': { lat: 30.7221, lng: 76.7915 },
  'Sector 21': { lat: 30.7275, lng: 76.7845 },
  'Sector 22': { lat: 30.7335, lng: 76.7765 },
  'Sector 23': { lat: 30.7391, lng: 76.7695 },
  'Sector 24': { lat: 30.7451, lng: 76.7625 },
  'Sector 25': { lat: 30.7511, lng: 76.7555 },
  'Sector 26': { lat: 30.7245, lng: 76.8085 },
  'Sector 27': { lat: 30.7185, lng: 76.8015 },
  'Sector 28': { lat: 30.7125, lng: 76.7945 },
  'Sector 29': { lat: 30.7065, lng: 76.7875 },
  'Sector 30': { lat: 30.7125, lng: 76.7805 },
  'Sector 31': { lat: 30.7065, lng: 76.7735 },
  'Sector 32': { lat: 30.7125, lng: 76.7665 },
  'Sector 33': { lat: 30.7185, lng: 76.7595 },
  'Sector 34': { lat: 30.7245, lng: 76.7525 },
  'Sector 35': { lat: 30.7305, lng: 76.7455 },
  'Sector 43': { lat: 30.7185, lng: 76.7425 },
};

/**
 * Suggests the nearest Chandigarh sector based on coordinate proximity.
 * Returns null if coordinates fall outside the Chandigarh metropolitan region.
 */
export function suggestNearestSector(
  latitude: number,
  longitude: number
): string | null {
  if (!isValidCoordinates(latitude, longitude)) {
    return null;
  }

  // Chandigarh approximate bounding box
  if (latitude < 30.65 || latitude > 30.82 || longitude < 76.68 || longitude > 76.88) {
    return null;
  }

  let nearestSector: string | null = null;
  let minDistanceSq = Number.POSITIVE_INFINITY;

  for (const [secName, coords] of Object.entries(CHANDIGARH_SECTOR_CENTROIDS)) {
    const dLat = latitude - coords.lat;
    const dLng = longitude - coords.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearestSector = secName;
    }
  }

  return nearestSector;
}

/**
 * Requests the citizen's current device location via browser Geolocation API.
 * Must only be called in direct response to user interaction.
 */
export async function requestDeviceCoordinates(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
): Promise<GeolocationResult> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.geolocation
  ) {
    return {
      success: false,
      error: 'Geolocation is not supported by your current browser or device.',
      errorCode: 'NOT_SUPPORTED',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!isValidCoordinates(latitude, longitude)) {
          resolve({
            success: false,
            error: 'Device returned invalid geographical coordinates.',
            errorCode: 'POSITION_UNAVAILABLE',
          });
          return;
        }

        resolve({
          success: true,
          coordinates: {
            latitude,
            longitude,
            accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : undefined,
          },
        });
      },
      (error) => {
        let userMessage: string;
        let code: GeolocationErrorCode;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            userMessage =
              'Location permission was denied. You can manually select your Chandigarh sector and landmark below.';
            code = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            userMessage =
              'Location information is unavailable or GPS signal could not be acquired. You can manually enter your sector below.';
            code = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            userMessage =
              'Location request timed out. Please retry or manually select your sector below.';
            code = 'TIMEOUT';
            break;
          default:
            userMessage =
              'Unable to retrieve location coordinates. You can manually enter your sector below.';
            code = 'POSITION_UNAVAILABLE';
            break;
        }

        resolve({
          success: false,
          error: userMessage,
          errorCode: code,
        });
      },
      options
    );
  });
}
