export function elementBadgeClass(element: string): string {
  switch (element) {
    case '火': return 'bg-fire/12 text-fire'
    case '水': return 'bg-water/12 text-water'
    case '木': return 'bg-wood/12 text-wood'
    case '光': return 'bg-light/15 text-light'
    case '闇': return 'bg-yami/15 text-yami'
    default:  return 'bg-line2 text-dim'
  }
}

export function typeBadgeClass(type: string): string {
  switch (type) {
    case '限定': return 'bg-limited/12 text-limited'
    case 'コラボ': return 'bg-collab/12 text-collab'
    case 'α': return 'bg-alpha/12 text-alpha'
    default:    return 'bg-line2 text-dim' // 恒常など
  }
}
