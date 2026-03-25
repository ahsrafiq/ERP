/**
 * In Ant Design modals/drawers: Enter submits primary action; Shift+Enter still inserts
 * a newline in textareas. Select/DatePicker open dropdowns are left to default handling.
 */
export function attachModalEnterToSubmit(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Let menus, messages, and popovers handle Enter
    if (
      target.closest('.ant-dropdown:not(.ant-dropdown-hidden)') ||
      target.closest('.ant-message') ||
      target.closest('.ant-notification') ||
      target.closest('.ant-popover:not(.ant-popover-hidden)')
    ) {
      return;
    }

    // Ant Design portaled overlays — don't steal Enter while choosing options / dates
    if (
      document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    ) {
      return;
    }
    if (
      document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')
    ) {
      return;
    }

    const modalContent = target.closest('.ant-modal-content');
    const drawerContent = target.closest('.ant-drawer-content');
    if (!modalContent && !drawerContent) return;

    const wrap = (modalContent?.closest('.ant-modal-wrap') ||
      drawerContent?.closest('.ant-drawer')) as HTMLElement | null;
    if (!wrap) return;

    // Ant Design sometimes leaves wraps in DOM with display:none
    if (wrap.offsetParent === null && wrap.style.display === 'none') return;

    // Textarea: Shift+Enter = newline; Enter alone = submit
    if (target.tagName === 'TEXTAREA') {
      if (e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
    } else if (target.tagName === 'INPUT') {
      const input = target as HTMLInputElement;
      if (input.type === 'submit' || input.type === 'button') return;
      // Let checkbox/radio use default where applicable
      if (input.type === 'checkbox' || input.type === 'radio') return;
      e.preventDefault();
      e.stopPropagation();
    } else {
      // Not a field we handle
      return;
    }

    const footer =
      wrap.querySelector('.ant-modal-footer') || wrap.querySelector('.ant-drawer-footer');
    let primary =
      footer?.querySelector<HTMLButtonElement>('.ant-btn-primary:not([disabled])') ||
      wrap.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary:not([disabled])') ||
      wrap.querySelector<HTMLButtonElement>('.ant-drawer-footer .ant-btn-primary:not([disabled])');

    if (!primary) {
      primary = wrap.querySelector<HTMLButtonElement>('.ant-btn-primary:not([disabled])');
    }

    primary?.click();
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
