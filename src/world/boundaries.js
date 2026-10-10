/**
 * Turning a chapter bundle into something the GPU can draw.
 *
 * Two meshes, and the split between them is the whole trick:
 *
 * - **The fill** is the land. Every polygon of every boundary version is
 *   triangulated and merged into one buffer, and the shader decides per
 *   fragment whether that version is alive on the current date. Nothing is
 *   rebuilt when the date moves.
 * - **The outlines** are built from *arcs*, not from polygons. Two states that
 *   share a border reference the same arc, so drawing per-polygon would draw
 *   every interior border twice and every coastline once — interior lines would
 *   come out heavier than the coast, which is backwards. Per-arc, each line is
 *   drawn exactly once.
 *
 * Both meshes carry the same date attributes, and both compute the same
 * hand-drawn wobble from the same function of the same coordinates, so the ink
 * cannot drift off its own territory.
 */

import * as THREE from 'three';

import { SHEET_SCALE, GLSL_DATE_ATTRIBUTES, GLSL_DATE_TRANSFER, GLSL_DATE_VARYINGS, patchMaterial } from '../core/shared.js';
import { nToYear } from '../lib/dates.js';
import { cleanRing, eachArcIndex, polygonRings } from '../lib/topojson.js';
import { hash1 } from '../lib/math.js';

const DATE_VERTEX_COMMON = /* glsl */ `
${GLSL_DATE_ATTRIBUTES}
varying vec2 vSheet;
`;

const DATE_VERTEX_BODY = /* glsl */ `
${GLSL_DATE_TRANSFER}
vSheet = position.xy / uSheetScale;
transformed.xy += usWobble(position.xy);
`;

const DATE_FRAGMENT_COMMON = /* glsl */ `
${GLSL_DATE_VARYINGS}
varying vec2 vSheet;
`;

/**
 * Offset a sheet-space point into the world, centred on the origin.
 *
 * Centring matters more than it looks: the camera frames the sheet by looking
 * at the origin, and M4's dive into a historical scene will be authored in the
 * same space, so the map's centre is also the world's.
 */
function toWorld([x, y], sheet, out) {
  out.set((x - sheet.width / 2) * SHEET_SCALE, (y - sheet.height / 2) * SHEET_SCALE, 0);
  return out;
}

/**
 * Does this span begin inside the chapter, or was it already drawn when the
 * chapter opened?
 *
 * This is the one number that decides whether a line fades in or is simply
 * there on the first frame. The pipeline cuts a chapter's geometry to the
 * chapter's own dates, so the earliest version in every bundle starts exactly on
 * the chapter's opening date — and a fade applied to that would mean every
 * chapter opened on blank paper. See `GLSL_DATE_MASK`.
 */
function beginsInsideChapter(spanStart, chapterStart) {
  return spanStart > chapterStart + 1e-6 ? 1 : 0;
}

