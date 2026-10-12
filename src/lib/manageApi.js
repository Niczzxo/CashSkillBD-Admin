// CashSkillBD — Product & Service Management API helper
// POSTs to /api/inventory with the user's Supabase access token.
export async function manageApi(session, action, payload = {}) {
  const r = await fetch('/api/inventory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'failed')
  return j
}
