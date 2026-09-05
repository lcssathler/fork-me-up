import { isPortableProfileExport, type ProfilePayload } from "@fork-me-up/protocol";

export type LoadedDeveloperProfile = DeepReadonly<{
  profileVersion: string;
  profile: ProfilePayload;
}>;

export type DeveloperProfileLoadResult =
  | Readonly<{ ok: true; value: LoadedDeveloperProfile }>
  | Readonly<{
      ok: false;
      error: Readonly<{ category: "invalid-input" }>;
    }>;

const invalidInput = deepFreeze({
  ok: false,
  error: { category: "invalid-input" },
} as const);

export function loadDeveloperProfileFromPortableExport(value: unknown): DeveloperProfileLoadResult {
  if (!isPortableProfileExport(value)) return invalidInput;

  return deepFreeze({
    ok: true,
    value: {
      profileVersion: value.profileVersion,
      profile: structuredClone(value.profile),
    },
  });
}

type DeepReadonly<Value> = Value extends (...arguments_: never[]) => unknown
  ? Value
  : Value extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<Value>;
}
