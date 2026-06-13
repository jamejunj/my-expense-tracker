'use client'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import {
  BudgetPlan, BudgetGroup, BudgetItem,
  saveBudgetPlan, getBudgetPlan, defaultBudgetPlan,
  calcBudget, genId, GROUP_COLORS, COLOR_KEYS,
} from '@/lib/storage'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const today = new Date()

  const [selYear,  setSelYear]  = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1) // 1-12
  const month = `${selYear}-${String(selMonth).padStart(2, '0')}`

  const [plan, setPlan] = useState<BudgetPlan>(defaultBudgetPlan(month))
  const [saved, setSaved] = useState(false)
  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('budget_autosave') !== 'false'
  })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const loadMonth = useCallback((m: string) => {
    setPlan(getBudgetPlan(m) || defaultBudgetPlan(m))
    setSaved(false)
  }, [])
  useEffect(() => { loadMonth(month) }, [month, loadMonth])

  const calc = calcBudget(plan)
  const monthLabel = `${THAI_MONTHS[selMonth - 1]} ${selYear}`

  // ── Auto-save helper ──
  const triggerSave = useCallback((next: BudgetPlan) => {
    if (autoSave) { saveBudgetPlan({ ...next, month }); setSaved(true); setTimeout(() => setSaved(false), 1500) }
    else setSaved(false)
  }, [autoSave, month])

  const handleSave = () => {
    saveBudgetPlan({ ...plan, month })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  const toggleAutoSave = (v: boolean) => {
    setAutoSave(v); localStorage.setItem('budget_autosave', String(v))
    if (v) { saveBudgetPlan({ ...plan, month }); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  // ── Group ops ──
  const addGroup = () => {
    const color = COLOR_KEYS[plan.groups.length % COLOR_KEYS.length]
    const g: BudgetGroup = { id: genId(), name: 'หมวดใหม่', type: '-', emoji: '📌', color, items: [] }
    setPlan(p => { const next = { ...p, groups: [...p.groups, g] }; triggerSave(next); return next })
  }
  const removeGroup = (id: string) => {
    setPlan(p => { const next = { ...p, groups: p.groups.filter(g => g.id !== id) }; triggerSave(next); return next })
  }
  const updateGroup = (id: string, patch: Partial<BudgetGroup>) => {
    setPlan(p => { const next = { ...p, groups: p.groups.map(g => g.id === id ? { ...g, ...patch } : g) }; triggerSave(next); return next })
  }

  // ── Item ops ──
  const addItem = (groupId: string) => {
    const item: BudgetItem = { id: genId(), label: 'รายการใหม่', amount: 0 }
    setPlan(p => {
      const next = { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, items: [...g.items, item] } : g) }
      triggerSave(next); return next
    })
  }
  const removeItem = (groupId: string, itemId: string) => {
    setPlan(p => {
      const next = { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g) }
      triggerSave(next); return next
    })
  }
  const updateItem = (groupId: string, itemId: string, patch: Partial<BudgetItem>) => {
    setPlan(p => {
      const next = {
        ...p,
        groups: p.groups.map(g =>
          g.id === groupId
            ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
            : g
        ),
      }
      triggerSave(next); return next
    })
  }
  const updateExtras = (val: number) => {
    setPlan(p => { const next = { ...p, monthly_extras: val }; triggerSave(next); return next })
  }

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // Year range: -3 to +2 from current year
  const yearOptions = Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">วางแผนงบประมาณ</h1>
            <p className="text-sm text-gray-400 mt-0.5">เดือน {monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Month dropdown */}
            <select
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
              {THAI_MONTHS.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>

            {/* Year dropdown */}
            <select
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Auto-save toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-gray-500 hidden sm:block">Auto Save</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={autoSave} onChange={e => toggleAutoSave(e.target.checked)} />
                <div className={`w-10 h-5 rounded-full transition-colors ${autoSave ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-5' : ''}`} />
              </div>
            </label>

            <button
              onClick={handleSave}
              disabled={autoSave}
              className={`px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all ${
                saved ? 'bg-emerald-500 text-white' :
                autoSave ? 'bg-gray-100 text-gray-400 cursor-default' :
                'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {saved ? '✓ บันทึกแล้ว' : 'บันทึก'}
            </button>
          </div>
        </div>

        {/* ── Summary chips ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'สุทธิหลังหักทั้งหมด', val: calc.afterAll, color: calc.afterAll >= 0 ? '#10b981' : '#ef4444' },
            { label: 'งบต่อวัน', val: calc.dailyBudget, color: '#3b82f6' },
            { label: 'จำนวนวัน', val: calc.daysInMonth, color: '#64748b', isInt: true },
            { label: 'Monthly Extras', val: plan.monthly_extras, color: '#f97316' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>
                {c.isInt ? c.val : fmt(c.val)}
              </p>
              {!c.isInt && <p className="text-xs text-gray-400 mt-0.5">บาท</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Groups column ── */}
          <div className="flex-1 min-w-0 space-y-3">

            {plan.groups.map((group) => {
              const gc    = GROUP_COLORS[group.color] ?? GROUP_COLORS.blue
              const total = group.items.reduce((s, i) => s + (i.amount || 0), 0)
              const isOpen = !collapsed.has(group.id)

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${gc.hex}` }}
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-4 py-3">

                    {/* +/− toggle */}
                    <button
                      onClick={() => updateGroup(group.id, { type: group.type === '+' ? '-' : '+' })}
                      title="สลับ รายรับ / รายจ่าย"
                      className={`w-7 h-7 rounded-full text-sm font-bold shrink-0 transition-colors ${
                        group.type === '+'
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {group.type}
                    </button>

                    {/* Emoji */}
                    <input
                      type="text"
                      value={group.emoji}
                      onChange={e => updateGroup(group.id, { emoji: e.target.value })}
                      className="w-8 text-xl text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-gray-200 rounded shrink-0"
                    />

                    {/* Name */}
                    <input
                      type="text"
                      value={group.name}
                      onChange={e => updateGroup(group.id, { name: e.target.value })}
                      className="flex-1 min-w-0 font-semibold text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    />

                    {/* Color picker */}
                    <div className="hidden sm:flex gap-1 shrink-0">
                      {COLOR_KEYS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateGroup(group.id, { color: c })}
                          title={c}
                          className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 ${
                            group.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: GROUP_COLORS[c].hex }}
                        />
                      ))}
                    </div>

                    {/* Total badge */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${gc.tag}`}>
                      {fmt(total)}
                    </span>

                    {/* Collapse */}
                    <button
                      onClick={() => toggleCollapse(group.id)}
                      className="text-gray-300 hover:text-gray-500 w-5 h-5 flex items-center justify-center text-xs shrink-0"
                    >
                      {isOpen ? '▼' : '▶'}
                    </button>

                    {/* Remove group */}
                    <button
                      onClick={() => removeGroup(group.id)}
                      className="text-gray-200 hover:text-red-400 transition-colors text-xl leading-none w-5 h-5 flex items-center justify-center shrink-0"
                      title="ลบกลุ่ม"
                    >
                      ×
                    </button>
                  </div>

                  {/* Items */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-50">
                      <table className="w-full text-sm mt-2">
                        <thead>
                          <tr className="text-xs text-gray-400 border-b border-gray-100">
                            <th className="text-left py-1.5 font-medium pl-1">รายการ</th>
                            <th className="text-right py-1.5 font-medium w-36">จำนวน (บาท)</th>
                            <th className="w-7" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(item => (
                            <tr key={item.id} className="group/row border-b border-gray-50 hover:bg-slate-50 transition-colors">
                              <td className="py-1.5 pr-3">
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={e => updateItem(group.id, item.id, { label: e.target.value })}
                                  className="w-full text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  value={item.amount || ''}
                                  onChange={e => updateItem(group.id, item.id, { amount: parseFloat(e.target.value) || 0 })}
                                  className="w-full text-right font-medium text-gray-800 border border-gray-100 focus:border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 rounded-lg px-2 py-0.5"
                                />
                              </td>
                              <td className="py-1.5 text-center">
                                <button
                                  onClick={() => removeItem(group.id, item.id)}
                                  className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg leading-none"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}

                          {group.items.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-3 text-center text-xs text-gray-300">
                                ยังไม่มีรายการ
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <button
                        onClick={() => addItem(group.id)}
                        className="mt-2 text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        <span className="text-base leading-none font-bold">+</span> เพิ่มรายการ
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add group */}
            <button
              onClick={addGroup}
              className="w-full bg-white border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl py-4 text-sm text-gray-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl font-bold leading-none">+</span> เพิ่มหมวด
            </button>

          </div>

          {/* ── Sticky summary ── */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-4">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm">สรุป — {monthLabel}</h3>

              <div className="space-y-1 text-sm">
                {plan.groups.map((group, i) => {
                  const gc = GROUP_COLORS[group.color] ?? GROUP_COLORS.blue
                  const total = group.items.reduce((s, it) => s + (it.amount || 0), 0)
                  const running = calc.groupResults[i]?.runningNet ?? 0
                  return (
                    <div key={group.id}>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500 flex items-center gap-1">
                          <span className={group.type === '+' ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>
                            {group.type}
                          </span>
                          <span className="truncate max-w-[120px]">{group.name}</span>
                        </span>
                        <span className="font-medium text-xs" style={{ color: gc.hex }}>
                          {fmt(total)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 pl-4 border-l-2 border-gray-100 mb-1">
                        <span className="text-xs text-gray-300">= เหลือ</span>
                        <span className={`text-xs font-semibold ${running >= 0 ? 'text-gray-600' : 'text-red-500'}`}>
                          {fmt(running)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">งบใช้จ่าย</span>
                  <span className="text-gray-700 font-medium">{fmt(calc.available)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">จำนวนวัน</span>
                  <span className="text-gray-700">{calc.daysInMonth} วัน</span>
                </div>
                {calc.remainder > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ปักเศษ</span>
                    <span className="text-gray-400">{fmt(calc.remainder)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 bg-blue-600 rounded-xl p-4 flex justify-between items-center">
                <span className="text-blue-100 text-sm font-medium">งบต่อวัน</span>
                <span className="text-3xl font-bold text-white">{fmt(calc.dailyBudget)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
