'use client';

import * as React from 'react';
import Card from '@components/Card';
import SimpleTable from '@components/SimpleTable';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
import ButtonGroup from '@components/ButtonGroup';
import ActionBar from '@components/ActionBar';
import ThemeDropdown from '@components/ThemeDropdown';
import NeighborTable from '@components/NeighborTable';
import TrackTable from '@components/TrackTable';
import AreaChart from '@components/AreaChart';
import YoutubePlayer, { YoutubePlayerActions } from '@components/YoutubePlayer';
import DateRangeModal from '@components/DateRangeModal';
import RankMode from '@components/RankMode';
import Tooltip from '@components/Tooltip';
import ASCII_BANNER from '@/lib/ascii';
import { formatName } from '@/lib/formatName';
import styles from './page.module.css';

const LOADER_FRAMES = ['|', '/', '-', '\\'];

type FetchMode = 'artists' | 'albums' | 'tracks' | 'stats' | 'neighbors';

function Spinner() {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % LOADER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);
  return <span>{LOADER_FRAMES[frame]}</span>;
}

function LyricsContent({
  lyrics,
  loading,
  selection,
  onLineClick,
}: {
  lyrics: { plain: string | null; instrumental: boolean } | null;
  loading: boolean;
  selection?: [number, number] | null;
  onLineClick?: (idx: number) => void;
}) {
  if (loading) return <div className={styles.lyricsStatus}>LOADING...</div>;
  if (lyrics?.instrumental) return <div className={styles.lyricsStatus}>♪ Instrumental</div>;
  if (lyrics && !lyrics.plain) return <div className={styles.lyricsStatus}>Lyrics not found.</div>;
  if (!lyrics?.plain) return null;
  return (
    <div className={styles.lyricsScroll}>
      {lyrics.plain.split('\n').map((line, i) => {
        const isSelected = selection ? i >= selection[0] && i <= selection[1] : false;
        const cls = [
          styles.lyricLine,
          onLineClick ? styles.lyricLineClickable : '',
          isSelected ? styles.lyricLineSelected : '',
        ].filter(Boolean).join(' ');
        return (
          <div key={i} className={cls} onClick={onLineClick ? () => onLineClick(i) : undefined}>
            <span className={styles.lyricLineNum}>{i + 1}</span>
            <span className={styles.lyricLineText}>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineLoader({ mode }: { mode: FetchMode }) {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % LOADER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);
  const label = mode === 'albums' ? 'ALBUMS' : mode === 'tracks' ? 'TRACKS' : mode === 'stats' ? 'OVERVIEW' : mode === 'neighbors' ? 'NEIGHBOURS' : 'ARTISTS';
  return (
    <div className={styles.loader}>
      {LOADER_FRAMES[frame]} FETCHING {label}...
    </div>
  );
}

type Period = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month' | 'this_month' | 'this_year' | 'custom';
type Theme = 'light' | 'dracula' | 'gruvbox' | 'github' | 'monokai' | 'tokyo' | 'catppuccin' | 'onedark';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'LIGHT' },
  { id: 'dracula', label: 'DRACULA' },
  { id: 'gruvbox', label: 'GRUVBOX' },
  { id: 'github', label: 'GITHUB DARK' },
  { id: 'monokai', label: 'MONOKAI' },
  { id: 'tokyo', label: 'TOKYO NIGHT' },
  { id: 'catppuccin', label: 'CATPPUCCIN' },
  { id: 'onedark', label: 'ONE DARK' },
];

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const _now = new Date();
const THIS_MONTH_LABEL = `THIS ${MONTH_NAMES[_now.getMonth()]}`;
const THIS_YEAR_LABEL = `THIS ${_now.getFullYear()}`;

const PERIOD_LABELS: Record<Period, string> = {
  overall: 'ALL TIME',
  '7day': '7 DAYS',
  '1month': '1 MONTH',
  '3month': '3 MONTHS',
  '6month': '6 MONTHS',
  '12month': '12 MONTHS',
  this_month: THIS_MONTH_LABEL,
  this_year: THIS_YEAR_LABEL,
  custom: 'CUSTOM DATE',
};

const PERIOD_LABEL_TO_VALUE: Record<string, Period> = Object.fromEntries(
  (Object.keys(PERIOD_LABELS) as Period[]).map((p) => [PERIOD_LABELS[p], p])
);

const PERIOD_ITEMS = (Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ id: p, label: PERIOD_LABELS[p] }));

const THEME_LABEL_TO_VALUE: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.label, t.id])
);

interface Artist {
  rank: number;
  name: string;
  playcount: number;
  url: string;
}

interface Album {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
  url: string;
  imageUrl: string | null;
}

interface Track {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
  url: string;
}

interface Neighbor {
  rank: number;
  username: string;
  sharedArtists: string[];
  avatar: string | null;
  url: string;
}

interface UserStats {
  username: string;
  realname: string | null;
  scrobbles: number;
  artists: number;
  albums: number;
  tracks: number;
  country: string | null;
  registered: number | null;
}

