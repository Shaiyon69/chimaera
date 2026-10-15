import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { format } from "date-fns";
import { getDateLocale } from "@shared";
import { gameDetailsContext } from "@renderer/context";
import "./description-header.scss";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function formatReleaseDate(rawDate: string, language: string) {
  if (!ISO_DATE_REGEX.test(rawDate)) return rawDate;

  const parsed = new Date(`${rawDate}T00:00:00`);
  if (isNaN(parsed.getTime())) return rawDate;

  return format(parsed, "MMM d, yyyy", { locale: getDateLocale(language) });
}

export function DescriptionHeader() {
  const { shopDetails } = useContext(gameDetailsContext);
  const { i18n } = useTranslation("game_details");

  if (!shopDetails) return null;

  const displayDate = formatReleaseDate(
    shopDetails?.release_date.date ?? "",
    i18n.language
  );

  const meta = [
    shopDetails.developers?.join(", "),
    shopDetails.publishers?.join(", "),
    displayDate,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="description-header">
      {meta && <p className="description-header__meta">{meta}</p>}

      {!!shopDetails.genres?.length && (
        <div className="description-header__chips">
          {shopDetails.genres.map((genre) => (
            <span key={genre.id} className="description-header__chip">
              {genre.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
