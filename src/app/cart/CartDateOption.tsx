'use client'

import React from 'react'

interface CartDateOptionProps {
  date: string
  day: string
  month: string
  dayOfWeek: string
  isSelected: boolean
  isDisabled: boolean
  reason: string | null
  isTooltipVisible: boolean
  tooltipPositionClass: string
  arrowPositionClass: string
  onSelect: (date: string) => void
  onUnavailableInteract: (date: string, reason: string) => void
  onUnavailableHoverStart: (date: string, reason: string) => void
  onUnavailableHoverEnd: () => void
}

export default function CartDateOption({
  date,
  day,
  month,
  dayOfWeek,
  isSelected,
  isDisabled,
  reason,
  isTooltipVisible,
  tooltipPositionClass,
  arrowPositionClass,
  onSelect,
  onUnavailableInteract,
  onUnavailableHoverStart,
  onUnavailableHoverEnd,
}: CartDateOptionProps) {
  const baseClasses = `w-16 text-center rounded-lg p-2 border-2 transition-all duration-200 ${
    isSelected ? 'genie-control-selected text-purple-900' : 'border-purple-100 bg-white'
  } ${
    isDisabled
      ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-70 cursor-not-allowed'
      : 'hover:border-purple-300'
  }`

  const content = (
    <>
      <span className={`block text-xs font-semibold ${isDisabled ? 'text-slate-400' : 'text-slate-500'}`}>{month}</span>
      <span className={`block text-xl font-bold ${isDisabled ? 'text-slate-400' : 'text-slate-800'}`}>{day}</span>
      <span className={`block text-[10px] font-medium ${isDisabled ? 'text-slate-400' : 'text-slate-500'}`}>
        {dayOfWeek.substring(0, 3)}
      </span>
    </>
  )

  return (
    <div className="relative shrink-0">
      {isDisabled ? (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className={`${baseClasses} pointer-events-none`}
          >
            {content}
          </button>
          {reason ? (
            <button
              type="button"
              className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
              aria-label={`${month} ${day} unavailable. ${reason}`}
              onClick={() => onUnavailableInteract(date, reason)}
              onFocus={() => onUnavailableHoverStart(date, reason)}
              onBlur={onUnavailableHoverEnd}
              onMouseEnter={() => onUnavailableHoverStart(date, reason)}
              onMouseLeave={onUnavailableHoverEnd}
            >
              <span className="sr-only">{reason}</span>
            </button>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(date)}
          className={baseClasses}
        >
          {content}
        </button>
      )}
      {isTooltipVisible && reason ? (
        <div className={`absolute bottom-full mb-2 ${tooltipPositionClass} w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-100 animate-fade-in-fast shadow-lg pointer-events-none whitespace-normal`}>
          {reason}
          <div className={`absolute ${arrowPositionClass} top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800`} />
        </div>
      ) : null}
    </div>
  )
}
