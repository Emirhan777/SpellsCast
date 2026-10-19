import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { createTracker } from '../../game/tilt';
import type { Point } from './protocol';
import { nativeWandAngles } from './device-controls';

export function useWand(active: boolean, onPoint: (point: Point) => void, onUnavailable: () => void, landscape = false) {
  const tracker = useRef(createTracker());
  const pointRef = useRef(onPoint);
  useEffect(() => { pointRef.current = onPoint; }, [onPoint]);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);
  const [enabled, setEnabled] = useState(false);
  const center = useCallback(() => tracker.current.center(), []);
  const enable = useCallback(async () => {
    try {
      const permission = await DeviceMotion.requestPermissionsAsync();
      if (!permission.granted || !(await DeviceMotion.isAvailableAsync())) return false;
      tracker.current.center(); setEnabled(true); return true;
    } catch { return false; }
  }, []);
  useEffect(() => {
    if (!active || !enabled) return;
    tracker.current.center();
    let received = false;
    DeviceMotion.setUpdateInterval(16);
    let lastOrientation: number | undefined;
    const subscription = DeviceMotion.addListener(({ rotation, orientation }) => {
      if (!rotation || ![rotation.alpha, rotation.beta, ...(landscape ? [rotation.gamma] : [])].every(Number.isFinite)) return;
      received = true;
      if (landscape && orientation !== lastOrientation) { tracker.current.center(); lastOrientation = orientation; }
      // Expo rotations are radians; the shared browser tracker takes degrees.
      const angles = nativeWandAngles(rotation, orientation, landscape);
      const point = tracker.current.push(angles.yaw, angles.pitch);
      if (point) pointRef.current(point);
    });
    const timer = setTimeout(() => { if (!received) unavailableRef.current(); }, 2500);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [active, enabled, landscape]);
  return { enable, center };
}
