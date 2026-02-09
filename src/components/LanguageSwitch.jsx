import { useI18n } from '../i18n';

function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="pill-tabs" role="tablist" aria-label={t('more.languageAria')}>
      <button
        type="button"
        className={`pill ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
        role="tab"
        aria-selected={lang === 'en'}
      >
        {t('language.english')}
      </button>
      <button
        type="button"
        className={`pill ${lang === 'my' ? 'active' : ''}`}
        onClick={() => setLang('my')}
        role="tab"
        aria-selected={lang === 'my'}
      >
        {t('language.myanmar')}
      </button>
    </div>
  );
}

export default LanguageSwitch;

