'use client';

import * as React from 'react';
import styles from './YoutubePlayer.module.css';

export interface YoutubePlayerActions {
  pause: () => void;
  play: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  videoId: string;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlayerReady?: (actions: YoutubePlayerActions | null) => void;
}

// Singleton promise — only one <script> tag ever added
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

function YoutubePlayer({ videoId, onEnded, onPlayingChange, onPlayerReady }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<any>(null);
  const onEndedRef = React.useRef(onEnded);
  const onPlayingChangeRef = React.useRef(onPlayingChange);
  const onPlayerReadyRef = React.useRef(onPlayerReady);
  React.useEffect(() => { onEndedRef.current = onEnded; });
  React.useEffect(() => { onPlayingChangeRef.current = onPlayingChange; });
  React.useEffect(() => { onPlayerReadyRef.current = onPlayerReady; });

  React.useEffect(() => {
    let cancelled = false;

    loadYTApi().then(() => {
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = '';
      const target = document.createElement('div');
      containerRef.current.appendChild(target);

      playerRef.current = new (window as any).YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, controls: 0, showinfo: 0, iv_load_policy: 3 },
        events: {
          onReady: (e: { target: any }) => {
            onPlayerReadyRef.current?.({
              pause: () => { try { e.target.pauseVideo(); } catch {} },
              play:  () => { try { e.target.playVideo();  } catch {} },
              getCurrentTime: () => { try { return e.target.getCurrentTime() ?? 0; } catch { return 0; } },
              getDuration: () => { try { return e.target.getDuration() ?? 0; } catch { return 0; } },
            });
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) onEndedRef.current?.();
            onPlayingChangeRef.current?.(e.data === 1);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      onPlayerReadyRef.current?.(null);
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  return <div ref={containerRef} className={styles.player} />;
}

export default YoutubePlayer;
