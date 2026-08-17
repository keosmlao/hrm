const EARTH_RADIUS_METRES = 6_371_000;

export type GpsMotionInput = {
  lat: number;
  lng: number;
  speedKmh: number;
  headingDegrees: number;
  elapsedSeconds: number;
};

/**
 * ຄາດຄະເນພິກັດຕາມຄວາມໄວ + ທິດທາງຫຼ້າສຸດຈາກ GPS.
 * ໃຊ້ great-circle destination ເພື່ອໃຫ້ຖືກຕ້ອງທັງທິດເໜືອ/ໃຕ້ ແລະ ຕາເວັນອອກ/ຕົກ.
 */
export function extrapolateGpsPosition({
  lat,
  lng,
  speedKmh,
  headingDegrees,
  elapsedSeconds,
}: GpsMotionInput): { lat: number; lng: number } {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(speedKmh) ||
    !Number.isFinite(headingDegrees) ||
    !Number.isFinite(elapsedSeconds) ||
    speedKmh <= 0 ||
    elapsedSeconds <= 0
  ) {
    return { lat, lng };
  }

  const distanceMetres = (speedKmh / 3.6) * elapsedSeconds;
  const angularDistance = distanceMetres / EARTH_RADIUS_METRES;
  const bearing = ((headingDegrees % 360) * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: ((((lng2 * 180) / Math.PI + 540) % 360) - 180),
  };
}
