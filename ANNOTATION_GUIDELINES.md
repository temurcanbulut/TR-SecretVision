# Annotation policy

1. Annotate the complete visible value in a sensitive field role; exclude the field name, quotes and separators. A multiline value receives one integer half-open `[x, y, width, height]` box per visible line, linked by `candidate_id`. Empty lines contain no target glyph and receive no box.
2. For a credential URI, label the complete URI as `credential_uri`; do not add nested password, email or host boxes. For fake private keys, include the PEM markers and body as fragments of one logical value.
3. Candidate annotations include BOTH sensitive and benign spans; training YOLO/COCO annotations contain ONLY sensitive spans. Never use the benign candidate class as a positive detection label.
4. The same literal string may be a secret in an authorization field and a technical identifier in a digest/reference field. Use the visible role. This is a closed benchmark policy, not a claim that an arbitrary real-world digest is necessarily safe.
5. Literal-vs-reference controls contain no rendered secret value. A template such as `${DB_PASS}` is not a password target. Public-key markers are benign in this task; the material is never a real public or private key.
6. Names in person fields are targets; the same generated phrase in a project-name field is benign. Fixed system identities in terminal prompts are not person email targets. Ambiguous public-person data is outside this release.
7. Preserve all pairs, payload identities, whole application/layout groups and image derivatives in their assigned split. Do not reshuffle image files.
8. `human_verified=false` is mandatory until a real human inspects the image and labels and an attributable review record is stored. AI inspection is a distinct field/log and does not change this flag.

Clean boxes use floor/ceil of character geometry with 2 px padding. `downscale_065` maps these rectangles and adds 2 px; `blur_070` adds 3 px. Raster subtraction validates resulting target ink containment. Blur boxes are deliberately looser and should be scored as a separate slice. JSON-escaped values use the visible escaped characters for ranges and the original logical value remains in `slots`.
