import type { DemoPlace } from "../domain/gyeolEvidence";

export type { DemoPlace } from "../domain/gyeolEvidence";

export const demoPlaces: DemoPlace[] = [
  {
    id: "seoul-city-hall",
    label: "서울시청",
    adminLabel: "서울특별시 중구 세종대로",
    latitude: 37.5663,
    longitude: 126.9779,
    aliases: ["서울 시청", "시청", "서울특별시청"]
  },
  {
    id: "gwanghwamun",
    label: "광화문",
    adminLabel: "서울특별시 종로구 세종로",
    latitude: 37.5759,
    longitude: 126.9768,
    aliases: ["광화문광장", "광화문 광장"]
  },
  {
    id: "gyeongbokgung",
    label: "경복궁",
    adminLabel: "서울특별시 종로구 사직로",
    latitude: 37.5796,
    longitude: 126.977,
    aliases: ["경복궁역", "경복궁 궁궐"]
  }
];

export function findDemoPlace(query: string): DemoPlace | undefined {
  const normalized = query.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  if (!normalized) return undefined;

  return demoPlaces.find((place) =>
    [place.label, ...place.aliases].some((alias) => {
      const normalizedAlias = alias.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
      return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    })
  );
}

export function isInsideSeoulDemoArea(latitude: number, longitude: number) {
  return Math.abs(latitude - 37.572) <= 0.03 && Math.abs(longitude - 126.978) <= 0.03;
}
