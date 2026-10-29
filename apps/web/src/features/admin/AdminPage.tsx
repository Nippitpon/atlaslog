import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import type { AdminUser } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import { listUsers, confirmUser, deleteUser, setUserRole, resetUserPassword } from '../../lib/adminApi.js'
import { generatePassword, MIN_PASSWORD_LENGTH } from '../../lib/username.js'
import { IconX } from '../../components/icons/index.js'

export function AdminPage() {
  const { user, isAdmin, roleLoaded } = useAuthStore()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetMustChange, setResetMustChange] = useState(true)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetDone, setResetDone] = useState<string | null>(null)

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

  if (!roleLoaded) return null
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
  const handleSetRole = (u: AdminUser, role: 'user' | 'coach') =>
    runAction(u.id, () => setUserRole(u.id, role))
  const handleDelete = (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return
    return runAction(u.id, () => deleteUser(u.id))
  }

  const openReset = (u: AdminUser) => {
    setResetTarget(u)
    setResetPassword('')
    setResetMustChange(true)
    setResetError(null)
    setResetDone(null)
  }
  const handleReset = async () => {
    if (!resetTarget) return
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setResetError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
      return
    }
    setResetBusy(true)
    setResetError(null)
    try {
      await resetUserPassword(resetTarget.id, resetPassword, resetMustChange)
      // Kept on screen so the admin can read the password out to the user.
      setResetDone(resetPassword)
      await load()
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e))
    } finally {
      setResetBusy(false)
    }
  }

  const pending = users.filter(u => !u.emailConfirmedAt)
  const confirmed = users.filter(u => u.emailConfirmedAt)

  const renderRow = (u: AdminUser, isPending: boolean) => {
    const isSelf = u.id === user?.id
    return (
      <div key={u.id} className="card card-tight" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Identity: full username + email (wraps instead of truncating) */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.3 }}>
            {u.username ?? u.email}
          </div>
          {u.username && (
            <div className="t-mono" style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, overflowWrap: 'anywhere' }}>
              {u.email}
            </div>
          )}
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            {u.role === 'admin' ? 'ADMIN · ' : u.role === 'coach' ? 'COACH · ' : ''}{isPending ? 'PENDING' : 'CONFIRMED'}
            {u.mustChangePassword ? ' · ต้องเปลี่ยนรหัส' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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
          <>
            {u.role !== 'admin' && !isSelf && (
              <div style={{
                display: 'flex', flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                {(['user', 'coach'] as const).map(r => {
                  const active = (u.role === 'coach' ? 'coach' : 'user') === r
                  return (
                    <button
                      key={r}
                      disabled={busyId === u.id || active}
                      onClick={() => handleSetRole(u, r)}
                      style={{
                        height: 32, fontSize: 11, padding: '0 10px', border: 'none', cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        color: active ? '#000' : 'var(--muted)',
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
            )}
            {u.role !== 'admin' && !isSelf && (
              <button
                className="btn btn-secondary"
                style={{ height: 32, fontSize: 11, padding: '0 12px', flexShrink: 0 }}
                disabled={busyId === u.id}
                onClick={() => openReset(u)}
              >
                Reset PW
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ height: 32, fontSize: 11, padding: '0 12px', flexShrink: 0, opacity: isSelf ? 0.4 : 1 }}
              disabled={busyId === u.id || isSelf}
              onClick={() => handleDelete(u)}
            >
              Delete
            </button>
          </>
        )}
        </div>
      </div>
    )
  }

  return (
    <div className="atlas-screen screen-enter screen-wide">
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
            <div className="r-grid" style={{ gap: 8 }}>
              {pending.length === 0
                ? <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No pending users</div>
                : pending.map(u => renderRow(u, true))}
            </div>
          </div>

          <div style={{ padding: '0 20px 32px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>CONFIRMED ({confirmed.length})</div>
            <div className="r-grid" style={{ gap: 8 }}>
              {confirmed.length === 0
                ? <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No confirmed users</div>
                : confirmed.map(u => renderRow(u, false))}
            </div>
          </div>
        </>
      )}

      {resetTarget && (
        <div className="sheet-backdrop" onClick={() => !resetBusy && setResetTarget(null)} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Reset password</h3>
              <button className="btn-icon" onClick={() => setResetTarget(null)}><IconX size={18} /></button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, wordBreak: 'break-all' }}>
              {resetTarget.username ? `${resetTarget.username} · ` : ''}{resetTarget.email}
            </p>

            {resetDone ? (
              <>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>NEW PASSWORD</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, userSelect: 'all', wordBreak: 'break-all' }}>{resetDone}</div>
                </div>
                <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                  รหัสนี้จะไม่แสดงอีก — แจ้งผู้ใช้ตอนนี้
                  {resetMustChange ? ' · ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสตอน login ครั้งแรก' : ''}
                </p>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setResetTarget(null)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>NEW PASSWORD</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={resetPassword}
                    onChange={e => { setResetPassword(e.target.value); setResetError(null) }}
                    placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัว`}
                    autoCapitalize="none"
                    autoCorrect="off"
                    style={{
                      flex: 1, minWidth: 0, height: 48, background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 14,
                      padding: '0 14px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <button className="btn btn-secondary" style={{ height: 48, fontSize: 11, padding: '0 12px', flexShrink: 0 }}
                    onClick={() => setResetPassword(generatePassword())}>
                    Generate
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={resetMustChange} onChange={e => setResetMustChange(e.target.checked)}
                    style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                    บังคับให้ผู้ใช้เปลี่ยนรหัสผ่านตอน login ครั้งแรก
                    <span className="t-mono" style={{ display: 'block', fontSize: 10, color: 'var(--muted)' }}>
                      ไม่ติ๊ก = ตั้งรหัสให้เฉย ๆ ผู้ใช้ใช้รหัสนี้ต่อได้เลย
                    </span>
                  </span>
                </label>

                {resetError && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                    padding: '10px 14px', marginTop: 14, color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 12,
                  }}>
                    {resetError}
                  </div>
                )}

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}
                  disabled={resetBusy} onClick={() => void handleReset()}>
                  {resetBusy ? '...' : 'Reset password'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
