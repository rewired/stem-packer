import type { InfoTextFormState } from '../../shared/info';
import { useTranslation } from '../hooks/useTranslation';

interface MetadataFormProps {
  fields: InfoTextFormState;
  onChange: (update: Partial<InfoTextFormState>) => void;
  onArtistBlur?: () => void | Promise<void>;
}

export function MetadataForm({ fields, onChange, onArtistBlur }: MetadataFormProps) {
  const { t } = useTranslation();

  const handleArtistBlur = () => {
    if (onArtistBlur) {
      void onArtistBlur();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">{t('metadata_section_title')}</h3>
        <p className="text-sm text-base-content/70">{t('metadata_section_description')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_title')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_artist')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.artist}
            onChange={(event) => onChange({ artist: event.target.value })}
            onBlur={handleArtistBlur}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_album')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.album}
            onChange={(event) => onChange({ album: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_bpm')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.bpm}
            onChange={(event) => onChange({ bpm: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_key')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.key}
            onChange={(event) => onChange({ key: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_license')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={fields.license}
            onChange={(event) => onChange({ license: event.target.value })}
          />
        </label>
        <label className="form-control md:col-span-2">
          <div className="label">
            <span className="label-text">{t('metadata_field_attribution')}</span>
          </div>
          <textarea
            className="textarea textarea-bordered textarea-sm h-24"
            value={fields.attribution}
            onChange={(event) => onChange({ attribution: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
