export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

const MEAN_EARTH_RADIUS_METERS = 6_371_008.8;

export function isValidGeoCoordinate(coordinate: GeoCoordinate) {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

export function greatCircleDistanceMeters(
  origin: GeoCoordinate,
  destination: GeoCoordinate
): number | null {
  if (!isValidGeoCoordinate(origin) || !isValidGeoCoordinate(destination)) return null;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    MEAN_EARTH_RADIUS_METERS *
    Math.asin(Math.min(1, Math.sqrt(Math.max(0, haversine))))
  );
}

export function formatApproxDistance(meters: number | null) {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return "산출 전";
  if (meters < 1_000) return `약 ${Math.round(meters / 10) * 10}m`;

  const kilometers = meters / 1_000;
  return kilometers < 10
    ? `약 ${kilometers.toFixed(1)}km`
    : `약 ${Math.round(kilometers)}km`;
}
