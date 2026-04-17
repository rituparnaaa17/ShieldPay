import { config } from '../config/env.js';
import { pollWeather } from './poll_weather.js';
import { pollAqi } from './poll_aqi.js';
import { detectTriggers } from './detect_triggers.js';
import { processClaims } from './process_claims.js';

const minute = (value) => Math.max(1, Number(value) || 1) * 60 * 1000;

const schedule = (task, intervalMs, label) => {
  const run = async () => {
    try {
      await task();
      console.log(`[scheduler] ${label} completed`);
    } catch (error) {
      console.error(`[scheduler] ${label} failed:`, error.message);
    }
  };

  run();
  const handle = setInterval(run, intervalMs);
  handle.unref?.();
  return handle;
};

export const startSchedulers = () => {
  const handles = [
    schedule(pollWeather, minute(config.intervals.pollWeatherMinutes), 'poll_weather'),
    schedule(pollAqi, minute(config.intervals.pollAqiMinutes), 'poll_aqi'),
    schedule(detectTriggers, minute(config.intervals.detectTriggersMinutes), 'detect_triggers'),
    schedule(processClaims, minute(config.intervals.processClaimsMinutes), 'process_claims'),
  ];

  return handles;
};