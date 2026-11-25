import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { Avatar } from './ui';
import type { WorkspaceUser } from '../domain/types';

export function AccountMenu({
  user,
  placement,
  open,
  onOpen,
  onClose,
  onProfile,
  onSettings,
  onLogout,
  onSwitchWorkspace,
  workspaceSwitchDisabled = false,
  settingsDisabled = false,
}: {
  user: WorkspaceUser;
  placement: 'header' | 'sidebar';
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onSwitchWorkspace?: () => void;
  workspaceSwitchDisabled?: boolean;
  settingsDisabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const [present, setPresent] = useState(open);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    direction: 'up' | 'down';
  }>();
  const role = user.role === 'super_admin' ? 'Super Admin' : 'User';
  useLayoutEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = setTimeout(() => {
      setPresent(false);
      setPosition(undefined);
    }, 160);
    return () => clearTimeout(timer);
  }, [open]);
  useLayoutEffect(() => {
    if (!present || !open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const height = panel.current.offsetHeight;
      const width = panel.current.offsetWidth;
      let direction: 'up' | 'down' = placement === 'sidebar' ? 'up' : 'down';
      if (
        direction === 'down' &&
        anchor.bottom + height + 8 > innerHeight &&
        anchor.top > height + 8
      )
        direction = 'up';
      if (direction === 'up' && anchor.top < height + 8 && innerHeight - anchor.bottom > height + 8)
        direction = 'down';
      setPosition({
        direction,
        left: Math.max(
          12,
          Math.min(
            placement === 'header' ? anchor.right - width : anchor.left,
            innerWidth - width - 12,
          ),
        ),
        top: Math.max(
          12,
          Math.min(
            direction === 'up' ? anchor.top - height - 8 : anchor.bottom + 8,
            innerHeight - height - 12,
          ),
        ),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const frame = requestAnimationFrame(() => {
      const items = panel.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      );
      items?.[focusLast.current ? items.length - 1 : 0]?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [present, open, placement]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent | FocusEvent) => {
      const node = event.target as Node;
      if (!trigger.current?.contains(node) && !panel.current?.contains(node)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, onClose]);
  function select(action: () => void) {
    trigger.current?.focus({ preventScroll: true });
    onClose();
    action();
  }
  return (
    <div className={`account-menu account-menu-${placement}`}>
      <button
        ref={trigger}
        type="button"
        className={`account-menu-trigger ${open ? 'is-open' : ''}`}
        aria-label={placement === 'header' ? 'Header Account Menu' : 'Sidebar Account Menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={present ? id : undefined}
        onClick={() => {
          focusLast.current = false;
          if (open) onClose();
          else onOpen();
        }}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            focusLast.current = event.key === 'ArrowUp';
            onOpen();
          }
          if (event.key === 'Escape') onClose();
        }}
      >
        <Avatar name={user.name} photo={user.photo} />
        <span className="account-menu-identity">
          <strong>{user.name}</strong>
          {placement === 'sidebar' && <small>{role}</small>}
        </span>
        <ChevronDown size={15} className="account-menu-chevron" aria-hidden="true" />
      </button>
      {present &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label="Account Options"
            aria-hidden={!open}
            inert={!open}
            className={`account-popover account-popover-${position?.direction || (placement === 'sidebar' ? 'up' : 'down')} ${open ? 'is-open' : 'is-closing'}`}
            style={{
              top: position?.top,
              left: position?.left,
              visibility: position ? 'visible' : 'hidden',
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                trigger.current?.focus({ preventScroll: true });
                onClose();
                return;
              }
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const items = [
                ...(panel.current?.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]:not(:disabled)',
                ) || []),
              ];
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              const index =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                      items.length;
              items[index]?.focus();
            }}
          >
            <div className="account-popover-heading" role="presentation">
              <Avatar name={user.name} photo={user.photo} />
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>{role}</small>
              </div>
            </div>
            <div className="account-popover-items" role="presentation">
              <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(onProfile)}>
                <UserRound size={17} aria-hidden="true" /> My Profile
              </button>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={settingsDisabled}
                onClick={() => select(onSettings)}
              >
                <Settings size={17} aria-hidden="true" /> Settings
              </button>
              {onSwitchWorkspace && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={workspaceSwitchDisabled}
                  onClick={() => select(onSwitchWorkspace)}
                >
                  <Building2 size={17} aria-hidden="true" /> Switch Workspace
                </button>
              )}
              <div role="separator" className="account-menu-separator" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="account-menu-logout"
                onClick={() => select(onLogout)}
              >
                <LogOut size={17} aria-hidden="true" /> Log Out
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
