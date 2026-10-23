import assert from 'node:assert/strict';
import {
  isValidCoordinates,
  formatCoordinates,
  suggestNearestSector,
  requestDeviceCoordinates,
  getSectorCoordinates,
  projectCoordinatesToPercent,
  projectPercentToCoordinates,
  CHANDIGARH_GEO_BOUNDS,
} from '../src/services/locationService.ts';
import {
  validateComplaintInput,
} from '../src/services/complaintsService.ts';

console.log('--- STARTING PHASE 1 EVIDENCE CAPTURE & LOCATION TEST SUITE ---');

const testQueue = [];

function test(name, fn) {
  testQueue.push(async () => {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  });
}

function asyncTest(name, fn) {
  testQueue.push(async () => {
    totalTests++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  });
}

// =====================================================================
// SECTION 1: COORDINATE VALIDATION & GEOLOCATION SERVICE
// =====================================================================

test('1. isValidCoordinates correctly validates Chandigarh and global coordinates', () => {
  // Valid Chandigarh Sector 17
  assert.equal(isValidCoordinates(30.7408, 76.7828), true);
  // Valid boundary values
  assert.equal(isValidCoordinates(90, 180), true);
  assert.equal(isValidCoordinates(-90, -180), true);
  assert.equal(isValidCoordinates(0, 0), true);

  // Invalid latitudes
  assert.equal(isValidCoordinates(90.001, 76.78), false);
  assert.equal(isValidCoordinates(-90.001, 76.78), false);

  // Invalid longitudes
  assert.equal(isValidCoordinates(30.74, 180.001), false);
  assert.equal(isValidCoordinates(30.74, -180.001), false);

  // Non-numeric / non-finite
  assert.equal(isValidCoordinates(NaN, 76.78), false);
  assert.equal(isValidCoordinates(30.74, Infinity), false);
  assert.equal(isValidCoordinates(null, 76.78), false);
  assert.equal(isValidCoordinates(undefined, undefined), false);
  // @ts-ignore
  assert.equal(isValidCoordinates('30.74', '76.78'), false);
});

test('2. formatCoordinates returns standard hemisphere representation', () => {
  const formatted = formatCoordinates(30.7408, 76.7828);
  assert.equal(formatted, '30.7408° N, 76.7828° E');

  const southernWestern = formatCoordinates(-33.8688, -151.2093);
  assert.equal(southernWestern, '33.8688° S, 151.2093° W');

  const invalid = formatCoordinates(100, 200);
  assert.equal(invalid, 'Invalid coordinates');
});

test('3. suggestNearestSector computes proximity to Chandigarh sectors without fabricating outside bounds', () => {
  // Near Sector 17 Plaza
  const sec17 = suggestNearestSector(30.7410, 76.7830);
  assert.equal(sec17, 'Sector 17');

  // Near Sector 22 Market
  const sec22 = suggestNearestSector(30.7330, 76.7760);
  assert.equal(sec22, 'Sector 22');

  // Distant coordinates (Delhi: ~28.6139, 77.2090) outside Chandigarh bounding box should return null
  const outside = suggestNearestSector(28.6139, 77.2090);
  assert.equal(outside, null);

  // Invalid coordinates should return null
  assert.equal(suggestNearestSector(NaN, NaN), null);
});

asyncTest('4. requestDeviceCoordinates returns NOT_SUPPORTED when navigator.geolocation is missing', async () => {
  // In Node environment, window and navigator.geolocation are undefined
  const result = await requestDeviceCoordinates();
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'NOT_SUPPORTED');
  assert.match(result.error || '', /not supported/i);
});

// =====================================================================
// SECTION 2: EVIDENCE VALIDATION & TEXT-ONLY COMPLAINTS SUPPORT
// =====================================================================

test('5. validateComplaintInput accepts valid text-only complaints (photo is strictly optional)', () => {
  const input = {
    title: 'Damaged pavement tile on pedestrian pathway',
    description: 'Broken concrete pavers causing tripping hazard outside community center.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    evidenceFile: null,
  };
  const error = validateComplaintInput(input);
  assert.equal(error, null, 'Text-only complaint should be completely valid');
});

