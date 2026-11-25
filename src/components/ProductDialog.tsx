import { useRef, useState } from 'react';
import type { Product } from '../domain/types';
import { ErrorText, Field, Modal, NumberInput, Spinner } from './ui';

export const emptyProduct = (reorderLevel = 5): Product => ({
  id: crypto.randomUUID(),
  name: '',
  topic: '',
  salesDescription: '',
  sku: '',
  salePrice: 0,
  trackInventory: true,
  quantityOnHand: 0,
  reorderLevel,
  updatedAt: new Date().toISOString(),
});

export function ProductDialog({
  value,
  onChange,
  onClose,
  onSave,
  title = 'New Product',
  submitLabel = 'Save Product',
}: {
  value: Product;
  onChange: (value: Product) => void;
  onClose: () => void;
  onSave: (value: Product) => Promise<void>;
  title?: string;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!value.name.trim()) {
      setError('Enter a product name.');
      return;
    }
    if (
      ![value.salePrice, value.quantityOnHand, value.reorderLevel].every(
        (number) => Number.isFinite(number) && number >= 0,
      )
    ) {
      setError('Prices and stock levels must be zero or higher.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...value,
        name: value.name.trim(),
        topic: value.topic.trim(),
        sku: value.sku.trim(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      subtitle="Catalog details flow into quotation line items."
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <form onSubmit={(event) => void save(event)} noValidate>
        <fieldset disabled={busy} className="product-dialog-fields">
          <div className="modal-body">
            <Field label="Product Or Service Name *">
              <input
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                maxLength={150}
              />
            </Field>
            <div className="form-grid">
              <Field label="Topic / Category">
                <input
                  value={value.topic}
                  onChange={(e) => onChange({ ...value, topic: e.target.value })}
                  placeholder="Office equipment"
                  maxLength={80}
                />
              </Field>
              <Field label="SKU / Item Code">
                <input
                  value={value.sku}
                  onChange={(e) => onChange({ ...value, sku: e.target.value })}
                  maxLength={80}
                />
              </Field>
            </div>
            <Field label="Sales Short Description">
              <textarea
                rows={3}
                value={value.salesDescription}
                onChange={(e) => onChange({ ...value, salesDescription: e.target.value })}
                maxLength={800}
              />
            </Field>
            <div className="form-grid">
              <Field label="Sales Price · NPR">
                <NumberInput
                  min="0"
                  step="0.01"
                  value={value.salePrice}
                  onValueChange={(salePrice) => onChange({ ...value, salePrice })}
                />
              </Field>
              <Field label="Reorder At">
                <NumberInput
                  min="0"
                  step="1"
                  value={value.reorderLevel}
                  onValueChange={(reorderLevel) => onChange({ ...value, reorderLevel })}
                />
              </Field>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={value.trackInventory}
                onChange={(e) => onChange({ ...value, trackInventory: e.target.checked })}
              />
              <span>Track Inventory Quantity</span>
            </label>
            {value.trackInventory && (
              <Field label="Quantity On Hand">
                <NumberInput
                  min="0"
                  step="1"
                  value={value.quantityOnHand}
                  onValueChange={(quantityOnHand) => onChange({ ...value, quantityOnHand })}
                />
              </Field>
            )}
            <ErrorText>{error}</ErrorText>
          </div>
        </fieldset>
        <div className="modal-actions">
          <button className="button" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy && <Spinner />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
