// The console's line icons.
//
// Written out here rather than pulled from an icon package: the whole
// application needs about twenty marks, and a local set keeps them on one
// grid, one stroke weight and one colour rule without adding a dependency
// whose tree-shaking has to be trusted.
//
// Every icon inherits currentColor and the surrounding font size through the
// shared wrapper, so an icon put next to a label matches it without being
// styled again. They are decoration in every place they are used - the label,
// the value or the aria-label beside them carries the meaning - so each one is
// hidden from assistive technology by default.

function Icon({ size = 18, strokeWidth = 1.75, children, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ---------- Navigation ---------- */

export function DashboardIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  )
}

export function ProjectsIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12h18" />
    </Icon>
  )
}

export function EmployeesIcon(props) {
  return (
    <Icon {...props}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a4 4 0 0 1 0 7.75" />
    </Icon>
  )
}

export function DepartmentsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 10h4a1 1 0 0 1 1 1v10" />
      <path d="M2 21h20" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </Icon>
  )
}

export function ProductsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 8.5v7a1.5 1.5 0 0 1-.8 1.32l-7 3.8a1.5 1.5 0 0 1-1.4 0l-7-3.8A1.5 1.5 0 0 1 4 15.5v-7" />
      <path d="M3.8 7.18 11.3 3.1a1.5 1.5 0 0 1 1.4 0l7.5 4.08a.5.5 0 0 1 0 .88l-7.5 4.08a1.5 1.5 0 0 1-1.4 0L3.8 8.06a.5.5 0 0 1 0-.88Z" />
      <path d="M12 12.4V20" />
    </Icon>
  )
}

export function InvestmentsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h13A1.5 1.5 0 0 1 19 6.5V8" />
      <rect x="3" y="8" width="18" height="11" rx="1.5" />
      <path d="M16 13.5h2" />
    </Icon>
  )
}

export function ReportsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21" />
      <path d="M7 16v-4" />
      <path d="M12 16V7" />
      <path d="M17 16v-6" />
    </Icon>
  )
}

export function SchemaIcon(props) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" />
      <path d="M4.5 11.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" />
    </Icon>
  )
}

/* ---------- Shell controls ---------- */

export function MenuIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 6h17M3.5 12h17M3.5 18h17" />
    </Icon>
  )
}

export function CloseIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function SunIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </Icon>
  )
}

export function MoonIcon(props) {
  return (
    <Icon {...props}>
      <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
    </Icon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Icon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Icon>
  )
}

export function ChevronUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 14.5 12 8l6.5 6.5" />
    </Icon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 9.5 12 16l6.5-6.5" />
    </Icon>
  )
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12h15" />
      <path d="M13.5 6.5 19 12l-5.5 5.5" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </Icon>
  )
}

export function LogOutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8.5 14 12l-4 3.5" />
      <path d="M14 12H4" />
    </Icon>
  )
}

/* ---------- Figures and states ---------- */

export function BudgetIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.2A3 3 0 0 0 12 8c-1.5 0-2.6.8-2.6 2s1.1 1.8 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2a3 3 0 0 1-2.5-1.2" />
      <path d="M12 6.4v11.2" />
    </Icon>
  )
}

export function GaugeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.6 18a9 9 0 1 1 16.8 0" />
      <path d="m14.5 9.5-3 4.5" />
      <circle cx="12" cy="15" r="1.4" />
    </Icon>
  )
}

export function ActivityIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2.5-6.5 5 13L17.5 12H21" />
    </Icon>
  )
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.2 2" />
    </Icon>
  )
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.7 4.2 2.9 17.5A1.5 1.5 0 0 0 4.2 20h15.6a1.5 1.5 0 0 0 1.3-2.5L13.3 4.2a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.8h.01" />
    </Icon>
  )
}

export function SparkIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 8 18 9.5 13.6 11 12 15.5 10.4 11 6 9.5 10.4 8Z" />
      <path d="M18.5 15.5 19.2 17.6l2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7Z" />
    </Icon>
  )
}

export function InboxIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 13h4l1.2 2.4a1 1 0 0 0 .9.6h4.8a1 1 0 0 0 .9-.6L16.5 13h4" />
      <path d="M5.6 5.4 3.7 12.3a2 2 0 0 0-.2.8V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.9a2 2 0 0 0-.2-.8l-1.9-6.9a2 2 0 0 0-1.9-1.4H7.5a2 2 0 0 0-1.9 1.4Z" />
    </Icon>
  )
}

export function CheckCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Icon>
  )
}

/* ---------- Analysis screens ---------- */

export function PrinterIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 9V4.5A.5.5 0 0 1 7.5 4h9a.5.5 0 0 1 .5.5V9" />
      <path d="M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </Icon>
  )
}

export function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4v10" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M4.5 18.5h15" />
    </Icon>
  )
}

export function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="1.8" />
      <path d="M15 6.5V5.8A1.8 1.8 0 0 0 13.2 4H5.8A1.8 1.8 0 0 0 4 5.8v7.4A1.8 1.8 0 0 0 5.8 15h.7" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
      <path d="M10.5 10v6.5M13.5 10v6.5" />
    </Icon>
  )
}

export function RefreshIcon(props) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5V9H15" />
    </Icon>
  )
}

export function SaveIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 4h9.8L20 8.7v9.8A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4Z" />
      <path d="M8 4v5h6V4" />
      <rect x="8" y="13" width="8" height="7" rx="1" />
    </Icon>
  )
}

export function TableIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.8" />
      <path d="M3.5 9.5h17" />
      <path d="M9.5 9.5V19" />
    </Icon>
  )
}

export function ChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7.5" y="12" width="3.2" height="5" rx="0.8" />
      <rect x="13.5" y="8" width="3.2" height="9" rx="0.8" />
    </Icon>
  )
}

export function CodeIcon(props) {
  return (
    <Icon {...props}>
      <path d="m8.5 8.5-4 3.5 4 3.5" />
      <path d="m15.5 8.5 4 3.5-4 3.5" />
      <path d="m13.5 5-3 14" />
    </Icon>
  )
}

export function InfoIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </Icon>
  )
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.8" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </Icon>
  )
}

export function FilterIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </Icon>
  )
}
