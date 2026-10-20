"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type {
  JsonValue,
  MetaResponse,
  Schema,
  SchemaNode,
  SchemaNodeType,
} from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import {
  addField,
  changeNodeType,
  clearConstant,
  fieldNameError,
  findParent,
  generatorsForType,
  LEAF_TYPES,
  moveField,
  removeNode,
  renameNode,
  SCHEMA_NODE_TYPES,
  setArrayLength,
  setConstant,
  setEnumValues,
  setGenerator,
  setGeneratorParam,
  setProbability,
} from "@/lib/schema/edit";

const ENUM_MIN = 2;
const ENUM_MAX = 50;

export interface SchemaInspectorProps {
  schema: Schema;
  node: SchemaNode;
  meta: MetaResponse;
  onChange: (schema: Schema) => void;
  onSelect: (id: string) => void;
}

function enumDraft(node: SchemaNode): string {
  return (node.enumValues ?? []).map((value) => String(value)).join("\n");
}

function constantDraft(node: SchemaNode): string {
  if (node.constant === undefined) return "";
  return JSON.stringify(node.constant, null, 2);
}

export function SchemaInspector({
  schema,
  node,
  meta,
  onChange,
  onSelect,
}: SchemaInspectorProps) {
  const id = node.id ?? "";
  const parent = useMemo(() => findParent(schema, id), [schema, id]);
  const [nameDraft, setNameDraft] = useState(node.name);
  const [enumText, setEnumText] = useState(() => enumDraft(node));
  const [constantText, setConstantText] = useState(() => constantDraft(node));
  const [constantError, setConstantError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- local text drafts mirror the selected node */
  useEffect(() => {
    setNameDraft(node.name);
  }, [id, node]);

  useEffect(() => {
    setEnumText(enumDraft(node));
  }, [id, node]);

  useEffect(() => {
    setConstantText(constantDraft(node));
    setConstantError(null);
  }, [id, node]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const nameError = fieldNameError(schema, id, nameDraft);
  const generators = generatorsForType(meta.generators, node.type);
  const selectedGenerator = node.generator
    ? meta.generators.find((entry) => entry.id === node.generator)
    : undefined;
  const indexInParent = parent?.fields?.findIndex((field) => field.id === id) ?? -1;
  const canMoveUp = indexInParent > 0;
  const canMoveDown =
    indexInParent >= 0 && Boolean(parent?.fields && indexInParent < parent.fields.length - 1);

  const enumValues = enumText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const duplicateEnum = new Set(enumValues).size !== enumValues.length;
  const enumError = duplicateEnum
    ? "Enum values must be unique."
    : enumValues.length > 0 && enumValues.length < ENUM_MIN
      ? `Add at least ${ENUM_MIN} enum values.`
      : enumValues.length > ENUM_MAX
        ? `Use at most ${ENUM_MAX} enum values.`
        : null;

  function commitName(value: string) {
    setNameDraft(value);
    if (fieldNameError(schema, id, value) === null && value.trim() !== node.name) {
      onChange(renameNode(schema, id, value));
    }
  }

  function commitEnum(value: string) {
    setEnumText(value);
    const values = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(values));
    if (unique.length === 0) {
      onChange(setEnumValues(schema, id, []));
      return;
    }
    if (unique.length === values.length && unique.length >= ENUM_MIN && unique.length <= ENUM_MAX) {
      onChange(setEnumValues(schema, id, unique));
    }
  }

  function commitConstant() {
    try {
      const value = JSON.parse(constantText) as JsonValue;
      setConstantError(null);
      onChange(setConstant(schema, id, value));
    } catch (error) {
      setConstantError(error instanceof Error ? error.message : "Invalid JSON value.");
    }
  }

  function changeType(type: SchemaNodeType) {
    if (type === node.type) return;
    onChange(changeNodeType(schema, id, type, meta));
  }

  const isLeaf = LEAF_TYPES.includes(node.type);

  return (
    <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Selected field</h3>
          <p className="mt-1 font-mono text-[0.7rem] text-zinc-500">
            {parent ? "field" : "root"} · {node.type}
          </p>
        </div>
        {parent ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onChange(removeNode(schema, id));
              if (parent.id) onSelect(parent.id);
            }}
          >
            <Trash2Icon aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="text-zinc-300">Field name</span>
        <Input
          value={nameDraft}
          onChange={(event) => commitName(event.target.value)}
          aria-invalid={Boolean(nameError)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        {nameError ? <span className="block text-xs text-red-300">{nameError}</span> : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-zinc-300">Type</span>
        <select
          value={node.type}
          onChange={(event) => changeType(event.target.value as SchemaNodeType)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {SCHEMA_NODE_TYPES.map((type) => (
            <option key={type} value={type} className="bg-zinc-900">
              {type}
            </option>
          ))}
        </select>
      </label>

      {isLeaf ? (
        <>
          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-300">Generator</span>
            <select
              value={node.generator ?? ""}
              onChange={(event) => {
                if (event.target.value) onChange(setGenerator(schema, id, event.target.value, meta));
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={generators.length === 0}
            >
              <option value="" className="bg-zinc-900">
                {generators.length === 0 ? "No generator available" : "Choose a generator"}
              </option>
              {generators.map((generator) => (
                <option key={generator.id} value={generator.id} className="bg-zinc-900">
                  {generator.label}
                </option>
              ))}
            </select>
            {selectedGenerator?.description ? (
              <span className="block text-xs text-zinc-500">{selectedGenerator.description}</span>
            ) : null}
          </label>

          {selectedGenerator && selectedGenerator.params.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Generator parameters
              </p>
              {selectedGenerator.params.map((param) => {
                const value = node.generatorParams?.[param.name];
                if (param.type === "boolean") {
                  return (
                    <label key={param.name} className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) =>
                          onChange(setGeneratorParam(schema, id, param.name, event.target.checked))
                        }
                        className="size-4 rounded border-white/20 bg-transparent accent-lime-300"
                      />
                      <span>{param.name}</span>
                      {param.required ? <span className="text-xs text-amber-300">required</span> : null}
                    </label>
                  );
                }
                return (
                  <label key={param.name} className="block space-y-1 text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      {param.name}
                      {param.required ? <span className="text-amber-300">required</span> : null}
                    </span>
                    <Input
                      type={param.type === "number" || param.type === "integer" ? "number" : "text"}
                      step={param.type === "integer" ? 1 : "any"}
                      value={typeof value === "string" || typeof value === "number" ? value : ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === "") {
                          onChange(setGeneratorParam(schema, id, param.name, ""));
                          return;
                        }
                        const numeric = Number(raw);
                        if (!Number.isFinite(numeric)) {
                          onChange(setGeneratorParam(schema, id, param.name, raw));
                          return;
                        }
                        onChange(
                          setGeneratorParam(
                            schema,
                            id,
                            param.name,
                            param.type === "number" || param.type === "integer"
                              ? param.type === "integer"
                                ? Math.trunc(numeric)
                                : numeric
                              : raw,
                          ),
                        );
                      }}
                      aria-label={`${param.name} generator parameter`}
                    />
                    {param.description ? (
                      <span className="block text-zinc-500">{param.description}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          ) : null}

          {node.type === "string" ? (
            <div className="space-y-1.5">
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-300">
                  Enum values <span className="text-xs text-zinc-500">(one per line, {ENUM_MIN}–{ENUM_MAX})</span>
                </span>
                <textarea
                  value={enumText}
                  onChange={(event) => commitEnum(event.target.value)}
                  rows={4}
                  spellCheck={false}
                  aria-invalid={Boolean(enumError)}
                  className={cn(
                    "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    enumError && "border-red-400/60",
                  )}
                  placeholder={"admin\nmember"}
                />
              </label>
              {enumError ? (
                <p className="text-xs text-amber-300">{enumError} Not applied yet.</p>
              ) : (
                <p className="text-xs text-zinc-500">
                  {enumValues.length > 0
                    ? `${enumValues.length} value${enumValues.length === 1 ? "" : "s"} applied.`
                    : "Leave empty to generate free-form strings."}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-300">Constant value (optional)</span>
              <textarea
                value={constantText}
                onChange={(event) => setConstantText(event.target.value)}
                rows={3}
                spellCheck={false}
                aria-invalid={Boolean(constantError)}
                className={cn(
                  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  constantError && "border-red-400/60",
                )}
                placeholder={node.type === "string" ? '"fixed value"' : "42"}
              />
            </label>
            {constantError ? <p className="text-xs text-red-300">{constantError}</p> : null}
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={commitConstant}
                disabled={!constantText.trim()}
              >
                Set constant
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  setConstantText("");
                  setConstantError(null);
                  onChange(clearConstant(schema, id));
                }}
                disabled={node.constant === undefined}
              >
                Clear constant
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {node.type === "array" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs">
              <span className="text-zinc-300">Minimum length</span>
              <Input
                type="number"
                min={0}
                value={node.length?.min ?? 1}
                onChange={(event) =>
                  onChange(
                    setArrayLength(
                      schema,
                      id,
                      Number(event.target.value || 0),
                      node.length?.max ?? 10,
                    ),
                  )
                }
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-zinc-300">Maximum length</span>
              <Input
                type="number"
                min={0}
                value={node.length?.max ?? 10}
                onChange={(event) =>
                  onChange(
                    setArrayLength(
                      schema,
                      id,
                      node.length?.min ?? 1,
                      Number(event.target.value || 0),
                    ),
                  )
                }
              />
            </label>
          </div>
          {node.items ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => node.items?.id && onSelect(node.items.id)}
            >
              Edit item schema
            </Button>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                const result = addField(schema, id, meta);
                if (result) {
                  onChange(result.schema);
                  onSelect(result.id);
                }
              }}
            >
              Add item schema
            </Button>
          )}
        </div>
      ) : null}

      {node.type === "object" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              onClick={() => {
                const result = addField(schema, id, meta);
                if (result) {
                  onChange(result.schema);
                  onSelect(result.id);
                }
              }}
            >
              <PlusIcon aria-hidden="true" />
              Add field
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onChange(moveField(schema, id, -1))}
              disabled={!canMoveUp}
            >
              <ArrowUpIcon aria-hidden="true" />
              Move up
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onChange(moveField(schema, id, 1))}
              disabled={!canMoveDown}
            >
              <ArrowDownIcon aria-hidden="true" />
              Move down
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            {(node.fields ?? []).length} field{(node.fields ?? []).length === 1 ? "" : "s"}.
            The output keeps this exact order.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
        <label className="block space-y-1 text-xs">
          <span className="text-zinc-300">Null probability (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={Math.round((node.nullProbability ?? 0) * 100)}
            onChange={(event) =>
              onChange(setProbability(schema, id, "nullProbability", Number(event.target.value || 0)))
            }
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-zinc-300">Omit probability (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={Math.round((node.omitProbability ?? 0) * 100)}
            onChange={(event) =>
              onChange(setProbability(schema, id, "omitProbability", Number(event.target.value || 0)))
            }
          />
        </label>
      </div>
    </div>
  );
}
