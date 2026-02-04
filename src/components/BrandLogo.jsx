function BrandLogo({ variant = 'full', className = '', title = 'Cashflow', decorative = true }) {
  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': title };

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 56 56"
        fill="none"
        className={className}
        {...accessibilityProps}
      >
        <circle cx="28" cy="28" r="21" stroke="currentColor" strokeWidth="2.8" />
        <path
          d="M16 23c3.2-3.2 8-3.2 12.8 0 4.8 3.2 9.6 3.2 12.2 0"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M16 33c3.2-3.2 8-3.2 12.8 0 4.8 3.2 9.6 3.2 12.2 0"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 360 64"
      fill="none"
      className={className}
      {...accessibilityProps}
    >
      <circle cx="30" cy="32" r="22" stroke="currentColor" strokeWidth="2.8" />
      <path
        d="M17 26c3.4-3.4 8.4-3.4 13.4 0 5.2 3.4 10.2 3.4 13.2 0"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M17 37c3.4-3.4 8.4-3.4 13.4 0 5.2 3.4 10.2 3.4 13.2 0"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <text
        x="64"
        y="44"
        fill="currentColor"
        fontFamily="Plus Jakarta Sans, Avenir Next, Segoe UI, sans-serif"
        fontSize="38"
        fontWeight="500"
        letterSpacing="0.4"
      >
        cashflow
      </text>
    </svg>
  );
}

export default BrandLogo;
