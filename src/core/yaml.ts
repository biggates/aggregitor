type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };
type YamlObj = Record<string, YamlValue>;

function inferType(raw: string): YamlValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw.includes(".") ? parseFloat(raw) : parseInt(raw, 10);
  const m = raw.match(/^(["'])(.*)\1$/s);
  if (m) return m[2];
  return raw;
}

export function parseYaml(source: string): YamlObj {
  const lines = source.split(/\r?\n/);
  const root: YamlObj = {};
  const stack: { indent: number; obj: YamlObj }[] = [
    { indent: -1, obj: root },
  ];
  let multiLineKey: string | null = null;
  let multiLineBuf: string[] = [];
  let multiLineIndent = 0;
  let inMultiLine = false;

  for (let i = 0; i < lines.length; i++) {
    let rawLine = lines[i];
    const stripped = rawLine.replace(/^[ \t]+/, "");
    const indent = rawLine.length - stripped.length;

    if (inMultiLine) {
      if (indent > multiLineIndent) {
        multiLineBuf.push(stripped);
        continue;
      }
      inMultiLine = false;
      const full = multiLineBuf.join("\n");
      setValue(stack, multiLineKey!, full);
      multiLineKey = null;
      multiLineBuf = [];
    }

    if (stripped === "" || stripped.startsWith("#")) continue;

    if (stripped.startsWith("- ")) {
      const val = inferType(stripped.slice(2).trim());
      const parent = stack[stack.length - 1].obj;
      if (!parent._list) parent._list = [];
      (parent._list as YamlValue[]).push(val);
      continue;
    }

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim();
    const rest = stripped.slice(colonIdx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    if (rest === "") {
      const child: YamlObj = {};
      const parent = stack[stack.length - 1].obj;
      if (Array.isArray(parent._list)) {
        (parent._list as YamlValue[]).push(child);
      } else {
        parent[key] = child;
      }
      stack.push({ indent, obj: child });
    } else if (rest === "|") {
      multiLineKey = key;
      multiLineIndent = indent;
      multiLineBuf = [];
      inMultiLine = true;
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;
      if (!Array.isArray(parent._list)) {
        parent[key] = "";
      }
    } else if (rest.startsWith("- ")) {
      const arr: YamlValue[] = [];
      const val = inferType(rest.slice(2).trim());
      arr.push(val);
      const parent = stack[stack.length - 1].obj;
      parent[key] = arr;
      stack.push({ indent, obj: { _list: arr } as unknown as YamlObj });
    } else {
      const val = inferType(rest);
      const parent = stack[stack.length - 1].obj;
      if (parent._list) {
        (parent._list as YamlValue[]).push(val);
      } else {
        parent[key] = val;
      }
    }
  }

  if (inMultiLine && multiLineKey) {
    setValue(stack, multiLineKey, multiLineBuf.join("\n"));
  }

  cleanLists(root);
  return root;
}

function setValue(
  stack: { indent: number; obj: YamlObj }[],
  key: string,
  val: YamlValue,
) {
  const parent = stack[stack.length - 1].obj;
  parent[key] = val;
}

function cleanLists(obj: YamlObj) {
  for (const k of Object.keys(obj)) {
    if (k === "_list") continue;
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sub = v as YamlObj;
      const list = sub._list;
      if (list) {
        obj[k] = list;
        const arr = list as YamlValue[];
        for (const item of arr) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            cleanLists(item as YamlObj);
          }
        }
      } else {
        cleanLists(sub);
      }
    }
  }
}
