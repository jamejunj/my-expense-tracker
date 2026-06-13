// Mock authentication
export const MOCK_USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin User' },
  { username: 'jame', password: '1234', name: 'Jame' },
]

export function login(username: string, password: string): boolean {
  const user = MOCK_USERS.find(u => u.username === username && u.password === password)
  if (user) {
    localStorage.setItem('auth_user', JSON.stringify({ username: user.username, name: user.name }))
    return true
  }
  return false
}

export function logout() {
  localStorage.removeItem('auth_user')
}

export function getUser(): { username: string; name: string } | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem('auth_user')
  return data ? JSON.parse(data) : null
}

export function isLoggedIn(): boolean {
  return getUser() !== null
}
