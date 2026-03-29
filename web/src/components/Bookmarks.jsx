import './Bookmarks.css';

export default function Bookmarks({ bookmarks, onSelectStation, onBack, onRemoveBookmark }) {
  return (
    <div className="bookmarks-page">
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

      <div className="bookmarks-list">
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
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="bookmark-item"
              onClick={() => onSelectStation(bookmark)}
              id={`bookmark-${bookmark.id}`}
            >
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
          ))
        )}
      </div>
    </div>
  );
}