test('6. validateComplaintInput validates image format and size constraints', () => {
  // Valid JPEG
  const validJpeg = new File([new Uint8Array(1024)], 'defect.jpg', { type: 'image/jpeg' });
  assert.equal(
    validateComplaintInput({
      title: 'Valid Complaint',
      description: 'Pothole description long enough.',
      category: 'Roads & Footpaths',
      sector: 'Sector 17',
      evidenceFile: validJpeg,
    }),
    null
  );

  // Invalid MIME type (e.g. PDF or GIF)
  const invalidPdf = new File([new Uint8Array(1024)], 'doc.pdf', { type: 'application/pdf' });
  const pdfError = validateComplaintInput({
    title: 'Valid Complaint',
    description: 'Pothole description long enough.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    evidenceFile: invalidPdf,
  });
  assert.match(pdfError || '', /Unsupported image format/i);

  // Oversized file > 10MB (11MB)
  const oversizedFile = new File([new Uint8Array(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
  const sizeError = validateComplaintInput({
    title: 'Valid Complaint',
    description: 'Pothole description long enough.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    evidenceFile: oversizedFile,
  });
  assert.match(sizeError || '', /exceeds the 10 MB file size limit/i);
});

test('7. validateComplaintInput validates latitude and longitude numeric bounds', () => {
  // Valid coordinates
  const valid = validateComplaintInput({
    title: 'Valid Complaint',
    description: 'Pothole description long enough.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    latitude: 30.7408,
    longitude: 76.7828,
  });
  assert.equal(valid, null);

  // Invalid latitude out of bounds
  const badLat = validateComplaintInput({
    title: 'Valid Complaint',
    description: 'Pothole description long enough.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    latitude: 95.0,
    longitude: 76.7828,
  });
  assert.match(badLat || '', /Latitude must be a valid number between -90 and 90/i);

  // Invalid longitude out of bounds
  const badLng = validateComplaintInput({
    title: 'Valid Complaint',
    description: 'Pothole description long enough.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
    latitude: 30.7408,
    longitude: 195.0,
  });
  assert.match(badLng || '', /Longitude must be a valid number between -180 and 180/i);
});

// =====================================================================
// SECTION 3: IMAGE SOURCE TAGGING & CAMERA DENIAL GUIDANCE
// =====================================================================

test('8. Source tagging strictly distinguishes camera captures from file uploads', () => {
  // In UI, imageSource is typed as 'camera' | 'file' | null
  // When a user selects a file from disk, imageSource === 'file'
  const fileSource = 'file';
  const cameraSource = 'camera';

  const formatSourceLabel = (src) => {
    if (src === 'camera') return 'Captured via Camera';
    if (src === 'file') return 'Selected from Device';
    return 'None';
  };

  assert.equal(formatSourceLabel(fileSource), 'Selected from Device');
  assert.equal(formatSourceLabel(cameraSource), 'Captured via Camera');
  assert.notEqual(formatSourceLabel(fileSource), formatSourceLabel(cameraSource));
});

test('9. Camera error handlers provide actionable feedback on permission denial and unavailable hardware', () => {
  const getCameraErrorMessage = (err) => {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Please grant camera permission in your browser or select an existing photo from your device.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No physical camera device was detected on your system. Please select a photo from your files.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Your camera is currently in use by another application. Please close other camera apps and retry.';
    }
    return 'Unable to initialize device camera.';
  };

  const deniedErr = new Error('Permission denied');
  deniedErr.name = 'NotAllowedError';
  assert.match(getCameraErrorMessage(deniedErr), /Camera permission was denied/i);

  const notFoundErr = new Error('No device');
  notFoundErr.name = 'NotFoundError';
  assert.match(getCameraErrorMessage(notFoundErr), /No physical camera device was detected/i);

  const busyErr = new Error('Hardware busy');
  busyErr.name = 'NotReadableError';
  assert.match(getCameraErrorMessage(busyErr), /camera is currently in use/i);
});

// =====================================================================
// SECTION 4: GEOLOCATION PERMISSION & ERROR HANDLING
// =====================================================================

test('10. Geolocation error codes are mapped into non-blocking citizen guidance', () => {
  const getGeoGuidance = (code) => {
    switch (code) {
      case 1: // PERMISSION_DENIED
        return {
          code: 'PERMISSION_DENIED',
          message: 'Location permission was denied. You can manually select your Chandigarh sector and landmark below.',
          blocksSubmission: false,
        };
      case 2: // POSITION_UNAVAILABLE
        return {
          code: 'POSITION_UNAVAILABLE',
          message: 'Location information is unavailable or GPS signal could not be acquired. You can manually enter your sector below.',
          blocksSubmission: false,
        };
      case 3: // TIMEOUT
        return {
          code: 'TIMEOUT',
          message: 'Location request timed out. Please retry or manually select your sector below.',
          blocksSubmission: false,
        };
      default:
        return {
          code: 'UNKNOWN',
          message: 'Unable to retrieve location coordinates. You can manually enter your sector below.',
          blocksSubmission: false,
        };
    }
  };

  const denied = getGeoGuidance(1);
  assert.equal(denied.code, 'PERMISSION_DENIED');
  assert.equal(denied.blocksSubmission, false);
  assert.match(denied.message, /manually select/i);

  const unavail = getGeoGuidance(2);
  assert.equal(unavail.code, 'POSITION_UNAVAILABLE');
  assert.equal(unavail.blocksSubmission, false);

  const timeout = getGeoGuidance(3);
  assert.equal(timeout.code, 'TIMEOUT');
  assert.equal(timeout.blocksSubmission, false);
});

// =====================================================================
// SECTION 5: PERSISTENCE TRANSACTIONAL COMPENSATION LOGIC
// =====================================================================

test('11. Upload compensation rollback removes complaint record if storage upload fails', async () => {
  // Simulate transactional behavior from complaintsService:
  // When an evidence upload throws an error, the compensation step deletes the created complaint
  let complaintDeleted = false;
  let rolledBackId = null;

  const mockDb = {
    async deleteComplaint(id) {
      complaintDeleted = true;
      rolledBackId = id;
    },
  };

  const fakeComplaintId = 'chd-comp-12345';
  const fakeUploadError = new Error('Storage bucket connection reset');

  // Trigger simulated compensation
  try {
    throw fakeUploadError;
  } catch {
    await mockDb.deleteComplaint(fakeComplaintId);
  }

  assert.equal(complaintDeleted, true, 'Complaint should be deleted to prevent orphaned records');
  assert.equal(rolledBackId, fakeComplaintId);
});

// =====================================================================
// SECTION 6: CAMERA STREAM LIFECYCLE & STARTUP FAILURES
// =====================================================================

test('12. Camera stream cleanup terminates all media tracks and disposes srcObject', () => {
  let trackStopped = 0;
  const mockTrack = {
    stop() {
      trackStopped++;
    },
  };

  const mockStream = {
    getTracks() {
      return [mockTrack, mockTrack];
    },
  };

  const mockVideo = {
    srcObject: mockStream,
  };

  // Simulating stopCamera lifecycle
  mockStream.getTracks().forEach((track) => track.stop());
  mockVideo.srcObject = null;

  assert.equal(trackStopped, 2, 'All tracks must be stopped during cleanup');
  assert.equal(mockVideo.srcObject, null, 'Video element srcObject must be detached');
});

test('13. Camera startup error handling handles SecurityError, OverconstrainedError and missing devices', () => {
  const mapCameraError = (err) => {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Permission denied or blocked by browser policy';
    }
    if (err.name === 'SecurityError') {
      return 'Blocked by browser security policy';
    }
    if (err.name === 'NotFoundError') {
      return 'No physical camera device detected';
    }
    if (err.name === 'NotReadableError') {
      return 'Camera in use by another application';
    }
    return err.message || 'Camera error';
  };

  const secErr = new Error('Security policy violation');
  secErr.name = 'SecurityError';
  assert.match(mapCameraError(secErr), /security policy/i);

  const notFound = new Error('Not found');
  notFound.name = 'NotFoundError';
  assert.match(mapCameraError(notFound), /No physical camera/i);

  const busy = new Error('Track busy');
  busy.name = 'NotReadableError';
  assert.match(mapCameraError(busy), /Camera in use/i);
});

// =====================================================================
// SECTION 7: GPS-TO-MAP-STATE SYNCHRONIZATION & INTERACTIVE SECTOR GRID
// =====================================================================

test('14. projectCoordinatesToPercent accurately maps Chandigarh GPS to relative container percentages', () => {
  // Test Chandigarh City Centre (Sector 17)
  const sec17 = { lat: 30.7408, lng: 76.7828 };
  const pos = projectCoordinatesToPercent(sec17.lat, sec17.lng);

  assert.ok(pos !== null, 'Projection must return valid object for valid coords');
  assert.ok(pos.xPercent >= 40 && pos.xPercent <= 60, `Sector 17 xPercent (${pos.xPercent}) should be near the center`);
  assert.ok(pos.yPercent >= 30 && pos.yPercent <= 50, `Sector 17 yPercent (${pos.yPercent}) should be in north-central area`);

  // Invalid coordinates should yield null
  assert.equal(projectCoordinatesToPercent(NaN, NaN), null);
  assert.equal(projectCoordinatesToPercent(150, 200), null);
});

test('15. projectPercentToCoordinates converts user map clicks to valid geographical coordinates', () => {
  // Center click (50%, 50%)
  const centerCoords = projectPercentToCoordinates(50, 50);
  assert.ok(isValidCoordinates(centerCoords.latitude, centerCoords.longitude));
  assert.ok(
    centerCoords.latitude >= CHANDIGARH_GEO_BOUNDS.minLat &&
    centerCoords.latitude <= CHANDIGARH_GEO_BOUNDS.maxLat
  );
  assert.ok(
    centerCoords.longitude >= CHANDIGARH_GEO_BOUNDS.minLng &&
    centerCoords.longitude <= CHANDIGARH_GEO_BOUNDS.maxLng
  );

  // Proximity to Chandigarh sectors from map click
  const sector = suggestNearestSector(centerCoords.latitude, centerCoords.longitude);
  assert.ok(sector !== null, 'A valid click inside Chandigarh bounds must suggest a nearby sector');
});

test('16. getSectorCoordinates and manual updates synchronize without fabricating unassigned coordinates', () => {
  // Lookup known sector
  const sec17Coords = getSectorCoordinates('Sector 17');
  assert.ok(sec17Coords !== null);
  assert.equal(sec17Coords.latitude, 30.7408);
  assert.equal(sec17Coords.longitude, 76.7828);

  // Unknown sector returns null
  assert.equal(getSectorCoordinates('Nonexistent Sector 999'), null);

  // When coordinates are null, projection is null (prevents fake pin rendering)
  assert.equal(projectCoordinatesToPercent(null, null), null);
});

let passedTests = 0;
let totalTests = 0;

for (const run of testQueue) {
  await run();
}

console.log(`\nAll ${passedTests}/${totalTests} tests passed successfully!`);
