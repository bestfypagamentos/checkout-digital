/**
 * Bestfy logo mark — "b" branco sobre fundo verde arredondado.
 * Props:
 *   size  — tamanho total do container (default: 40)
 *   className — classes extras para o container
 */
export default function BestfyIcon({ size = 40, className = '' }) {
  return (
    <div
      className={`rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 22 26"
        fill="none"
        style={{ width: size * 0.62, height: size * 0.62 }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 1 L8 1 L8 11 Q20 11 20 18 Q20 25 8 25 L2 25 Z
             M8 14 Q16 14 16 18 Q16 22 8 22 Z"
          fill="white"
        />
      </svg>
    </div>
  )
}
