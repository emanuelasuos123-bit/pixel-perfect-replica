<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Atlas content lives in `src/data/atlas.ts` (places, people, projects, stories with relation ids); add material there, never hardcode it in components — keeps data swappable.
- Map uses MapLibre GL v4 loaded client-only with OpenFreeMap tiles; v6 worker breaks under Vite dev.
- Territory boundary is `src/data/boundary.json` (OSM relation 5522180); places must fall inside it.
- Trajectories come from a street router (`src/lib/trajectory.ts`), never straight lines.
