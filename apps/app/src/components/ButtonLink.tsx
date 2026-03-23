import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

type ButtonLinkProps = {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
  icon?: boolean
  className?: string
}

const variantClasses: Record<NonNullable<ButtonLinkProps['variant']>, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
  icon: 'icon-button',
}

export default function ButtonLink({
  href,
  children,
  variant = 'primary',
  icon = false,
  className = '',
}: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={`${variantClasses[variant]} ${className}`.trim()}
    >
      <span>{children}</span>
      {icon ? <ArrowRight aria-hidden="true" size={16} /> : null}
    </a>
  )
}