/** Build the land fills: one merged, triangulated buffer over all versions. */
function buildFill(geometries, arcs, sheet, chapterStart) {
  const positions = [];
  const starts = [];
  const ends = [];
  const terminals = [];
  const froms = [];
  const indices = [];

  let base = 0;
  let skipped = 0;
  const scratch = new THREE.Vector2();

  for (const geometry of geometries) {
    const props = geometry.properties;
    const start = nToYear(props.start);
    const end = nToYear(props.end);
    const terminal = props.t ? 1 : 0;
    const from = beginsInsideChapter(start, chapterStart);

    for (const rings of polygonRings(geometry, arcs)) {
      if (!rings.length) continue;
      const outer = cleanRing(rings[0]);
      if (outer.length < 3) {
        skipped++;
        continue;
      }

      const holes = [];
      for (let i = 1; i < rings.length; i++) {
        const hole = cleanRing(rings[i]);
        if (hole.length >= 3) holes.push(hole);
      }

      const contour = outer.map(([x, y]) => toWorld([x, y], sheet, scratch).clone());
      const holeContours = holes.map((hole) => hole.map(([x, y]) => toWorld([x, y], sheet, scratch).clone()));

      // three ships an earcut implementation, so triangulation costs no
      // dependency. It also strips the closing duplicate from the arrays it is
      // handed, which is why the vertex list is assembled *after* the call.
      const triangles = THREE.ShapeUtils.triangulateShape(contour, holeContours);
      if (triangles.length === 0) {
        skipped++;
        continue;
      }

      const vertices = contour.concat(...holeContours);
      for (const vertex of vertices) {
        positions.push(vertex.x, vertex.y, 0);
        starts.push(start);
        ends.push(end);
        terminals.push(terminal);
        froms.push(from);
      }
      for (let i = 0; i < triangles.length; i++) {
        const [a, b, c] = triangles[i];
        indices.push(base + a, base + b, base + c);
      }
      base += vertices.length;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  geometry.setAttribute('aTerminal', new THREE.Float32BufferAttribute(terminals, 1));
  geometry.setAttribute('aFrom', new THREE.Float32BufferAttribute(froms, 1));
  geometry.setIndex(indices);
  // An empty buffer has no bounding sphere to compute and three.js warns about
  // the NaN radius it arrives at. Chapter 1 is the real case: its window holds
  // no boundary polygon at all, only story routes, so the land fill is
  // legitimately nothing.
  if (positions.length) geometry.computeBoundingSphere();

  return { geometry, triangles: indices.length / 3, skipped };
}

/**
 * Work out which dates each arc is alive for.
 *
 * An arc is shared, so it can be referenced by boundary versions with different
 * windows. The union is the honest answer for the outline: a coastline that
 * exists while an area is a territory and again when it becomes a state was
 * drawn continuously, and should not blink.
 */
function arcSpans(geometries) {
  const spans = new Map();
  for (const geometry of geometries) {
    const props = geometry.properties;
    const start = nToYear(props.start);
    const end = nToYear(props.end);
    const terminal = props.t ? 1 : 0;
    eachArcIndex(geometry, (ref) => {
      const index = ref < 0 ? ~ref : ref;
      const current = spans.get(index);
      if (!current) {
        spans.set(index, { start, end, terminal });
      } else {
        if (start < current.start) current.start = start;
        if (end > current.end) current.end = end;
        if (terminal > current.terminal) current.terminal = terminal;
      }
    });
  }
  return spans;
}

/**
 * Build the outlines: each arc expanded into quads, one quad per segment.
 *
 * The expansion happens on the CPU rather than in a vertex shader with a
 * geometry shader — which WebGL2 does not have. Four vertices per segment, each
 * carrying its own side flag, and the shader offsets them along the segment
 * normal by `aSide * halfWidth`. That keeps the line weight a per-frame uniform,
 * so a chapter can change how heavy its ink is without touching the buffer.
 */
function buildOutline(geometries, arcs, sheet, spans, chapterStart) {
  const positions = [];
  const normals = [];
  const sides = [];
  const starts = [];
  const ends = [];
  const terminals = [];
  const froms = [];
  const indices = [];
  const seeds = [];

  let base = 0;
  let segments = 0;
  const scratch = new THREE.Vector2();

  for (const [index, span] of spans) {
    const arc = arcs[index];
    if (!arc || arc.length < 2) continue;

    // A stable per-arc personality, so the dispersal scatters differently for
    // each line but identically on every load.
    const seed = hash1(index * 2654435761);
    const from = beginsInsideChapter(span.start, chapterStart);

    for (let i = 0; i < arc.length - 1; i++) {
      const a = toWorld(arc[i], sheet, scratch).clone();
      const b = toWorld(arc[i + 1], sheet, scratch).clone();
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) continue;

      const nx = -dy / length;
      const ny = dx / length;

      positions.push(a.x, a.y, 0, a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, 0);
      normals.push(nx, ny, nx, ny, nx, ny, nx, ny);
      // -1 and +1 are the two sides of the stroke; the order below winds the
      // quad consistently so back-face culling is not needed either way.
      sides.push(-1, 1, 1, -1);
      for (let k = 0; k < 4; k++) {
        starts.push(span.start);
        ends.push(span.end);
        terminals.push(span.terminal);
        froms.push(from);
      }
      seeds.push(seed, seed, seed, seed);

      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      base += 4;
      segments++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals, 2));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  geometry.setAttribute('aTerminal', new THREE.Float32BufferAttribute(terminals, 1));
  geometry.setAttribute('aFrom', new THREE.Float32BufferAttribute(froms, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setIndex(indices);
  if (positions.length) geometry.computeBoundingSphere();

  return { geometry, segments, positions };
}

/**
 * The land material: paper, wash, hatch, and the date mask.
 *
 * Unlit, deliberately. A `MeshStandardMaterial` under an ambient light divides
 * the albedo by pi on the way out, so the paper tint chosen in
 * `timeline/chapters.js` would arrive on screen about a third as bright as it
 * was written — which is how a warm cream sheet turns into grey card. Nothing
 * on this plate is *lit*: the relief, the grain and the hatch are all drawn. So
 * the material carries no lighting model, and the chapter's numbers are the
 * chapter's colour.
 */
export function createFillMaterial() {
  return patchMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      // The whole scene is coplanar and composited by draw order, not depth.
      // Coplanar surfaces plus depth testing is z-fighting waiting to happen;
      // renderOrder is the honest way to stack a set of layers on one sheet.
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    {
      name: 'land-fill',
      vertexCommon: DATE_VERTEX_COMMON,
      vertexBody: DATE_VERTEX_BODY,
      fragmentCommon: DATE_FRAGMENT_COMMON,
      fragmentBody: /* glsl */ `
        vec3 paper; vec3 ink; vec3 accent; vec4 style; vec4 tone;
        usChapterMix(paper, ink, accent, style, tone);

        float alive = usAlive(vStart, vEnd, vTerminal, vFrom);
        // Hatch lines are cut a little finer than the boundary ink they sit
        // under, the way a burin plate separates its tones from its contours.
        float hatch = usHatch(vSheet, style.x * uHatch, style.y, style.z * 0.55);

        // Land is paper that has been washed and hatched, not a fill colour.
        // Keeping it close to the sheet's own tone is what stops the continent
        // reading as a sticker on top of the paper.
        vec3 col = paper;
        col = mix(col, ink, hatch * 0.34);
        col = mix(col, accent, tone.x * 0.32 * (1.0 - hatch * 0.6));
        col *= usPaperGrain(vSheet, tone.y * uPaper);

        diffuseColor.rgb = col;
        diffuseColor.a *= alive;
      `,
    },
  );
}

/** The outline material: engraved ink, in the chapter's own weight. */
export function createOutlineMaterial() {
  return patchMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    {
      name: 'boundary-outline',
      // A local uniform, not a shared one: the anchor layer reuses this same
      // geometry at a different weight and must not have to fight the cursor
      // chapter for it.
      uniforms: { uWeightScale: { value: 1 } },
      vertexCommon: /* glsl */ `
        attribute vec2 aNormal;
        attribute float aSide;
        attribute float aSeed;
        uniform float uWeightScale;
        varying float vSeed;
        varying float vAcross;
        ${DATE_VERTEX_COMMON}
      `,
      vertexBody: /* glsl */ `
        vec3 chapterPaper; vec3 chapterInk; vec3 chapterAccent; vec4 chapterStyle; vec4 chapterTone;
        usChapterMix(chapterPaper, chapterInk, chapterAccent, chapterStyle, chapterTone);

        // Line weight is a chapter property, so it is read at draw time rather
        // than baked into the buffer. The style's z component is in CSS pixels
        // and is converted here through the sheet's pixel scale, which is what
        // makes 1.6 mean the same weight on a phone and on a 4K panel.
        float halfWidth = 0.5 * chapterStyle.z * uWorldPerPixel * uWeightScale;
        transformed.xy += aNormal * aSide * halfWidth;

        vSeed = aSeed;
        vAcross = aSide;
        ${DATE_VERTEX_BODY}
      `,
      fragmentCommon: /* glsl */ `
        varying float vSeed;
        varying float vAcross;
        ${DATE_FRAGMENT_COMMON}
      `,
      fragmentBody: /* glsl */ `
        vec3 paper; vec3 ink; vec3 accent; vec4 style; vec4 tone;
        usChapterMix(paper, ink, accent, style, tone);

        float alive = usAlive(vStart, vEnd, vTerminal, vFrom);

        // A stroke that is hard-edged reads as vector art; a stroke that thins
        // toward its edges reads as ink sitting on paper. This is the whole
        // difference, in two lines.
        float profile = 1.0 - abs(vAcross);
        float inkCoverage = smoothstep(0.0, 0.55, profile);

        // Bleed: ink creeps a little past the line into the fibre, more so in
        // the chapters that are allowed a heavier hand.
        float bleed = style.w * 0.22;
        inkCoverage = pow(inkCoverage, 1.0 - bleed * 0.35);

        float grain = usPaperGrain(vSheet, tone.y * uPaper * 0.7);

        vec3 col = mix(ink, accent, tone.x * 0.25);
        col *= grain;

        diffuseColor.rgb = col;
        diffuseColor.a = alive * inkCoverage * 0.92;
      `,
    },
  );
}

/**
 * Assemble the boundary layer for one chapter.
 *
 * @param {object} bundle                 a loaded chapter bundle
 * @param {object} [options]
 * @param {THREE.Material[]} [options.anchorMaterials]  one material per anchor slot
 * @returns {{group: THREE.Group, land: THREE.Mesh, lines: THREE.Mesh, anchors: THREE.Mesh[],
 *            fillMaterial: THREE.Material, outlineMaterial: THREE.Material,
 *            outlineGeometry: THREE.BufferGeometry, outlinePositions: number[], stats: object}}
 */
export function buildBoundaries(bundle, options = {}) {
  const { geometries, arcs, sheet } = bundle;
  const chapterStart = bundle.meta.start;
  const spans = arcSpans(geometries);

  const fill = buildFill(geometries, arcs, sheet, chapterStart);
  const outline = buildOutline(geometries, arcs, sheet, spans, chapterStart);

  const fillMaterial = createFillMaterial();
  const outlineMaterial = createOutlineMaterial();

  const group = new THREE.Group();
  group.name = `boundaries:${bundle.id}`;

  const land = new THREE.Mesh(fill.geometry, fillMaterial);
  land.renderOrder = 2;
  land.frustumCulled = false;
  group.add(land);

  // Sediment goes between the land and the live ink: under the current
  // boundaries, over the territory they describe.
  const anchors = (options.anchorMaterials ?? []).map((material, slot) => {
    const mesh = new THREE.Mesh(outline.geometry, material);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    mesh.name = `anchor:${bundle.id}:${slot}`;
    group.add(mesh);
    return mesh;
  });

  const lines = new THREE.Mesh(outline.geometry, outlineMaterial);
  lines.renderOrder = 4;
  lines.frustumCulled = false;
  group.add(lines);

  return {
    group,
    land,
    lines,
    anchors,
    fillMaterial,
    outlineMaterial,
    outlineGeometry: outline.geometry,
    outlinePositions: outline.positions,
    stats: {
      triangles: fill.triangles,
      skipped: fill.skipped,
      segments: outline.segments,
      arcs: spans.size,
      vertices:
        fill.geometry.getAttribute('position').count + outline.geometry.getAttribute('position').count,
    },
  };
}
