import { SearchField } from "heroui-native/search-field";
import React, { useState } from "react";

type PillSearchFieldProps = {
  placeholder?: string;
  className?: string;
};

/**
 * Full-width pill search using HeroUI SearchField; rounded-full shell for the sell screen.
 */
export function PillSearchField({
  placeholder = "Search items or scan…",
  className = "",
}: PillSearchFieldProps) {
  const [q, setQ] = useState("");

  return (
    <SearchField
      value={q}
      onChange={setQ}
      className={`rounded-full bg-surface-secondary shadow-surface ${className}`}
    >
      <SearchField.Group className="min-h-[48px] rounded-full px-1">
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={placeholder}
          className="rounded-full border-0 bg-transparent py-3 text-[15px] text-field-foreground shadow-none"
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
