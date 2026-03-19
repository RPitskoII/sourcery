interface ListFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
}

export function ListFilters({
  search,
  onSearchChange,
}: ListFiltersProps) {
  return (
    <div className="list-filters">
      <input
        type="text"
        className="filter-input filter-input-full"
        placeholder="Search company or contact..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search leads"
      />
    </div>
  );
}
