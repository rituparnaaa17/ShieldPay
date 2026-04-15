import { getAllZones } from '../services/weatherService.js';
import { fetchAqiSnapshotForZone } from '../services/aqiService.js';

export const pollAqi = async () => {
  const zones = await getAllZones();
  const snapshots = [];

  for (const zone of zones) {
    snapshots.push(await fetchAqiSnapshotForZone(zone));
  }

  return snapshots;
};