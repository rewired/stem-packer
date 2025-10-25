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
        <label className="form-control" htmlFor="metadata-title">
          <span className="label-text" id="metadata-title-label">
            {t('metadata_field_title')}
          </span>
          <input
            id="metadata-title"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-title-label"
            value={fields.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="form-control" htmlFor="metadata-artist">
          <span className="label-text" id="metadata-artist-label">
            {t('metadata_field_artist')}
          </span>
          <input
            id="metadata-artist"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-artist-label"
            value={fields.artist}
            onChange={(event) => onChange({ artist: event.target.value })}
            onBlur={handleArtistBlur}
          />
        </label>
        <label className="form-control" htmlFor="metadata-album">
          <span className="label-text" id="metadata-album-label">
            {t('metadata_field_album')}
          </span>
          <input
            id="metadata-album"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-album-label"
            value={fields.album}
            onChange={(event) => onChange({ album: event.target.value })}
          />
        </label>
        <label className="form-control" htmlFor="metadata-bpm">
          <span className="label-text" id="metadata-bpm-label">
            {t('metadata_field_bpm')}
          </span>
          <input
            id="metadata-bpm"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-bpm-label"
            value={fields.bpm}
            onChange={(event) => onChange({ bpm: event.target.value })}
          />
        </label>
        <label className="form-control" htmlFor="metadata-key">
          <span className="label-text" id="metadata-key-label">
            {t('metadata_field_key')}
          </span>
          <input
            id="metadata-key"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-key-label"
            value={fields.key}
            onChange={(event) => onChange({ key: event.target.value })}
          />
        </label>
        <label className="form-control" htmlFor="metadata-license">
          <span className="label-text" id="metadata-license-label">
            {t('metadata_field_license')}
          </span>
          <input
            id="metadata-license"
            type="text"
            className="input input-bordered input-sm"
            aria-labelledby="metadata-license-label"
            value={fields.license}
            onChange={(event) => onChange({ license: event.target.value })}
          />
        </label>
        <label className="form-control md:col-span-2" htmlFor="metadata-attribution">
          <span className="label-text" id="metadata-attribution-label">
            {t('metadata_field_attribution')}
          </span>
          <textarea
            id="metadata-attribution"
            className="textarea textarea-bordered textarea-sm h-24"
            aria-labelledby="metadata-attribution-label"
            value={fields.attribution}
            onChange={(event) => onChange({ attribution: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
