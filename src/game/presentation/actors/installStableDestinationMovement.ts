import { PlayerNavigationView } from "./PlayerNavigationView";

let installed = false;

/**
 * Makes guided auto-walk idempotent. Cleaning guidance can request the same
 * destination on consecutive scene updates; restarting the tween every frame
 * makes the worker appear stuck and prevents interaction readiness.
 */
export const installStableDestinationMovement = (): void => {
  if (installed) return;
  installed = true;

  const prototype = PlayerNavigationView.prototype as PlayerNavigationView & {
    setDestination(point: { readonly x: number; readonly y: number }): void;
    snapshot(): {
      readonly destination?: { readonly x: number; readonly y: number };
    };
  };
  const originalSetDestination = PlayerNavigationView.prototype.setDestination;

  prototype.setDestination = function setStableDestination(point): void {
    const active = this.snapshot().destination;
    if (active && Math.hypot(active.x - point.x, active.y - point.y) <= 1) return;
    originalSetDestination.call(this, point);
  };
};
