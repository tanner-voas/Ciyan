# Cíyán v0.9.23 — floating header (UI-01, Cíyán slice)

The document previously used horizontal `overflow: hidden`, which implicitly made the body a vertical scroll container and prevented the sticky topbar from following viewport scrolling. Use `overflow-x: clip` instead. Programmatic study-card scrolling accounts for the actual header height (including the safe area). Immersive reader controls, bottom navigation, zoom policy, and cloud services are unchanged. Backup version transition is an identity step.

Device acceptance: check long Study, Words, Grammar, Stats and Settings screens, both hosted and standalone; verify all topbar actions remain reachable, automatic study-card scrolling is unobscured, and the immersive Reader retains its tap-to-reveal controls. This release covers only Cíyán; UI-01 remains open for the other workspace applications.
