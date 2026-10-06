# NOTICE

This file covers third-party material used by us-palimpsest. The MIT licence in `LICENSE`
applies to **source code only**. It does not and cannot apply to the material described below.

## Boundary data — Atlas of Historical County Boundaries (AHCB)

Derived boundary geometry in this repository comes from the Atlas of Historical County
Boundaries.

> John H. Long, et al., *Atlas of Historical County Boundaries*, Dr. William M. Scholl Center
> for American History and Culture, The Newberry Library, Chicago.

- **Coverage:** 1629-03-04 through 2000-12-31, dated to the day, in WGS84.
- **Upstream access:** <https://publications.newberry.org/ahcbp>
- **Terms:** The Newberry Library states that the data may be downloaded and "reused for any
  lawful purpose, commercial or non-commercial, without licensing or permission fees to the
  library." Files were originally released under CC BY-NC-SA; the Newberry notes that stale
  copies of that notice remain in some old files and "can be ignored."

### Obligations we hold ourselves to

1. This data is **not** relicensed under MIT. Do not apply the repository's code licence to it.
2. Attribution to the Newberry Library and the Atlas of Historical County Boundaries is required
   in the product itself, not only in documentation.
3. Derived geometry is kept in its own directory and never mixed into a code-only bundle.
4. If the Newberry's terms change, this notice is updated before the next release.

## Intermediate reference

[lincolnmullen.com/projects/us-boundaries](https://lincolnmullen.com/projects/us-boundaries/) —
an interactive map over the same AHCB data, assembled by Lincoln Mullen. Its code is MIT; its
boundary data is AHCB and carries the terms above. We reuse the *data model* (interval-coded
features carrying `START_DATE` / `END_DATE` / `CHANGE`) and, where useful, annotation text.

## Unresolved

- **Art and audio.** Original illustration and sound are ours to license. Third-party samples must
  be CC0 or explicitly cleared, and listed here before they are committed. Nothing is listed yet.
- **Alaska, Hawaii, and DC.** AHCB publishes these in separate datasets with their own citations.
  Add them here if and when they enter the product.
