/**
 * Guards for two specific, repeatedly-expensive mistakes in the GLSL sources.
 *
 * Both of these fail *loudly* — the page will not boot — but neither failure
 * points at its own cause, which is what makes them worth a machine check
 * rather than a resolution to be careful. Between them they have cost five
 * debugging cycles, three of them after the fix for the same trap had already
 * been written down.
 *
 * 1. **A backtick inside a GLSL comment.** Every GLSL block here is a JavaScript
 *    template literal tagged with a glsl comment, so a backtick in a comment ends
 *    the string. The file then fails to parse with an error naming whatever
 *    identifier happened to follow, which reads like a typo in working code.
 *
 * 2. **A GLSL reserved word used as a name.** `half` is held back for a future
 *    16-bit type, so `float half = ...` is reported as a syntax error on the
 *    reserved word rather than as "that name is taken".
 *
 * Both checks lean on a convention this codebase already keeps: a GLSL block
 * always closes on a line whose first non-space character is a backtick. So
 * everything between a block's opening backtick and the next such line is the
 * block's body.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** GLSL ES 3.00 words that are reserved rather than in use, and so read as
 *  plausible names to anyone arriving from a language where they are free. */
const RESERVED = new Set([
  'asm', 'class', 'union', 'enum', 'typedef', 'template', 'this', 'packed',
  'goto', 'switch', 'default', 'inline', 'noinline', 'volatile', 'public',
  'static', 'extern', 'external', 'interface', 'long', 'short', 'double',
  'half', 'fixed', 'unsigned', 'superp', 'input', 'output', 'filter', 'sizeof',
  'cast', 'namespace', 'using', 'sample', 'patch', 'resource', 'common',
  'partition', 'active', 'subroutine', 'row_major', 'hvec2', 'hvec3', 'hvec4',
  'dvec2', 'dvec3', 'dvec4', 'fvec2', 'fvec3', 'fvec4', 'sampler3DRect',
]);

const TYPE =
  'float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|' +
  'bvec2|bvec3|bvec4|mat2|mat3|mat4|sampler2D|samplerCube';

function javascriptFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...javascriptFiles(full));
    else if (entry.name.endsWith('.js')) found.push(full);
  }
  return found;
}

/** Each GLSL block in a file, as `{ line, body }` with `line` its opening line. */
function glslBlocks(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].indexOf('/* glsl */');
    if (marker === -1) continue;

    const open = lines[i].indexOf('`', marker);
    if (open === -1) continue;

    let close = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^[ \t]*`/.test(lines[j])) {
        close = j;
        break;
      }
    }
    if (close === -1) continue;

    const body = [lines[i].slice(open + 1), ...lines.slice(i + 1, close)]
      .map((text, offset) => ({ line: i + 1 + offset, text }))
      .filter(({ text }) => text.trim() !== '');

    blocks.push({ line: i + 1, body });
  }

  return blocks;
}

function sources() {
  return javascriptFiles(HERE)
    .filter((file) => !file.endsWith('shader-source.test.js'))
    .map((file) => ({ file, blocks: glslBlocks(file) }));
}

describe('GLSL template literals', () => {
  it('contain no backticks, which would end the string', () => {
    const offenders = [];

    for (const { file, blocks } of sources()) {
      for (const block of blocks) {
        for (const { line, text } of block.body) {
          if (text.includes('`')) {
            offenders.push(`${path.relative(HERE, file)}:${line}  ${text.trim().slice(0, 90)}`);
          }
        }
      }
    }

    expect(offenders, `backtick inside a GLSL block:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('declare no variable with a GLSL reserved name', () => {
    const declaration = new RegExp(`\\b(?:${TYPE})\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*(?=[=;,)])`, 'g');
    const offenders = [];

    for (const { file, blocks } of sources()) {
      for (const block of blocks) {
        for (const { line, text } of block.body) {
          // Comments are prose and may name a reserved word freely; what matters
          // is what the compiler reads.
          const code = text.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          for (const match of code.matchAll(declaration)) {
            if (RESERVED.has(match[1])) {
              offenders.push(`${path.relative(HERE, file)}:${line}  ${match[0].trim()}`);
            }
          }
        }
      }
    }

    expect(offenders, `GLSL reserved word used as a name:\n${offenders.join('\n')}`).toEqual([]);
  });
});
