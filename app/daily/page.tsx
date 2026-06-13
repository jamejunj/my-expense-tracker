'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from '@/components/Navbar'
import {
  DailyExpense, PaymentMethod, Transaction,
  saveDailyExpense, getDailyExpense,
  getBudgetPlan, calcBudget,
  DEFAULT_PAYMENT_METHODS, genId,
} from '@/lib/storage'

// ─── Constants ────────────────────────────────────────────────────────────────
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const DOW_TH     = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.']

const fmt = (n: number, dec = 2) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// ─── Blank form state ─────────────────────────────────────────────────────────
// date stored as string so the input can be fully cleared before validation
const blankForm = (day: number | string = 1, methodId = '') => ({
  date: String(day), name: '', methodId, description: '', amount: 0,
})

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DailyPage() {
  const today  = new Date()
  const txListRef = useRef<HTMLDivElement>(null)

  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  )
  const [data, setData] = useState<DailyExpense>({
    month,
    limit_per_day: 0,
    monthly_extras: 0,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    transactions: [],
  })
  const [saved,      setSaved]      = useState(false)
  const [autoSave,   setAutoSave]   = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('daily_autosave') !== 'false'
  })
  const [showMgmt,   setShowMgmt]   = useState(false)
  const [newLabel,   setNewLabel]   = useState('')

  // ── Filter state ──
  const [filterDay,      setFilterDay]      = useState<number | null>(null)
  const [filterMethodId, setFilterMethodId] = useState<string | null>(null)
  const [searchText,     setSearchText]     = useState('')

  // ── Keyboard nav focused cell ──
  const [focusedCell, setFocusedCell] = useState<{ dayIdx: number; methodIdx: number } | null>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)

  // ── Form state ──
  const [showForm,   setShowForm]   = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [form, setForm] = useState(blankForm())
  const [formErr, setFormErr] = useState('')

  const loadMonth = useCallback((m: string) => {
    const existing = getDailyExpense(m)
    if (existing) {
      setData(existing)
    } else {
      const bp = getBudgetPlan(m)
      let limit = 0, extras = 0
      if (bp) { const c = calcBudget(bp); limit = c.dailyBudget; extras = bp.monthly_extras }
      setData({ month: m, limit_per_day: limit, monthly_extras: extras, paymentMethods: DEFAULT_PAYMENT_METHODS, transactions: [] })
    }
    setSaved(false); setFilterDay(null); setFilterMethodId(null); setSearchText(''); setFocusedCell(null)
  }, [])
  useEffect(() => { loadMonth(month) }, [month, loadMonth])

  // ── Derived ──
  const [year, mo] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mo, 0).getDate()
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const firstDow    = new Date(year, mo - 1, 1).getDay()

  const getVal = (day: number, mid: string) =>
    data.transactions.filter(t => t.date === day && t.methodId === mid)
      .reduce((s, t) => s + t.amount, 0)

  const dayTotal = (day: number) =>
    data.transactions.filter(t => t.date === day)
      .reduce((s, t) => s + t.amount, 0)

  const rowTotal = (mid: string) =>
    data.transactions.filter(t => t.methodId === mid)
      .reduce((s, t) => s + t.amount, 0)

  const totalBudget = data.limit_per_day * daysInMonth + data.monthly_extras
  const totalSpent  = data.transactions.reduce((s, t) => s + t.amount, 0)
  const netRemain   = totalBudget - totalSpent

  const dailyRemain = days.map(d => data.limit_per_day - dayTotal(d))
  let cumDR = 0
  const monthRemain = days.map((_, i) => { cumDR += dailyRemain[i]; return data.monthly_extras + cumDR })

  const firstSpentIdx = days.findIndex(d => dayTotal(d) > 0)

  // ── Filtered transaction list ──
  const filteredTxs = data.transactions
    .filter(t => {
      if (filterDay      !== null && t.date     !== filterDay)      return false
      if (filterMethodId !== null && t.methodId !== filterMethodId) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        const ml = data.paymentMethods.find(m => m.id === t.methodId)?.label ?? ''
        if (![t.name, t.description, ml].some(s => s.toLowerCase().includes(q))) return false
      }
      return true
    })
    .sort((a, b) => a.date - b.date)

  // ── Table cell click → filter + keyboard focus ──
  const handleCellClick = (day: number, mid: string) => {
    const dayIdx    = days.indexOf(day)
    const methodIdx = data.paymentMethods.findIndex(m => m.id === mid)
    if (filterDay === day && filterMethodId === mid) {
      setFilterDay(null); setFilterMethodId(null); setFocusedCell(null)
    } else {
      setFilterDay(day); setFilterMethodId(mid)
      setFocusedCell({ dayIdx, methodIdx })
      tableWrapRef.current?.focus()
      setTimeout(() => txListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }

  // ── Auto-save helper ──
  const triggerSave = useCallback((next: DailyExpense) => {
    if (autoSave) { saveDailyExpense(next); setSaved(true); setTimeout(() => setSaved(false), 1500) }
    else setSaved(false)
  }, [autoSave])

  // ── Save ──
  const handleSave = () => { saveDailyExpense(data); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const toggleAutoSave = (v: boolean) => {
    setAutoSave(v); localStorage.setItem('daily_autosave', String(v))
    if (v) { saveDailyExpense(data); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  // ── Payment method management ──
  const addMethod = () => {
    if (!newLabel.trim()) return
    setData(p => {
      const next = { ...p, paymentMethods: [...p.paymentMethods, { id: genId(), label: newLabel.trim() }] }
      triggerSave(next); return next
    })
    setNewLabel('')
  }
  const removeMethod = (id: string) => {
    setData(p => {
      const next = { ...p, paymentMethods: p.paymentMethods.filter(m => m.id !== id) }
      triggerSave(next); return next
    })
  }
  const renameMethod = (id: string, label: string) => {
    setData(p => {
      const next = { ...p, paymentMethods: p.paymentMethods.map(m => m.id === id ? { ...m, label } : m) }
      triggerSave(next); return next
    })
  }

  // ── Transaction form ──
  const openNew = (day?: number, methodId?: string) => {
    setEditingId(null)
    setForm(blankForm(day ?? filterDay ?? today.getDate(), methodId ?? filterMethodId ?? ''))
    setFormErr(''); setShowForm(true)
  }
  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setForm({ date: String(tx.date), name: tx.name, methodId: tx.methodId, description: tx.description, amount: tx.amount })
    setFormErr(''); setShowForm(true)
  }
  const submitForm = () => {
    const dateNum = parseInt(form.date)
    if (!form.date.trim() || isNaN(dateNum)) { setFormErr('กรุณากรอกวันที่'); return }
    if (dateNum < 1 || dateNum > daysInMonth)  { setFormErr(`วันที่ต้องอยู่ระหว่าง 1 - ${daysInMonth}`); return }
    if (form.amount === 0)                      { setFormErr('กรุณากรอกยอดค่าใช้จ่าย'); return }
    const tx = { ...form, date: dateNum }
    if (editingId) {
      setData(p => {
        const next = { ...p, transactions: p.transactions.map(t => t.id === editingId ? { ...t, ...tx } : t) }
        triggerSave(next); return next
      })
    } else {
      setData(p => {
        const next = { ...p, transactions: [...p.transactions, { id: genId(), ...tx }] }
        triggerSave(next); return next
      })
    }
    setShowForm(false)
  }
  const deleteTx = (id: string) => {
    setData(p => {
      const next = { ...p, transactions: p.transactions.filter(t => t.id !== id) }
      triggerSave(next); return next
    })
  }

  // ── Keyboard navigation (defined after openNew so no TDZ issue) ──
  const navigateCell = useCallback((dDay: number, dMethod: number) => {
    setFocusedCell(prev => {
      if (!prev) return prev
      const newDayIdx    = Math.max(0, Math.min(days.length - 1,                  prev.dayIdx    + dDay))
      const newMethodIdx = Math.max(0, Math.min(data.paymentMethods.length - 1,   prev.methodIdx + dMethod))
      setFilterDay(days[newDayIdx])
      setFilterMethodId(data.paymentMethods[newMethodIdx]?.id ?? null)
      return { dayIdx: newDayIdx, methodIdx: newMethodIdx }
    })
  }, [days, data.paymentMethods])

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!focusedCell || showForm) return
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); navigateCell(1, 0);  break
      case 'ArrowLeft':  e.preventDefault(); navigateCell(-1, 0); break
      case 'ArrowDown':  e.preventDefault(); navigateCell(0, 1);  break
      case 'ArrowUp':    e.preventDefault(); navigateCell(0, -1); break
      case 'Enter':
        e.preventDefault()
        e.shiftKey ? navigateCell(0, -1) : navigateCell(0, 1)
        break
      case 'Tab':
        e.preventDefault()
        e.shiftKey ? navigateCell(-1, 0) : navigateCell(1, 0)
        break
      case ' ':
        e.preventDefault()
        openNew(days[focusedCell.dayIdx], data.paymentMethods[focusedCell.methodIdx]?.id)
        break
      case 'Escape':
        setFocusedCell(null); setFilterDay(null); setFilterMethodId(null)
        break
    }
  }, [focusedCell, showForm, days, data.paymentMethods, navigateCell, openNew])

  const monthLabel = `${THAI_MONTHS[mo - 1]} ${year}`
  const hasFilter  = filterDay !== null || filterMethodId !== null || searchText !== ''

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-full mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">บันทึกค่าใช้จ่ายรายวัน</h1>
            <p className="text-sm text-gray-400">เดือน {monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const d   = new Date(today.getFullYear(), today.getMonth() - 12 + i)
                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                return <option key={val} value={val}>{THAI_MONTHS[d.getMonth()]} {d.getFullYear()}</option>
              })}
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

        {/* ── Settings bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-wrap items-end gap-5">
            {[
              { label: 'งบต่อวัน', key: 'limit_per_day' as const },
              { label: 'เงินพิเศษ', key: 'monthly_extras' as const },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-400 mb-1">{f.label} (บาท)</label>
                <input
                  type="number"
                  value={data[f.key] || ''}
                  onChange={e => { setData(p => { const next = { ...p, [f.key]: parseFloat(e.target.value) || 0 }; triggerSave(next); return next }) }}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-28 text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
            ))}
            <div className="flex gap-5 flex-1 flex-wrap">
              {[
                { label: 'งบรวม',   val: totalBudget, cls: 'text-blue-600'    },
                { label: 'ใช้ไป',   val: totalSpent,  cls: totalSpent > totalBudget ? 'text-red-600' : 'text-gray-700' },
                { label: 'คงเหลือ', val: netRemain,   cls: netRemain < 0 ? 'text-red-600' : 'text-emerald-600' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold ${s.cls}`}>{fmt(s.val, 0)}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowMgmt(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              ⚙ จัดการรายการ {showMgmt ? '▲' : '▼'}
            </button>
          </div>

          {showMgmt && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3 font-medium">ช่องทางชำระเงิน</p>
              <div className="flex flex-wrap gap-2">
                {data.paymentMethods.map(m => (
                  <div key={m.id} className="group/chip flex items-center gap-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5">
                    <input type="text" value={m.label} onChange={e => renameMethod(m.id, e.target.value)}
                      className="text-sm text-gray-700 bg-transparent border-0 focus:outline-none w-20" />
                    <button onClick={() => removeMethod(m.id)} className="text-gray-200 hover:text-red-400 text-lg leading-none">×</button>
                  </div>
                ))}
                <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
                  <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMethod()}
                    placeholder="ชื่อใหม่…"
                    className="text-sm bg-transparent border-0 focus:outline-none w-20 text-blue-700 placeholder-blue-300" />
                  <button onClick={addMethod} className="text-blue-600 hover:text-blue-800 font-bold text-base leading-none">+</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Grid Table (read-only, click to filter, arrow/enter/tab to navigate) ── */}
        <div
          ref={tableWrapRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto mb-4 focus:outline-none"
        >
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">สรุปรายวัน</span>
            <span className="text-xs text-gray-400">— คลิกเซลล์เพื่อเลือก</span>
            {focusedCell && (
              <span className="text-[10px] text-gray-400 ml-auto hidden sm:flex gap-2">
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded">↑↓←→</kbd> เลื่อน
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Tab</kbd> คอลัมน์ถัดไป
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Enter</kbd> แถวถัดไป
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Space</kbd> บันทึก
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd> ยกเลิก
              </span>
            )}
          </div>
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200">
                <th className="sticky left-0 z-20 bg-slate-50 border-r border-gray-200 px-4 py-3 text-left font-semibold text-gray-600 min-w-[110px]">
                  รายการ
                </th>
                <th className="sticky left-[110px] z-20 bg-slate-50 border-r border-gray-200 px-3 py-3 text-right font-semibold text-gray-600 min-w-[80px]">
                  รวม
                </th>
                {days.map(d => {
                  const dow      = (firstDow + d - 1) % 7
                  const isWknd   = dow === 0 || dow === 6
                  const isTodayD = year === today.getFullYear() && mo === today.getMonth() + 1 && d === today.getDate()
                  const isActive = filterDay === d
                  return (
                    <th key={d} className={`border-r border-gray-100 px-1 py-2 text-center min-w-[54px] cursor-pointer hover:bg-blue-50 transition-colors ${
                      isActive ? 'bg-blue-200' : isTodayD ? 'bg-blue-100' : isWknd ? 'bg-slate-100' : ''
                    }`}
                      onClick={() => { setFilterDay(filterDay === d ? null : d); setFilterMethodId(null); setTimeout(() => txListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100) }}
                    >
                      <div className={`font-bold ${isActive ? 'text-blue-800' : isTodayD ? 'text-blue-700' : 'text-gray-600'}`}>
                        {String(d).padStart(2, '0')}
                      </div>
                      <div className={`text-[10px] ${isWknd ? 'text-blue-400' : 'text-gray-400'}`}>{DOW_TH[dow]}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.paymentMethods.map((method, ri) => (
                <tr key={method.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="sticky left-0 z-10 bg-inherit border-b border-r border-gray-100 px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                    {method.label}
                  </td>
                  <td className="sticky left-[110px] z-10 bg-inherit border-b border-r border-gray-100 px-3 py-2 text-right font-medium text-gray-500">
                    {rowTotal(method.id) !== 0
                      ? <span className={rowTotal(method.id) < 0 ? 'text-emerald-600' : ''}>{fmt(rowTotal(method.id), 0)}</span>
                      : <span className="text-gray-200">—</span>}
                  </td>
                  {days.map((d, di) => {
                    const val      = getVal(d, method.id)
                    const dow      = (firstDow + d - 1) % 7
                    const isWknd   = dow === 0 || dow === 6
                    const isTD     = year === today.getFullYear() && mo === today.getMonth() + 1 && d === today.getDate()
                    const isActive  = filterDay === d && filterMethodId === method.id
                    const isFocused = focusedCell?.dayIdx === di && focusedCell?.methodIdx === ri
                    return (
                      <td
                        key={d}
                        onClick={() => handleCellClick(d, method.id)}
                        className={`border-b border-r border-gray-50 px-1 py-2 text-right cursor-pointer hover:bg-blue-50 transition-colors select-none ${
                          isFocused ? 'bg-blue-200 ring-2 ring-inset ring-blue-600' :
                          isActive  ? 'bg-blue-100 ring-1 ring-inset ring-blue-400' :
                          isTD ? 'bg-blue-50/40' : isWknd ? 'bg-slate-50/60' : ''
                        }`}
                      >
                        {val !== 0
                          ? <span className={`font-medium ${val < 0 ? 'text-emerald-600' : 'text-gray-800'}`}>{fmt(val, 0)}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Total */}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-100 border-b border-r border-gray-200 px-4 py-2 text-gray-700">รวมทั้งหมด</td>
                <td className="sticky left-[110px] z-10 bg-gray-100 border-b border-r border-gray-200 px-3 py-2 text-right text-gray-800">
                  {fmt(totalSpent, 0)}
                </td>
                {days.map(d => {
                  const t = dayTotal(d)
                  return (
                    <td key={d} className="border-b border-r border-gray-200 px-1 py-2 text-right bg-gray-50 text-gray-700">
                      {t !== 0 ? fmt(t, 0) : ''}
                    </td>
                  )
                })}
              </tr>

              {/* Daily Remain */}
              <tr>
                <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-4 py-2 text-gray-600 font-medium">
                  Daily Remain <div className="text-[10px] text-gray-400 font-normal">{data.limit_per_day}/วัน</div>
                </td>
                <td className="sticky left-[110px] z-10 bg-white border-b border-r border-gray-100 px-3 py-2" />
                {days.map((d, i) => {
                  const dr      = dailyRemain[i]
                  const visible = firstSpentIdx !== -1 && i >= firstSpentIdx
                  return (
                    <td key={d} className={`border-b border-r border-gray-100 px-1 py-2 text-right font-medium text-[11px] ${
                      dr < 0 ? 'text-red-500 bg-red-50' : 'text-emerald-600'
                    }`}>
                      {visible ? fmt(dr, 0) : ''}
                    </td>
                  )
                })}
              </tr>

              {/* Month Remain */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-100 border-r border-gray-200 px-4 py-2 text-gray-600 font-medium">
                  Month Remain <div className="text-[10px] text-gray-400 font-normal">เงินพิเศษ + Σ daily</div>
                </td>
                <td className="sticky left-[110px] z-10 bg-slate-100 border-r border-gray-200 px-3 py-2 text-right font-bold text-gray-800">
                  {fmt(netRemain, 0)}
                </td>
                {days.map((d, i) => {
                  const mr      = monthRemain[i]
                  const visible = firstSpentIdx !== -1 && i >= firstSpentIdx
                  return (
                    <td key={d} className={`border-r border-gray-100 px-1 py-2 text-right text-[11px] ${
                      mr < 0 ? 'text-red-500 bg-red-50' : 'text-gray-500'
                    }`}>
                      {visible ? fmt(mr, 0) : ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Transaction list section ── */}
        <div ref={txListRef}>
          {/* Search + filter bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="🔍 ค้นหา ชื่อรายการ, คำอธิบาย, ประเภท…"
                className="flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              {/* Active filter chips */}
              {filterDay !== null && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                  วัน {filterDay}
                  <button onClick={() => setFilterDay(null)} className="hover:text-blue-900 text-sm leading-none">×</button>
                </span>
              )}
              {filterMethodId !== null && (
                <span className="flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                  {data.paymentMethods.find(m => m.id === filterMethodId)?.label ?? filterMethodId}
                  <button onClick={() => setFilterMethodId(null)} className="hover:text-purple-900 text-sm leading-none">×</button>
                </span>
              )}
              {hasFilter && (
                <button
                  onClick={() => { setFilterDay(null); setFilterMethodId(null); setSearchText('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  ล้างตัวกรอง
                </button>
              )}

              <button
                onClick={() => openNew()}
                className="ml-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl shadow-sm transition-colors"
              >
                <span className="text-base leading-none">+</span> บันทึกรายการ
              </button>
            </div>
          </div>

          {/* Transaction count */}
          <p className="text-xs text-gray-400 mb-2 px-1">
            {filteredTxs.length} รายการ {hasFilter ? `(กรองจาก ${data.transactions.length})` : ''}
          </p>

          {/* List */}
          {filteredTxs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center text-gray-400">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-sm">ยังไม่มีรายการ{hasFilter ? 'ที่ตรงกับเงื่อนไข' : ''}</p>
              {!hasFilter && (
                <button onClick={() => openNew()} className="mt-3 text-blue-600 text-sm hover:underline">
                  + เพิ่มรายการแรก
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map(tx => {
                const method = data.paymentMethods.find(m => m.id === tx.methodId)
                return (
                  <div key={tx.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 hover:border-gray-200 transition-colors">
                    {/* Date badge */}
                    <div
                      className="bg-blue-50 text-blue-600 font-bold text-sm rounded-xl w-11 h-11 flex flex-col items-center justify-center shrink-0 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => { setFilterDay(tx.date); setFilterMethodId(null) }}
                      title="กรองตามวันนี้"
                    >
                      <span className="text-[10px] font-normal text-blue-400">วัน</span>
                      <span>{tx.date}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-800 text-sm">
                          {tx.name || <span className="text-gray-400 font-normal italic">ไม่มีชื่อ</span>}
                        </span>
                        {method && (
                          <span
                            className="bg-slate-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100 hover:text-blue-600 transition-colors"
                            onClick={() => { setFilterMethodId(tx.methodId); setFilterDay(null) }}
                            title="กรองตามประเภทนี้"
                          >
                            {method.label}
                          </span>
                        )}
                      </div>
                      {tx.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.description}</p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className={`text-base font-bold shrink-0 ${tx.amount < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount < 0 ? '+' : '−'} {fmt(Math.abs(tx.amount), 0)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(tx)}
                        className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => deleteTx(tx.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FAB ── */}
        <button
          onClick={() => openNew()}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg text-2xl flex items-center justify-center transition-all hover:scale-105 z-20"
          title="บันทึกรายการ"
        >
          +
        </button>
      </div>

      {/* ── Transaction Form Modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitForm() } }}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-gray-800 text-lg">
                {editingId ? '✏️ แก้ไขรายการ' : '➕ บันทึกรายการ'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-300 hover:text-gray-500 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {/* Date */}
              <div className="flex gap-3">
                <div className="w-28">
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                    วันที่ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" min={1} max={daysInMonth}
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-center font-bold"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">ชื่อรายการ</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="เช่น ข้าวกลางวัน"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">ประเภทรายการ</label>
                <select
                  value={form.methodId}
                  onChange={e => setForm(p => ({ ...p, methodId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {data.paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">คำอธิบาย</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                  ยอดค่าใช้จ่าย <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(ติดลบ = เงินคืน / รายรับ)</span>
                </label>
                <input
                  type="number"
                  value={form.amount || ''}
                  onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className={`w-full border rounded-xl px-3 py-2.5 text-right text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    form.amount < 0 ? 'text-emerald-600 border-emerald-200' :
                    form.amount > 0 ? 'text-red-500 border-red-200' : 'border-gray-200 text-gray-800'
                  }`}
                />
                {form.amount !== 0 && (
                  <p className={`text-xs mt-1 text-right font-medium ${
                    form.amount < 0 ? 'text-emerald-500' : 'text-red-400'
                  }`}>
                    {form.amount < 0 ? '↑ รับเงิน / รายรับ' : '↓ จ่ายเงิน / ค่าใช้จ่าย'}
                  </p>
                )}
              </div>

              {formErr && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formErr}</p>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={submitForm}
                disabled={!form.date || form.amount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {editingId ? 'อัปเดต' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
