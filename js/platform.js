// Where TimeFall is running: the web page, or inside the iPhone or Android
// shell (native/). No imports, so any module can read these while loading.
const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
export const isNative = !!cap?.isNativePlatform?.();
// 'ios', 'android' or 'web'.
export const platform = isNative ? cap.getPlatform() : 'web';
// Safari on iPhone, including the home-screen app: only iOS has navigator.standalone.
export const isIphoneWeb = !isNative && typeof navigator !== 'undefined' && 'standalone' in navigator;
// A phone or tablet browser, where the TimeFall app may be installed beside
// the page. An iPad can call itself a Mac, so touch points settle that case;
// a touch laptop is not a phone.
export const isPhoneWeb = !isNative && typeof navigator !== 'undefined'
  && (/iPhone|iPad|Android/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
// Which screen-mirroring steps fit this device (words.js has the wording).
export const mirrorKind = platform === 'ios' || isIphoneWeb ? 'iphone'
  : platform === 'android' || (typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)) ? 'android' : 'computer';
