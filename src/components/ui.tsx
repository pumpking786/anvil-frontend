import { ThemeLogo } from './ThemeLogo';
import {
  useEffect,
  useId,
  useRef,
  useState,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type InputHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { readImage } from '../lib/images';
export function Mark({ small = false, style }: { small?: boolean; style?: React.CSSProperties }) {
  return (
    <span className={`mark ${small ? 'small' : ''}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path
          d="M5.5 26 13.4 6h5.2l7.9 20h-5.2l-1.5-4.4h-7.6L10.7 26zm8.3-8.5h4.5L16 10.7z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
export function BrandLogo({
  src,
  small = false,
  style,
}: {
  src?: string;
  small?: boolean;
  style?: React.CSSProperties;
}) {
  return src ? (
    <ThemeLogo
      className={`brand-logo ${small ? 'small' : ''}`}
      style={style}
      src={src}
      alt=""
      fetchPriority="high"
    />
  ) : (
    <Mark small={small} style={style} />
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={17} aria-label="Loading" />;
}
export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? (
    <span className="field-error" role="alert">
      <AlertCircle size={13} />
      {children}
    </span>
  ) : null;
}

// Keep partially entered numbers editable; normalize only when the user leaves the field.
export function NumberInput({
  value,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (!focused) setDraft(Number.isFinite(value) ? String(value) : '');
  }, [focused, value]);
  return (
    <input
      {...props}
      type="number"
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onValueChange(event.target.validity.badInput ? NaN : Number(event.target.value));
      }}
    />
  );
}
export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node;
      const element = node as ReactElement<Record<string, unknown>>;
      if (
        ['input', 'textarea', 'select'].includes(element.type as string) ||
        element.type === NumberInput
      )
        return cloneElement(element, {
          id,
          'aria-invalid': !!error,
          'aria-describedby':
            [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
        });
      return element.props.children
        ? cloneElement(element, { children: associate(element.props.children as ReactNode) })
        : element;
    });
  }
  return (
    <div className={`field ${className} ${error ? 'invalid' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {associate(children)}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`}>
          <ErrorText>{error}</ErrorText>
        </span>
      )}
    </div>
  );
}
const modalStack: HTMLDivElement[] = [];
let originalBodyOverflow = '';
let originalRootInert = false;
function updateModalFocus() {
  modalStack.forEach((box, index) => {
    box.inert = index !== modalStack.length - 1;
  });
  const root = document.getElementById('root');
  if (root) root.inert = modalStack.length > 0 || originalRootInert;
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  className = '',
  backdropClassName = '',
  closeLabel = 'Close Dialog',
  style,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  closeLabel?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = returnFocus.current;
    const box = ref.current!;
    if (!modalStack.length) {
      originalBodyOverflow = document.body.style.overflow;
      originalRootInert = document.getElementById('root')?.inert || false;
    }
    modalStack.push(box);
    updateModalFocus();
    const focusables = () =>
      Array.from(
        box.querySelectorAll<HTMLElement>(
          'summary, button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          !element.matches('.sr-only, [type="hidden"], [tabindex="-1"]') &&
          element.getClientRects().length > 0,
      );
    if (!box.contains(document.activeElement)) {
      const available = focusables();
      (available.find((element) => element.dataset.autofocus === 'true') || available[0])?.focus();
    }
    const handler = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== box) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const items = focusables();
        const first = items[0],
          last = items.at(-1);
        if (!box.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      const wasTop = modalStack.at(-1) === box;
      const index = modalStack.indexOf(box);
      if (index >= 0) modalStack.splice(index, 1);
      updateModalFocus();
      if (!modalStack.length) document.body.style.overflow = originalBodyOverflow;
      if (wasTop && previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className={`modal-backdrop ${backdropClassName}`}>
      <div
        className={`modal ${className}`}
        style={style}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function ImageUpload({
  label,
  value,
  onChange,
  round = false,
  previewStyle,
  maxDimension = round ? 1600 : 1000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  round?: boolean;
  previewStyle?: React.CSSProperties;
  maxDimension?: number;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="image-upload">
      <div className={`upload-preview ${round ? 'round' : ''}`} style={previewStyle}>
        {value ? (
          <img
            src={value}
            alt={label}
            style={
              previewStyle
                ? { objectFit: previewStyle.objectFit, objectPosition: previewStyle.objectPosition }
                : undefined
            }
          />
        ) : (
          <ImagePlus size={24} strokeWidth={1.3} />
        )}
      </div>
      <div>
        <strong>{label}</strong>
        <div className="upload-buttons">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? 'Processing…' : value ? 'Change Image' : 'Upload Image'}
          </button>
          {value && (
            <button type="button" className="text-button muted" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        <span className="field-hint">PNG, JPG or WebP · Up to 5 MB</span>
        <ErrorText>{error}</ErrorText>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Upload ${label}`}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError('');
          try {
            onChange(await readImage(file, maxDimension, round));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
export function Avatar({
  name,
  photo,
  size = '',
}: {
  name: string;
  photo?: string;
  size?: string;
}) {
  const [failedPhoto, setFailedPhoto] = useState('');
  return (
    <span className={`avatar ${size}`}>
      {photo && photo !== failedPhoto ? (
        <img src={photo} alt="" decoding="async" onError={() => setFailedPhoto(photo)} />
      ) : (
        name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0])
          .join('')
          .toUpperCase() || 'P'
      )}
    </span>
  );
}
export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <Check size={17} />
      {message}
    </div>
  );
}
