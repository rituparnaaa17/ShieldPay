import { getAllZones, fetchWeatherSnapshotForZone } from '../services/weatherService.js';

export const pollWeather = async () => {
  const zones = await getAllZones();
  const snapshots = [];

  for (const zone of zones) {
    snapshots.push(await fetchWeatherSnapshotForZone(zone));
  }

  return snapshots;
};