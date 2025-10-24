import { TranslationProvider, useTranslation } from './hooks/useTranslation';
import { Icon } from '@stem-packer/ui';

function AppContent() {
  const { t } = useTranslation();
  const isReady = true;

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
        <header className="flex items-center gap-3">
          <Icon name="library_music" className="text-4xl" />
          <div>
            <h1 className="text-3xl font-semibold">{t('heading_welcome')}</h1>
            <p className="text-base-content/80">{t('description_get_started')}</p>
          </div>
        </header>
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <button className="btn btn-primary w-fit" disabled={!isReady}>
              <Icon name="folder_open" className="text-2xl" />
              <span>{t('button_choose_folder')}</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <TranslationProvider locale="en">
      <AppContent />
    </TranslationProvider>
  );
}
