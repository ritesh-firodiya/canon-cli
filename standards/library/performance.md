# Performance

For web and Expo apps. Opt in with `standards: [performance]`.

Learned from an editor where every canvas edit redrew the whole screen, and each
redraw cost 21 database round trips. Nothing was broken; it was just slow.

1. **A local edit never redraws the screen.** When the UI already shows the
   change (a canvas, a field, a toggle), save it and update only what the save
   changed, from the mutation's answer. Next.js: no `router.refresh()`. Expo: no
   refetch or invalidate-all of the screen's query. Redraw only when
   server-drawn content changes shape (a row added or removed), and say why in
   a comment.
2. **Hot paths are guarded by lint.** The screens people edit on (an editor, a
   canvas, a form that saves on every change) get a `no-restricted-syntax` rule
   that bans the redraw call in their folders. Each allowed exception gets a
   disable comment with its reason.
3. **Count the round trips of a screen's loader.** Each query is one trip to
   the database, and on the deployed app every trip waits on the network.
   - Never look the same row up twice in one request. Pass on what you already
     loaded.
   - Never count rows you also read (`count` next to `findMany`). Use the
     length.
   - A nested Prisma select is one more query per relation. Fold reads into one
     query where you can: all open refs at once, not main and then the
     branches.
   - **Separation of duties comes before speed.** Database roles, row
     policies and column grants are not traded for fewer queries. Prisma's
     `relationJoins` reads every column, so it fails where a column has its own
     grant (a sealed password column, say). Change the data layer for speed
     only when speed is make-or-break, measured, and the owner decides.
4. **A navigation shows something at once.** Never put a whole screen inside
   `<Suspense fallback={null}>`: the click looks dead, then the screen jumps.
   The fallback is a drawn loading state, so where `design-sets` applies it is a
   screen in the design set first. What every screen of a section shares (a
   bar, a rail) lives in a layout, so it stays on screen while the screen inside
   changes; data both the layout and the page need is loaded once per request
   (React `cache`). Expo: the same with a shared navigator layout.
5. **Measure before and after.** A performance change states a number: round
   trips per screen (count Prisma `query` events in a throwaway test), or a
   trace of the slow interaction. A guess is not a result.
6. **Session reads may be cached, writes may not.** A signed session cookie
   (Better Auth's `cookieCache`, a few minutes) spares each read a query. Every
   write checks the session in the database, so a device signed out elsewhere
   changes nothing. An e2e test proves it.
