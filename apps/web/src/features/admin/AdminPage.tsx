import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import type { AdminUser } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import { listUsers, confirmUser, deleteUser } from '../../lib/adminApi.js'

export function AdminPage() {
  const { user, isAdmin } = useAuthStore()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listUsers())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
  useEffect(() => { if (isAdmin) void load() }, [isAdmin, load])

  if (!isAdmin) return <Navigate to="/" replace />

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirm = (u: AdminUser) => runAction(u.id, () => confirmUser(u.id))
  const handleDelete = (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return
    return runAction(u.id, () => deleteUser(u.id))
  }

  const pending = users.filter(u => !u.emailConfirmedAt)
  const confirmed = users.filter(u => u.emailConfirmedAt)

  const renderRow = (u: AdminUser, isPending: boolean) => {
    const isSelf = u.id === user?.id
    return (
      <div key={u.id} className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.email}
          </div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {u.role === 'admin' ? 'ADMIN · ' : ''}{isPending ? 'PENDING' : 'CONFIRMED'}
          </div>
        </div>
        {isPending ? (
          <>
            <button
              className="btn btn-primary"
              style={{ height: 32, fontSize: 11, padding: '0 12px', flexShrink: 0 }}
              disabled={busyId === u.id}
              onClick={() => handleConfirm(u)}
            >
              {busyId === u.id ? '...' : 'Confirm'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ height: 32, fontSize: 11, padding: '0 12px', flexShrink: 0 }}
              disabled={busyId === u.id || isSelf}
              onClick={() => handleDelete(u)}
            >
              Reject
            </button>
          </>
        ) : (
          <button
            className="btn btn-secondary"
            style={{ height: 32, fontSize: 11, padding: '0 12px', flexShrink: 0, opacity: isSelf ? 0.4 : 1 }}
            disabled={busyId === u.id || isSelf}
            onClick={() => handleDelete(u)}
          >
            Delete
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">ADMIN</div>
          <h1>Users</h1>
        </div>
        <button
          className="btn btn-secondary"
          style={{ height: 34, fontSize: 11, padding: '0 12px' }}
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px',
            color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            {error}
          </div>
        </div>
      )}

      {loading && users.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <>
          <div style={{ padding: '0 20px 20px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>PENDING ({pending.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.length === 0
                ? <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No pending users</div>
                : pending.map(u => renderRow(u, true))}
            </div>
          </div>

          <div style={{ padding: '0 20px 32px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>CONFIRMED ({confirmed.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {confirmed.length === 0
                ? <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No confirmed users</div>
                : confirmed.map(u => renderRow(u, false))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
