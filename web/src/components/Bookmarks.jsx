import { useState, useRef, useCallback, useMemo } from 'react';
import { getServiceColorClass } from '../utils/service.js';
import './Bookmarks.css';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default function Bookmarks({
  bookmarks,
  recentAccesses = [],
  onSelectStation,
  onSelectJourney,
  onBack,
  onRemoveBookmark,
  onReorderBookmarks,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const listRef = useRef(null);

  // ── Pointer-based drag (works on both touch and mouse) ──
  const pointerState = useRef(null);

  const handleDragHandlePointerDown = useCallback((e, idx) => {
    // Only primary button / single touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const listEl = listRef.current;
    if (!listEl) return;

    const items = listEl.querySelectorAll('.bookmark-item');
    const rects = Array.from(items).map((el) => el.getBoundingClientRect());

    pointerState.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      fromIdx: idx,
      rects,
    };

    setDragIdx(idx);
    setOverIdx(idx);

    // Capture so we get move/up even outside the element
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    const ps = pointerState.current;
    if (!ps || e.pointerId !== ps.pointerId) return;

    const y = e.clientY;
    // Determine which slot the pointer is over
    let newOver = ps.fromIdx;
    for (let i = 0; i < ps.rects.length; i++) {
      const r = ps.rects[i];
      const midY = r.top + r.height / 2;
      if (y < midY) {
        newOver = i;
        break;
      }
      newOver = i;
    }
    setOverIdx(newOver);
  }, []);

  const handlePointerUp = useCallback((e) => {
    const ps = pointerState.current;
    if (!ps || e.pointerId !== ps.pointerId) return;

    const from = ps.fromIdx;
    pointerState.current = null;

    // Compute final drop index from current overIdx
    setOverIdx((currentOver) => {
      const to = currentOver ?? from;
      if (from !== to && onReorderBookmarks) {
        onReorderBookmarks(from, to);
      }
      return null;
    });
    setDragIdx(null);
  }, [onReorderBookmarks]);

  const handlePointerCancel = useCallback((e) => {
    const ps = pointerState.current;
    if (!ps || e.pointerId !== ps.pointerId) return;
    pointerState.current = null;
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // Build the display order for the visual preview
  const displayOrder = (() => {
    const ordered = bookmarks.map((b, i) => ({ ...b, _origIdx: i }));
    if (dragIdx != null && overIdx != null && dragIdx !== overIdx) {
      const item = ordered.splice(dragIdx, 1)[0];
      ordered.splice(overIdx, 0, item);
    }
    return ordered;
  })();

  // ── Compute filtered recent accesses ──
  const recentItems = useMemo(() => {
    const now = Date.now();
    const bookmarkIds = new Set(bookmarks.map((b) => b.id));

    return recentAccesses
      .filter((entry) => {
        // Exclude stations already shown as bookmarks
        if (entry.type === 'station' && bookmarkIds.has(entry.id)) return false;
        // Exclude journeys accessed more than 6 hours ago
        if (entry.type === 'journey') {
          const age = now - new Date(entry.accessedAt).getTime();
          if (age > SIX_HOURS_MS) return false;
        }
        return true;
      })
      // Already sorted by accessedAt (most recent first) from tracking
      .slice(0, 10);
  }, [recentAccesses, bookmarks]);

  return (
    <div
      className="bookmarks-page"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <header className="bookmarks-header">
        <button
          className="bookmarks-back-btn"
          onClick={onBack}
          aria-label="Go back"
          id="bookmarks-back-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="bookmarks-title">Bookmarks</h1>
      </header>

      <div className="bookmarks-scroll-area">
        {/* ── Bookmarked stations ── */}
        <div className="bookmarks-list" ref={listRef}>
          {bookmarks.length === 0 ? (
            <div className="bookmarks-empty">
              <span className="bookmarks-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="bookmarks-empty-text">No bookmarks yet</span>
              <span className="bookmarks-empty-hint">
                Add stations to bookmarks from the station board menu
              </span>
            </div>
          ) : (
            displayOrder.map((bookmark) => {
              const isDragging = dragIdx != null && bookmark._origIdx === dragIdx;
              return (
                <div
                  key={bookmark.id}
                  className={`bookmark-item${isDragging ? ' bookmark-dragging' : ''}`}
                  onClick={() => {
                    if (dragIdx == null) onSelectStation(bookmark);
                  }}
                  id={`bookmark-${bookmark.id}`}
                >
                  {/* Drag handle */}
                  <button
                    className="bookmark-drag-handle"
                    onPointerDown={(e) => handleDragHandlePointerDown(e, displayOrder.indexOf(bookmark))}
                    aria-label={`Reorder ${bookmark.name}`}
                    tabIndex={-1}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </button>

                  <div className="bookmark-item-content">
                    <svg className="bookmark-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="bookmark-item-name">{bookmark.name}</span>
                  </div>
                  <button
                    className="bookmark-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(bookmark.id);
                    }}
                    aria-label={`Remove ${bookmark.name} from bookmarks`}
                    id={`remove-bookmark-${bookmark.id}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Recently Accessed ── */}
        {recentItems.length > 0 && (
          <div className="recent-section">
            <h2 className="recent-section-title">
              <svg className="recent-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Recent
            </h2>
            <div className="recent-list">
              {recentItems.map((entry) => {
                if (entry.type === 'station') {
                  return (
                    <div
                      key={`recent-station-${entry.id}`}
                      className="recent-item"
                      onClick={() => onSelectStation(entry)}
                      id={`recent-station-${entry.id}`}
                    >
                      <div className="recent-item-content">
                        <svg className="recent-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="recent-item-name">{entry.name}</span>
                      </div>
                      <svg className="recent-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  );
                }

                // Journey entry
                const destName = entry.journey?.destination?.name || '';
                return (
                  <div
                    key={`recent-journey-${entry.journey.journeyRef}-${entry.journey.operatingDayRef}`}
                    className="recent-item recent-item-journey"
                    onClick={() => onSelectJourney(entry)}
                    id={`recent-journey-${entry.journey.journeyRef}`}
                  >
                    <div className="recent-item-content">
                      <span className={`recent-journey-badge ${getServiceColorClass(entry.journey.name)}`}>
                        {entry.journey.name}
                      </span>
                      <span className="recent-item-name">
                        <span className="recent-journey-arrow">→</span>
                        {destName}
                      </span>
                    </div>
                    <svg className="recent-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
