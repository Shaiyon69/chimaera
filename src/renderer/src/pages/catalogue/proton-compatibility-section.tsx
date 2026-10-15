import { CheckboxField } from "@renderer/components/checkbox-field/checkbox-field";
import { RadioField } from "@renderer/components/radio-field/radio-field";
import { FilterPopover } from "./filter-popover";
import SteamDeckLogo from "@renderer/assets/steam-deck-logo.svg?url";

import "./proton-compatibility-section.scss";

interface ProtonCompatibilitySectionProps {
  title: string;
  protonSliderLabel: string;
  deckSliderLabel: string;
  protonOptions: { value: string; label: string; color?: string }[];
  protonValue: string;
  deckChecked: boolean;
  deckLabel: string;
  color: string;
  onProtonChange: (value: string) => void;
  onDeckChange: (checked: boolean) => void;
}

export function ProtonCompatibilitySection({
  title,
  protonSliderLabel,
  deckSliderLabel,
  protonOptions,
  protonValue,
  deckChecked,
  deckLabel,
  color,
  onProtonChange,
  onDeckChange,
}: ProtonCompatibilitySectionProps) {
  return (
    <FilterPopover
      title={title}
      color={color}
      count={(protonValue !== "" ? 1 : 0) + (deckChecked ? 1 : 0)}
    >
      <div className="filter-section proton-compatibility-section">
        <div className="filter-section__content-inner proton-compatibility-section__content-inner">
          <div className="proton-compatibility-section__control">
            <span className="proton-compatibility-section__label">
              {protonSliderLabel}
            </span>

            <div className="proton-compatibility-section__option-list">
              {protonOptions.map((option) => (
                <div key={option.value}>
                  <RadioField
                    name="protondb-tier-filter"
                    value={option.value}
                    checked={protonValue === option.value}
                    onChange={() => onProtonChange(option.value)}
                    onClick={(event) => {
                      if (protonValue === option.value) {
                        event.preventDefault();
                        onProtonChange("");
                      }
                    }}
                    className="proton-compatibility-section__option-item"
                    labelClassName="proton-compatibility-section__option-label"
                    label={option.label}
                    leftSlot={
                      <span
                        className="proton-compatibility-section__option-orb"
                        aria-hidden="true"
                        style={{
                          backgroundColor:
                            option.color ?? "rgba(255, 255, 255, 0.32)",
                        }}
                      />
                    }
                    aria-label={option.label}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="proton-compatibility-section__control">
            <span className="proton-compatibility-section__label proton-compatibility-section__label--deck">
              <img
                src={SteamDeckLogo}
                alt=""
                aria-hidden="true"
                className="proton-compatibility-section__deck-icon"
              />
              {deckSliderLabel}
            </span>

            <CheckboxField
              label={deckLabel}
              checked={deckChecked}
              onChange={(event) => onDeckChange(event.target.checked)}
            />
          </div>
        </div>
      </div>
    </FilterPopover>
  );
}
