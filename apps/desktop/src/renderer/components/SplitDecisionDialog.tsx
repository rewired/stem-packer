import { useTranslation } from '../hooks/useTranslation';

export interface SplitDecisionPrompt {
  folderPath: string;
  candidateCount: number;
}

interface SplitDecisionDialogProps {
  prompt: SplitDecisionPrompt | null;
  onChooseSplit: () => void | Promise<void>;
  onChooseSevenZip: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function SplitDecisionDialog({
  prompt,
  onChooseSplit,
  onChooseSevenZip,
  onCancel
}: SplitDecisionDialogProps) {
  const { t } = useTranslation();

  if (!prompt) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open onClose={() => onCancel()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('dialog_multichannel_title')}</h3>
        <p className="py-4 text-base-content/80">
          {t('dialog_multichannel_message', { count: prompt.candidateCount })}
        </p>
        <div className="modal-action flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn" onClick={() => onCancel()}>
            {t('dialog_multichannel_cancel')}
          </button>
          <button type="button" className="btn" onClick={() => onChooseSevenZip()}>
            {t('dialog_multichannel_choose_7z')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onChooseSplit()}>
            {t('dialog_multichannel_choose_split')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={() => onCancel()}>
        <button type="submit">{t('dialog_multichannel_cancel')}</button>
      </form>
    </dialog>
  );
}
