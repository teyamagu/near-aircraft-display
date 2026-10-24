import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { aircraft, enrichment } from '../test/fixtures.ts'
import { buildDisplay } from '../lib/format.ts'
import { AircraftList } from './AircraftList.tsx'
import { LedPanel } from './LedPanel.tsx'
import { StatusBar } from './StatusBar.tsx'

describe('LedPanel', () => {
  it('待機中の文言を出す', () => {
    render(<LedPanel display={null} idle={{ line1: 'STANDBY', line2: 'NO POSITION' }} />)
    expect(screen.getByText('STANDBY')).toBeTruthy()
    expect(screen.getByText('NO POSITION')).toBeTruthy()
  })

  it('選択中の便の路線と残距離を出す', () => {
    const display = buildDisplay(aircraft(), enrichment(), new Date(2026, 9, 24, 12, 0, 0))
    render(<LedPanel display={display} idle={{ line1: 'STANDBY', line2: 'NO POSITION' }} />)
    expect(screen.getByRole('region', { name: '選択中の機体 JAL39' })).toBeTruthy()
    expect(screen.getByText('HND -> TSA')).toBeTruthy()
    expect(screen.getByText(/km to go$/)).toBeTruthy()
  })
})

describe('AircraftList', () => {
  it('空のときは案内を出す', () => {
    render(
      <AircraftList
        aircraft={[]}
        entries={{}}
        selectedHex={null}
        onSelect={() => undefined}
        emptyMessage="半径内に飛行中の機体はありません"
        now={new Date()}
      />,
    )
    expect(screen.getByText('半径内に飛行中の機体はありません')).toBeTruthy()
  })

  it('クリックした機体を選ぶ', () => {
    const onSelect = vi.fn()
    render(
      <AircraftList
        aircraft={[aircraft()]}
        entries={{}}
        selectedHex={null}
        onSelect={onSelect}
        emptyMessage={null}
        now={new Date()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /JAL39/ }))
    expect(onSelect).toHaveBeenCalledWith('86e7e6')
  })
})

describe('StatusBar', () => {
  const props = {
    position: null,
    radiusKm: 80,
    onRadiusChange: vi.fn(),
    onRequestLocation: vi.fn(),
    onRefresh: vi.fn(),
    onManualPosition: vi.fn(),
    loading: false,
    hasError: false,
    lastUpdated: null,
  }

  it('範囲外の座標は受け付けない', () => {
    render(<StatusBar {...props} />)
    fireEvent.change(screen.getByLabelText('緯度'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('経度'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    expect(screen.getByText(/緯度 -90〜90/)).toBeTruthy()
    expect(props.onManualPosition).not.toHaveBeenCalled()
  })

  it('正しい座標を渡す', () => {
    const onManualPosition = vi.fn()
    render(<StatusBar {...props} onManualPosition={onManualPosition} />)
    fireEvent.change(screen.getByLabelText('緯度'), { target: { value: '35.6812' } })
    fireEvent.change(screen.getByLabelText('経度'), { target: { value: '139.7671' } })
    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    expect(onManualPosition).toHaveBeenCalledWith(35.6812, 139.7671)
  })
})
