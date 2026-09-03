import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div className="card placeholder">
        The page you requested does not exist.{' '}
        <Link to="/dashboard">Go back to the dashboard</Link>.
      </div>
    </>
  )
}
