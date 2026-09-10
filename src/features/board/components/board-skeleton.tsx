const LANE_SHAPES: Record<string, string[]> = {
  "lane-1": ["card-1", "card-2", "card-3"],
  "lane-2": ["card-1", "card-2"],
  "lane-3": ["card-1", "card-2", "card-3", "card-4"],
};

export function BoardSkeleton() {
  return (
    <>
      <header className="flex items-start justify-between gap-3.5 border-b-2 border-(--color-border) px-4.5 py-3">
        <div className="min-w-0 flex-1">
          <div
            data-shape="header-name"
            className="h-[1lh] w-56 animate-pulse bg-(--color-divider) text-h5"
          />
          <div
            data-shape="header-context"
            className="mt-0.5 h-[1lh] w-72 animate-pulse bg-(--color-divider) text-control"
          />
        </div>
      </header>
      <div
        data-shape="filter-bar"
        className="h-[41px] border-(--color-divider) border-b"
      />
      <div
        data-region="board"
        className="flex items-stretch overflow-x-auto">
        {Object.entries(LANE_SHAPES).map(([lane, cards]) => (
          <div
            key={lane}
            data-region="lane"
            className="flex w-[268px] shrink-0 flex-col gap-1.5 border-(--color-divider) border-r bg-(--color-chrome-tint) p-1.5">
            <div
              data-shape="lane-header"
              className="h-6 w-2/3 animate-pulse bg-(--color-divider)"
            />
            {cards.map((card) => (
              <div
                key={card}
                data-shape="card"
                className="h-20 animate-pulse bg-(--color-divider)"
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}