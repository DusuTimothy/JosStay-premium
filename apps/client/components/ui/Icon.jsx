"use client";

const paths = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M17.5 4.2a3.2 3.2 0 0 1 0 6.2M22 20v-1.5a4 4 0 0 0-3-3.8" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  arrowRight: <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  arrowLeft: <path d="M20 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.7 2.7L16 9.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4.5" />
    </>
  ),
  zap: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  wifi: (
    <>
      <path d="M3 8.5a15 15 0 0 1 18 0M6 12a10.5 10.5 0 0 1 12 0M9.2 15.5a5.5 5.5 0 0 1 5.6 0" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11" />
      <path d="m9 4 3 2 3-2M9 20l3-2 3 2M4.5 10l1-3.5M19.5 10l-1-3.5M4.5 14l1 3.5M19.5 14l-1 3.5" />
    </>
  ),
  car: (
    <>
      <path d="m5 11 1.6-4A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1L19 11" />
      <rect x="3" y="11" width="18" height="6.5" rx="2" />
      <path d="M7 17.5V19M17 17.5V19M6.5 14h.01M17.5 14h.01" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
      <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M7 3.5c0 1 1 1.2 1 2.2M11 3.5c0 1 1 1.2 1 2.2" />
    </>
  ),
  droplets: (
    <>
      <path d="M12 3.5c3 3.6 6 6.8 6 10.2a6 6 0 0 1-12 0c0-3.4 3-6.6 6-10.2Z" />
      <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  star: (
    <path
      d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.6l6.5-.9L12 2.8Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  heart: (
    <path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" />
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.5L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.4Z" />
      <path d="M8.8 8.3c.4 2.9 2.3 4.8 5.2 5.2.7.1 1.2-.4 1.2-1.1v-.8l-1.7-.6-.8.8a5.6 5.6 0 0 1-2.2-2.2l.8-.8-.6-1.7H10c-.7 0-1.2.5-1.2 1.2Z" />
    </>
  ),
  plane: (
    <path d="M10.5 13.5 3 11V8.8l7.5 1.2L14 4h2.4l-1.6 6.4L21 12v2.4l-6.2.7L16 21h-2.4l-3.1-7.5Z" />
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.5 12 4l8.5 5.5M4.5 10h15M6 10v7M10 10v7M14 10v7M18 10v7M3.5 20h17" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3l1.4 4-2 1.4a12 12 0 0 0 6.2 6.2l1.4-2 4 1.4v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="m18.5 14 .9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.5 2" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 9h18M16 13.5h1.5" />
      <path d="M6 6V4.5A1.5 1.5 0 0 1 7.5 3h8" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 10.5 8.5-7 8.5 7V20a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20v-9.5Z" />
      <path d="M9.5 21.5v-7h5v7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V7M3 12h18V18M3 18h18M6.5 9.5h3.2V12H6.5zM13.5 9.5h4V12h-4z" />
    </>
  ),
  bedLogo: (
    <>
      <path d="M3.5 17.5v-9" />
      <path d="M3.5 13.5h17a1.5 1.5 0 0 1 1.5 1.5v2.5" />
      <path d="M3.5 17.5h19" />
      <path d="M6.5 11.5V9.8a1.3 1.3 0 0 1 1.3-1.3h3.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M12.5 11.5V9.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  send: <path d="m21 3-8.5 18-2.6-7L3 11.4 21 3Z" />,
  bath: (
    <>
      <path d="M4 12V5.5A2.5 2.5 0 0 1 6.5 3c1.2 0 2 .7 2.4 1.7" />
      <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3ZM6 19.5V21M18 19.5V21" />
      <path d="M7 12V9.5h4V12" />
    </>
  ),
  ruler: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="1.5" transform="rotate(-30 12 12)" />
      <path d="m8.5 13.5 1.5 .8M11 9.8l1.5 .8M13.5 6.2l1.5 .8" />
    </>
  ),
  filter: <path d="M3 5h18M6.5 12h11M10 19h4" />,
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17.5h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17.7 17.7 0 0 1-3.1 3.8" />
      <path d="M6.2 6.7A17.7 17.7 0 0 0 2.5 12s3.5 6 9.5 6c1.8 0 3.4-.5 4.7-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" />
      <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  dashboard: (
    <>
      <path d="M3.5 20.5h17M5 20.5V9l7-5 7 5v11.5" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.8, ...rest }) {
  const shape = paths[name] || paths.search;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {shape}
    </svg>
  );
}
