export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function formatConfidencePercent(confidence: number): string {
  if (confidence > 1) return `${confidence.toFixed(1)}%`;
  return `${(confidence * 100).toFixed(1)}%`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatArea(area: number): string {
  return `${area.toFixed(2)} acres`;
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getAnimalIcon(species: string): string {
  if (!species) return '🐾';
  const clean = species.trim().toLowerCase().replace(/_/g, ' ');
  if (clean.includes('boar') || clean.includes('pig')) return '🐗';
  if (clean.includes('elephant')) return '🐘';
  if (clean.includes('tiger')) return '🐅';
  if (clean.includes('leopard')) return '🐆';
  if (clean.includes('bear')) return '🐻';
  if (clean.includes('gaur') || clean.includes('bison')) return '🦬';
  if (clean.includes('deer')) return '🦌';
  if (clean.includes('monkey')) return '🐒';
  if (clean.includes('snake')) return '🐍';
  return '🐾';
}
