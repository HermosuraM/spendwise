import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <EmptyState icon="search" title="Page not found">
      <Link to="/" className="font-medium text-accent hover:underline">Back to the dashboard</Link>
    </EmptyState>
  )
}
