interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className = '' }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#6255E7" />
      <rect x="7" y="8" width="18" height="4.2" rx="2.1" fill="#FFFFFF" />
      <rect x="12.5" y="10" width="4.2" height="14" rx="2.1" fill="#FFFFFF" />
      <rect x="19" y="19.5" width="6" height="3.6" rx="1.8" fill="#FFFFFF" />
    </svg>
  );
}
