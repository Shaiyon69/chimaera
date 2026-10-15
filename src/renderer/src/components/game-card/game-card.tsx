import type { ShopAssets } from "@types";

import "./game-card.scss";

export interface GameCardProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  game: ShopAssets;
}

export function GameCard({ game, ...props }: GameCardProps) {
  return (
    <button {...props} type="button" className="game-card">
      <div className="game-card__media">
        <img
          src={game.libraryImageUrl ?? undefined}
          alt=""
          className="game-card__cover"
          loading="lazy"
        />
      </div>
      <div className="game-card__label">
        <p className="game-card__title">{game.title}</p>
      </div>
    </button>
  );
}
