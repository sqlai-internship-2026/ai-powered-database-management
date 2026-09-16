import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useT } from '../i18n'

export default function NotFound() {
  const t = useT()

  return (
    <>
      <PageHeader title={t('Page not found')} />
      <div className="card placeholder">
        {t('The page you requested does not exist.')}{' '}
        <Link to="/dashboard">{t('Go back to the dashboard')}</Link>.
      </div>
    </>
  )
}
