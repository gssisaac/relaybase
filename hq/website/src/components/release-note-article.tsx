import { Badge } from "@/components/ui/badge";
import { formatReleaseDate, type ReleaseNote } from "@/lib/release-notes";

type ReleaseNoteArticleProps = {
  note: ReleaseNote;
  latest?: boolean;
};

export function ReleaseNoteArticle({
  note,
  latest = false,
}: ReleaseNoteArticleProps) {
  return (
    <article
      id={`v${note.version}`}
      className="scroll-mt-24 space-y-6 border-b border-border/60 pb-12 last:border-b-0 last:pb-0"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {note.title}
          </h2>
          <Badge
            variant="outline"
            className="border-brand/30 font-mono text-brand-muted"
          >
            v{note.version}
          </Badge>
          {latest ? (
            <Badge
              variant="secondary"
              className="border border-brand/20 bg-brand/10 text-brand-muted"
            >
              Latest
            </Badge>
          ) : null}
        </div>
        <time
          dateTime={note.date}
          className="block text-sm text-muted-foreground"
        >
          {formatReleaseDate(note.date)}
        </time>
      </header>

      <div className="space-y-8">
        {note.sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {section.title}
            </h3>
            <ul className="space-y-2 text-base leading-relaxed text-muted-foreground">
              {section.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/70"
                  />
                  <span className="text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
