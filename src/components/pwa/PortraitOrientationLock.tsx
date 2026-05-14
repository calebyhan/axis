"use client";

import { useEffect } from "react";

type PortraitLockMode = "portrait-primary" | "portrait";
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitLockMode) => Promise<void>;
};

const MOBILE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

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

function getOrientationAngle() {
  const modernAngle = screen.orientation?.angle;
  if (typeof modernAngle === "number") return modernAngle;

  const legacyWindow = window as Window & { orientation?: number };
  return legacyWindow.orientation ?? 0;
}

function syncPortraitFallback() {
  const isMobilePointer = window.matchMedia(MOBILE_POINTER_QUERY).matches;
  const isLandscape = window.innerWidth > window.innerHeight;
  const isPhoneSized = Math.min(window.innerWidth, window.innerHeight) <= 767;

  if (!isMobilePointer || !isLandscape || !isPhoneSized) {
    document.documentElement.removeAttribute("data-axis-mobile-landscape");
    return;
  }

  const angle = getOrientationAngle();
  const direction = angle === -90 || angle === 270 ? "counterclockwise" : "clockwise";
  document.documentElement.setAttribute("data-axis-mobile-landscape", direction);
}

export function PortraitOrientationLock() {
  useEffect(() => {
    void lockToPortrait();
    syncPortraitFallback();

    const handleOrientationChange = () => {
      void lockToPortrait();
      syncPortraitFallback();
    };

    const handleResize = () => {
      syncPortraitFallback();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void lockToPortrait();
        syncPortraitFallback();
      }
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.documentElement.removeAttribute("data-axis-mobile-landscape");
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
