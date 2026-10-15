import { useId, type CSSProperties, type ReactNode } from "react";
import cn from "classnames";
import "./filter-popover.scss";

interface FilterPopoverProps {
  title: string;
  color?: string;
  count?: number;
  className?: string;
  popClassName?: string;
  children: ReactNode;
}

// popover="auto" gives light-dismiss, Esc and one-open-at-a-time for free.
// React 18 doesn't type the attribute, so it goes through a spread.
export function FilterPopover({
  title,
  color,
  count = 0,
  className,
  popClassName,
  children,
}: Readonly<FilterPopoverProps>) {
  const id = useId();
  const style = color ? ({ "--orb": color } as CSSProperties) : undefined;

  return (
    <>
      <button
        type="button"
        className={cn("filter-facet", className)}
        style={style}
        {...{ popovertarget: id }}
      >
        <i className="filter-facet__orb" />
        {title}
        {count > 0 && <span className="filter-facet__count">{count}</span>}
      </button>

      <div
        id={id}
        className={cn("filter-facet-pop", popClassName)}
        style={style}
        {...{ popover: "auto" }}
      >
        {children}
      </div>
    </>
  );
}
