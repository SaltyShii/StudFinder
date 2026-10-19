# Coding Standards

Read during review.

- Check a suspected defect against the existing tests, `GLOSSARY.md` and code comments before reporting it; documented design decisions (for example the Ace run ignoring spark chance) are not defects.
- A refactor keeps behaviour: memo dependency granularity, fallbacks and ordering stay unless the commit body says otherwise. Review it by comparing old and new path by path with `git show main:<file>`, including state transitions and error order.
