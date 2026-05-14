"use client";

import { useEffect } from "react";

type PortraitLockMode = "portrait-primary" | "portrait";
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitLockMode) => Promise<void>;
};

async function lockToPortrait() {
  if (typeof screen === "undefined" || !("orientation" in screen)) {
    return;
  }

  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  if (typeof orientation?.lock !== "function") return;

  try {
    await orientation.lock("portrait-primary");
  } catch {
    try {
      await orientation.lock("portrait");
    } catch {
      // Browsers that only allow orientation locking in installed/fullscreen contexts can ignore this.
    }
  }
}

export function PortraitOrientationLock() {
  useEffect(() => {
    void lockToPortrait();

    const handleOrientationChange = () => {
      void lockToPortrait();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void lockToPortrait();
      }
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
