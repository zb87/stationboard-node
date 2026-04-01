/**
 * Map common Swiss transport service names to color classes.
 */
export function getServiceColorClass(name) {
  const n = (name || '').toUpperCase();
  if (n.startsWith('S')) return 'badge-sbahn';
  if (n.startsWith('IC') || n.startsWith('EC')) return 'badge-intercity';
  if (n.startsWith('IR') || n.startsWith('VAE') || n.startsWith('LIX')) return 'badge-interregio';
  if (n.startsWith('TGV') || n.startsWith('RJ')) return 'badge-highspeed';
  if (n.startsWith('R')) return 'badge-regio';
  if (n.startsWith('T') || n.startsWith('TRAM')) return 'badge-tram';
  if (n.startsWith('B') || n.startsWith('BUS')) return 'badge-bus';
  return 'badge-default';
}

/**
 * Check if the estimated platform is a refinement of the planned platform.
 * e.g. planned="41/42" estimated="41" → refinement (just narrowing down)
 * e.g. planned="11" estimated="5" → real change
 */
export function isPlatformRefinement(planned, estimated) {
  if (!planned || !estimated) return false;
  const parts = String(planned).split('/').map((p) => p.trim());
  return parts.includes(String(estimated).trim());
}
