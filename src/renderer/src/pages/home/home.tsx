import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { levelDBService } from "@renderer/services/leveldb.service";
import { orderBy } from "lodash-es";
import { useNavigate } from "react-router-dom";

import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

import { Button, GameCard, Hero } from "@renderer/components";
import type { DownloadSource, ShopAssets, Steam250Game } from "@types";

import flameIconAnimated from "@renderer/assets/icons/flame-animated.gif";
import starsIconAnimated from "@renderer/assets/icons/stars-animated.gif";

import { logger } from "@renderer/logger";
import { buildGameDetailsPath, ensureArray } from "@renderer/helpers";
import { CatalogueCategory } from "@shared";
import "./home.scss";

const categories = Object.values(CatalogueCategory);

// Seconds each card takes to pass by; keeps speed constant across row lengths.
const SECONDS_PER_CARD = 4;

export default function Home() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();

  const [loading, setLoading] = useState<Record<CatalogueCategory, boolean>>({
    [CatalogueCategory.Hot]: true,
    [CatalogueCategory.Weekly]: true,
    [CatalogueCategory.Achievements]: true,
  });
  const [randomGame, setRandomGame] = useState<Steam250Game | null>(null);

  const [catalogue, setCatalogue] = useState<
    Record<CatalogueCategory, ShopAssets[]>
  >({
    [CatalogueCategory.Hot]: [],
    [CatalogueCategory.Weekly]: [],
    [CatalogueCategory.Achievements]: [],
  });

  const getCatalogue = useCallback(async (category: CatalogueCategory) => {
    try {
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const downloadSources = orderBy(sources, "createdAt", "desc");

      const params = {
        take: 12,
        skip: 0,
        downloadSourceIds: downloadSources.map((source) => source.id),
      };

      // The API often resets the first connection at startup, so retry.
      let result: ShopAssets[] | undefined;
      for (let attempt = 1; !result; attempt++) {
        try {
          result = await window.electron.hydraApi.get<ShopAssets[]>(
            `/catalogue/${category}`,
            {
              params,
              needsAuth: false,
            }
          );
        } catch (error) {
          if (attempt >= 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
      }

      setCatalogue((prev) => ({
        ...prev,
        [category]: ensureArray<ShopAssets>(result, `/catalogue/${category}`),
      }));
    } catch (error) {
      // One failing row must not break the others.
      logger.error(`Failed to load catalogue ${category}`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, []);

  const getRandomGame = useCallback(() => {
    window.electron.getRandomGame().then((game) => {
      if (game) setRandomGame(game);
    });
  }, []);

  const handleRandomizerClick = () => {
    if (randomGame) {
      navigate(
        buildGameDetailsPath(
          { ...randomGame, shop: "steam" },
          {
            fromRandomizer: "1",
          }
        )
      );
    }
  };

  useEffect(() => {
    categories.forEach(getCatalogue);
    getRandomGame();
  }, [getCatalogue, getRandomGame]);

  return (
    <SkeletonTheme baseColor="#0c0c0c" highlightColor="#444">
      <section className="home__content">
        <Hero />

        <section className="home__header">
          <Button
            onClick={handleRandomizerClick}
            theme="outline"
            disabled={!randomGame}
          >
            <div className="home__icon-wrapper">
              <img
                src={starsIconAnimated}
                alt=""
                className="home__stars-icon"
              />
            </div>
            {t("surprise_me")}
          </Button>
        </section>

        {categories.map((category) => {
          const games = catalogue[category];

          return (
            <section className="home__row" key={category}>
              <h2 className="home__title">
                {category === CatalogueCategory.Hot && (
                  <div className="home__title-icon">
                    <img
                      src={flameIconAnimated}
                      alt=""
                      className="home__title-flame-icon"
                    />
                  </div>
                )}

                {t(category)}
              </h2>

              {loading[category] ? (
                <div className="home__skeleton-row">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div className="home__marquee-item" key={index}>
                      <Skeleton className="home__card-skeleton" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="home__marquee">
                  <div
                    className="home__marquee-track"
                    style={
                      {
                        "--duration": `${games.length * SECONDS_PER_CARD}s`,
                      } as CSSProperties
                    }
                  >
                    {[0, 1].map((copy) => (
                      <div
                        className="home__marquee-group"
                        key={copy}
                        aria-hidden={copy === 1}
                        // Second copy only exists for the seamless loop; keep it out of tab order.
                        {...(copy === 1 ? { inert: "" } : {})}
                      >
                        {games.map((game) => (
                          <div
                            className="home__marquee-item"
                            key={game.objectId}
                          >
                            <GameCard
                              game={game}
                              onClick={() =>
                                navigate(buildGameDetailsPath(game))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </section>
    </SkeletonTheme>
  );
}
