import { logger } from "./logger.js";

let apiKey: string | null = null;

export function initMaps(key: string): void {
  apiKey = key;
  logger.info("Google Maps client initialized");
}

interface DistanceResult {
  techId: string;
  durationMins: number;
  distanceKm: number;
}

/**
 * Get drive times from multiple tech locations to a destination.
 * Returns results sorted by shortest drive time.
 *
 * Falls back gracefully if Google Maps isn't configured — returns empty array.
 */
export async function getDriveTimes(
  origins: Array<{ techId: string; address: string }>,
  destination: string,
): Promise<DistanceResult[]> {
  if (!apiKey) {
    logger.debug("Google Maps not configured — skipping drive time calculation");
    return [];
  }

  if (!destination || origins.length === 0) {
    return [];
  }

  try {
    const originAddresses = origins.map((o) => encodeURIComponent(o.address)).join("|");
    const destEncoded = encodeURIComponent(destination);

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${originAddresses}` +
      `&destinations=${destEncoded}` +
      `&mode=driving` +
      `&units=imperial` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      rows: Array<{
        elements: Array<{
          status: string;
          duration: { value: number };
          distance: { value: number };
        }>;
      }>;
    };

    if (data.status !== "OK") {
      logger.error({ status: data.status }, "Google Maps API error");
      return [];
    }

    const results: DistanceResult[] = [];

    for (let i = 0; i < origins.length; i++) {
      const element = data.rows[i]?.elements[0];
      if (element?.status === "OK") {
        results.push({
          techId: origins[i].techId,
          durationMins: Math.round(element.duration.value / 60),
          distanceKm: Math.round(element.distance.value / 1000),
        });
      }
    }

    return results.sort((a, b) => a.durationMins - b.durationMins);
  } catch (err) {
    logger.error({ err }, "Failed to get drive times from Google Maps");
    return [];
  }
}
