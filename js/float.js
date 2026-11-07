// Floating views.
// Desktop Chrome and Edge: Document Picture-in-Picture, a real always-on-top
// mini window that holds live, tappable page content.
// Elsewhere (Safari, iPhone): a picture-in-picture video of the face, drawn
// into a canvas and streamed. It floats over other apps but can't be tapped,
// and iOS may freeze it while the app is in the background.

import { isNative } from './platform.js';

// The phone shells have their own floating view (js/native.js), so neither
// browser kind applies inside them.
export const canFloatWindow = () => !isNative && 'documentPictureInPicture' in window;

// An iPhone home-screen app refuses picture-in-picture although it reports it
// as available; a Safari tab allows it (WebKit bug 303885, device test 7).
// The display-mode half also covers a Mac Safari web app, which is untested.
export const inIosHomeScreenApp = () => navigator.standalone === true
  || (matchMedia('(display-mode: standalone)').matches
    && typeof HTMLVideoElement.prototype.webkitSetPresentationMode === 'function');

export function canFloatVideo() {
  if (isNative || inIosHomeScreenApp()) return false;
  const v = document.createElement('video');
  return !!(document.pictureInPictureEnabled || typeof v.webkitSetPresentationMode === 'function')
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

// Opens the mini window and returns its document; `onClose` runs when it closes.
export async function openFloatWindow(width, height, onClose) {
  const win = await window.documentPictureInPicture.requestWindow({ width, height });
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const copy = win.document.createElement('link');
    copy.rel = 'stylesheet';
    copy.href = link.href;
    win.document.head.append(copy);
  }
  const meta = win.document.createElement('meta');
  meta.name = 'color-scheme';
  meta.content = 'light dark';
  win.document.head.append(meta);
  win.addEventListener('pagehide', onClose, { once: true });
  return win;
}

// Streams `canvas` into a hidden video and asks for picture-in-picture.
// Safari's own presentation mode goes first: on iPhone the standard request is
// refused once play() has been awaited, because it no longer counts the tap,
// and asking before play() is refused because the video isn't ready. Tested
// on iOS 27 with check/ (docs/device-tests.md, test 7).
export async function openFloatVideo(canvas, onClose) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.className = 'pip-video';
  video.srcObject = canvas.captureStream(4);
  document.body.append(video);
  const cleanup = () => { video.srcObject = null; video.remove(); onClose(); };
  try {
    await video.play();
    if (typeof video.webkitSetPresentationMode === 'function') {
      // A refusal here is silent, so wait briefly for the mode to change.
      await new Promise((resolve, reject) => {
        const giveUp = setTimeout(() => reject(new Error('picture-in-picture did not open')), 1500);
        video.addEventListener('webkitpresentationmodechanged', () => {
          clearTimeout(giveUp);
          if (video.webkitPresentationMode === 'picture-in-picture') resolve();
          else reject(new Error('picture-in-picture did not open'));
        }, { once: true });
        video.webkitSetPresentationMode('picture-in-picture');
      });
      video.addEventListener('webkitpresentationmodechanged', () => {
        if (video.webkitPresentationMode !== 'picture-in-picture') cleanup();
      });
    } else {
      video.addEventListener('leavepictureinpicture', cleanup, { once: true });
      await video.requestPictureInPicture();
    }
  } catch (e) {
    // Don't leave a hidden video streaming after a refusal.
    video.srcObject = null;
    video.remove();
    throw e;
  }
  return () => {
    if (document.pictureInPictureElement === video) document.exitPictureInPicture();
    else if (video.webkitPresentationMode === 'picture-in-picture') video.webkitSetPresentationMode('inline');
    else cleanup();
  };
}
