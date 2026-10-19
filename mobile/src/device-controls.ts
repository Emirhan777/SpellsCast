export type DeviceMode = 'tilt' | 'finger';
export type DeviceBests = Record<DeviceMode, number>;
export const DEVICE_BESTS_KEY = 'spellscast.device.bests.v1';
export function readDeviceBests(value: unknown): DeviceBests {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const score = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
  return { tilt: score(data.tilt), finger: score(data.finger) };
}
// Sensor axes stay in the phone's portrait coordinate system. In landscape,
// screen-up tipping is rotation about Y (gamma), with the sign set by rotation.
export function nativeWandAngles(rotation: { alpha: number; beta: number; gamma: number }, orientation: number, landscape = false) {
  const pitch = landscape ? (orientation === 90 ? rotation.gamma : -rotation.gamma) : rotation.beta;
  return { yaw: rotation.alpha * 180 / Math.PI, pitch: pitch * 180 / Math.PI };
}
