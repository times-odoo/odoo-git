import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/ui';

export function Modal() {
  const { modal, closeModal } = useUIStore();
  const [inputValue, setInputValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  // Reset/initialize input value when modal config changes
  useEffect(() => {
    if (modal) {
      setInputValue(modal.initialInputValue || '');
      setCheckboxChecked(modal.checkboxDefaultChecked || false);
    } else {
      setInputValue('');
      setCheckboxChecked(false);
    }
  }, [modal]);

  if (!modal) return null;

  const variantColors = {
    danger: 'btn-danger',
    warning: 'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20',
    default: 'btn-accent',
  };

  const handleConfirm = () => {
    if (modal.requireInput && inputValue !== modal.requireInput) return;
    modal.onConfirm(inputValue, checkboxChecked);
    closeModal();
  };

  const handleCancel = () => {
    modal.onCancel?.();
    closeModal();
  };

  const isConfirmDisabled = modal.requireInput ? inputValue !== modal.requireInput : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative panel p-5 max-w-md w-full mx-4 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-primary font-semibold text-[15px] mb-2">{modal.title}</h3>
        <p className="text-muted text-[13px] mb-4 leading-relaxed whitespace-pre-line">{modal.message}</p>

        {modal.requireInput && (
          <div className="mb-4">
            <p className="text-[12px] text-muted mb-1.5">
              Type <span className="font-mono text-danger">{modal.requireInput}</span> to confirm:
            </p>
            <input
              type="text"
              className="input-field font-mono"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={modal.inputPlaceholder}
              autoFocus
            />
          </div>
        )}

        {modal.showTextInput && (
          <div className="mb-4">
            <input
              type="text"
              className="input-field text-[13px]"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={modal.inputPlaceholder}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>
        )}

        {modal.showCheckbox && (
          <div className="mb-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-[13px] text-primary hover:text-accent transition-colors">
              <input
                type="checkbox"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              {modal.checkboxLabel || 'Enable'}
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-surface" onClick={handleCancel}>
            {modal.cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn ${variantColors[modal.variant || 'default']} ${isConfirmDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {modal.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
