/* eslint-disable @typescript-eslint/no-explicit-any */
import { SETTINGS_CATALOG } from "src/settings/settings.catalog";
import { OneSeaterSettings } from "./types";

export function buildDefaultSettings(): OneSeaterSettings {
  // Wir starten leer und lassen setDeep die Struktur bauen.
  const base: Record<string, unknown> = {};

  for (const item of SETTINGS_CATALOG) {
    setDeep(base, item.path, item.default);
  }

  return base as unknown as OneSeaterSettings;
}

export type Primitive = string | boolean | null | undefined;

// "a.b.c" Pfade für beliebige Objekte
export type Path<T> =
  T extends Primitive ? never :
  {
    [K in keyof T & string]:
      T[K] extends Primitive
        ? K
        : K | `${K}.${Path<T[K]>}`
  }[keyof T & string];

// Wert-Typ eines Pfades
export type PathValue<T, P extends Path<T>> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? Rest extends Path<T[K]>
        ? PathValue<T[K], Rest>
        : never
      : never
    : P extends keyof T
      ? T[P]
      : never;

export function getDeep<T, P extends Path<T>>(obj: T, path: P): PathValue<T, P> {
  const keys = path.split(".");
  let cur: any = obj;
  for (const k of keys) cur = cur?.[k];
  return cur as PathValue<T, P>;
}

export function setDeep<T, P extends Path<T>>(obj: T, path: P, value: PathValue<T, P>) {
  const keys = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined) cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

