import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { createTracker } from '../../game/tilt';
import type { Point } from './protocol';

export function useWand(active: boolean, onPoint: (point: Point) => void, onUnavailable: () => void) {
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
    const subscription = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation || ![rotation.alpha, rotation.beta].every(Number.isFinite)) return;
      received = true;
      // Expo rotations are radians; the shared browser tracker takes degrees.
      const point = tracker.current.push(rotation.alpha * 180 / Math.PI, rotation.beta * 180 / Math.PI);
      if (point) pointRef.current(point);
    });
    const timer = setTimeout(() => { if (!received) unavailableRef.current(); }, 2500);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [active, enabled]);
  return { enable, center };
}
