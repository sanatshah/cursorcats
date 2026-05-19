'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/** @typedef {'project' | 'user' | 'bundled'} SkillSource */

/** @typedef {{ id: string, name: string, description: string, source: SkillSource, path: string }} SkillEntry */

const SOURCE_PRIORITY = { project: 3, user: 2, bundled: 1 };

/**
 * @param {string} content
 * @returns {{ name: string | null, description: string | null }}
 */
function parseSkillFrontmatter(content) {
  const text = String(content || '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: null, description: null };

  let name = null;
  let description = null;
  const lines = match[1].split(/\r?\n/);
  let inDescription = false;
  const descLines = [];

  for (const line of lines) {
    if (inDescription) {
      if (/^\S/.test(line) && line.includes(':')) {
        inDescription = false;
      } else {
        descLines.push(line);
        continue;
      }
    }
    if (!inDescription && descLines.length) break;

    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = stripYamlScalar(nameMatch[1]);
      continue;
    }
    const descMatch = line.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const rest = descMatch[1];
      if (rest === '|' || rest === '>') {
        inDescription = true;
      } else {
        description = stripYamlScalar(rest);
      }
    }
  }

  if (descLines.length) {
    description = descLines.join('\n').trim();
  }

  return { name, description };
}

/**
 * @param {string} raw
 */
function stripYamlScalar(raw) {
  let s = String(raw || '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

/**
 * @param {string} rootDir
 * @returns {string[]}
 */
function findSkillFiles(rootDir) {
  const root = String(rootDir || '').trim();
  if (!root || !fs.existsSync(root)) return [];

  /** @type {string[]} */
  const results = [];

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name === 'SKILL.md') {
        results.push(full);
      }
    }
  }

  walk(root);
  return results;
}

/**
 * @param {string} filePath
 * @param {SkillSource} source
 * @returns {SkillEntry | null}
 */
function loadSkillFromFile(filePath, source) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { name: fmName, description: fmDesc } = parseSkillFrontmatter(content);
    const folderName = path.basename(path.dirname(filePath));
    const name = (fmName && fmName.trim()) || folderName;
    if (!name) return null;
    const description = (fmDesc && String(fmDesc).trim()) || '';
    const id = `${source}:${name}`;
    return { id, name, description, source, path: filePath };
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} projectFolder
 * @returns {SkillEntry[]}
 */
function listAvailableSkills(projectFolder) {
  /** @type {Map<string, SkillEntry>} */
  const byName = new Map();

  /** @type {Array<{ source: SkillSource, root: string }>} */
  const roots = [
    { source: 'bundled', root: path.join(os.homedir(), '.cursor', 'skills-cursor') },
    { source: 'user', root: path.join(os.homedir(), '.cursor', 'skills') },
  ];

  const folder = String(projectFolder || '').trim();
  if (folder) {
    roots.unshift({ source: 'project', root: path.join(folder, '.cursor', 'skills') });
  }

  for (const { source, root } of roots) {
    for (const filePath of findSkillFiles(root)) {
      const skill = loadSkillFromFile(filePath, source);
      if (!skill) continue;
      const existing = byName.get(skill.name);
      if (!existing || SOURCE_PRIORITY[source] > SOURCE_PRIORITY[existing.source]) {
        byName.set(skill.name, skill);
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  listAvailableSkills,
  parseSkillFrontmatter,
};
