'use client';

import * as React from 'react';
import styles from './YoutubePlayer.module.css';

export interface YoutubePlayerActions {
  pause: () => void;
  play: () => void;
  getCurrentTime: () => number;
}

interface Props {
  videoId: string;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlayerReady?: (actions: YoutubePlayerActions | null) => void;
}

// ─── Module-level singleton ───────────────────────────────────────────────────
// Keeps the YT Player (and its iframe) alive across React unmount/remount cycles
// so toggling full ↔ mini doesn't restart the video.

let ytPlayer: any = null;
let ytCurrentVideoId: string | null = null;

// Module-level callback refs — updated by whichever instance is currently active
const cbOnEnded: { current: (() => void) | undefined } = { current: undefined };
const cbOnPlayingChange: { current: ((p: boolean) => void) | undefined } = { current: undefined };
const cbOnPlayerReady: { current: ((a: YoutubePlayerActions | null) => void) | undefined } = { current: undefined };

let holderEl: HTMLDivElement | null = null;
function getHolder(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (!holderEl) {
    holderEl = document.createElement('div');
    holderEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(holderEl);
  }
  return holderEl;
}

function getIframe(): HTMLIFrameElement | null {
  try { return ytPlayer?.getIframe?.() ?? null; } catch { return null; }
}

// ─── Shared API promise ───────────────────────────────────────────────────────
let apiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

// ─── Component ────────────────────────────────────────────────────────────────
function YoutubePlayer({ videoId, onEnded, onPlayingChange, onPlayerReady }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keep module-level callbacks in sync with whoever is currently mounted
  React.useEffect(() => { cbOnEnded.current = onEnded; });
  React.useEffect(() => { cbOnPlayingChange.current = onPlayingChange; });
  React.useEffect(() => { cbOnPlayerReady.current = onPlayerReady; });

  React.useEffect(() => {
    if (!containerRef.current) return;

    if (ytPlayer && ytCurrentVideoId === videoId) {
      // Same video already playing — just move the iframe into this container
      const iframe = getIframe();
      if (iframe) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(iframe);
      }
      const actions: YoutubePlayerActions = {
        pause: () => { try { ytPlayer.pauseVideo(); } catch {} },
        play:  () => { try { ytPlayer.playVideo();  } catch {} },
        getCurrentTime: () => { try { return ytPlayer.getCurrentTime() ?? 0; } catch { return 0; } },
      };
      cbOnPlayerReady.current?.(actions);

      return () => {
        cbOnPlayerReady.current?.(null);
        const iframe = getIframe();
        const holder = getHolder();
        if (iframe && holder) holder.appendChild(iframe);
      };
    }

    // New video — (re)create the player
    let cancelled = false;

    // Park existing iframe in the holder before destroying
    const oldIframe = getIframe();
    if (oldIframe) getHolder()?.appendChild(oldIframe);
    try { ytPlayer?.destroy(); } catch {}
    ytPlayer = null;
    ytCurrentVideoId = null;

    loadYTApi().then(() => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      const target = document.createElement('div');
      containerRef.current.appendChild(target);

      ytPlayer = new (window as any).YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, controls: 0, showinfo: 0, iv_load_policy: 3 },
        events: {
          onReady: (e: { target: any }) => {
            ytCurrentVideoId = videoId;
            cbOnPlayerReady.current?.({
              pause: () => { try { e.target.pauseVideo(); } catch {} },
              play:  () => { try { e.target.playVideo();  } catch {} },
              getCurrentTime: () => { try { return e.target.getCurrentTime() ?? 0; } catch { return 0; } },
            });
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) cbOnEnded.current?.();
            cbOnPlayingChange.current?.(e.data === 1);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      cbOnPlayerReady.current?.(null);
      const iframe = getIframe();
      const holder = getHolder();
      if (iframe && holder) holder.appendChild(iframe);
    };
  }, [videoId]);

  return <div ref={containerRef} className={styles.player} />;
}

export default YoutubePlayer;
