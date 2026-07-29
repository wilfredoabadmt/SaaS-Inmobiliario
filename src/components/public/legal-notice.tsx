/**
 * Aviso visible en todas las páginas legales recomendando revisión profesional.
 */
export function LegalNotice() {
  return (
    <div
      role="note"
      className="rounded-lg border border-[#fce8c8] bg-[#fff8ed] px-5 py-4 text-sm text-[#9a5b00]"
    >
      <strong className="font-[650]">Aviso importante:</strong> Este documento
      es una plantilla informativa elaborada con base en el funcionamiento real
      del producto. No constituye asesoría legal. Se recomienda la revisión por
      un profesional jurídico antes de su uso en producción comercial.
    </div>
  );
}
