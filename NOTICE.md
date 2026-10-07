# NOTICE

This file covers third-party material used by us-palimpsest. The MIT licence in `LICENSE`
applies to **source code only**. It does not and cannot apply to the material described below.

## Boundary data — Atlas of Historical County Boundaries (AHCB)

Derived boundary geometry in this repository comes from the Atlas of Historical County
Boundaries.

> John H. Long, et al., *Atlas of Historical County Boundaries*, Dr. William M. Scholl Center
> for American History and Culture, The Newberry Library, Chicago.

- **Coverage:** 1629-03-04 through 2000-12-31, dated to the day, in WGS84. All fifty states and the
  District of Columbia, Alaska and Hawaii included.
- **No additional clearance needed.** Alaska, Hawaii and the District of Columbia arrive in the same
  release, so drawing them costs no new source and no new terms.
- **Upstream access:** <https://publications.newberry.org/ahcb>
- **Terms: CC0 1.0 Universal (Public Domain Dedication).** The Newberry's rebuilt site (2025) states
  that the Atlas data "is released under Creative Commons CC0 1.0 Universal (Public Domain
  Dedication)" and "may be used without requesting permission." Files were originally released under
  CC BY-NC-SA, and some secondary sources — including rOpenSci's `USAboundaries` documentation —
  still quote that superseded label.
- **Status:** the project is closed. Data files were released in 2012 and no further updates are
  planned; the national dataset covers county boundaries through 2000.

CC0 is a public-domain dedication, so there is no licence conflict between this data and the
repository's MIT code.

### Standards we hold ourselves to

Not obligations — CC0 imposes none. These are our own, and we keep them because a compilation of
this quality deserves them:

1. Attribution to the Newberry Library and the Atlas of Historical County Boundaries appears in the
   product itself, not only in documentation.
2. Derived geometry is kept in its own directory and never mixed into a code-only bundle.
3. We do not present the compilation as our own work. A CC0 dedication by the Newberry does not
   transfer authorship of it to us, and we do not relicense it.
4. Forty years of session-law transcription by named people should not become anonymous, so the
   compiler credits are reproduced in the product's about panel.
5. If the Newberry's terms change, this notice is updated before the next release.

## Intermediate reference

[lincolnmullen.com/projects/us-boundaries](https://lincolnmullen.com/projects/us-boundaries/) —
an interactive map over the same AHCB data, assembled by Lincoln Mullen. Its code is MIT; its
boundary data is AHCB and carries the terms above. We reuse the *data model* (interval-coded
features carrying `START_DATE` / `END_DATE` / `CHANGE`) and, where useful, annotation text.

## Modern boundary data — TIGER/Line

Chapter 8 geometry from 2000 onward comes from TIGER/Line.

> U.S. Census Bureau, *TIGER/Line Shapefiles*.

- **Terms: not copyrighted.** TIGER/Line products are free to use in a product or publication,
  provided acknowledgement is given to the U.S. Census Bureau as the source. "TIGER/Line" and
  "Census TIGER" are registered trademarks of the Census Bureau.
- **Obligation:** a Census Bureau acknowledgement in the product's about panel, alongside the
  Newberry credit.

## Statistics — NHGIS (IPUMS)

Population and settlement figures that drive city lights and settlement density come from NHGIS.

> Steven Manson, Jonathan Schroeder, David Van Riper, and Steven Ruggles. *IPUMS National Historical
> Geographic Information System* [dataset]. Minneapolis, MN: IPUMS. <https://www.nhgis.org>

- **Terms: a limited licence, not an open one.** The data is provided free of charge, but the terms
  require citation, **prohibit redistribution without permission**, and require that altered data not
  be redistributed without renaming the dataset and shipping FGDC-compliant metadata. IPUMS also asks
  to be sent a copy of any publication using the data.
- **Consequence for this repository:** NHGIS contributes *numbers*, not shipped geometry. Its
  boundary files are not redistributed here. Where modern boundaries are needed we use TIGER/Line,
  which NHGIS itself derives its 1990-onward files from, under a simpler licence.
- **Statistics derived from NHGIS** are aggregated and are not a redistribution of the source tables.
  The citation above is reproduced in the product's about panel.

## Unresolved

- **Art and audio.** Original illustration and sound are ours to license. Third-party samples must
  be CC0 or explicitly cleared, and listed here before they are committed. Nothing is listed yet.
