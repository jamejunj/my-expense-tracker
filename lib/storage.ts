// ─── ID Generator ────────────────────────────────────────────────────────────
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ─── Budget Types ─────────────────────────────────────────────────────────────
export interface BudgetItem {
  id: string
  label: string
  amount: number
}

export interface BudgetGroup {
  id: string
  name: string
  type: '+' | '-'   // income vs expense
  emoji: string
  color: string     // key into GROUP_COLORS
  items: BudgetItem[]
}

export interface BudgetPlan {
  month: string     // "YYYY-MM"
  groups: BudgetGroup[]
  monthly_extras: number
}

// ─── Daily Expense Types ─────────────────────────────────────────────────────
export interface PaymentMethod {
  id: string
  label: string
}

export interface Transaction {
  id: string
  date: number       // day of month 1-31
  name: string
  methodId: string   // payment method id, '' = unspecified
  description: string
  amount: number     // positive = expense, negative = refund/income
}

export interface DailyExpense {
  month: string
  limit_per_day: number
  monthly_extras: number
  paymentMethods: PaymentMethod[]
  transactions: Transaction[]
}

// ─── Color palette (full Tailwind class strings — no dynamic interpolation) ──
export const GROUP_COLORS: Record<string, { hex: string; tag: string }> = {
  blue:    { hex: '#3b82f6', tag: 'bg-blue-100 text-blue-700' },
  emerald: { hex: '#10b981', tag: 'bg-emerald-100 text-emerald-700' },
  red:     { hex: '#ef4444', tag: 'bg-red-100 text-red-700' },
  purple:  { hex: '#a855f7', tag: 'bg-purple-100 text-purple-700' },
  pink:    { hex: '#ec4899', tag: 'bg-pink-100 text-pink-700' },
  orange:  { hex: '#f97316', tag: 'bg-orange-100 text-orange-700' },
  teal:    { hex: '#14b8a6', tag: 'bg-teal-100 text-teal-700' },
  indigo:  { hex: '#6366f1', tag: 'bg-indigo-100 text-indigo-700' },
}
export const COLOR_KEYS = Object.keys(GROUP_COLORS)

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = []

export function defaultBudgetPlan(month: string): BudgetPlan {
  return { month, monthly_extras: 0, groups: [] }
}

// ─── Budget Calculator ────────────────────────────────────────────────────────
export function calcBudget(plan: BudgetPlan) {
  const [year, mo] = plan.month.split('-').map(Number)
  const daysInMonth = new Date(year, mo, 0).getDate()

  let net = 0
  const groupResults = plan.groups.map(group => {
    const total = group.items.reduce((s, item) => s + (item.amount || 0), 0)
    if (group.type === '+') net += total
    else net -= total
    return { id: group.id, total, runningNet: net }
  })

  const afterAll  = net
  const available = afterAll - plan.monthly_extras
  const dailyBudget = daysInMonth > 0 && available > 0
    ? Math.floor(available / daysInMonth) : 0
  const remainder = available > 0 ? available - dailyBudget * daysInMonth : 0

  return { groupResults, afterAll, available, daysInMonth, dailyBudget, remainder }
}

// ─── Budget Storage ───────────────────────────────────────────────────────────
const BUDGET_KEY  = 'v2_budget_plans'
const EXPENSE_KEY = 'v2_daily_expenses'

export function getBudgetPlans(): Record<string, BudgetPlan> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}') } catch { return {} }
}
export function saveBudgetPlan(plan: BudgetPlan) {
  const all = getBudgetPlans(); all[plan.month] = plan
  localStorage.setItem(BUDGET_KEY, JSON.stringify(all))
}
export function getBudgetPlan(month: string): BudgetPlan | null {
  return getBudgetPlans()[month] || null
}

// ─── Daily Expense Storage ────────────────────────────────────────────────────
export function getDailyExpenses(): Record<string, DailyExpense> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(EXPENSE_KEY) || '{}') } catch { return {} }
}
export function saveDailyExpense(expense: DailyExpense) {
  const all = getDailyExpenses(); all[expense.month] = expense
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(all))
}
export function getDailyExpense(month: string): DailyExpense | null {
  const raw = getDailyExpenses()[month]
  if (!raw) return null
  // migrate old format that used entries instead of transactions
  if (!('transactions' in raw)) return { ...(raw as unknown as DailyExpense), transactions: [] }
  return raw
}
