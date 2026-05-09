'use client';

import styles from '@components/RankMode.module.css';
import * as React from 'react';
import Card from '@components/Card';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
import ThemeDropdown from '@components/ThemeDropdown';
import YoutubePlayer, { YoutubePlayerActions } from '@components/YoutubePlayer';
import { formatName } from '@/lib/formatName';
import ASCII_BANNER from '@/lib/ascii';

// ── Types ──────────────────────────────────────────────────────────────────

type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
type TierKey = Tier | 'unranked';
type ViewMode = 'inline' | 'classic';

interface TierConfig { id: Tier; color: string; }
const TIERS: TierConfig[] = [
  { id: 'S', color: '#e05252' },
  { id: 'A', color: '#d97c3a' },
  { id: 'B', color: '#c9a227' },
  { id: 'C', color: '#4a9e6b' },
  { id: 'D', color: '#4a80c4' },
  { id: 'F', color: '#7a7a9a' },
];

const VIEW_MODES = [
  { id: 'inline',  label: 'INLINE'  },
  { id: 'classic', label: 'CLASSIC' },
];

interface AlbumTrack { rank: number; name: string; duration: number; playcount: number; }
interface AlbumMeta {
  artUrl: string | null; releaseDate: string | null; tracks: AlbumTrack[];
  totalDuration: number; listeners: number; playcount: number; tags: string[];
}
interface SearchAlbum { name: string; artist: string; imageUrl: string | null; mbid: string | null; }
type TierTrack = { name: string; duration: number };
type TierState = Record<TierKey, TierTrack[]>;
interface DropTarget { tier: TierKey; index: number; }

const emptyTiers = (): TierState => ({ S: [], A: [], B: [], C: [], D: [], F: [], unranked: [] });