function TrackYtButton({ artist, track, onPlay }: { artist: string; track: string; onPlay: (videoId: string) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [videoId, setVideoId] = React.useState<string | null>(null);

  const handleClick = async () => {
    if (videoId) { onPlay(videoId); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      const data = await res.json();
      if (data.videoId) { setVideoId(data.videoId); onPlay(data.videoId); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={styles.ytBtn} onClick={handleClick} disabled={loading} title="Play on YouTube">
      {loading ? '...' : '▶'}
    </button>
  );
}


interface AlbumMeta {
  artUrl: string | null;
  releaseDate: string | null;
  tracks: { rank: number; name: string; duration: number; playcount: number }[];
  totalDuration: number;
  listeners: number;
  playcount: number;
  tags: string[];
}

type ImageView = 'pixel' | 'original';

function formatDuration(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const APP_MODES = [
  { id: 'charts', label: 'CHARTS' },
  { id: 'rank', label: 'RANK MODE' },
];

export default function Home() {
  const [appMode, setAppMode] = React.useState<'charts' | 'rank' | 'listen-later'>('charts');
  const [theme, setTheme] = React.useState<Theme>('github');
  const [username, setUsername] = React.useState('');
  const [period, setPeriod] = React.useState<Period>('overall');
  const [sessionUsername, setSessionUsername] = React.useState<string | null>(null);
  const [listenLaterSet, setListenLaterSet] = React.useState<Set<string>>(new Set());
  const [listenLaterItems, setListenLaterItems] = React.useState<{ artist: string; album: string; added_at: string }[]>([]);

  React.useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data: { loggedIn: boolean; username: string | null }) => {
        if (data.loggedIn && data.username) {
          setSessionUsername(data.username);
          setUsername(data.username);
          localStorage.setItem('lastfm-username', data.username);
          fetch('/api/listen-later')
            .then((r) => r.json())
            .then((d: { items?: { artist: string; album: string; added_at: string }[] }) => {
              if (d.items) {
                setListenLaterItems(d.items);
                setListenLaterSet(new Set(d.items.map((i) => `${i.artist}|||${i.album}`)));
              }
            })
            .catch(() => {});
        } else {
          const saved = localStorage.getItem('lastfm-username');
          if (saved) setUsername(saved);
        }
      })
      .catch(() => {
        const saved = localStorage.getItem('lastfm-username');
        if (saved) setUsername(saved);
      });
  }, []);
  const [customDateRange, setCustomDateRange] = React.useState<{ from: string; to: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fetchMode, setFetchMode] = React.useState<FetchMode>('artists');
  const [showPlays, setShowPlays] = React.useState(true);
  const [resultsExpanded, setResultsExpanded] = React.useState(false);
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [albums, setAlbums] = React.useState<Album[]>([]);
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [neighbors, setNeighbors] = React.useState<Neighbor[]>([]);
  const [userStats, setUserStats] = React.useState<UserStats | null>(null);
  const [overviewTop, setOverviewTop] = React.useState<{ artists: Artist[]; albums: Album[]; tracks: Track[] } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastFetched, setLastFetched] = React.useState<{
    username: string;
    period: string;
    mode: FetchMode;
    customRange?: { from: string; to: string };
  } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [hoveredAlbumIndex, setHoveredAlbumIndex] = React.useState<number | null>(null);
  const [lockedAlbumIndex, setLockedAlbumIndex] = React.useState<number | null>(null);
  const [albumMetas, setAlbumMetas] = React.useState<(AlbumMeta | null)[]>([]);
  const [albumMetasLoading, setAlbumMetasLoading] = React.useState(false);
  const [imageView, setImageView] = React.useState<ImageView>('pixel');
  const [tracklistOpen, setTracklistOpen] = React.useState(true);
  const [overviewChart, setOverviewChart] = React.useState<{ days: { date: string; count: number }[]; total: number } | null>(null);
  const [nowPlaying, setNowPlaying] = React.useState<{ track: string; artist: string; album: string | null; imageUrl: string | null } | null>(null);
  const [nowPlayingLoading, setNowPlayingLoading] = React.useState(false);
  const [savedNeighborState, setSavedNeighborState] = React.useState<{ username: string; neighbors: Neighbor[] } | null>(null);
  const [pixelArtCache, setPixelArtCache] = React.useState<Record<number, string[] | null>>({});
  const [pixelLoading, setPixelLoading] = React.useState(false);
  const pixelFetchedRef = React.useRef<Set<number>>(new Set());
  const [ytEmbed, setYtEmbed] = React.useState<{ videoId: string; title: string; source: 'album' | 'tracks' | 'listen-later'; albumIdx: number; trackIdx: number } | null>(null);
  const [ytMini, setYtMini] = React.useState(false);
  const [ytPlaying, setYtPlaying] = React.useState(false);
  const [ytNavLoading, setYtNavLoading] = React.useState(false);
  const ytPlayerActionsRef = React.useRef<YoutubePlayerActions | null>(null);
  const ytVideoCacheRef = React.useRef<Record<string, string>>({});
  const scrobbleStartRef = React.useRef<number>(0);
  const scrobbledRef = React.useRef(false);
  const elapsedRef = React.useRef(0);
  const playSegmentStartRef = React.useRef<number | null>(null);
  const scrobbleTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [lyricsOpen, setLyricsOpen] = React.useState(false);
  const [lyrics, setLyrics] = React.useState<{ plain: string | null; instrumental: boolean } | null>(null);
  const [lyricsLoading, setLyricsLoading] = React.useState(false);
  const lyricsOpenRef = React.useRef(false);
  const [lyricAnchor, setLyricAnchor] = React.useState<number | null>(null);
  const [lyricSelection, setLyricSelection] = React.useState<[number, number] | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [llHoveredIdx, setLlHoveredIdx] = React.useState<number | null>(null);
  const [llLockedIdx, setLlLockedIdx] = React.useState<number | null>(null);
  const [llAlbumMetas, setLlAlbumMetas] = React.useState<Record<string, AlbumMeta | null>>({});
  const [llPixelCache, setLlPixelCache] = React.useState<Record<string, string[] | null>>({});
  const [llPixelLoading, setLlPixelLoading] = React.useState(false);
  const [llTracklistOpen, setLlTracklistOpen] = React.useState(true);
  const llPixelFetchedRef = React.useRef<Set<string>>(new Set());
  const llFetchingRef = React.useRef<Set<string>>(new Set());
  const llLeaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const themes: Theme[] = ['light', 'dracula', 'gruvbox', 'github', 'monokai', 'tokyo', 'catppuccin', 'onedark'];
    themes.forEach((t) => document.body.classList.remove(`theme-${t}`));
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  React.useEffect(() => {
    if (appMode !== 'listen-later' || !sessionUsername) return;
    fetch('/api/listen-later')
      .then((r) => r.json())
      .then((d: { items?: { artist: string; album: string; added_at: string }[] }) => {
        if (d.items) {
          setListenLaterItems(d.items);
          setListenLaterSet(new Set(d.items.map((i) => `${i.artist}|||${i.album}`)));
        }
      })
      .catch(() => {});
  }, [appMode]);

  // Reset scrobble state and fire now-playing when track changes
  React.useEffect(() => {
    if (scrobbleTimerRef.current) { clearInterval(scrobbleTimerRef.current); scrobbleTimerRef.current = null; }
    scrobbledRef.current = false;
    elapsedRef.current = 0;
    playSegmentStartRef.current = null;
    scrobbleStartRef.current = Math.floor(Date.now() / 1000);

    if (!ytEmbed) return;

    const sep = ytEmbed.title.indexOf(' — ');
    if (sep === -1) return;
    const artist = ytEmbed.title.slice(0, sep);
    const track = ytEmbed.title.slice(sep + 3);
    const album = ytEmbed.source === 'album' && ytEmbed.albumIdx >= 0
      ? albums[ytEmbed.albumIdx]?.name
      : ytEmbed.source === 'listen-later' && ytEmbed.albumIdx >= 0
      ? listenLaterItems[ytEmbed.albumIdx]?.album
      : undefined;

    fetch('/api/scrobble/now-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, track, ...(album ? { album } : {}) }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytEmbed?.videoId]);

  // Track elapsed play time and fire scrobble at threshold
  React.useEffect(() => {
    if (!ytEmbed) return;

    if (ytPlaying) {
      playSegmentStartRef.current = Date.now();
      if (!scrobbleTimerRef.current) {
        scrobbleTimerRef.current = setInterval(() => {
          if (scrobbledRef.current) { clearInterval(scrobbleTimerRef.current!); scrobbleTimerRef.current = null; return; }
          const segmentMs = playSegmentStartRef.current ? Date.now() - playSegmentStartRef.current : 0;
          const totalElapsed = elapsedRef.current + segmentMs / 1000;
          const duration = ytPlayerActionsRef.current?.getDuration() ?? 0;
          const threshold = duration > 0 ? Math.min(240, Math.max(30, duration / 2)) : 30;
          if (totalElapsed >= threshold) {
            scrobbledRef.current = true;
            clearInterval(scrobbleTimerRef.current!);
            scrobbleTimerRef.current = null;
            const sep = ytEmbed.title.indexOf(' — ');
            if (sep === -1) return;
            const artist = ytEmbed.title.slice(0, sep);
            const track = ytEmbed.title.slice(sep + 3);
            const album = ytEmbed.source === 'album' && ytEmbed.albumIdx >= 0
              ? albums[ytEmbed.albumIdx]?.name
              : ytEmbed.source === 'listen-later' && ytEmbed.albumIdx >= 0
              ? listenLaterItems[ytEmbed.albumIdx]?.album
              : undefined;
            fetch('/api/scrobble', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, track, timestamp: scrobbleStartRef.current, ...(album ? { album } : {}) }),
            }).catch(() => {});
          }
        }, 1000);
      }
    } else {
      if (playSegmentStartRef.current !== null) {
        elapsedRef.current += (Date.now() - playSegmentStartRef.current) / 1000;
        playSegmentStartRef.current = null;
      }
      if (scrobbleTimerRef.current) { clearInterval(scrobbleTimerRef.current); scrobbleTimerRef.current = null; }
    }

    return () => {
      if (scrobbleTimerRef.current) { clearInterval(scrobbleTimerRef.current); scrobbleTimerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytPlaying, ytEmbed?.videoId]);

  React.useEffect(() => {
    const activeIndex = lockedAlbumIndex ?? hoveredAlbumIndex;
    if (activeIndex === null) return;
    if (pixelFetchedRef.current.has(activeIndex)) return;
    const meta = albumMetas[activeIndex];
    const artUrl = meta?.artUrl ?? albums[activeIndex]?.imageUrl;
    if (!artUrl) return;

    pixelFetchedRef.current.add(activeIndex);
    setPixelLoading(true);
    fetch(`/api/pixel-art?artUrl=${encodeURIComponent(artUrl)}`)
      .then((r) => r.json())
      .then((data) => setPixelArtCache((prev) => ({ ...prev, [activeIndex]: data.pixels ?? null })))
      .catch(() => setPixelArtCache((prev) => ({ ...prev, [activeIndex]: null })))
      .finally(() => setPixelLoading(false));
  }, [lockedAlbumIndex, hoveredAlbumIndex, albumMetas]);

  React.useEffect(() => {
    setTracklistOpen(false);
  }, [lockedAlbumIndex, hoveredAlbumIndex]);

  // Lazy-fetch album meta for hovered/locked LL item
  React.useEffect(() => {
    const activeIndex = llLockedIdx ?? llHoveredIdx;
    if (activeIndex === null) return;
    const item = listenLaterItems[activeIndex];
    if (!item) return;
    const key = `${item.artist}|||${item.album}`;
    if (llFetchingRef.current.has(key) || key in llAlbumMetas) return;
    llFetchingRef.current.add(key);
    fetch(`/api/album-info?artist=${encodeURIComponent(item.artist)}&album=${encodeURIComponent(item.album)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((meta: AlbumMeta | null) => { setLlAlbumMetas((prev) => ({ ...prev, [key]: meta })); llFetchingRef.current.delete(key); })
      .catch(() => { setLlAlbumMetas((prev) => ({ ...prev, [key]: null })); llFetchingRef.current.delete(key); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llLockedIdx, llHoveredIdx, listenLaterItems]);

  // Pixel art for hovered/locked LL item
  React.useEffect(() => {
    const activeIndex = llLockedIdx ?? llHoveredIdx;
    if (activeIndex === null) return;
    const item = listenLaterItems[activeIndex];
    if (!item) return;
    const key = `${item.artist}|||${item.album}`;
    if (llPixelFetchedRef.current.has(key)) return;
    const artUrl = llAlbumMetas[key]?.artUrl;
    if (!artUrl) return;
    llPixelFetchedRef.current.add(key);
    setLlPixelLoading(true);
    fetch(`/api/pixel-art?artUrl=${encodeURIComponent(artUrl)}`)
      .then((r) => r.json())
      .then((data) => setLlPixelCache((prev) => ({ ...prev, [key]: data.pixels ?? null })))
      .catch(() => setLlPixelCache((prev) => ({ ...prev, [key]: null })))
      .finally(() => setLlPixelLoading(false));
  }, [llLockedIdx, llHoveredIdx, llAlbumMetas, listenLaterItems]);

  React.useEffect(() => {
    setLlTracklistOpen(false);
  }, [llLockedIdx, llHoveredIdx]);

  const closeYtEmbed = React.useCallback(() => {
    setYtEmbed(null);
    setYtMini(false);
    setYtPlaying(false);
    setLyricsOpen(false);
    setLyrics(null);
    setLyricAnchor(null);
    setLyricSelection(null);
  }, []);

  const fetchLyrics = React.useCallback(async (artist: string, track: string) => {
    setLyricsLoading(true);
    setLyrics(null);
    try {
      const res = await fetch(`/api/lyrics?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      const data = await res.json();
      setLyrics({
        plain: data.plainLyrics ?? null,
        instrumental: data.instrumental ?? false,
      });
    } finally {
      setLyricsLoading(false);
    }
  }, []);

  // Reset lyrics + selection when track changes; re-fetch if panel is open
  React.useEffect(() => {
    setLyrics(null);
    setLyricAnchor(null);
    setLyricSelection(null);
    if (lyricsOpenRef.current && ytEmbed) {
      const sep = ytEmbed.title.indexOf(' — ');
      if (sep !== -1) fetchLyrics(ytEmbed.title.slice(0, sep), ytEmbed.title.slice(sep + 3));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytEmbed?.videoId]);

  React.useEffect(() => { lyricsOpenRef.current = lyricsOpen; }, [lyricsOpen]);

  const handleLyricLineClick = React.useCallback((idx: number) => {
    setLyricAnchor((anchor) => {
      if (anchor === null || Math.abs(idx - anchor) > 3) {
        setLyricSelection([idx, idx]);
        return idx;
      }
      setLyricSelection([Math.min(idx, anchor), Math.max(idx, anchor)]);
      return anchor;
    });
  }, []);

  const handleLyricsExport = React.useCallback(async () => {
    if (!ytEmbed || !lyrics?.plain || !lyricSelection) return;
    const lines = lyrics.plain.split('\n');
    const selectedLines = lines.slice(lyricSelection[0], lyricSelection[1] + 1);
    const lineNumbers = Array.from({ length: selectedLines.length }, (_, i) => lyricSelection[0] + i + 1);

    const sep = ytEmbed.title.indexOf(' — ');
    const artist = sep !== -1 ? ytEmbed.title.slice(0, sep) : ytEmbed.title;
    const trackName = sep !== -1 ? ytEmbed.title.slice(sep + 3) : '';
    const albumName = ytEmbed.source === 'album' && ytEmbed.albumIdx >= 0
      ? albums[ytEmbed.albumIdx]?.name ?? null
      : ytEmbed.source === 'listen-later' && ytEmbed.albumIdx >= 0
      ? listenLaterItems[ytEmbed.albumIdx]?.album ?? null
      : null;
    const llMetaKey = ytEmbed.source === 'listen-later' && ytEmbed.albumIdx >= 0
      ? `${listenLaterItems[ytEmbed.albumIdx]?.artist}|||${listenLaterItems[ytEmbed.albumIdx]?.album}`
      : null;
    const artUrl = ytEmbed.source === 'album' && ytEmbed.albumIdx >= 0
      ? albumMetas[ytEmbed.albumIdx]?.artUrl ?? null
      : llMetaKey
      ? llAlbumMetas[llMetaKey]?.artUrl ?? null
      : null;

    const bodyStyle = getComputedStyle(document.body);
    const bgColor = bodyStyle.getPropertyValue('--theme-background').trim() || '#1e1e2e';
    const textColor = bodyStyle.getPropertyValue('--theme-text').trim() || '#cdd6f4';
    const overlayColor = bodyStyle.getPropertyValue('--theme-overlay').trim() || '#6c7086';
    const fontFamily = bodyStyle.fontFamily;

    const scale = 2;
    const W = 560 * scale;
    const pad = 28 * scale;
    const artSize = 72 * scale;
    const fontSize = 13 * scale;
    const smallSize = 11 * scale;
    const lineH = 20 * scale;
    const gutterW = 36 * scale;
    const lyricsTopPad = 20 * scale;

    const headerH = artSize;
    const lyricsH = selectedLines.length * lineH;
    const H = pad + headerH + lyricsTopPad + lyricsH + lyricsTopPad + lineH + pad;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Album art
    if (artUrl) {
      try {
        const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(artUrl)}`);
        const blob = await proxyRes.blob();
        const imgUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, pad, pad, artSize, artSize); URL.revokeObjectURL(imgUrl); resolve(); };
          img.onerror = () => resolve();
          img.src = imgUrl;
        });
      } catch { /* no art */ }
    } else {
      ctx.save();
      ctx.fillStyle = overlayColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(pad, pad, artSize, artSize);
      ctx.restore();
    }

    // Track / artist / album
    const infoX = pad + artSize + 16 * scale;
    const infoMaxW = W - infoX - pad;
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillText(trackName, infoX, pad, infoMaxW);
    ctx.font = `${smallSize}px ${fontFamily}`;
    ctx.fillStyle = overlayColor;
    ctx.fillText(artist, infoX, pad + fontSize * 1.5, infoMaxW);
    if (albumName) ctx.fillText(albumName, infoX, pad + fontSize * 1.5 + smallSize * 1.6, infoMaxW);

    // Divider
    const divY = pad + headerH + lyricsTopPad * 0.5;
    ctx.save();
    ctx.strokeStyle = overlayColor;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(pad, divY);
    ctx.lineTo(W - pad, divY);
    ctx.stroke();
    ctx.restore();

    // Lyrics
    const lyricsStartY = pad + headerH + lyricsTopPad;
    ctx.font = `${fontSize}px ${fontFamily}`;
    selectedLines.forEach((line, i) => {
      const y = lyricsStartY + i * lineH;
      ctx.save();
      ctx.fillStyle = overlayColor;
      ctx.globalAlpha = 0.35;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(String(lineNumbers[i]), pad + gutterW, y);
      ctx.restore();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line || '', pad + gutterW + 8 * scale, y, W - pad - gutterW - 8 * scale - pad);
    });

    // Watermark
    ctx.save();
    ctx.fillStyle = overlayColor;
    ctx.globalAlpha = 0.4;
    ctx.font = `${smallSize}px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('musilog.me', W - pad, H - pad * 0.5);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `lyrics-${artist}-${trackName}.png`.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [ytEmbed, lyrics, lyricSelection, albums, albumMetas, llAlbumMetas, listenLaterItems]);

  const handleAutoNext = React.useCallback(() => {
    if (!ytEmbed) return;
    if (ytEmbed.source === 'tracks') {
      if (tracks[ytEmbed.trackIdx + 1]) handleTrackNavigate(ytEmbed.trackIdx + 1);
    } else if (ytEmbed.source === 'listen-later') {
      const item = listenLaterItems[ytEmbed.albumIdx];
      const metaKey = item ? `${item.artist}|||${item.album}` : null;
      const meta = metaKey ? llAlbumMetas[metaKey] : null;
      if (meta?.tracks[ytEmbed.trackIdx + 1]) handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1);
    } else {
      if (albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1]) {
        handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytEmbed, tracks, albumMetas, llAlbumMetas, listenLaterItems]);

  const ytPlayingRef = React.useRef(ytPlaying);
  React.useEffect(() => { ytPlayingRef.current = ytPlaying; });

  React.useEffect(() => {
    if (!ytEmbed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeYtEmbed(); return; }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (ytPlayingRef.current) ytPlayerActionsRef.current?.pause();
        else ytPlayerActionsRef.current?.play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ytEmbed]);

  const handleFetch = async (mode: FetchMode = fetchMode, overridePeriod?: Period, overrideCustomRange?: { from: string; to: string } | null, overrideUsername?: string, limit = 10) => {
    const activeUsername = (overrideUsername ?? username).trim();
    if (!activeUsername) {
      setError('Enter your Last.fm username.');
      return;
    }
    const activePeriod = overridePeriod ?? period;
    const activeCustomRange = overrideCustomRange !== undefined ? overrideCustomRange : customDateRange;
    if (mode === 'neighbors') setSavedNeighborState(null);
    setResultsExpanded(limit > 10);
    setLoading(true);
    setError('');
    setArtists([]);
    setAlbums([]);
    setTracks([]);
    setNeighbors([]);
    setUserStats(null);
    setOverviewTop(null);
    setAlbumMetas([]);
    setPixelArtCache({});
    pixelFetchedRef.current = new Set<number>();
    setOverviewChart(null);
    setNowPlaying(null);
    setNowPlayingLoading(false);
    setHoveredAlbumIndex(null);
    setLockedAlbumIndex(null);
    if (!ytMini) setYtEmbed(null);
    const start = Date.now();
    try {
      if (mode === 'stats') {
        const u = encodeURIComponent(activeUsername);
        const nowTs = Math.floor(Date.now() / 1000);
        const sixMonthsAgoTs = nowTs - 182 * 86400;
        setNowPlayingLoading(true);
        const [statsRes, artistsRes, albumsRes, tracksRes, chartRes] = await Promise.all([
          fetch(`/api/stats?username=${u}`),
          fetch(`/api/top-artists?username=${u}&period=overall`),
          fetch(`/api/top-albums?username=${u}&period=overall`),
          fetch(`/api/top-tracks?username=${u}&period=overall`),
          fetch(`/api/scrobble-chart?username=${u}&from=${sixMonthsAgoTs}&to=${nowTs}`),
        ]);
        const [statsData, artistsData, albumsData, tracksData, chartData] = await Promise.all([
          statsRes.json(), artistsRes.json(), albumsRes.json(), tracksRes.json(), chartRes.json(),
        ]);
        const elapsed = Date.now() - start;
        if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
        if (!statsRes.ok) { setError(statsData.error || 'Something went wrong.'); }
        else {
          setUserStats(statsData as UserStats);
          setOverviewTop({
            artists: artistsRes.ok ? (artistsData.artists ?? []).slice(0, 5) : [],
            albums:  albumsRes.ok  ? (albumsData.albums   ?? []).slice(0, 5) : [],
            tracks:  tracksRes.ok  ? (tracksData.tracks   ?? []).slice(0, 5) : [],
          });
          if (chartRes.ok) setOverviewChart(chartData);
          setLastFetched({ username: statsData.username, period: '', mode: 'stats' });
          fetch(`/api/now-playing?username=${u}`)
            .then((r) => r.json())
            .then((d) => { if (d.nowPlaying) setNowPlaying(d.nowPlaying); })
            .finally(() => setNowPlayingLoading(false));
        }
        return;
      }
      if (mode === 'neighbors') {
        const res = await fetch(`/api/neighbors?username=${encodeURIComponent(activeUsername)}`);
        const data = await res.json();
        const elapsed = Date.now() - start;
        if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
        if (!res.ok) { setError(data.error || 'Something went wrong.'); }
        else {
          setNeighbors(data.neighbors);
          setLastFetched({ username: data.username, period: '', mode: 'neighbors' });
        }
        return;
      }
      const base = `/api/${mode === 'albums' ? 'top-albums' : mode === 'tracks' ? 'top-tracks' : 'top-artists'}`;
      let params: string;
      if (activePeriod === 'custom' && activeCustomRange) {
        const fromTs = Math.floor(new Date(activeCustomRange.from + 'T00:00:00Z').getTime() / 1000);
        const toTs = Math.floor(new Date(activeCustomRange.to + 'T23:59:59Z').getTime() / 1000);
        params = `username=${encodeURIComponent(activeUsername)}&from=${fromTs}&to=${toTs}&limit=${limit}`;
      } else if (activePeriod === 'this_month' || activePeriod === 'this_year') {
        const now = new Date();
        const fromDate = activePeriod === 'this_month'
          ? new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
          : new Date(Date.UTC(now.getFullYear(), 0, 1));
        const fromTs = Math.floor(fromDate.getTime() / 1000);
        const toTs = Math.floor(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)).getTime() / 1000);
        params = `username=${encodeURIComponent(activeUsername)}&from=${fromTs}&to=${toTs}&limit=${limit}`;
      } else {
        params = `username=${encodeURIComponent(activeUsername)}&period=${activePeriod}&limit=${limit}`;
      }
      const res = await fetch(`${base}?${params}`);
      const data = await res.json();
      const elapsed = Date.now() - start;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        if (mode === 'albums') {
          setAlbums(data.albums);
          setAlbumMetasLoading(true);
          Promise.all(
            (data.albums as Album[]).map(async (a) => {
              try {
                const r = await fetch(`/api/album-info?artist=${encodeURIComponent(a.artist)}&album=${encodeURIComponent(a.name)}`);
                return r.ok ? (await r.json() as AlbumMeta) : null;
              } catch { return null; }
            })
          ).then((metas) => { setAlbumMetas(metas); setAlbumMetasLoading(false); });
        } else if (mode === 'tracks') {
          setTracks(data.tracks);
        } else {
          setArtists(data.artists);
        }
        setLastFetched({
          username: data.username,
          period: (activePeriod === 'this_month' || activePeriod === 'this_year') ? activePeriod : data.period,
          mode,
          customRange: activePeriod === 'custom' && activeCustomRange ? activeCustomRange : undefined,
        });
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeClick = (mode: FetchMode) => {
    setFetchMode(mode);
    handleFetch(mode);
  };

  const handleAlbumHover = (index: number) => {
    if (lockedAlbumIndex !== null) return;
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setHoveredAlbumIndex(index);
  };

  const handleAlbumLeave = () => {
    if (lockedAlbumIndex !== null) return;
    leaveTimer.current = setTimeout(() => setHoveredAlbumIndex(null), 300);
  };

  const handleAlbumClick = (index: number) => {
    setLockedAlbumIndex((prev) => prev === index ? null : index);
  };

  const handleLlHover = (index: number) => {
    if (llLockedIdx !== null) return;
    if (llLeaveTimer.current) { clearTimeout(llLeaveTimer.current); llLeaveTimer.current = null; }
    setLlHoveredIdx(index);
  };

  const handleLlLeave = () => {
    if (llLockedIdx !== null) return;
    llLeaveTimer.current = setTimeout(() => setLlHoveredIdx(null), 300);
  };

  const handleLlClick = (index: number) => {
    setLlLockedIdx((prev) => prev === index ? null : index);
  };

  const handleLlYtNavigate = async (llIdx: number, trackIdx: number) => {
    if (ytNavLoading) return;
    const item = listenLaterItems[llIdx];
    const metaKey = item ? `${item.artist}|||${item.album}` : null;
    const meta = metaKey ? llAlbumMetas[metaKey] : null;
    const track = meta?.tracks[trackIdx];
    if (!track || !item) return;
    const cacheKey = `${item.artist}::${track.name}`;
    if (ytVideoCacheRef.current[cacheKey]) {
      setYtEmbed({ videoId: ytVideoCacheRef.current[cacheKey], title: `${item.artist} — ${track.name}`, source: 'listen-later', albumIdx: llIdx, trackIdx });
      return;
    }
    setYtNavLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(item.artist)}&track=${encodeURIComponent(track.name)}`);
      const data = await res.json();
      if (data.videoId) {
        ytVideoCacheRef.current[cacheKey] = data.videoId;
        setYtEmbed({ videoId: data.videoId, title: `${item.artist} — ${track.name}`, source: 'listen-later', albumIdx: llIdx, trackIdx });
      }
    } finally {
      setYtNavLoading(false);
    }
  };

  const handleNeighborClick = (index: number) => {
    const neighbor = neighbors[index];
    if (!neighbor) return;
    setSavedNeighborState({ username, neighbors });
    setUsername(neighbor.username);
    localStorage.setItem('lastfm-username', neighbor.username);
    setFetchMode('albums');
    setPeriod('overall');
    handleFetch('albums', 'overall', null, neighbor.username);
  };

  const handleBackToNeighbors = () => {
    if (!savedNeighborState) return;
    setUsername(savedNeighborState.username);
    localStorage.setItem('lastfm-username', savedNeighborState.username);
    setNeighbors(savedNeighborState.neighbors);
    setAlbums([]);
    setAlbumMetas([]);
    setFetchMode('neighbors');
    setLastFetched({ username: savedNeighborState.username, period: '', mode: 'neighbors' });
    setSavedNeighborState(null);
  };

  const handleYtNavigate = async (albumIdx: number, trackIdx: number) => {
    if (ytNavLoading) return;
    const meta = albumMetas[albumIdx];
    const track = meta?.tracks[trackIdx];
    const album = albums[albumIdx];
    if (!track || !album) return;
    const cacheKey = `${album.artist}::${track.name}`;
    if (ytVideoCacheRef.current[cacheKey]) {
      setYtEmbed({ videoId: ytVideoCacheRef.current[cacheKey], title: `${album.artist} — ${track.name}`, source: 'album', albumIdx, trackIdx });
      return;
    }
    setYtNavLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(album.artist)}&track=${encodeURIComponent(track.name)}`);
      const data = await res.json();
      if (data.videoId) {
        ytVideoCacheRef.current[cacheKey] = data.videoId;
        setYtEmbed({ videoId: data.videoId, title: `${album.artist} — ${track.name}`, source: 'album', albumIdx, trackIdx });
      }
    } finally {
      setYtNavLoading(false);
    }
  };

  const handleTrackPlay = (trackIdx: number, videoId: string) => {
    const t = tracks[trackIdx];
    if (!t) return;
    setYtEmbed({ videoId, title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
  };

  const handleTrackNavigate = async (trackIdx: number) => {
    if (ytNavLoading) return;
    const t = tracks[trackIdx];
    if (!t) return;
    const cacheKey = `${t.artist}::${t.name}`;
    if (ytVideoCacheRef.current[cacheKey]) {
      setYtEmbed({ videoId: ytVideoCacheRef.current[cacheKey], title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
      return;
    }
    setYtNavLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(t.artist)}&track=${encodeURIComponent(t.name)}`);
      const data = await res.json();
      if (data.videoId) {
        ytVideoCacheRef.current[cacheKey] = data.videoId;
        setYtEmbed({ videoId: data.videoId, title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
      }
    } finally {
      setYtNavLoading(false);
    }
  };

  const handlePeriodSelect = (id: string) => {
    const value = id as Period;
    if (value === 'custom') {
      setIsModalOpen(true);
    } else {
      setPeriod(value);
      const activeMode = lastFetched?.mode ?? fetchMode;
      if (username.trim() && activeMode !== 'stats' && activeMode !== 'neighbors') {
        handleFetch(activeMode, value);
      }
    }
  };

  const handleModalConfirm = (from: string, to: string) => {
    const range = { from, to };
    setCustomDateRange(range);
    setPeriod('custom');
    setIsModalOpen(false);
    if (username.trim()) {
      handleFetch(lastFetched?.mode ?? fetchMode, 'custom', range);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleExport = async () => {
    if (!resultsRef.current) return;
    setExporting(true);
    try {
      const rows = resultsRef.current.querySelectorAll<HTMLTableRowElement>('tbody tr');
      rows.forEach((row) => {
        row.style.animationName = 'none';
        row.style.opacity = '1';
      });

      const noExportEls = resultsRef.current.querySelectorAll<HTMLElement>('[data-no-export]');
      noExportEls.forEach((el) => { el.style.display = 'none'; });

      const html2canvas = (await import('html2canvas')).default;
      const bodyStyle = getComputedStyle(document.body);
      const bgColor = bodyStyle.getPropertyValue('--theme-background').trim() || '#ffffff';
      const textColor = bodyStyle.getPropertyValue('--theme-text').trim() || '#000000';
      const overlayColor = bodyStyle.getPropertyValue('--theme-overlay').trim() || '#888888';
      const elStyle = getComputedStyle(resultsRef.current);
      const fontFamily = elStyle.fontFamily;
      const basePx = parseFloat(elStyle.fontSize);

      const resultsCanvas = await html2canvas(resultsRef.current, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      noExportEls.forEach((el) => { el.style.display = ''; });

      const scale = 2;
      const pad = 24 * scale;
      const gap = 16 * scale;
      const asciiFontPx = basePx * 0.5 * scale;
      const asciiLineH = asciiFontPx * 1.2;
      const asciiLines = ASCII_BANNER.split('\n');
      const asciiBlockH = asciiLines.length * asciiLineH;
      const footerFontPx = basePx * scale;

      const W = resultsCanvas.width + pad * 2;
      const H = pad + asciiBlockH + gap + resultsCanvas.height + gap + footerFontPx * 1.5 + pad;

      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const ctx = out.getContext('2d')!;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = textColor;
      ctx.font = `${asciiFontPx}px ${fontFamily}`;
      ctx.textBaseline = 'top';
      asciiLines.forEach((line, i) => ctx.fillText(line, pad, pad + i * asciiLineH));
      ctx.restore();

      ctx.drawImage(resultsCanvas, pad, pad + asciiBlockH + gap);

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = overlayColor;
      ctx.font = `${footerFontPx}px ${fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'right';
      ctx.fillText('analyzed by musilog.me', W - pad, pad + asciiBlockH + gap + resultsCanvas.height + gap + footerFontPx);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `lastfm-top-${lastFetched?.mode ?? 'artists'}-${lastFetched?.username ?? 'export'}.png`;
      link.href = out.toDataURL('image/png');
      link.click();
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  const hasResults = artists.length > 0 || albums.length > 0 || tracks.length > 0 || neighbors.length > 0 || userStats !== null || overviewTop !== null;

  const statsRows: string[][] = userStats ? [
    ['SCROBBLES', userStats.scrobbles.toLocaleString()],
    ['ARTISTS', userStats.artists.toLocaleString()],
    ['ALBUMS', userStats.albums.toLocaleString()],
    ['TRACKS', userStats.tracks.toLocaleString()],
    ...(userStats.country ? [['COUNTRY', userStats.country]] : []),
    ...(userStats.registered ? [['MEMBER SINCE', new Date(userStats.registered * 1000).getFullYear().toString()]] : []),
  ] : [];

  const tableData: React.ReactNode[][] =
    artists.length > 0
      ? showPlays
        ? [['#', 'ARTIST', 'PLAYS'], ...artists.map((a) => [String(a.rank), formatName(a.name), a.playcount.toLocaleString()])]
        : [['#', 'ARTIST'], ...artists.map((a) => [String(a.rank), formatName(a.name)])]
      : userStats
      ? [['STAT', 'VALUE'], ...statsRows]
      : showPlays
      ? [['#', 'ALBUM', 'ARTIST', 'PLAYS'], ...albums.map((a) => [String(a.rank), formatName(a.name), a.artist, a.playcount.toLocaleString()])]
      : [['#', 'ALBUM', 'ARTIST'], ...albums.map((a) => [String(a.rank), formatName(a.name), a.artist])];

  const tableAlign = (
    artists.length > 0 ? (showPlays ? ['left', 'left', 'right'] : ['left', 'left']) :
    userStats ? ['left', 'right'] :
    (showPlays ? ['left', 'left', 'left', 'right'] : ['left', 'left', 'left'])
  ) as ('left' | 'right')[];

  const periodDisplay = lastFetched?.customRange
    ? `${lastFetched.customRange.from} TO ${lastFetched.customRange.to}`
    : PERIOD_LABELS[lastFetched?.period as Period] ?? lastFetched?.period ?? '';

  const modeLabel =
    lastFetched?.mode === 'albums' ? 'TOP ALBUMS' :
    lastFetched?.mode === 'tracks' ? 'TOP SONGS' :
    lastFetched?.mode === 'stats' ? 'OVERVIEW' :
    lastFetched?.mode === 'neighbors' ? 'NEIGHBOURS' :
    'TOP ARTISTS';
  const noPeriodMode = lastFetched?.mode === 'stats' || lastFetched?.mode === 'neighbors';
  const resultTitle = lastFetched
    ? noPeriodMode
      ? `${modeLabel} — @${lastFetched.username.toUpperCase()}`
      : `${modeLabel} — @${lastFetched.username.toUpperCase()} — ${periodDisplay}`
    : 'TOP 10';

  const pendingModeLabel =
    fetchMode === 'albums' ? 'TOP ALBUMS' :
    fetchMode === 'tracks' ? 'TOP SONGS' :
    fetchMode === 'stats' ? 'OVERVIEW' :
    fetchMode === 'neighbors' ? 'NEIGHBOURS' :
    'TOP ARTISTS';
  const pendingPeriodDisplay = period === 'custom' && customDateRange
    ? `${customDateRange.from} TO ${customDateRange.to}`
    : PERIOD_LABELS[period];
  const pendingTitle = (fetchMode === 'stats' || fetchMode === 'neighbors')
    ? `${pendingModeLabel} — @${username.trim().toUpperCase()}`
    : `${pendingModeLabel} — @${username.trim().toUpperCase()} — ${pendingPeriodDisplay}`;

  return (
    <div className={styles.wrapper}>
    <ActionBar
      items={ytEmbed ? [
        { hotkey: 'K', body: ytPlaying ? 'PAUSE' : 'PLAY', onClick: () => ytPlaying ? ytPlayerActionsRef.current?.pause() : ytPlayerActionsRef.current?.play() },
        { hotkey: 'ESC', body: 'STOP', onClick: closeYtEmbed },
      ] : []}
      center={(() => {
        if (ytEmbed) {
          const sep = ytEmbed.title.indexOf(' — ');
          const artist = sep !== -1 ? ytEmbed.title.slice(0, sep) : '';
          const track = sep !== -1 ? ytEmbed.title.slice(sep + 3) : ytEmbed.title;
          return `${ytPlaying ? '♪' : '‖'} ${track} — ${artist}`;
        }
        return sessionUsername ? `@${sessionUsername.toUpperCase()}` : undefined;
      })()}
      rightItems={[
        sessionUsername
          ? { body: 'LOGOUT', onClick: () => fetch('/api/auth/logout', { method: 'POST' }).then(() => setSessionUsername(null)) }
          : { body: 'LOGIN', onClick: () => { window.location.href = '/api/auth/login'; } },
        { hotkey: '♥', body: 'SUPPORT', onClick: () => window.open('https://deionmenor.com', '_blank') },
      ]}
    >
      <ThemeDropdown
        label={appMode === 'rank' ? 'RANK MODE' : appMode === 'listen-later' ? 'LISTEN LATER' : 'CHARTS'}
        items={[...APP_MODES, ...(sessionUsername ? [{ id: 'listen-later', label: 'LISTEN LATER' }] : [])]}
        currentId={appMode}
        onSelect={(id) => setAppMode(id as 'charts' | 'rank' | 'listen-later')}
      />
      <ThemeDropdown hotkey="◑" label="THEME" items={THEMES} currentId={theme} onSelect={(id) => setTheme(id as Theme)} />
    </ActionBar>
    <main className={styles.main}>
      {appMode === 'rank' && <RankMode />}
      {appMode === 'listen-later' && (
        <div className={styles.pageRow}>
          <div className={styles.container}>
            {ytEmbed && !ytMini ? (
              <Card title={ytEmbed.title}>
                <div className={styles.ytEmbedWrapper}>
                  <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} onPlayingChange={setYtPlaying} onPlayerReady={(a) => { ytPlayerActionsRef.current = a; }} />
                </div>
                <div className={styles.ytControls}>
                  <div className={styles.ytNavButtons}>
                    {ytEmbed.source === 'tracks' ? (
                      <>
                        {ytEmbed.trackIdx > 0 && (
                          <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                            {ytNavLoading ? '...' : 'PREV'}
                          </ActionButton>
                        )}
                        {tracks[ytEmbed.trackIdx + 1] && (
                          <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                            {ytNavLoading ? '...' : 'NEXT'}
                          </ActionButton>
                        )}
                      </>
                    ) : (() => {
                      const isLL = ytEmbed.source === 'listen-later';
                      const llItem = isLL ? listenLaterItems[ytEmbed.albumIdx] : null;
                      const llMKey = llItem ? `${llItem.artist}|||${llItem.album}` : null;
                      const llM = llMKey ? llAlbumMetas[llMKey] : null;
                      const hasNext = isLL ? !!llM?.tracks[ytEmbed.trackIdx + 1] : !!albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1];
                      return (
                        <>
                          {ytEmbed.trackIdx > 0 && (
                            <ActionButton hotkey="←" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                              {ytNavLoading ? '...' : 'PREV'}
                            </ActionButton>
                          )}
                          {hasNext && (
                            <ActionButton hotkey="→" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                              {ytNavLoading ? '...' : 'NEXT'}
                            </ActionButton>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className={styles.ytNavButtons}>
                    <ActionButton
                      isSelected={lyricsOpen}
                      onClick={() => {
                        const next = !lyricsOpen;
                        setLyricsOpen(next);
                        if (next && !lyrics && ytEmbed) {
                          const sep = ytEmbed.title.indexOf(' — ');
                          if (sep !== -1) fetchLyrics(ytEmbed.title.slice(0, sep), ytEmbed.title.slice(sep + 3));
                        }
                      }}
                    >
                      LYRICS
                    </ActionButton>
                    <ActionButton hotkey="⊟" onClick={() => setYtMini(true)}>MINI</ActionButton>
                    <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
                  </div>
                </div>
                {lyricsOpen && (
                  <div className={styles.lyricsPanel}>
                    <LyricsContent lyrics={lyrics} loading={lyricsLoading} selection={lyricSelection} onLineClick={lyrics?.plain ? handleLyricLineClick : undefined} />
                    {lyricSelection && (
                      <div className={styles.lyricsExportRow}>
                        <button className={styles.lyricsExportBtn} onClick={handleLyricsExport}>
                          ↓ EXPORT {lyricSelection[1] - lyricSelection[0] + 1} LINE{lyricSelection[1] !== lyricSelection[0] ? 'S' : ''}
                        </button>
                        <button className={styles.lyricsExportBtn} onClick={() => { setLyricAnchor(null); setLyricSelection(null); }}>
                          ✕ CLEAR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <Card title={`LISTEN LATER${listenLaterItems.length > 0 ? ` — ${listenLaterItems.length} ALBUM${listenLaterItems.length !== 1 ? 'S' : ''}` : ''}`}>
                {listenLaterItems.length === 0 ? (
                  <div className={styles.sidebarLoading}>NO SAVED ALBUMS.</div>
                ) : (
                  <SimpleTable
                    data={[
                      ['ARTIST', 'ALBUM', 'SAVED'],
                      ...listenLaterItems.map((item) => [item.artist, formatName(item.album), item.added_at.slice(0, 10)]),
                    ]}
                    onRowHover={handleLlHover}
                    onRowClick={handleLlClick}
                    onTableLeave={handleLlLeave}
                    selectedRow={llLockedIdx ?? llHoveredIdx ?? undefined}
                    animate
                    headerVariant="red"
                  />
                )}
              </Card>
            )}
          </div>

          <div className={styles.sidebarCol}>
            {ytEmbed && ytMini && (
              <Card title={ytEmbed.title}>
                <div className={styles.ytEmbedWrapper}>
                  <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} />
                </div>
                <div className={styles.ytControls}>
                  <div className={styles.ytNavButtons}>
                    {ytEmbed.source === 'tracks' ? (
                      <>
                        {ytEmbed.trackIdx > 0 && (
                          <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                            {ytNavLoading ? '...' : 'PREV'}
                          </ActionButton>
                        )}
                        {tracks[ytEmbed.trackIdx + 1] && (
                          <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                            {ytNavLoading ? '...' : 'NEXT'}
                          </ActionButton>
                        )}
                      </>
                    ) : (() => {
                      const isLL = ytEmbed.source === 'listen-later';
                      const llItem = isLL ? listenLaterItems[ytEmbed.albumIdx] : null;
                      const llMKey = llItem ? `${llItem.artist}|||${llItem.album}` : null;
                      const llM = llMKey ? llAlbumMetas[llMKey] : null;
                      const hasNext = isLL ? !!llM?.tracks[ytEmbed.trackIdx + 1] : !!albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1];
                      return (
                        <>
                          {ytEmbed.trackIdx > 0 && (
                            <ActionButton hotkey="←" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                              {ytNavLoading ? '...' : 'PREV'}
                            </ActionButton>
                          )}
                          {hasNext && (
                            <ActionButton hotkey="→" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                              {ytNavLoading ? '...' : 'NEXT'}
                            </ActionButton>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className={styles.ytNavButtons}>
                    <ActionButton
                      isSelected={lyricsOpen}
                      onClick={() => {
                        const next = !lyricsOpen;
                        setLyricsOpen(next);
                        if (next && !lyrics && ytEmbed) {
                          const sep = ytEmbed.title.indexOf(' — ');
                          if (sep !== -1) fetchLyrics(ytEmbed.title.slice(0, sep), ytEmbed.title.slice(sep + 3));
                        }
                      }}
                    >
                      LYRICS
                    </ActionButton>
                    <ActionButton hotkey="⊞" onClick={() => setYtMini(false)}>EXPAND</ActionButton>
                    <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
                  </div>
                </div>
                {lyricsOpen && (
                  <div className={styles.lyricsPanel}>
                    <LyricsContent lyrics={lyrics} loading={lyricsLoading} selection={lyricSelection} onLineClick={lyrics?.plain ? handleLyricLineClick : undefined} />
                    {lyricSelection && (
                      <div className={styles.lyricsExportRow}>
                        <button className={styles.lyricsExportBtn} onClick={handleLyricsExport}>
                          ↓ EXPORT {lyricSelection[1] - lyricSelection[0] + 1} LINE{lyricSelection[1] !== lyricSelection[0] ? 'S' : ''}
                        </button>
                        <button className={styles.lyricsExportBtn} onClick={() => { setLyricAnchor(null); setLyricSelection(null); }}>
                          ✕ CLEAR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
            <div className={styles.sidebar}>
              {(() => {
                const activeIndex = llLockedIdx ?? llHoveredIdx;
                const activeItem = activeIndex !== null ? listenLaterItems[activeIndex] : null;
                if (!activeItem) return (
                  <Card title="LISTEN LATER">
                    <div className={styles.sidebarIntro}>
                      <p>Your saved albums appear here. Hover an album to preview it, click to lock the panel and see the full tracklist.</p>
                    </div>
                  </Card>
                );
                const llKey = `${activeItem.artist}|||${activeItem.album}`;
                const activeMeta = llAlbumMetas[llKey] ?? null;
                const pixels = llPixelCache[llKey];
                const isLoading = llFetchingRef.current.has(llKey);

                return (
                  <Card title="ALBUM INFO">
                    <div className={styles.sidebarContent}>
                      <div className={styles.albumHeader}>
                        {activeMeta?.artUrl && (
                          <button
                            className={styles.albumThumb}
                            onClick={() => setImageView((v) => v === 'pixel' ? 'original' : 'pixel')}
                            title={imageView === 'pixel' ? 'Show original' : 'Show pixel art'}
                          >
                            {imageView === 'pixel' ? (
                              llPixelLoading && !pixels
                                ? <div className={styles.thumbPlaceholder} />
                                : pixels
                                ? <div className={styles.pixelGrid}>{pixels.map((c, i) => <div key={i} className={styles.pixelCell} style={{ backgroundColor: c }} />)}</div>
                                : <div className={styles.thumbPlaceholder} />
                            ) : (
                              <img src={activeMeta.artUrl} alt={activeItem.album} className={styles.thumbImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                          </button>
                        )}
                        <div className={styles.albumHeaderInfo}>
                          <div className={styles.albumTitle}>{formatName(activeItem.album)}</div>
                          <div className={styles.albumSubtitle}>{activeItem.artist}</div>
                        </div>
                      </div>

                      <button
                        className={styles.listenLaterBtn}
                        onClick={() => {
                          fetch('/api/listen-later', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: activeItem.artist, album: activeItem.album }) }).catch(() => {});
                          setListenLaterSet((prev) => { const next = new Set(prev); next.delete(llKey); return next; });
                          setListenLaterItems((prev) => prev.filter((i) => !(i.artist === activeItem.artist && i.album === activeItem.album)));
                          setLlLockedIdx(null);
                          setLlHoveredIdx(null);
                        }}
                      >
                        ◆ REMOVE
                      </button>

                      {isLoading && !activeMeta && <div className={styles.sidebarLoading}>LOADING...</div>}

                      {activeMeta && (
                        <>
                          <div className={styles.statsRow}>
                            {activeMeta.releaseDate && (
                              <div className={styles.statItem}>
                                <span className={styles.statValue}>{activeMeta.releaseDate.slice(0, 4)}</span>
                                <span className={styles.statLabel}>◈</span>
                              </div>
                            )}
                            <div className={styles.statItem}>
                              <span className={styles.statValue}>{formatDuration(activeMeta.totalDuration)}</span>
                              <span className={styles.statLabel}>◷</span>
                            </div>
                            <div className={styles.statItem}>
                              <span className={styles.statValue}>{formatCount(activeMeta.listeners)}</span>
                              <span className={styles.statLabel}>◉</span>
                            </div>
                            <div className={styles.statItem}>
                              <span className={styles.statValue}>{formatCount(activeMeta.playcount)}</span>
                              <span className={styles.statLabel}>↺</span>
                            </div>
                          </div>

                          {activeMeta.tags.slice(0, 3).length > 0 && (
                            <div className={styles.tags}>
                              {activeMeta.tags.slice(0, 3).join(' · ')}
                            </div>
                          )}

                          {activeMeta.tracks.length > 0 && (
                            <div className={styles.tracklistSection}>
                              <button className={styles.tracklistToggle} onClick={() => setLlTracklistOpen((o) => !o)}>
                                {llTracklistOpen ? '▼' : '▶'} TRACKLIST
                              </button>
                              {llTracklistOpen && (() => {
                                const withPlays = activeMeta.tracks.filter((t) => t.playcount > 0);
                                const hotSet = new Set(
                                  [...withPlays].sort((a, b) => b.playcount - a.playcount).slice(0, 3).map((t) => t.rank)
                                );
                                return (
                                  <div className={styles.sidebarTracks}>
                                    {activeMeta.tracks.map((t, tIdx) => (
                                      <div key={t.rank} className={styles.sidebarTrack}>
                                        <span className={styles.sidebarTrackNum}>{t.rank}.</span>
                                        <span className={styles.sidebarTrackName}>{formatName(t.name)}</span>
                                        {hotSet.has(t.rank) && (
                                          <Tooltip content={`${t.playcount.toLocaleString()} plays`}>
                                            <span className={styles.hotDot} />
                                          </Tooltip>
                                        )}
                                        {t.duration > 0 && (
                                          <span className={styles.sidebarTrackDur}>
                                            {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
                                          </span>
                                        )}
                                        <TrackYtButton
                                          artist={activeItem.artist}
                                          track={t.name}
                                          onPlay={(videoId) => setYtEmbed({ videoId, title: `${activeItem.artist} — ${t.name}`, source: 'listen-later', albumIdx: activeIndex!, trackIdx: tIdx })}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {appMode === 'charts' && <>
      <div className={styles.banner}>
        <Card title="MUSILOG.FM">
          <div className={styles.bannerInner}>
            <div className={styles.bannerForm}>
              <Input
                label="USERNAME"
                placeholder="e.g. rj"
                prefix="@"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  localStorage.setItem('lastfm-username', e.target.value);
                  setSavedNeighborState(null);
                }}
                onKeyDown={handleKeyDown}
                isBlink={true}
              />
              <ButtonGroup
                isFull
                items={[
                  { body: 'TOP ALBUMS',  selected: fetchMode === 'albums',    onClick: () => handleModeClick('albums') },
                  { body: 'TOP ARTISTS', selected: fetchMode === 'artists',   onClick: () => handleModeClick('artists') },
                  { body: 'TOP SONGS',   selected: fetchMode === 'tracks',    onClick: () => handleModeClick('tracks') },
                  { body: 'NEIGHBOURS',  selected: fetchMode === 'neighbors', onClick: () => handleModeClick('neighbors') },
                  { body: 'OVERVIEW',    selected: fetchMode === 'stats',     onClick: () => handleModeClick('stats') },
                ]}
              />
              {error && <div className={styles.error}>{error}</div>}
            </div>
            <pre className={styles.bannerPre}>{ASCII_BANNER}</pre>
          </div>
        </Card>
      </div>
      <div className={styles.pageRow}>
      <div className={styles.container}>
        {(loading || hasResults) && !(ytEmbed && !ytMini) && (
          <div className={styles.resultsToolbar}>
            {savedNeighborState && (
              <ActionButton hotkey="←" onClick={handleBackToNeighbors}>NEIGHBOURS</ActionButton>
            )}
            {fetchMode !== 'stats' && fetchMode !== 'neighbors' && (
              <ThemeDropdown
                label={period === 'custom' && customDateRange ? `${customDateRange.from} → ${customDateRange.to}` : PERIOD_LABELS[period]}
                items={PERIOD_ITEMS}
                currentId={period}
                onSelect={handlePeriodSelect}
              />
            )}
            <div className={styles.toolbarRight}>
              <button className={styles.exportBtn} onClick={handleExport} disabled={exporting || loading || !hasResults}>
                {exporting ? '...' : '↓ EXPORT'}
              </button>
              <button className={styles.playsToggle} onClick={() => setShowPlays((v) => !v)}>
                {showPlays ? '[X]' : '[ ]'} PLAYS
              </button>
            </div>
          </div>
        )}

        {loading && (
          <Card title={pendingTitle}>
            <LineLoader mode={fetchMode} />
          </Card>
        )}

        {hasResults && (
          <>
            {ytEmbed && !ytMini ? (
              <Card title={ytEmbed.title}>
                <div className={styles.ytEmbedWrapper}>
                  <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} onPlayingChange={setYtPlaying} onPlayerReady={(a) => { ytPlayerActionsRef.current = a; }} />
                </div>
                <div className={styles.ytControls}>
                  <div className={styles.ytNavButtons}>
                    {ytEmbed.source === 'tracks' ? (
                      <>
                        {ytEmbed.trackIdx > 0 && (
                          <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                            {ytNavLoading ? '...' : 'PREV'}
                          </ActionButton>
                        )}
                        {tracks[ytEmbed.trackIdx + 1] && (
                          <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                            {ytNavLoading ? '...' : 'NEXT'}
                          </ActionButton>
                        )}
                      </>
                    ) : (() => {
                      const isLL = ytEmbed.source === 'listen-later';
                      const llItem = isLL ? listenLaterItems[ytEmbed.albumIdx] : null;
                      const llMetaKey = llItem ? `${llItem.artist}|||${llItem.album}` : null;
                      const llMeta = llMetaKey ? llAlbumMetas[llMetaKey] : null;
                      const hasNext = isLL
                        ? !!llMeta?.tracks[ytEmbed.trackIdx + 1]
                        : !!albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1];
                      return (
                        <>
                          {ytEmbed.trackIdx > 0 && (
                            <ActionButton hotkey="←" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                              {ytNavLoading ? '...' : 'PREV'}
                            </ActionButton>
                          )}
                          {hasNext && (
                            <ActionButton hotkey="→" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                              {ytNavLoading ? '...' : 'NEXT'}
                            </ActionButton>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className={styles.ytNavButtons}>
                    <ActionButton
                      isSelected={lyricsOpen}
                      onClick={() => {
                        const next = !lyricsOpen;
                        setLyricsOpen(next);
                        if (next && !lyrics && ytEmbed) {
                          const sep = ytEmbed.title.indexOf(' — ');
                          if (sep !== -1) fetchLyrics(ytEmbed.title.slice(0, sep), ytEmbed.title.slice(sep + 3));
                        }
                      }}
                    >
                      LYRICS
                    </ActionButton>
                    <ActionButton hotkey="⊟" onClick={() => setYtMini(true)}>MINI</ActionButton>
                    <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
                  </div>
                </div>
                {lyricsOpen && (
                  <div className={styles.lyricsPanel}>
                    <LyricsContent lyrics={lyrics} loading={lyricsLoading} selection={lyricSelection} onLineClick={lyrics?.plain ? handleLyricLineClick : undefined} />
                    {lyricSelection && (
                      <div className={styles.lyricsExportRow}>
                        <button className={styles.lyricsExportBtn} onClick={handleLyricsExport}>
                          ↓ EXPORT {lyricSelection[1] - lyricSelection[0] + 1} LINE{lyricSelection[1] !== lyricSelection[0] ? 'S' : ''}
                        </button>
                        <button className={styles.lyricsExportBtn} onClick={() => { setLyricAnchor(null); setLyricSelection(null); }}>
                          ✕ CLEAR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <>
              <div className={styles.results} ref={resultsRef}>
                <Card title={resultTitle}>
                  {neighbors.length > 0 ? (
                    <NeighborTable
                      key={`${lastFetched?.username}-neighbors`}
                      neighbors={neighbors}
                      onRowClick={handleNeighborClick}
                    />
                  ) : tracks.length > 0 ? (
                    <TrackTable
                      key={`${lastFetched?.username}-${lastFetched?.period}-tracks`}
                      tracks={tracks}
                      onPlay={handleTrackPlay}
                      showPlays={showPlays}
                      headerVariant="blue"
                    />
                  ) : userStats ? (
                    <>
                    {(nowPlayingLoading || nowPlaying) && (
                      <div className={styles.nowPlaying}>
                        {nowPlayingLoading ? (
                          <div className={styles.nowPlayingInfo}>
                            <div className={styles.nowPlayingLabel}><Spinner /> NOW PLAYING</div>
                          </div>
                        ) : nowPlaying && (
                          <>
                            {nowPlaying.imageUrl && (
                              <img src={nowPlaying.imageUrl} alt={nowPlaying.album ?? nowPlaying.track} className={styles.nowPlayingArt} />
                            )}
                            <div className={styles.nowPlayingInfo}>
                              <div className={styles.nowPlayingLabel}>NOW PLAYING</div>
                              <div className={styles.nowPlayingTrack}>{formatName(nowPlaying.track)}</div>
                              <div className={styles.nowPlayingArtist}>{nowPlaying.artist}</div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className={styles.overviewSplit}>
                      <div className={styles.overviewStats}>
                        <SimpleTable
                          key={`${lastFetched?.username}-stats`}
                          data={tableData}
                          align={tableAlign}
                          animate
                          hideHeader
                        />
                      </div>
                      {overviewChart && (
                        <div className={styles.overviewChart}>
                          <AreaChart data={overviewChart.days} total={overviewChart.total} groupBy="week" />
                        </div>
                      )}
                    </div>
                    </>
                  ) : (
                    <SimpleTable
                      key={`${lastFetched?.username}-${lastFetched?.period}-${lastFetched?.mode}`}
                      data={tableData}
                      align={tableAlign}
                      animate
                      headerVariant={albums.length > 0 ? 'red' : artists.length > 0 ? 'green' : undefined}
                      onRowHover={albums.length > 0 ? handleAlbumHover : undefined}
                      onRowClick={albums.length > 0 ? handleAlbumClick : undefined}
                      onTableLeave={albums.length > 0 ? handleAlbumLeave : undefined}
                      selectedRow={lockedAlbumIndex ?? hoveredAlbumIndex ?? undefined}
                    />
                  )}
                </Card>
                {overviewTop && (
                  <>
                    <Card title="TOP ALBUMS — ALL TIME">
                      <SimpleTable
                        data={showPlays
                          ? [['#', 'ALBUM', 'ARTIST', 'PLAYS'], ...overviewTop.albums.map((a) => [String(a.rank), formatName(a.name), a.artist, a.playcount.toLocaleString()])]
                          : [['#', 'ALBUM', 'ARTIST'], ...overviewTop.albums.map((a) => [String(a.rank), formatName(a.name), a.artist])]}
                        align={showPlays ? ['left', 'left', 'left', 'right'] : ['left', 'left', 'left']}
                        headerVariant="red"
                        animate
                      />
                    </Card>
                    <Card title="TOP ARTISTS — ALL TIME">
                      <SimpleTable
                        data={showPlays
                          ? [['#', 'ARTIST', 'PLAYS'], ...overviewTop.artists.map((a) => [String(a.rank), formatName(a.name), a.playcount.toLocaleString()])]
                          : [['#', 'ARTIST'], ...overviewTop.artists.map((a) => [String(a.rank), formatName(a.name)])]}
                        align={showPlays ? ['left', 'left', 'right'] : ['left', 'left']}
                        headerVariant="green"
                        animate
                      />
                    </Card>
                    <Card title="TOP SONGS — ALL TIME">
                      <TrackTable
                        tracks={overviewTop.tracks}
                        onPlay={handleTrackPlay}
                        showPlays={showPlays}
                        headerVariant="blue"
                      />
                    </Card>
                  </>
                )}
              </div>
              {lastFetched && ['albums', 'artists', 'tracks'].includes(lastFetched.mode) && !resultsExpanded && (
                <ActionButton
                  hotkey="+"
                  onClick={() => handleFetch(lastFetched.mode as FetchMode, period, customDateRange, undefined, 50)}
                >
                  {`MORE ${lastFetched.mode === 'albums' ? 'ALBUMS' : lastFetched.mode === 'tracks' ? 'SONGS' : 'ARTISTS'}`}
                </ActionButton>
              )}
              </>
            )}
          </>
        )}
      </div>

      <div className={styles.sidebarCol}>
        {ytEmbed && ytMini && (
          <Card title={ytEmbed.title}>
            <div className={styles.ytEmbedWrapper}>
              <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} />
            </div>
            <div className={styles.ytControls}>
              <div className={styles.ytNavButtons}>
                {ytEmbed.source === 'tracks' ? (
                  <>
                    {ytEmbed.trackIdx > 0 && (
                      <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                        {ytNavLoading ? '...' : 'PREV'}
                      </ActionButton>
                    )}
                    {tracks[ytEmbed.trackIdx + 1] && (
                      <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                        {ytNavLoading ? '...' : 'NEXT'}
                      </ActionButton>
                    )}
                  </>
                ) : (() => {
                  const isLL = ytEmbed.source === 'listen-later';
                  const llItem = isLL ? listenLaterItems[ytEmbed.albumIdx] : null;
                  const llMetaKey = llItem ? `${llItem.artist}|||${llItem.album}` : null;
                  const llMeta = llMetaKey ? llAlbumMetas[llMetaKey] : null;
                  const hasNext = isLL
                    ? !!llMeta?.tracks[ytEmbed.trackIdx + 1]
                    : !!albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1];
                  return (
                    <>
                      {ytEmbed.trackIdx > 0 && (
                        <ActionButton hotkey="←" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                          {ytNavLoading ? '...' : 'PREV'}
                        </ActionButton>
                      )}
                      {hasNext && (
                        <ActionButton hotkey="→" onClick={() => isLL ? handleLlYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1) : handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                          {ytNavLoading ? '...' : 'NEXT'}
                        </ActionButton>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className={styles.ytNavButtons}>
                <ActionButton
                  isSelected={lyricsOpen}
                  onClick={() => {
                    const next = !lyricsOpen;
                    setLyricsOpen(next);
                    if (next && !lyrics && ytEmbed) {
                      const sep = ytEmbed.title.indexOf(' — ');
                      if (sep !== -1) fetchLyrics(ytEmbed.title.slice(0, sep), ytEmbed.title.slice(sep + 3));
                    }
                  }}
                >
                  LYRICS
                </ActionButton>
                <ActionButton hotkey="⊞" onClick={() => setYtMini(false)}>EXPAND</ActionButton>
                <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
              </div>
            </div>
            {lyricsOpen && (
              <div className={styles.lyricsPanel}>
                <LyricsContent lyrics={lyrics} loading={lyricsLoading} selection={lyricSelection} onLineClick={lyrics?.plain ? handleLyricLineClick : undefined} />
                {lyricSelection && (
                  <div className={styles.lyricsExportRow}>
                    <button className={styles.lyricsExportBtn} onClick={handleLyricsExport}>
                      ↓ EXPORT {lyricSelection[1] - lyricSelection[0] + 1} LINE{lyricSelection[1] !== lyricSelection[0] ? 'S' : ''}
                    </button>
                    <button className={styles.lyricsExportBtn} onClick={() => { setLyricAnchor(null); setLyricSelection(null); }}>
                      ✕ CLEAR
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
        <div className={styles.sidebar}>
        {(() => {
          const activeIndex = lockedAlbumIndex ?? hoveredAlbumIndex;
          const activeAlbum = activeIndex !== null ? albums[activeIndex] : null;
          const activeMeta = activeIndex !== null ? albumMetas[activeIndex] ?? null : null;

          if (!activeAlbum) return (
            <Card title="MUSILOG.FM">
              <div className={styles.sidebarIntro}>
                <p>Enter your Last.fm username and pick a time period to see your top albums, artists, or songs.</p>
                <p>Hover an album to preview it. Click to lock the panel and see the full tracklist.</p>
              </div>
            </Card>
          );

          const idx = activeIndex!;
          const pixels = pixelArtCache[idx];

          return (
            <Card title="ALBUM INFO">
              <div className={styles.sidebarContent}>
                <div className={styles.albumHeader}>
                  {(activeAlbum.imageUrl || activeMeta?.artUrl) && (
                    <button
                      className={styles.albumThumb}
                      onClick={() => setImageView((v) => v === 'pixel' ? 'original' : 'pixel')}
                      title={imageView === 'pixel' ? 'Show original' : 'Show pixel art'}
                    >
                      {imageView === 'pixel' ? (
                        pixelLoading && !pixels
                          ? <div className={styles.thumbPlaceholder} />
                          : pixels
                          ? <div className={styles.pixelGrid}>{pixels.map((c, i) => <div key={i} className={styles.pixelCell} style={{ backgroundColor: c }} />)}</div>
                          : <div className={styles.thumbPlaceholder} />
                      ) : (
                        <img src={activeMeta?.artUrl ?? activeAlbum.imageUrl!} alt={activeAlbum.name} className={styles.thumbImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                    </button>
                  )}
                  <div className={styles.albumHeaderInfo}>
                    <div className={styles.albumTitle}>{formatName(activeAlbum.name)}</div>
                    <div className={styles.albumSubtitle}>{activeAlbum.artist}</div>
                  </div>
                </div>

                {sessionUsername && (() => {
                  const key = `${activeAlbum.artist}|||${activeAlbum.name}`;
                  const saved = listenLaterSet.has(key);
                  return (
                    <button
                      className={`${styles.listenLaterBtn}${saved ? ` ${styles.saved}` : ''}`}
                      onClick={() => {
                        if (saved) {
                          fetch('/api/listen-later', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: activeAlbum.artist, album: activeAlbum.name }) }).catch(() => {});
                          setListenLaterSet((prev) => { const next = new Set(prev); next.delete(key); return next; });
                        } else {
                          fetch('/api/listen-later', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: activeAlbum.artist, album: activeAlbum.name }) }).catch(() => {});
                          setListenLaterSet((prev) => new Set(prev).add(key));
                        }
                      }}
                    >
                      {saved ? '◆ SAVED' : '◇ LISTEN LATER'}
                    </button>
                  );
                })()}

                {albumMetasLoading && !activeMeta && <div className={styles.sidebarLoading}>LOADING...</div>}

                {activeMeta && (
                  <>
                    <div className={styles.statsRow}>
                      {activeMeta.releaseDate && (
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{activeMeta.releaseDate.slice(0, 4)}</span>
                          <span className={styles.statLabel}>◈</span>
                        </div>
                      )}
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatDuration(activeMeta.totalDuration)}</span>
                        <span className={styles.statLabel}>◷</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatCount(activeMeta.listeners)}</span>
                        <span className={styles.statLabel}>◉</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatCount(activeMeta.playcount)}</span>
                        <span className={styles.statLabel}>↺</span>
                      </div>
                    </div>

                    {activeMeta.tags.slice(0, 3).length > 0 && (
                      <div className={styles.tags}>
                        {activeMeta.tags.slice(0, 3).join(' · ')}
                      </div>
                    )}

                    {activeMeta.tracks.length > 0 && (
                      <div className={styles.tracklistSection}>
                        <button className={styles.tracklistToggle} onClick={() => setTracklistOpen((o) => !o)}>
                          {tracklistOpen ? '▼' : '▶'} TRACKLIST
                        </button>
                        {tracklistOpen && (() => {
                          const withPlays = activeMeta.tracks.filter((t) => t.playcount > 0);
                          const hotSet = new Set(
                            [...withPlays].sort((a, b) => b.playcount - a.playcount).slice(0, 3).map((t) => t.rank)
                          );
                          return (
                            <div className={styles.sidebarTracks}>
                              {activeMeta.tracks.map((t, tIdx) => (
                                <div key={t.rank} className={styles.sidebarTrack}>
                                  <span className={styles.sidebarTrackNum}>{t.rank}.</span>
                                  <span className={styles.sidebarTrackName}>{formatName(t.name)}</span>
                                  {hotSet.has(t.rank) && (
                                    <Tooltip content={`${t.playcount.toLocaleString()} plays`}>
                                      <span className={styles.hotDot} />
                                    </Tooltip>
                                  )}
                                  {t.duration > 0 && (
                                    <span className={styles.sidebarTrackDur}>
                                      {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
                                    </span>
                                  )}
                                  <TrackYtButton
                                    artist={activeAlbum.artist}
                                    track={t.name}
                                    onPlay={(videoId) => setYtEmbed({ videoId, title: `${activeAlbum.artist} — ${t.name}`, source: 'album', albumIdx: idx, trackIdx: tIdx })}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })()}
        </div>
      </div>

      </div>

      <DateRangeModal
        isOpen={isModalOpen}
        initialFrom={customDateRange?.from}
        initialTo={customDateRange?.to}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />
      </>}
    </main>
    </div>
  );
}
