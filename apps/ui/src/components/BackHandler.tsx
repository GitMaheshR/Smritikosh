import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onHardwareBack } from '../platform';
import { closeTopOverlay } from './ui';

/** Wires Android's Back button: close the open sheet first, else go back a screen, else leave the app. */
export function BackHandler() {
  const nav = useNavigate();
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    let off = () => {};
    let disposed = false;
    void onHardwareBack(() => {
      if (closeTopOverlay()) return true;
      if ((window.history.state as { idx?: number } | null)?.idx) {
        navRef.current(-1);
        return true;
      }
      return false;
    }).then((remove) => {
      if (disposed) remove();
      else off = remove;
    });
    return () => {
      disposed = true;
      off();
    };
  }, []);

  return null;
}
