import bestfyIcon from '../assets/bestfy-icon.svg'

export default function BestfyIcon({ size = 40, className = '' }) {
  return (
    <img
      src={bestfyIcon}
      alt="Bestfy"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
