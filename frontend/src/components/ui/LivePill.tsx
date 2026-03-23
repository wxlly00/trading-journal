export function LivePill({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${connected ? 'bg-green/10 text-green' : 'bg-subtle text-[#999]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green animate-pulse' : 'bg-[#ccc]'}`} />
      {connected ? 'EA Connecté' : 'EA Déconnecté'}
    </span>
  )
}
