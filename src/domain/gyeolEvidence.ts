export type DemoRegionId = "hanseong" | "cheonan";

export type DemoPlace = {
  id: string;
  regionId: DemoRegionId;
  label: string;
  adminLabel: string;
  latitude: number;
  longitude: number;
  aliases: string[];
  canonicalPlaceId?: string;
};

export type JourneyPresentation =
  | {
      kind: "doseongdo-walk";
      buttonLabel: string;
      ariaLabel: string;
    }
  | {
      kind: "regional-zoom";
      buttonLabel: string;
      ariaLabel: string;
      mapRegionId: string;
    };

export type DemoExperience = {
  wholeMapRegionId: string;
  journey: JourneyPresentation;
};

export type ClaimStatus =
  | "source-confirmed"
  | "api-snapshot-confirmed"
  | "regional-inference";

export type EvidenceStatus =
  | "공식 원문 확인"
  | "공공데이터 저장본"
  | "API 연결 준비"
  | "권역 대응 추정";

export type DeliveryMode = "cached-snapshot" | "curated-fallback";

export type MapRegistrationStatus = "unregistered" | "approximate" | "human-verified";

export type SourceReference = {
  id: string;
  organization: string;
  datasetTitle?: string;
  datasetId?: string;
  recordTitle: string;
  recordId: string;
  recordUrl: string;
  datasetUrl?: string;
  accessedAt: string;
  sourceUpdatedAt?: string;
  coordinates?: {
    placeId: string;
    crs: "WGS84";
    latitude: number;
    longitude: number;
  };
  historicalFact?: {
    year: number;
    historicalName: string;
  };
  addressFact?: {
    placeId: string;
    address: string;
  };
  openingFact?: {
    placeId: string;
    openedAt: string;
  };
  license: {
    name: string;
    url: string;
    appliesTo: "metadata" | "text" | "image";
    attributionRequired: boolean;
  };
};

export type NormalizedBounds = {
  unit: "normalized";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MapRegionReference = {
  id: string;
  label: string;
  modernPlaceId?: string;
  mapId: string;
  imageId?: string;
  collectionNumber: "신수19997";
  edition: "신유본(1861)";
  assetPath: string;
  assetSha256?: string;
  assetSpace: {
    width: number;
    height: number;
    origin: "top-left";
  };
  point: {
    unit: "normalized";
    x: number;
    y: number;
  };
  bounds?: NormalizedBounds;
  registrationStatus: MapRegistrationStatus;
  reviewedAt?: string;
  reviewNote: string;
  sourceIds?: string[];
};

export type OfficialArtifactRecord = {
  collectionNumber: "신수19997";
  title: string;
  titleHanja: string;
  creator: string;
  period: string;
  edition: "신유본(1861)";
  material: string;
  format: string;
  roadNotation: string;
  emuseumId: "PS0100100101101999700000";
  images: Array<{
    id: string;
    galleryIndex: number;
    title: string;
    fileName: string;
    width: number;
    height: number;
    imageUrl: string;
    identificationEvidenceUrl: string;
    rightsSourceId: string;
    localAssetPath?: string;
    sha256?: string;
  }>;
};

export type PublicDataRecord = {
  id: string;
  name: string;
  nameHanja?: string;
  creator?: string;
  collectionNumber: string;
  museum?: string;
  nationalityPeriod?: string;
  material?: string;
  sizeInfo?: string;
  description?: string;
  imageCount?: number;
  rightsCode?: string;
  syncedAt: string;
};

export type EvidenceSnapshot = {
  schemaVersion: 1;
  snapshotCreatedAt: string;
  record: OfficialArtifactRecord;
  sources: SourceReference[];
  mapRegions: MapRegionReference[];
  api: {
    datasetId: "15159017";
    datasetUrl: string;
    endpointBase: string;
    status: "credential-required" | "synced";
    record: PublicDataRecord | null;
  };
};

export type EvidenceItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  status: EvidenceStatus;
  claimStatus: ClaimStatus;
  sourceIds: string[];
  mapRegionId?: string;
};

export type DemoResult = {
  place: DemoPlace;
  candidate: {
    name: string;
    hanja: string;
    label: string;
    summary: string;
    limitation: string;
  };
  evidence: EvidenceItem[];
};

export type GyeolResultEnvelope = DemoResult & {
  artifact: OfficialArtifactRecord;
  sources: SourceReference[];
  mapRegions: MapRegionReference[];
  experience: DemoExperience;
  delivery: {
    mode: DeliveryMode;
    servedAt: string;
    snapshotCreatedAt: string;
    label: string;
    warning?: string;
  };
};

export function isNormalizedBounds(bounds: NormalizedBounds) {
  return (
    bounds.unit === "normalized" &&
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.x + bounds.width <= 1 &&
    bounds.y + bounds.height <= 1
  );
}
