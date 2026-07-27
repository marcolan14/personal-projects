'use client'

import { useRef } from 'react'

type Props = {
  value: string
  onChange: (formatted: string) => void
  className?: string
}

export default function TimeInput({ value, onChange, className }: Props) {
  const [rawMin = '', rawSec = ''] = value.split(':')
  const minRef = useRef<HTMLInputElement>(null)
  const secRef = useRef<HTMLInputElement>(null)

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    onChange(`${digits}:${rawSec}`)
    if (digits.length === 2) secRef.current?.focus()
  }

  function handleSecChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    onChange(`${rawMin}:${digits}`)
  }

  function handleMinBlur() {
    if (rawMin) onChange(`${rawMin.padStart(2, '0')}:${rawSec}`)
  }

  function handleSecBlur() {
    if (rawSec) onChange(`${rawMin}:${rawSec.padStart(2, '0')}`)
  }

  function handleSecKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && rawSec === '') minRef.current?.focus()
  }

  return (
    <div className={`flex items-center justify-center gap-1 ${className ?? ''}`}>
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        value={rawMin}
        onChange={handleMinChange}
        onBlur={handleMinBlur}
        placeholder="mm"
        maxLength={2}
        className="w-6 bg-transparent text-inherit placeholder-gray-600 text-center focus:outline-none"
      />
      <span className="opacity-60">:</span>
      <input
        ref={secRef}
        type="text"
        inputMode="numeric"
        value={rawSec}
        onChange={handleSecChange}
        onBlur={handleSecBlur}
        onKeyDown={handleSecKeyDown}
        placeholder="ss"
        maxLength={2}
        className="w-6 bg-transparent text-inherit placeholder-gray-600 text-center focus:outline-none"
      />
    </div>
  )
}
