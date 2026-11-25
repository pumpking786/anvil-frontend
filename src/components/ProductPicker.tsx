import { useId, useMemo, useState, type CSSProperties } from 'react';
import { Package, Check, Plus } from 'lucide-react';
import type { Product } from '../domain/types';
import { searchProducts } from '../domain/products';
import { money } from '../domain/quotation';
import { AutoTextarea } from './AutoTextarea';

export function ProductPicker({
  products,
  value,
  onChange,
  onSelect,
  onCreate,
  label,
  style,
  maxLength,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  onCreate?: (name: string) => void;
  label: string;
  style?: CSSProperties;
  maxLength: number;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const matches = useMemo(() => searchProducts(products, query), [products, query]);
  const visible = matches.slice(0, 30);
  function choose(product: Product) {
    onSelect(product);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="product-picker inline-product-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <AutoTextarea
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? `${id}-results` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[active] ? `${id}-option-${active}` : undefined}
        aria-describedby={open ? `${id}-help` : undefined}
        className="line-product-title"
        rows={1}
        style={style}
        value={value}
        maxLength={maxLength}
        placeholder="Product / service title"
        autoComplete="off"
        onFocus={() => {
          setQuery('');
          setActive(-1);
          setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setQuery('');
            setActive(-1);
            setOpen(true);
          }
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(open ? i + 1 : 0, visible.length - 1));
          }
          if (event.key === 'ArrowUp' && open) {
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (open && active >= 0 && visible[active]) choose(visible[active]);
            else setOpen(false);
          }
        }}
      />
      {open && (
        <div className="product-search-results">
          <div className="product-search-caption" id={`${id}-help`}>
            <span>
              {products.length
                ? 'Choose from inventory or type your own title'
                : 'No inventory yet — type a custom product or service'}
            </span>
          </div>
          <div role="listbox" id={`${id}-results`} aria-label="Inventory Products">
            {visible.map((product, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={active === index}
                id={`${id}-option-${index}`}
                key={product.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(product)}
                ref={(element) => {
                  if (element && active === index && open) {
                    const parent = element.parentElement!;
                    if (element.offsetTop < parent.scrollTop) parent.scrollTop = element.offsetTop;
                    else if (
                      element.offsetTop + element.offsetHeight >
                      parent.scrollTop + parent.clientHeight
                    )
                      parent.scrollTop =
                        element.offsetTop + element.offsetHeight - parent.clientHeight;
                  }
                }}
              >
                <Package size={17} />
                <span className="product-result-copy">
                  <strong>{product.name}</strong>
                  <span>
                    {[product.sku, product.topic].filter(Boolean).join(' · ') ||
                      'Product / Service'}
                  </span>
                  {product.salesDescription && <small>{product.salesDescription}</small>}
                  <small
                    className={
                      product.trackInventory && product.quantityOnHand <= 0
                        ? 'stock-unavailable'
                        : ''
                    }
                  >
                    {product.trackInventory
                      ? `${product.quantityOnHand} in stock`
                      : 'Service · stock not tracked'}
                  </small>
                </span>
                <span className="product-result-price">
                  NPR {money(product.salePrice)}
                  {active === index && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
          {!visible.length && products.length > 0 && (
            <p>No matching products. Continue typing to use a custom item.</p>
          )}
          {onCreate && (
            <button
              type="button"
              className="product-create-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                onCreate(value.trim());
              }}
            >
              <Plus size={16} /> Create Product{value.trim() ? ` “${value.trim()}”` : ''}
            </button>
          )}
          {matches.length > 30 && (
            <p>Showing 30 products. Type a name, SKU or category to narrow the list.</p>
          )}
        </div>
      )}
    </div>
  );
}
