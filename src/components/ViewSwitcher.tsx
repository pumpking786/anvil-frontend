import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
export type CollectionView = 'list' | 'tiles';
export function useCollectionView(collection: string) {
  const key = `patra-view:${collection}`;
  const [view, update] = useState<CollectionView>(() => {
    try {
      return localStorage.getItem(key) === 'list' ? 'list' : 'tiles';
    } catch {
      return 'tiles';
    }
  });
  const setView = (value: CollectionView) => {
    update(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Optional display preference. */
    }
  };
  return [view, setView] as const;
}
export function ViewSwitcher({
  value,
  onChange,
  label,
}: {
  value: CollectionView;
  onChange: (value: CollectionView) => void;
  label: string;
}) {
  return (
    <div className="view-switcher" role="group" aria-label={label}>
      <button
        type="button"
        aria-pressed={value === 'list'}
        title="List View"
        onClick={() => onChange('list')}
      >
        <List size={17} />
        <span>List</span>
      </button>
      <button
        type="button"
        aria-pressed={value === 'tiles'}
        title="Tile View"
        onClick={() => onChange('tiles')}
      >
        <LayoutGrid size={17} />
        <span>Tiles</span>
      </button>
    </div>
  );
}
