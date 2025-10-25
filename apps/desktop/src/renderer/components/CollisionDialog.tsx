import { useTranslation } from '../hooks/useTranslation';
import type { CollisionCheckPayload, CollisionKind } from '../../shared/collisions';

export interface CollisionPrompt {
  payload: CollisionCheckPayload;
  kind: CollisionKind;
  collisionCount: number;
  outputDir: string;
}

interface CollisionDialogProps {
  prompt: CollisionPrompt | null;
  onIgnore: () => void | Promise<void>;
  onAbort: () => void | Promise<void>;
}

export function CollisionDialog({ prompt, onIgnore, onAbort }: CollisionDialogProps) {
  const { t } = useTranslation();

  if (!prompt) {
    return null;
  }

  const messageKey = prompt.kind === 'zip' ? 'dialog_overwrite_message_zip' : 'dialog_overwrite_message_7z';
  const messageParams: Record<string, string | number> =
    prompt.kind === 'zip'
      ? { count: prompt.collisionCount, directory: prompt.outputDir }
      : { directory: prompt.outputDir };

  return (
    <dialog className="modal modal-open" open onClose={() => onAbort()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('dialog_overwrite_title')}</h3>
        <p className="py-4 text-base-content/80">{t(messageKey, messageParams)}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => onAbort()}>
            {t('dialog_overwrite_abort')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onIgnore()}>
            {t('dialog_overwrite_ignore')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={() => onAbort()}>
        <button type="submit">{t('dialog_overwrite_abort')}</button>
      </form>
    </dialog>
  );
}
