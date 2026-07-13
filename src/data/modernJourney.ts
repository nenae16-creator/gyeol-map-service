import type { GeoCoordinate } from "../domain/geoDistance";
import modernJourneyOrigin from "./snapshots/modern-journey-origin.v1.json";

export type ModernJourneyReference = GeoCoordinate & {
  id: string;
  label: string;
  address: string;
  addressSourceUrl: string;
  coordinateSourceUrl: string;
  accessedAt: string;
};

export const GONGJU_CITY_HALL_ORIGIN: ModernJourneyReference =
  modernJourneyOrigin.origin;