function formatDuration(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtDur(s: number): string {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Sidebar play button ────────────────────────────────────────────────────

function SidebarPlayBtn({ artist, track, onPlay }: { artist: string; track: string; onPlay: (videoId: string) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [videoId, setVideoId] = React.useState<string | null>(null);
  const handleClick = async () => {
    if (videoId) { onPlay(videoId); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      const data = await res.json();
      if (data.videoId) { setVideoId(data.videoId); onPlay(data.videoId); }
    } finally { setLoading(false); }
  };
  return (
    <button className={styles.ytBtn} onClick={handleClick} disabled={loading} title="Play on YouTube">
      {loading ? '...' : '▶'}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RankMode() {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchAlbum[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedAlbum, setSelectedAlbum] = React.useState<SearchAlbum | null>(null);
  const [albumMeta, setAlbumMeta] = React.useState<AlbumMeta | null>(null);
  const [tiers, setTiers] = React.useState<TierState>(emptyTiers());
  const [loadingTracks, setLoadingTracks] = React.useState(false);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>('inline');
  const [ytEmbed, setYtEmbed] = React.useState<{ videoId: string; title: string; trackIdx: number } | null>(null);
  const [ytPlaying, setYtPlaying] = React.useState(false);
  const ytPlayerActionsRef = React.useRef<YoutubePlayerActions | null>(null);
  const dragSrcRef = React.useRef<{ tier: TierKey; index: number } | null>(null);
  const tierListRef = React.useRef<HTMLDivElement>(null);

  const hasResults = results.length > 0 || !!selectedAlbum;

  // ── Data fetching ─────────────────────────────────────────────────────────

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSelectedAlbum(null); setAlbumMeta(null); setTiers(emptyTiers()); setYtEmbed(null);
    try {
      const res = await fetch(`/api/album-search?q=${encodeURIComponent(query.trim())}`);
      setResults((await res.json()).albums ?? []);
    } finally { setSearching(false); }
  };

  const handleSelectAlbum = async (album: SearchAlbum) => {
    setSelectedAlbum(album); setResults([]); setAlbumMeta(null);
    setTiers(emptyTiers()); setYtEmbed(null); setLoadingTracks(true);
    try {
      const res = await fetch(`/api/album-info?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.name)}`);
      const data: AlbumMeta = await res.json();
      setAlbumMeta(data);
      setTiers((prev) => ({ ...prev, unranked: data.tracks.map((t) => ({ name: t.name, duration: t.duration })) }));
    } finally { setLoadingTracks(false); }
  };

  const handleBack = () => {
    setSelectedAlbum(null); setAlbumMeta(null); setTiers(emptyTiers());
    setResults([]); setYtEmbed(null);
  };

  // ── YouTube ───────────────────────────────────────────────────────────────

  const handlePlay = (videoId: string, trackName: string, trackIdx: number) =>
    setYtEmbed({ videoId, title: `${selectedAlbum?.artist} — ${trackName}`, trackIdx });

  const handleYtNavigate = (trackIdx: number) => {
    if (!albumMeta || !selectedAlbum) return;
    const t = albumMeta.tracks[trackIdx];
    if (!t) return;
    fetch(`/api/yt-link?artist=${encodeURIComponent(selectedAlbum.artist)}&track=${encodeURIComponent(t.name)}`)
      .then((r) => r.json())
      .then((data) => { if (data.videoId) setYtEmbed({ videoId: data.videoId, title: `${selectedAlbum.artist} — ${t.name}`, trackIdx }); });
  };

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleDragStart = (tier: TierKey, index: number) => { dragSrcRef.current = { tier, index }; };

  const handleDragOver = (e: React.DragEvent, tier: TierKey, index: number) => {
    e.preventDefault(); e.stopPropagation();
    setDropTarget({ tier, index });
  };

  const handleDragOverRow = (e: React.DragEvent, tier: TierKey) => {
    e.preventDefault();
    setDropTarget({ tier, index: tiers[tier].length });
  };

  const move = (toTier: TierKey, toIndex: number) => {
    const src = dragSrcRef.current;
    if (!src) return;
    setTiers((prev) => {
      const srcList = [...prev[src.tier]];
      const [item] = srcList.splice(src.index, 1);
      const tgtList = src.tier === toTier ? srcList : [...prev[toTier]];
      const pos = src.tier === toTier && src.index < toIndex ? toIndex - 1 : toIndex;
      tgtList.splice(pos, 0, item);
      if (src.tier === toTier) return { ...prev, [toTier]: tgtList };
      return { ...prev, [src.tier]: srcList, [toTier]: tgtList };
    });
    dragSrcRef.current = null;
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, tier: TierKey, index: number) => { e.preventDefault(); e.stopPropagation(); move(tier, index); };
  const handleDropRow = (e: React.DragEvent, tier: TierKey) => { e.preventDefault(); move(tier, tiers[tier].length); };
  const handleDragEnd = () => { dragSrcRef.current = null; setDropTarget(null); };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!tierListRef.current || !selectedAlbum) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const bodyStyle = getComputedStyle(document.body);
      const bgColor = bodyStyle.getPropertyValue('--theme-background').trim() || '#ffffff';
      const textColor = bodyStyle.getPropertyValue('--theme-text').trim() || '#000000';
      const overlayColor = bodyStyle.getPropertyValue('--theme-overlay').trim() || '#888888';
      const elStyle = getComputedStyle(tierListRef.current);
      const fontFamily = elStyle.fontFamily, basePx = parseFloat(elStyle.fontSize);
      const listCanvas = await html2canvas(tierListRef.current, { backgroundColor: bgColor, scale: 2, useCORS: true, logging: false });

      const scale = 2, pad = 24 * scale, gap = 16 * scale;
      const asciiFontPx = basePx * 0.5 * scale, asciiLineH = asciiFontPx * 1.2;
      const asciiLines = ASCII_BANNER.split('\n'), asciiBlockH = asciiLines.length * asciiLineH;
      const footerFontPx = basePx * scale;
      const artSize = Math.round(basePx * 4 * scale);

      // Try to load art image via proxy to avoid CORS issues with Last.fm CDN
      const artSrc = albumMeta?.artUrl ?? selectedAlbum.imageUrl ?? null;
      let artImg: HTMLImageElement | null = null;
      if (artSrc) {
        try {
          artImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `/api/proxy-image?url=${encodeURIComponent(artSrc)}`;
          });
        } catch {}
      }

      // Measure ASCII block width so we can right-align it
      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d')!;
      mCtx.font = `${asciiFontPx}px ${fontFamily}`;
      const asciiW = Math.max(...asciiLines.map((l) => mCtx.measureText(l).width));

      const headerH = Math.max(asciiBlockH, artImg ? artSize : 0);
      const W = listCanvas.width + pad * 2;
      const H = pad + headerH + gap + listCanvas.height + gap + footerFontPx * 1.5 + pad;
      const out = document.createElement('canvas');
      out.width = W; out.height = H;
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);

      // ASCII banner — right side of header
      ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = textColor;
      ctx.font = `${asciiFontPx}px ${fontFamily}`; ctx.textBaseline = 'top';
      const asciiX = W - pad - asciiW;
      asciiLines.forEach((line, i) => ctx.fillText(line, asciiX, pad + i * asciiLineH));
      ctx.restore();

      // Album art + info — left side of header
      if (artImg) ctx.drawImage(artImg, pad, pad, artSize, artSize);
      const textX = pad + (artImg ? artSize + gap : 0);
      const nameFontPx = basePx * 1.1 * scale;
      const metaFontPx = basePx * 0.9 * scale;
      const year = albumMeta?.releaseDate?.slice(0, 4) ?? null;
      ctx.save();
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      ctx.font = `${nameFontPx}px ${fontFamily}`;
      ctx.fillText(selectedAlbum.name.toUpperCase(), textX, pad);
      ctx.fillStyle = overlayColor;
      ctx.font = `${metaFontPx}px ${fontFamily}`;
      ctx.fillText([selectedAlbum.artist, year].filter(Boolean).join(' · '), textX, pad + nameFontPx * 1.5);
      ctx.restore();

      // Tier list
      const y = pad + headerH + gap;
      ctx.drawImage(listCanvas, pad, y);

      // Footer
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = overlayColor;
      ctx.font = `${footerFontPx}px ${fontFamily}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
      ctx.fillText('ranked with musilog.me', W - pad, y + listCanvas.height + gap + footerFontPx);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `musilog-tierlist-${selectedAlbum.artist}-${selectedAlbum.name}.png`.replace(/[^a-z0-9-_.]/gi, '-');
      link.href = out.toDataURL('image/png');
      link.click();
    } finally { setExporting(false); }
  };

  // ── View renderers ────────────────────────────────────────────────────────

  const playingTrackName = albumMeta?.tracks[ytEmbed?.trackIdx ?? -1]?.name ?? null;
  const isPlaying = (name: string) => !exporting && playingTrackName === name;

  const handleRankedDoubleClick = async (trackName: string) => {
    if (!selectedAlbum) return;
    const trackIdx = albumMeta?.tracks.findIndex((t) => t.name === trackName) ?? 0;
    const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(selectedAlbum.artist)}&track=${encodeURIComponent(trackName)}`);
    const data = await res.json();
    if (data.videoId) handlePlay(data.videoId, trackName, trackIdx);
  };

  const chipProps = (tier: TierKey, i: number) => ({
    draggable: true as const,
    onDragStart: () => handleDragStart(tier, i),
    onDragOver: (e: React.DragEvent) => handleDragOver(e, tier, i),
    onDrop: (e: React.DragEvent) => handleDrop(e, tier, i),
    onDragEnd: handleDragEnd,
  });

  const isDropBefore = (tier: TierKey, i: number) => dropTarget?.tier === tier && dropTarget.index === i;
  const isDropAfterAll = (tier: TierKey) => dropTarget?.tier === tier && dropTarget.index >= tiers[tier].length;

  // Mode 1 — Inline: [S] — track · track · track
  const renderInline = () => (
    <div className={styles.inlineGrid}>
      {TIERS.map(({ id, color }, rowIdx) => {
        const items = tiers[id];
        return (
          <div key={id} className={`${styles.inlineRow} ${styles.animateTierRow}`}
            style={{ '--row-index': rowIdx } as React.CSSProperties}
            onDragOver={(e) => handleDragOverRow(e, id)}
            onDrop={(e) => handleDropRow(e, id)}
          >
            <span className={styles.inlineLabel} style={{ color }}>[{id}]</span>
            <span className={styles.inlineDash}>—</span>
            <span className={styles.inlineZone}>
              {items.flatMap((t, i) => [
                isDropBefore(id, i) ? <span key={`ind-${i}`} className={styles.inlineCursor}>▎</span> : null,
                <span key={i} className={[styles.inlineChip, isPlaying(t.name) ? styles.chipPlaying : undefined].filter(Boolean).join(' ')}
                  {...chipProps(id, i)} onDoubleClick={() => handleRankedDoubleClick(t.name)}>{t.name}</span>,
                i < items.length - 1 ? <span key={`sep-${i}`} className={styles.inlineSep}> · </span> : null,
              ]).filter(Boolean)}
              {isDropAfterAll(id) && <span className={styles.inlineCursor}>▎</span>}
            </span>
          </div>
        );
      })}
    </div>
  );

  // Mode 2 — Classic: colored label block + chip boxes in a zone
  const renderClassic = () => (
    <div className={styles.classicGrid}>
      {TIERS.map(({ id, color }, rowIdx) => {
        const items = tiers[id];
        return (
          <div key={id} className={`${styles.classicRow} ${styles.animateTierRow}`}
            style={{ '--row-index': rowIdx } as React.CSSProperties}
            onDragOver={(e) => handleDragOverRow(e, id)}
            onDrop={(e) => handleDropRow(e, id)}
          >
            <div className={styles.classicLabel} style={{ background: color }}>{id}</div>
            <div className={styles.classicZone}>
              {items.flatMap((t, i) => [
                isDropBefore(id, i) ? <div key={`ind-${i}`} className={styles.dropLine} /> : null,
                <div key={i} className={[styles.chip, isPlaying(t.name) ? styles.chipPlaying : undefined].filter(Boolean).join(' ')}
                  {...chipProps(id, i)} onDoubleClick={() => handleRankedDoubleClick(t.name)}>{formatName(t.name)}</div>,
              ]).filter(Boolean)}
              {isDropAfterAll(id) && <div className={styles.dropLine} />}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Unranked pool (shared across all modes) ───────────────────────────────

  const handleUnrankedDoubleClick = async (trackName: string) => {
    if (!selectedAlbum) return;
    const trackIdx = albumMeta?.tracks.findIndex((t) => t.name === trackName) ?? 0;
    const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(selectedAlbum.artist)}&track=${encodeURIComponent(trackName)}`);
    const data = await res.json();
    if (data.videoId) handlePlay(data.videoId, trackName, trackIdx);
  };

  const renderUnranked = () => {
    if (tiers.unranked.length === 0) return null;
    return (
      <div className={styles.unrankedPool}
        onDragOver={(e) => handleDragOverRow(e, 'unranked')}
        onDrop={(e) => handleDropRow(e, 'unranked')}
      >
        <div className={styles.unrankedLabel}>UNRANKED — double-click to listen</div>
        <div className={styles.unrankedZone}>
          {tiers.unranked.flatMap((t, i) => [
            isDropBefore('unranked', i) ? <div key={`ind-${i}`} className={styles.dropLine} /> : null,
            <div key={t.name}
              className={[styles.chip, isPlaying(t.name) ? styles.chipPlaying : undefined].filter(Boolean).join(' ')}
              {...chipProps('unranked', i)}
              onDoubleClick={() => handleUnrankedDoubleClick(t.name)}
              title="Double-click to listen"
            >
              {formatName(t.name)}
            </div>,
          ]).filter(Boolean)}
          {isDropAfterAll('unranked') && <div className={styles.dropLine} />}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const artUrl = albumMeta?.artUrl ?? selectedAlbum?.imageUrl ?? null;

  return (
    <>
      <div className={styles.banner}>
        <Card title="RANK MODE">
          <div className={styles.bannerInner}>
            <form className={styles.bannerForm} onSubmit={handleSearch}>
              <Input label="ALBUM" placeholder="Search for an album..." value={query} onChange={(e) => setQuery(e.target.value)} isBlink />
              <ActionButton onClick={() => handleSearch()}>{searching ? '...' : 'SEARCH'}</ActionButton>
            </form>
            <pre className={styles.bannerPre}>{ASCII_BANNER}</pre>
          </div>
        </Card>
      </div>

      {hasResults && (
        <div className={selectedAlbum ? styles.pageRow : styles.container}>
          <div className={styles.container}>

            {results.length > 0 && (
              <Card title="SEARCH RESULTS">
                <div className={styles.resultsList}>
                  {results.map((album, i) => (
                    <div key={i} className={styles.resultItem} onClick={() => handleSelectAlbum(album)} tabIndex={0} role="button"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectAlbum(album); }}>
                      {album.imageUrl && <img src={album.imageUrl} alt="" className={styles.resultThumb} />}
                      <div className={styles.resultInfo}>
                        <div className={styles.resultName}>{album.name}</div>
                        <div className={styles.resultArtist}>{album.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {selectedAlbum && (
              <>
                <div className={styles.toolbar}>
                  <ActionButton onClick={handleBack}>← BACK</ActionButton>
                  <ThemeDropdown
                    label={VIEW_MODES.find((v) => v.id === viewMode)?.label ?? 'INLINE'}
                    items={VIEW_MODES}
                    currentId={viewMode}
                    onSelect={(id) => setViewMode(id as ViewMode)}
                  />
                  <div className={styles.toolbarRight}>
                    <button className={styles.exportBtn} onClick={handleExport} disabled={exporting || loadingTracks}>
                      {exporting ? '...' : '↓ EXPORT'}
                    </button>
                  </div>
                </div>

                {loadingTracks && <div className={styles.loading}>LOADING...</div>}

                {!loadingTracks && (
                  <div ref={tierListRef}>
                    <Card title={`${selectedAlbum.name.toUpperCase()} — ${selectedAlbum.artist.toUpperCase()}`}>
                      {viewMode === 'inline'   && renderInline()}
                      {viewMode === 'classic'  && renderClassic()}
                      {renderUnranked()}
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedAlbum && (
            <div className={styles.sidebarCol}>
              <Card title="ALBUM INFO">
                {ytEmbed && (
                  <>
                    <div className={styles.ytEmbedWrapper}>
                      <YoutubePlayer videoId={ytEmbed.videoId} onPlayingChange={setYtPlaying}
                        onPlayerReady={(a) => { ytPlayerActionsRef.current = a; }}
                        onEnded={() => { if (albumMeta && ytEmbed.trackIdx < albumMeta.tracks.length - 1) handleYtNavigate(ytEmbed.trackIdx + 1); }}
                      />
                    </div>
                    <div className={styles.ytControls}>
                      <div className={styles.ytNavButtons}>
                        {ytEmbed.trackIdx > 0 && <ActionButton hotkey="←" onClick={() => handleYtNavigate(ytEmbed.trackIdx - 1)}>PREV</ActionButton>}
                        {albumMeta?.tracks[ytEmbed.trackIdx + 1] && <ActionButton hotkey="→" onClick={() => handleYtNavigate(ytEmbed.trackIdx + 1)}>NEXT</ActionButton>}
                      </div>
                      <div className={styles.ytNavButtons}>
                        <ActionButton onClick={() => ytPlaying ? ytPlayerActionsRef.current?.pause() : ytPlayerActionsRef.current?.play()}>
                          {ytPlaying ? 'PAUSE' : 'PLAY'}
                        </ActionButton>
                        <ActionButton onClick={() => setYtEmbed(null)}>STOP</ActionButton>
                      </div>
                    </div>
                  </>
                )}
                <div className={styles.sidebarContent}>
                  <div className={styles.albumHeader}>
                    {artUrl && (
                      <div className={styles.albumThumb}>
                        <img src={artUrl} alt={selectedAlbum.name} className={styles.thumbImg}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                    <div className={styles.albumHeaderInfo}>
                      <div className={styles.albumTitle}>{formatName(selectedAlbum.name)}</div>
                      <div className={styles.albumSubtitle}>{selectedAlbum.artist}</div>
                    </div>
                  </div>
                  {loadingTracks && <div className={styles.sidebarLoading}>LOADING...</div>}
                  {albumMeta && (
                    <>
                      <div className={styles.statsRow}>
                        {albumMeta.releaseDate && (
                          <div className={styles.statItem}>
                            <span>{albumMeta.releaseDate.slice(0, 4)}</span>
                            <span className={styles.statLabel}>◈</span>
                          </div>
                        )}
                        <div className={styles.statItem}>
                          <span>{formatDuration(albumMeta.totalDuration)}</span>
                          <span className={styles.statLabel}>◷</span>
                        </div>
                        <div className={styles.statItem}>
                          <span>{formatCount(albumMeta.listeners)}</span>
                          <span className={styles.statLabel}>◉</span>
                        </div>
                        <div className={styles.statItem}>
                          <span>{formatCount(albumMeta.playcount)}</span>
                          <span className={styles.statLabel}>↺</span>
                        </div>
                      </div>
                      {albumMeta.tags.slice(0, 3).length > 0 && (
                        <div className={styles.tags}>{albumMeta.tags.slice(0, 3).join(' · ')}</div>
                      )}
                      {albumMeta.tracks.length > 0 && (
                        <div className={styles.sidebarTracks}>
                          {albumMeta.tracks.map((t, tIdx) => (
                            <div key={t.rank} className={styles.sidebarTrack}>
                              <span className={styles.sidebarTrackNum}>{t.rank}.</span>
                              <span className={styles.sidebarTrackName}>{formatName(t.name)}</span>
                              {t.duration > 0 && <span className={styles.sidebarTrackDur}>{fmtDur(t.duration)}</span>}
                              <SidebarPlayBtn artist={selectedAlbum.artist} track={t.name}
                                onPlay={(videoId) => handlePlay(videoId, t.name, tIdx)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
