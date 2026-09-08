baseline: 56a36f8d023a923ce6d1bb2eb3d6f6e0c490d41c
fix_attempts: 1
regates_used: 0

Stage 3 (fix) deviation: the approved render-prop children (control: ReactNode) => ReactElement
was implemented first, then found to break at runtime with a new, different error ("Functions are
not valid as a child of Client Components") because raw functions can't cross the RSC Server->Client
boundary. Confirms the assessment's core diagnosis (boundary-crossing header composition in
BoardScreen) but not its specific mechanism. Landed fix instead has BoardScreen build <ProjectHeader>
itself from plain props (commentCount, newIssue), mirroring ProjectDetailsScreen's already-working
pattern. See fix.md "Deviations from Assessment" for full detail. All local checks (tsc, full test
suite 2773/2773, style-check, build, and live next dev verification against seeded data) pass.
