'use client'

import { useState } from 'react'

type WakuwakuSlot = {
  wakuwakuMasterId: string
  level: string
}

type WakuwakuMaster = {
  id: string
  name: string
}

type WakuwakuEditModalProps = {
  isOpen: boolean
  onClose: () => void
  ownedCharacterId: string
  currentSlots: Array<{
    id: string
    level: string
    wakuwakuMaster: {
      id: string
      name: string
    }
  }>
  allWakuwaku: WakuwakuMaster[]
  onSave: (formData: FormData) => Promise<void>
}

export default function WakuwakuEditModal({
  isOpen,
  onClose,
  ownedCharacterId,
  currentSlots,
  allWakuwaku,
  onSave,
}: WakuwakuEditModalProps) {
  const [slots, setSlots] = useState<WakuwakuSlot[]>(() => {
    const initial = currentSlots.map((slot) => ({
      wakuwakuMasterId: slot.wakuwakuMaster.id,
      level: slot.level,
    }))
    // 最大4個までパディング
    while (initial.length < 4) {
      initial.push({ wakuwakuMasterId: '', level: 'L' })
    }
    return initial
  })

  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSlotChange = (index: number, field: 'wakuwakuMasterId' | 'level', value: string) => {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setSlots(newSlots)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const formData = new FormData()
      formData.append('ownedCharacterId', ownedCharacterId)
      
      // 空でないスロットのみ送信
      const validSlots = slots.filter((slot) => slot.wakuwakuMasterId !== '')
      formData.append('slots', JSON.stringify(validSlots))

      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const clearSlot = (index: number) => {
    const newSlots = [...slots]
    newSlots[index] = { wakuwakuMasterId: '', level: 'L' }
    setSlots(newSlots)
  }

  const applyPreset = (presetType: 'douzoku' | 'gekishu' | 'senkei') => {
    const presets = {
      douzoku: ['同族・加撃', '同族・加撃速', '同族・加命撃'],
      gekishu: ['撃種・加撃', '撃種・加撃速', '撃種・加命撃'],
      senkei: ['戦型・加撃', '戦型・加撃速', '戦型・加命撃'],
    }

    const presetNames = presets[presetType]
    const newSlots = [...slots]

    presetNames.forEach((name, index) => {
      const wakuwaku = allWakuwaku.find((w) => w.name === name)
      if (wakuwaku && index < 3) {
        newSlots[index] = { wakuwakuMasterId: wakuwaku.id, level: 'L' }
      }
    })

    // 4つめのスロットは空にする
    if (newSlots.length > 3) {
      newSlots[3] = { wakuwakuMasterId: '', level: 'L' }
    }

    setSlots(newSlots)
  }

  const clearAll = () => {
    setSlots([
      { wakuwakuMasterId: '', level: 'L' },
      { wakuwakuMasterId: '', level: 'L' },
      { wakuwakuMasterId: '', level: 'L' },
      { wakuwakuMasterId: '', level: 'L' },
    ])
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold">わくわくの実を編集</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* ショートカットボタン */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs text-gray-600 mb-2">クイック設定:</p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => applyPreset('douzoku')}
                className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm font-medium transition-colors"
              >
                同3
              </button>
              <button
                type="button"
                onClick={() => applyPreset('gekishu')}
                className="flex-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm font-medium transition-colors"
              >
                撃3
              </button>
              <button
                type="button"
                onClick={() => applyPreset('senkei')}
                className="flex-1 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-sm font-medium transition-colors"
              >
                戦3
              </button>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors"
            >
              オールクリア
            </button>
          </div>

          <div className="space-y-4">
            {slots.map((slot, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">スロット {index + 1}</span>
                  {slot.wakuwakuMasterId && (
                    <button
                      type="button"
                      onClick={() => clearSlot(index)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      クリア
                    </button>
                  )}
                </div>

                <select
                  value={slot.wakuwakuMasterId}
                  onChange={(e) => handleSlotChange(index, 'wakuwakuMasterId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">なし</option>
                  {allWakuwaku.map((wakuwaku) => (
                    <option key={wakuwaku.id} value={wakuwaku.id}>
                      {wakuwaku.name}
                    </option>
                  ))}
                </select>

                {slot.wakuwakuMasterId && (
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={slot.level === 'L'}
                        onChange={() => handleSlotChange(index, 'level', 'L')}
                        className="mr-2"
                      />
                      <span className="text-sm">L</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={slot.level === 'EL'}
                        onChange={() => handleSlotChange(index, 'level', 'EL')}
                        className="mr-2"
                      />
                      <span className="text-sm">EL</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
