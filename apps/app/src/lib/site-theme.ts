export type NavItem = {
  label: string
  href: string
}

export const siteTheme = {
  brand: {
    mark: '◆',
    name: 'Your App',
    strapline: 'Replace this copy in src/lib/site-theme.ts',
  },
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Demo table', href: '/demo' },
    { label: 'About', href: '/about' },
  ] satisfies NavItem[],
  footer: {
    summary: 'TanStack Start frontend, Hono API on AWS Lambda, Drizzle + Postgres, Better Auth.',
    links: [{ label: 'About', href: '/about' }],
  },
}
