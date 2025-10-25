import { Icon } from '@stem-packer/ui';
import type { ReactNode } from 'react';
import type { DroppedFolderResolutionError } from '../../shared/drop';
import { useFolderDrop } from '../hooks/useFolderDrop';
import { useTranslation } from '../hooks/useTranslation';

interface DropSurfaceProps {
  isActive: boolean;
  disabled?: boolean;
  onFolderDrop: (folderPath: string) => Promise<void> | void;
  onDropError?: (reason: DroppedFolderResolutionError) => Promise<void> | void;
  children?: ReactNode;
}

export function DropSurface({
  isActive,
  disabled,
  onFolderDrop,
  onDropError,
  children
}: DropSurfaceProps) {
  const { t } = useTranslation();
  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useFolderDrop({
    disabled,
    onFolderDrop,
    onDropError
  });

  const isHighlighting = (isDragging || isActive) && !disabled;

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200 ${
        isHighlighting ? 'border-primary bg-primary/10' : 'border-base-content/30'
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="presentation"
      data-drop-active={isHighlighting ? 'true' : 'false'}
      tabIndex={-1}
    >
      <div className="flex flex-col items-center gap-3 text-center text-base-content/80">
        {children ?? (
          <>
            <Icon name="file_open" className="text-5xl" />
            <p className="text-lg font-medium">{t('drag_drop_title')}</p>
            <p>{t('drag_drop_description')}</p>
          </>
        )}
      </div>
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-primary/20 text-primary-content transition-opacity ${
          isDragging ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <span className="text-lg font-semibold">{t('drag_drop_overlay_prompt')}</span>
      </div>
    </div>
  );
}
