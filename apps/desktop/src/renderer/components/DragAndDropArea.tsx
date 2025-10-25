import { Icon } from '@stem-packer/ui';
import type { ReactNode } from 'react';
import { useDroppedPaths } from '../hooks/useDroppedPaths';
import { useTranslation } from '../hooks/useTranslation';

interface DragAndDropAreaProps {
  isActive: boolean;
  disabled?: boolean;
  onDrop: (paths: string[]) => void;
  children?: ReactNode;
}

export function DragAndDropArea({ isActive, disabled, onDrop, children }: DragAndDropAreaProps) {
  const { t } = useTranslation();
  const { isDragging, handleDragLeave, handleDragOver, handleDrop } = useDroppedPaths({
    disabled,
    onPathsSelected: onDrop
  });

  return (
    <div
      className={`rounded-xl border-2 border-dashed ${
        isDragging || isActive ? 'border-primary bg-primary/10' : 'border-base-content/30'
      } p-10 transition-colors`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="presentation"
    >
      {children ?? (
        <div className="flex flex-col items-center gap-3 text-center text-base-content/80">
          <Icon name="file_open" className="text-5xl" />
          <p className="text-lg font-medium">{t('drag_drop_title')}</p>
          <p>{t('drag_drop_description')}</p>
        </div>
      )}
    </div>
  );
}
