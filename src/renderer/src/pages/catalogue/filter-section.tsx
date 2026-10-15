import { CheckboxField } from "@renderer/components/checkbox-field/checkbox-field";
import { TextField } from "@renderer/components/text-field/text-field";
import { useFormat } from "@renderer/hooks";
import { useCallback, useMemo, useState } from "react";
import { FilterPopover } from "./filter-popover";
import "./filter.scss";
import List from "rc-virtual-list";
import { useTranslation } from "react-i18next";

export interface FilterSectionProps {
  title: string;
  items: {
    label: string;
    value: string | number;
    checked: boolean;
    group?: string;
  }[];
  groups?: readonly {
    label: string;
    value: string;
  }[];
  onSelect: (value: string | number) => void;
  color: string;
  onClear: () => void;
}

export function FilterSection({
  title,
  items,
  groups,
  color,
  onSelect,
  onClear,
}: FilterSectionProps) {
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { t } = useTranslation("catalogue");

  const availableGroups = useMemo(() => {
    return (groups ?? []).filter((group) =>
      items.some((item) => item.group === group.value)
    );
  }, [groups, items]);

  const activeGroup = useMemo(() => {
    if (
      selectedGroup &&
      availableGroups.some((group) => group.value === selectedGroup)
    ) {
      return selectedGroup;
    }

    return (
      availableGroups.find((group) =>
        items.some((item) => item.checked && item.group === group.value)
      )?.value ??
      availableGroups[0]?.value ??
      null
    );
  }, [availableGroups, items, selectedGroup]);

  const visibleItems = useMemo(() => {
    if (!activeGroup) return items;
    return items.filter((item) => item.group === activeGroup);
  }, [activeGroup, items]);

  const filteredItems = useMemo(() => {
    if (search.length > 0) {
      return visibleItems.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      );
    }

    return visibleItems;
  }, [visibleItems, search]);

  const selectedItemsCount = useMemo(() => {
    return items.filter((item) => item.checked).length;
  }, [items]);

  const onSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const { formatNumber } = useFormat();

  if (!items.length) {
    return null;
  }

  return (
    <FilterPopover title={title} color={color} count={selectedItemsCount}>
      <div className="filter-section">
        <div className="filter-section__content-inner">
          {selectedItemsCount > 0 && (
            <button
              type="button"
              className="filter-section__clear-button"
              onClick={onClear}
            >
              {t("clear_filters", {
                filterCount: formatNumber(selectedItemsCount),
              })}
            </button>
          )}

          {availableGroups.length > 1 && (
            <div
              className="filter-section__group-tabs"
              role="tablist"
              aria-label={title}
            >
              {availableGroups.map((group) => {
                const selectedInGroup = items.filter(
                  (item) => item.checked && item.group === group.value
                ).length;

                return (
                  <button
                    key={group.value}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup === group.value}
                    className={`filter-section__group-tab ${
                      activeGroup === group.value
                        ? "filter-section__group-tab--active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedGroup(group.value);
                      setSearch("");
                    }}
                  >
                    <span>{group.label}</span>
                    {selectedInGroup > 0 && (
                      <span className="filter-section__group-tab-count">
                        {formatNumber(selectedInGroup)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <TextField
            placeholder={t("search")}
            onChange={(e) => onSearch(e.target.value)}
            value={search}
            containerProps={{ className: "filter-section__search" }}
            theme="dark"
          />

          <List
            data={filteredItems}
            height={28 * (filteredItems.length > 8 ? 8 : filteredItems.length)}
            itemHeight={28}
            itemKey="value"
            styles={{
              verticalScrollBar: {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
              },
              verticalScrollBarThumb: {
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: "24px",
              },
            }}
          >
            {(item) => (
              <div key={item.value} className="filter-section__item">
                <CheckboxField
                  label={item.label}
                  checked={item.checked}
                  onChange={() => onSelect(item.value)}
                />
              </div>
            )}
          </List>
        </div>
      </div>
    </FilterPopover>
  );
}
