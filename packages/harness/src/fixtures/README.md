# Sheet regression fixture

`inconsistent-table.webp` is a real rejected preview generated from the repository's public
`apps/web/public/showcase/table.jpg` example. Its front has separated legs but its back is a
solid panel. It includes the application's preview watermark; this also exercises robustness
to disconnected foreground marks. It contains no customer upload or account data.

The opposite-view guard only detects large open-to-solid changes with stable foreground masks.
It does not certify general 3D geometry, hidden surfaces, transparent or near-white objects.
